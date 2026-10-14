import { pgDb } from './postgresDatabase.js';
import { logger } from './logger.js';

// A session-level PostgreSQL advisory lock shared by every TigerBot deployment
// pointed at the same database. Only one process may own the Discord gateway.
const INSTANCE_LOCK_KEY = 'tuckettnorton-coder/TigerBot:single-discord-instance';
let lockConnection = null;

export async function acquireBotInstanceLock() {
  if (lockConnection) return true;

  if (!pgDb?.pool || !pgDb.isConnected) {
    throw new Error('PostgreSQL is not connected; the cross-host single-instance lock cannot be acquired.');
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
  const connection = lockConnection;
  lockConnection = null;
  if (!connection) return;

  try {
    await connection.query(
      'SELECT pg_advisory_unlock(hashtextextended($1::text, 0::bigint))',
      [INSTANCE_LOCK_KEY],
    );
  } catch (error) {
    logger.warn('Could not explicitly release the TigerBot single-instance lock:', error?.message || error);
  } finally {
    connection.release();
  }
}
