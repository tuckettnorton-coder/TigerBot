import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Collection } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { botConfig } from '../../config/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAX_COMMANDS = 100;
const COMMAND_COUNT_WARN_THRESHOLD = 90;
const PRIORITY_COMMANDS = ['panel', 'updatepanel'];
const MAX_DESCRIPTION_LENGTH = 100;

function sanitizeCommandPayload(command) {
    const copy = JSON.parse(JSON.stringify(command));
    const sanitizeOption = (option) => {
        if (typeof option.description === 'string') option.description = option.description.slice(0, MAX_DESCRIPTION_LENGTH);
        if (Array.isArray(option.options)) option.options.forEach(sanitizeOption);
        return option;
    };
    if (typeof copy.description === 'string') copy.description = copy.description.slice(0, MAX_DESCRIPTION_LENGTH);
    if (Array.isArray(copy.options)) copy.options.forEach(sanitizeOption);
    return copy;
}

function getSubcommandInfo(commandData) {
    const subcommands = [];
    
    if (commandData.options) {
        for (const option of commandData.options) {
            if (option.type === 1) {
                subcommands.push(option.name);
            } else if (option.type === 2) {
                if (option.options) {
                    for (const subOption of option.options) {
                        if (subOption.type === 1) {
                            subcommands.push(`${option.name}/${subOption.name}`);
                        }
                    }
                }
            }
        }
    }
    
    return subcommands;
}

async function getAllFiles(directory, fileList = []) {
    const files = await fs.readdir(directory, { withFileTypes: true });
    
    for (const file of files) {
        const filePath = path.join(directory, file.name);
        
        if (file.isDirectory()) {
            if (file.name === 'modules') {
                continue;
            }
            await getAllFiles(filePath, fileList);
        } else if (file.name.endsWith('.js')) {
            fileList.push(filePath);
        }
    }
    
    return fileList;
}

export async function loadCommands(client) {
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, '../../commands');
    const commandFiles = await getAllFiles(commandsPath);
    
    logger.info(`Found ${commandFiles.length} command files to load`);
    
    const uniqueCommandNames = new Set();
    
    for (const filePath of commandFiles) {
        try {
            const normalizedPath = filePath.replace(/\\/g, '/');
            const commandDir = path.dirname(filePath);
            const category = path.basename(commandDir);
            const commandModule = await import(`file://${filePath}`);
            const command = commandModule.default || commandModule;
            
            if (!command.data || !command.execute) {
                logger.warn(`Command at ${filePath} is missing required "data" or "execute" property.`);
                continue;
            }
            
            command.category = category;
            command.filePath = normalizedPath;
            const primaryCommandName = command.data.name;
            
            if (!uniqueCommandNames.has(primaryCommandName)) {
                uniqueCommandNames.add(primaryCommandName);
                client.commands.set(primaryCommandName, command);
            }
            
            const subcommands = getSubcommandInfo(command.data.toJSON());
            logger.info(`Loaded command: ${primaryCommandName} from ${normalizedPath} (category: ${category})`);
            
            if (subcommands.length > 0) {
                logger.info(`  - Subcommands: ${subcommands.join(', ')}`);
            }
        } catch (error) {
            logger.error(`Error loading command from ${filePath}:`, error);
        }
    }
    
    const uniqueCommands = new Set();
    for (const [name, command] of client.commands.entries()) {
        if (command.data && command.data.name) uniqueCommands.add(command.data.name);
    }
    
    logger.info(`Loaded ${uniqueCommands.size} commands`);
    return client.commands;
}

function collectCommandPayloads(client) {
    const commands = [];
    let totalSubcommands = 0;
    const registeredNames = new Set();

    for (const command of client.commands.values()) {
        if (!command.data || typeof command.data.toJSON !== 'function') {
            logger.warn(`Command missing data or toJSON method: ${command}`);
            continue;
        }

        const commandName = command.data.name;
        if (registeredNames.has(commandName)) continue;

        registeredNames.add(commandName);
        const commandJson = command.data.toJSON();
        commands.push(commandJson);
        totalSubcommands += getSubcommandInfo(commandJson).length;
    }

    return { commands, totalSubcommands };
}

function validateCommands(commands) {
    const validationErrors = [];

    for (const cmd of commands) {
        if (cmd.name && cmd.name.length > 32) validationErrors.push(`Command ${cmd.name} has name longer than 32 chars`);
        if (cmd.description && cmd.description.length > MAX_DESCRIPTION_LENGTH) validationErrors.push(`Command ${cmd.name} has description longer than ${MAX_DESCRIPTION_LENGTH} chars`);

        if (!cmd.options) continue;

        for (const option of cmd.options) {
            if (option.name && option.name.length > 32) validationErrors.push(`Command ${cmd.name} option ${option.name} has name longer than 32 chars`);
            if (option.description && option.description.length > MAX_DESCRIPTION_LENGTH) validationErrors.push(`Command ${cmd.name} option ${option.name} has description longer than ${MAX_DESCRIPTION_LENGTH} chars`);
            if (!option.options) continue;

            for (const subOption of option.options) {
                if (subOption.name && subOption.name.length > 32) validationErrors.push(`Command ${cmd.name} subcommand ${option.name} option ${subOption.name} has name longer than 32 chars`);
                if (subOption.description && subOption.description.length > MAX_DESCRIPTION_LENGTH) validationErrors.push(`Command ${cmd.name} subcommand ${option.name} option ${subOption.name} has description longer than ${MAX_DESCRIPTION_LENGTH} chars`);
            }
        }
    }

    if (validationErrors.length > 0) {
        logger.error('Command validation failed. Errors:');
        validationErrors.forEach(error => logger.error(`  - ${error}`));
        throw new Error(`Command validation failed with ${validationErrors.length} errors`);
    }
}

function prepareCommandsForRegistration(commands) {
    if (commands.length >= COMMAND_COUNT_WARN_THRESHOLD) {
        logger.warn(`Command count (${commands.length}) is near Discord's ${MAX_COMMANDS} global command limit`);
    }

    if (commands.length <= MAX_COMMANDS) return commands;

    const priority = commands.filter(command => PRIORITY_COMMANDS.includes(command.name));
    const regular = commands.filter(command => !PRIORITY_COMMANDS.includes(command.name));
    return [...priority, ...regular].slice(0, MAX_COMMANDS);
}

async function registerGlobalCommands(client, clientId, commands, totalSubcommands) {
    if (!client.isReady()) throw new Error('Discord client must be ready before slash-command registration.');
    
    logger.info(`Preparing to register ${totalSubcommands + commands.length} commands`);
    validateCommands(commands);

    const commandsToRegister = prepareCommandsForRegistration(commands).map(sanitizeCommandPayload);
    const panelPayload = commandsToRegister.find((command) => command.name === 'panel');

    if (!panelPayload) {
        throw new Error('The /panel command was not included in the registration payload.');
    }

    const panelSubcommands = (panelPayload.options || [])
        .filter((option) => option.type === 1)
        .map((option) => option.name);

    const requiredPanelSubcommands = ['post', 'staff', 'pm', 'builder'];
    const missingPanelSubcommands = requiredPanelSubcommands.filter(
        (name) => !panelSubcommands.includes(name),
    );

    if (missingPanelSubcommands.length) {
        throw new Error(
            `The /panel registration payload is missing: ${missingPanelSubcommands.join(', ')}`,
        );
    }

    logger.info(
        `Slash command payload verified: ${commandsToRegister.length} commands; /panel = ${panelSubcommands.join(', ')}`,
    );

    // Use discord.js's guild command manager directly. This uses the authenticated
    // Discord client and avoids relying on a separate CLIENT_ID value for registration.
    // Guild commands appear immediately in the server.
    for (const guild of client.guilds.cache.values()) {
        try {
            const registered = await guild.commands.set(commandsToRegister);

            const panel = registered.find((command) => command.name === 'panel');
            if (!panel) {
                throw new Error('Discord did not return the /panel command after registration.');
            }

            const registeredSubcommands = (panel.options || [])
                .filter((option) => option.type === 1)
                .map((option) => option.name);

            const missing = requiredPanelSubcommands.filter(
                (name) => !registeredSubcommands.includes(name),
            );

            if (missing.length > 0) {
                throw new Error(
                    `/panel is missing subcommands: ${missing.join(', ')}`,
                );
            }

            logger.info(
                `Registered and verified /panel in guild ${guild.id}: ${registeredSubcommands.join(', ')}`,
            );
        } catch (error) {
            logger.error(
                `Failed to register/verify commands in guild ${guild.id}: ${error.message}`,
            );
            throw error;
        }
    }
}
export async function registerCommands(client, options = {}) {
    const { clientId = null } = options;

    try {
        const { commands, totalSubcommands } = collectCommandPayloads(client);
        await registerGlobalCommands(client, clientId, commands, totalSubcommands);
    } catch (error) {
        logger.error('Error registering commands:', error);
        throw error;
    }
}

export async function reloadCommand(client, commandName) {
    const command = client.commands.get(commandName);
    
    if (!command) return { success: false, message: `Command "${commandName}" not found` };
    
    try {
        const commandPath = path.resolve(command.filePath);
        const moduleUrl = pathToFileURL(commandPath);
        moduleUrl.searchParams.set('t', Date.now().toString());
        const newCommand = (await import(moduleUrl.href)).default;
        client.commands.set(commandName, newCommand);
        logger.info(`Reloaded command: ${commandName}`);
        return { success: true, message: `Successfully reloaded command "${commandName}"` };
    } catch (error) {
        logger.error(`Error reloading command "${commandName}":`, error);
        return { success: false, message: `Error reloading command: ${error.message}` };
    }
}