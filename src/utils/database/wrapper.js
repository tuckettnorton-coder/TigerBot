import { pgDb } from '../postgresDatabase.js';
import { MemoryStorage } from '../memoryStorage.js';
import { logger } from '../logger.js';
import path from 'node:path';
import { validateGuildConfigOrThrow } from '../schemas.js';

class DatabaseWrapper {
    constructor() {
        this.initialized = false;
        this.db = null;
        this.useFallback = false;
        this.connectionType = 'none';
        this.degradedModeWarningShown = false;
        this.degradedReason = null;
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        // Hosts without a PostgreSQL add-on can use local file-backed storage.
        // Set TIGERBOT_STORAGE_FILE for an explicit file path, or TIGERBOT_DATA_DIR
        // / DATA_DIR for a persistent host volume. The file is not shared across
        // separate machines or independent containers.
        const localStoragePath = process.env.TIGERBOT_STORAGE_FILE
            || path.join(
                process.env.TIGERBOT_DATA_DIR || process.env.DATA_DIR || path.join(process.cwd(), 'data'),
                'tigerbot-memory.json',
            );
        const initializeLocalStorage = async (reason) => {
            this.db = new MemoryStorage({ filePath: localStoragePath });
            await this.db.initialize();
            this.useFallback = true;
            this.connectionType = 'memory';
            this.degradedReason = reason;
            this.initialized = true;
            this.degradedModeWarningShown = true;
            logger.warn(`⚠️ Using local file-backed fallback storage at ${localStoragePath}. This does not require PostgreSQL, but is not shared across separate hosts.`);
        };

        // Explicit no-PostgreSQL mode for hosts without a database add-on.
        if (process.env.ALLOW_IN_MEMORY_DB === 'true') {
            logger.info('ALLOW_IN_MEMORY_DB=true: skipping PostgreSQL connection and using local file storage.');
            await initializeLocalStorage('IN_MEMORY_MODE_ENABLED');
            return;
        }

        try {
            logger.info('Attempting to connect to PostgreSQL...');
            const pgConnected = await pgDb.connect();
            if (pgConnected) {
                this.db = pgDb;
                this.connectionType = 'postgresql';
                this.degradedReason = null;
                logger.info('✅ PostgreSQL Database initialized - using persistent database');
                this.initialized = true;
                return;
            }

            const pgFailure = pgDb.getLastFailure?.();
            if (pgFailure?.reason === 'SCHEMA_VERSION_MISMATCH') {
                const schemaError = new Error(
                    `Schema version mismatch detected (${pgFailure.message}). Run migrations before startup.`,
                );
                schemaError.code = 'SCHEMA_VERSION_MISMATCH';
                throw schemaError;
            }
        } catch (error) {
            logger.warn('PostgreSQL connection failed:', error.message);

            if (error.code === 'SCHEMA_VERSION_MISMATCH') {
                throw error;
            }
        }

        await initializeLocalStorage('POSTGRES_UNAVAILABLE');
        logger.warn('PostgreSQL is unavailable; TigerBot will use local file-backed storage instead.');
    }

    async set(key, value, ttl = null) {
        if (this.useFallback) {
            logger.debug(`[LOCAL FALLBACK] Writing to file-backed storage: ${key}`);
        }

        if (typeof key === 'string' && /^guild:[^:]+:config$/.test(key)) {
            const guildId = key.split(':')[1];
            validateGuildConfigOrThrow(value, {
                guildId,
                errorCode: 'VALIDATION_FAILED',
            });
        }

        return this.db.set(key, value, ttl);
    }

    async get(key, defaultValue = null) {
        return this.db.get(key, defaultValue);
    }

    async delete(key) {
        if (this.useFallback) {
            logger.debug(`[LOCAL FALLBACK] Deleting from file-backed storage: ${key}`);
        }
        return this.db.delete(key);
    }

    async list(prefix) {
        return this.db.list(prefix);
    }

    async exists(key) {
        if (this.db.exists) {
            return this.db.exists(key);
        }
        const value = await this.db.get(key);
        return value !== null;
    }

    async increment(key, amount = 1) {
        if (this.useFallback) {
            logger.debug(`[LOCAL FALLBACK] Incrementing file-backed storage: ${key}`);
        }
        if (this.db.increment) {
            return this.db.increment(key, amount);
        }
        const current = await this.db.get(key, 0);
        const newValue = current + amount;
        await this.db.set(key, newValue);
        return newValue;
    }

    async decrement(key, amount = 1) {
        if (this.useFallback) {
            logger.debug(`[LOCAL FALLBACK] Decrementing file-backed storage: ${key}`);
        }
        if (this.db.decrement) {
            return this.db.decrement(key, amount);
        }
        const current = await this.db.get(key, 0);
        const newValue = current - amount;
        await this.db.set(key, newValue);
        return newValue;
    }

    isDegraded() {
        return this.useFallback;
    }

    isAvailable() {
        return this.db && !this.useFallback;
    }

    getStatus() {
        const localFileBacked = Boolean(this.useFallback && this.db?.filePath);
        return {
            initialized: this.initialized,
            connectionType: this.connectionType,
            isDegraded: this.useFallback,
            isAvailable: this.isAvailable(),
            // Local JSON storage is persistent on this host's filesystem, but
            // is not shared between separate hosts or containers.
            isPersistent: !this.useFallback || localFileBacked,
            localFileBacked,
            degradedReason: this.degradedReason,
        };
    }

    getConnectionType() {
        return this.connectionType;
    }
}

export const db = new DatabaseWrapper();

export async function initializeDatabase() {
    try {
        logger.info('Initializing Database (PostgreSQL > Memory fallback)...');
        await db.initialize();
        logger.info('✅ Database initialized');
        return { db };
    } catch (error) {
        logger.error('❌ Database Initialization Error:', error);

        // Do not continue with an uninitialized wrapper if neither PostgreSQL
        // nor the local file-backed fallback could be opened.
        throw error;
    }
}

export async function getFromDb(key, defaultValue = null) {
    try {
        const value = await db.get(key);
        return value === null ? defaultValue : value;
    } catch (error) {
        logger.error(`Error getting value for key ${key}:`, error);
        return defaultValue;
    }
}

export async function setInDb(key, value, ttl = null) {
    try {
        await db.set(key, value, ttl);
        return true;
    } catch (error) {
        logger.error(`Error setting value for key ${key}:`, error);
        return false;
    }
}

export async function deleteFromDb(key) {
    try {
        await db.delete(key);
        return true;
    } catch (error) {
        logger.error(`Error deleting key ${key}:`, error);
        return false;
    }
}
