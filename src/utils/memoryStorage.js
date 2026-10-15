// memoryStorage.js
// Optional file-backed fallback for hosts where PostgreSQL is not available.
// The existing in-memory API remains unchanged; file persistence is local to
// the host filesystem and is not a shared database across separate machines.

import { logger } from './logger.js';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

class MemoryStorage {
    constructor({ filePath = null } = {}) {
        this.data = new Map();
        this.expirationTimes = new Map();
        this.filePath = filePath;
        this.writeQueue = Promise.resolve();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return this;
        if (!this.filePath) {
            this.initialized = true;
            return this;
        }

        try {
            const raw = await readFile(this.filePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed?.version !== 1 || !Array.isArray(parsed.data)) {
                throw new Error('Unsupported or invalid TigerBot local storage file format.');
            }
            this.data = new Map(parsed.data);
            this.expirationTimes = new Map(
                Array.isArray(parsed.expirationTimes) ? parsed.expirationTimes : []
            );
            logger.info(`Loaded ${this.data.size} keys from local fallback storage: ${this.filePath}`);
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                // Preserve a damaged file for recovery rather than silently
                // overwriting it with an empty database.
                if (error instanceof SyntaxError || error.message?.includes('invalid TigerBot local storage')) {
                    const backupPath = `${this.filePath}.corrupt-${Date.now()}`;
                    await rename(this.filePath, backupPath).catch(() => null);
                    logger.error(`Local fallback storage was invalid; preserved it at ${backupPath}. Starting with empty local storage.`);
                } else {
                    throw error;
                }
            } else {
                logger.info(`Creating local fallback storage file at ${this.filePath}`);
            }
        }

        this.initialized = true;
        // Persist a valid initial snapshot immediately so the directory/file is
        // created before giveaway schedules are accepted.
        await this.persist();
        return this;
    }

    async persist() {
        if (!this.filePath) return true;

        const snapshot = JSON.stringify({
            version: 1,
            data: [...this.data.entries()],
            expirationTimes: [...this.expirationTimes.entries()],
        });

        const write = this.writeQueue.then(async () => {
            await mkdir(dirname(this.filePath), { recursive: true });
            const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
            await writeFile(temporaryPath, snapshot, 'utf8');
            await rename(temporaryPath, this.filePath);
            return true;
        });

        // A failed write is returned to the caller, while keeping later writes
        // able to proceed instead of leaving a permanently rejected queue.
        this.writeQueue = write.catch(() => null);
        return write;
    }

    async get(key, defaultValue = null) {
        await this.initialize();
        const value = this.data.get(key);

        if (this.expirationTimes.has(key)) {
            const expirationTime = this.expirationTimes.get(key);
            if (Date.now() > expirationTime) {
                this.data.delete(key);
                this.expirationTimes.delete(key);
                await this.persist();
                return defaultValue;
            }
        }

        return value !== undefined ? value : defaultValue;
    }

    async set(key, value, ttl = null) {
        await this.initialize();
        this.data.set(key, value);

        if (ttl && ttl > 0) {
            this.expirationTimes.set(key, Date.now() + (ttl * 1000));
        } else {
            this.expirationTimes.delete(key);
        }

        await this.persist();
        return true;
    }

    async delete(key) {
        await this.initialize();
        this.data.delete(key);
        this.expirationTimes.delete(key);
        await this.persist();
        return true;
    }

    async list(prefix) {
        await this.initialize();
        const keys = [];
        let expiredAny = false;

        for (const key of this.data.keys()) {
            if (!key.startsWith(prefix)) continue;

            if (this.expirationTimes.has(key)) {
                const expirationTime = this.expirationTimes.get(key);
                if (Date.now() > expirationTime) {
                    this.data.delete(key);
                    this.expirationTimes.delete(key);
                    expiredAny = true;
                    continue;
                }
            }
            keys.push(key);
        }

        if (expiredAny) await this.persist();
        return keys;
    }

    async exists(key) {
        await this.initialize();
        const value = this.data.get(key);

        if (this.expirationTimes.has(key)) {
            const expirationTime = this.expirationTimes.get(key);
            if (Date.now() > expirationTime) {
                this.data.delete(key);
                this.expirationTimes.delete(key);
                await this.persist();
                return false;
            }
        }

        return value !== undefined;
    }

    async increment(key, amount = 1) {
        const current = await this.get(key, 0);
        const newValue = current + amount;
        await this.set(key, newValue);
        return newValue;
    }

    async decrement(key, amount = 1) {
        const current = await this.get(key, 0);
        const newValue = current - amount;
        await this.set(key, newValue);
        return newValue;
    }

    async clear() {
        await this.initialize();
        this.data.clear();
        this.expirationTimes.clear();
        await this.persist();
        return true;
    }
}

export { MemoryStorage };
