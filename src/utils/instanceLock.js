import { pgDb } from './postgresDatabase.js';
import { logger } from './logger.js';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// A database advisory lock is preferred when PostgreSQL is available. If the
// host is running without PostgreSQL, use a heartbeat lock file beside the
// local storage file so two processes on the same host cannot run giveaways
// against separate in-memory snapshots at the same time.
const INSTANCE_LOCK_KEY = 'tuckettnorton-coder/TigerBot:single-discord-instance';
const LOCAL_LOCK_STALE_MS = 120_000;
let lockConnection = null;
let localLockHandle = null;
let localLockPath = null;
let localLockHeartbeat = null;

function getLocalDataDirectory() {
  if (process.env.TIGERBOT_DATA_DIR || process.env.DATA_DIR) {
    return path.resolve(process.env.TIGERBOT_DATA_DIR || process.env.DATA_DIR);
  }
  if (process.env.TIGERBOT_STORAGE_FILE) {
    return path.dirname(path.resolve(process.env.TIGERBOT_STORAGE_FILE));
  }
  return path.join(process.cwd(), 'data');
}

async function acquireLocalFileLock() {
  const hostname = os.hostname();
  const lockPath = process.env.TIGERBOT_INSTANCE_LOCK_FILE
    ? path.resolve(process.env.TIGERBOT_INSTANCE_LOCK_FILE)
    : path.join(getLocalDataDirectory(), 'tigerbot-instance.lock');

  await mkdir(path.dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx');
      localLockHandle = handle;
      localLockPath = lockPath;

      const writeHeartbeat = async () => {
        const record = {
          pid: process.pid,
          hostname,
          heartbeatAt: Date.now(),
        };
        await handle.truncate(0);
        await handle.writeFile(JSON.stringify(record), 'utf8');
        await handle.sync();
      };

      await writeHeartbeat();
      localLockHeartbeat = setInterval(async () => {
        try {
          const record = JSON.parse(await readFile(lockPath, 'utf8'));
          if (record.pid !== process.pid || record.hostname !== hostname) {
            clearInterval(localLockHeartbeat);
            localLockHeartbeat = null;
            return;
          }
          await writeHeartbeat();
        } catch (error) {
          logger.warn('Could not refresh TigerBot local instance lock:', error?.message || error);
        }
      }, 30_000);
      localLockHeartbeat.unref?.();

      logger.info(`Acquired local single-instance lock: ${lockPath}`);
      return true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;

      let record = null;
      try {
        record = JSON.parse(await readFile(lockPath, 'utf8'));
      } catch {
        // A just-created lock file may briefly be empty before its owner writes.
        return false;
      }

      const recentHeartbeat = Number.isFinite(Number(record.heartbeatAt))
        && Date.now() - Number(record.heartbeatAt) <= LOCAL_LOCK_STALE_MS;
      let processAlive = false;
      if (record.hostname === hostname && Number.isInteger(Number(record.pid))) {
        try {
          process.kill(Number(record.pid), 0);
          processAlive = true;
        } catch (processError) {
          processAlive = processError?.code === 'EPERM';
        }
      }

      if (processAlive || recentHeartbeat) {
        logger.error(
          `A different TigerBot process already holds the local instance lock (${record.hostname || 'unknown host'} / PID ${record.pid || 'unknown'}). Stop the other process before starting another copy.`
        );
        return false;
      }

      // Only remove a lock whose owning process is gone or whose heartbeat is
      // stale. The heartbeat prevents a second process from stealing a live lock.
      await unlink(lockPath).catch(unlinkError => {
        if (unlinkError?.code !== 'ENOENT') throw unlinkError;
      });
    }
  }

  return false;
}

export async function acquireBotInstanceLock() {
  if (lockConnection || localLockHandle) return true;

  if (!pgDb?.pool || !pgDb.isConnected) {
    return await acquireLocalFileLock();
  }

  const connection = await pgDb.pool.connect();

  try {
    const result = await connection.query(
      'SELECT pg_try_advisory_lock(hashtextextended($1::text, 0::bigint)) AS acquired',
      [INSTANCE_LOCK_KEY],
    );

    if (result.rows[0]?.acquired !== true) {
      connection.release();
      return false;
    }

    // Keep this connection checked out for the bot's entire lifetime. The lock
    // is automatically released by PostgreSQL if this process or connection dies.
    lockConnection = connection;
    return true;
  } catch (error) {
    connection.release();
    throw error;
  }
}

export async function releaseBotInstanceLock() {
  if (lockConnection) {
    const connection = lockConnection;
    lockConnection = null;

    try {
      await connection.query(
        'SELECT pg_advisory_unlock(hashtextextended($1::text, 0::bigint))',
        [INSTANCE_LOCK_KEY],
      );
    } catch (error) {
      logger.warn('Could not explicitly release the TigerBot PostgreSQL instance lock:', error?.message || error);
    } finally {
      connection.release();
    }
    return;
  }

  if (localLockHeartbeat) {
    clearInterval(localLockHeartbeat);
    localLockHeartbeat = null;
  }

  const handle = localLockHandle;
  const lockPath = localLockPath;
  localLockHandle = null;
  localLockPath = null;

  try {
    if (lockPath) {
      const record = JSON.parse(await readFile(lockPath, 'utf8'));
      if (record.pid === process.pid && record.hostname === os.hostname()) {
        await unlink(lockPath).catch(error => {
          if (error?.code !== 'ENOENT') throw error;
        });
      }
    }
  } catch (error) {
    logger.warn('Could not remove TigerBot local instance lock:', error?.message || error);
  } finally {
    await handle?.close().catch(() => null);
  }
}
