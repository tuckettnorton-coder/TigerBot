import 'dotenv/config';

const modules = [
  './config/application.js',
  './utils/database.js',
  './services/config/guildConfig.js',
  './services/serverstatsService.js',
  './utils/logger.js',
  './services/birthdayService.js',
  './handlers/loaders/commandLoader.js',
  './utils/errorHandler.js',
  './services/music/riffySetup.js',
  './services/music/playerHandler.js',
  './config/database/schemaVersion.js',
  'discord.js',
  '@discordjs/rest',
  'express',
  'node-cron'
];

console.log('[BOOT DIAGNOSTIC] Starting import-by-import test...');

for (const modulePath of modules) {
  try {
    await import(modulePath);
    console.log('[BOOT DIAGNOSTIC] OK:', modulePath);
  } catch (error) {
    console.error('[BOOT DIAGNOSTIC] FAILED:', modulePath);
    console.error(error?.stack || error);
    process.exit(1);
  }
}

console.log('[BOOT DIAGNOSTIC] ALL IMPORTS PASSED.');
process.exit(0);
