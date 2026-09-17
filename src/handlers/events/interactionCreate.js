import { Events, MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import {
  getBotMessage,
  isBotOwner,
  isCommandCategoryEnabled,
  isMaintenanceMode,
} from '../config/bot.js';
import botConfig from '../config/bot.js';
import { handleApplicationModal } from '../commands/Community/apply.js';
import { handleInteractionError, createError, ErrorTypes, ErrorCodes } from '../utils/errorHandler.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { createInteractionTraceContext, runWithTraceContext } from '../utils/logger.js';
import { validateChatInputPayloadOrThrow } from '../utils/commandInputValidation.js';
import { enforceAbuseProtection, formatCooldownDuration } from '../utils/abuseProtection.js';
import { isCommandEnabled } from '../services/commandAccessService.js';
import { resolveSlashAccessKey } from '../utils/messageAdapter.js';
import { isCollectorManagedComponent } from '../utils/collectorComponents.js';
import { ResponseCoordinator } from '../utils/responseCoordinator.js';
import { enforceDefaultCommandPermissions } from '../utils/permissionGuard.js';

const COMMAND_ERROR_SUBTYPES = {
  warn: 'warn_failed', kick: 'kick_failed', ban: 'ban_failed', unban: 'unban_failed',
  timeout: 'timeout_failed', untimeout: 'untimeout_failed', warnings: 'warnings_view_failed',
  ticket: 'ticket_failed', serverstats: 'serverstats_failed', gcreate: 'giveaway_failed',
  gend: 'giveaway_failed', gdelete: 'giveaway_failed', greroll: 'giveaway_failed',
};

function withTraceContext(context = {}, traceContext = {}) {
  return { traceId: traceContext.traceId, guildId: context.guildId || traceContext.guildId,
    userId: context.userId || traceContext.userId, command: context.commandName || traceContext.command, ...context };
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    const interactionTraceContext = createInteractionTraceContext(interaction);
    interaction.traceContext = interactionTraceContext;
    interaction.traceId = interactionTraceContext.traceId;

    return runWithTraceContext(interactionTraceContext, async () => {
      try {
        InteractionHelper.patchInteractionResponses(interaction);
        ResponseCoordinator.attach(interaction);

        if (interaction.isChatInputCommand()) {
          try {
            logger.info(`Command executed: /${interaction.commandName} by ${interaction.user.tag}`);
            validateChatInputPayloadOrThrow(interaction, withTraceContext({ type: 'command_input_validation', commandName: interaction.commandName }, interactionTraceContext));
            const command = client.commands.get(interaction.commandName);
            if (!command) throw createError(`No command matching ${interaction.commandName} was found.`, ErrorTypes.CONFIGURATION, 'Sorry, that command does not exist.');
            if (isMaintenanceMode() && !isBotOwner(interaction.user.id)) throw createError('Bot is in maintenance mode', ErrorTypes.CONFIGURATION, getBotMessage('maintenanceMode'));
            if (!isCommandCategoryEnabled(command.category)) throw createError(`Feature disabled for category ${command.category}`, ErrorTypes.CONFIGURATION, getBotMessage('commandDisabled'));
            const defaultCooldownSec = Number(botConfig.commands?.defaultCooldown) || 0;
            if (defaultCooldownSec > 0 && !isBotOwner(interaction.user.id)) {
              const cooldownKey = `${interaction.user.id}:${interaction.commandName}`;
              const expiresAt = client.cooldowns.get(cooldownKey);
              if (expiresAt && Date.now() < expiresAt) throw createError(`Default command cooldown active for ${interaction.commandName}`, ErrorTypes.RATE_LIMIT, getBotMessage('cooldownActive', { time: `${Math.ceil((expiresAt - Date.now()) / 1000)}s` }));
              client.cooldowns.set(cooldownKey, Date.now() + defaultCooldownSec * 1000);
            }
            const abuseProtection = await enforceAbuseProtection(interaction, command, interaction.commandName);
            if (!abuseProtection.allowed) throw createError(`Risky command cooldown active for ${interaction.commandName}`, ErrorTypes.RATE_LIMIT, `This command is on cooldown. Please wait ${formatCooldownDuration(abuseProtection.remainingMs)} before trying again.`);
            let guildConfig = null;
            if (interaction.guild) {
              guildConfig = await getGuildConfig(client, interaction.guild.id, interactionTraceContext);
              const accessKey = resolveSlashAccessKey(interaction);
              if (!(await isCommandEnabled(client, interaction.guild.id, accessKey, command.category))) throw createError(`Command ${accessKey} is disabled in this guild`, ErrorTypes.CONFIGURATION, 'This command has been disabled for this server.');
            }
            if (!await enforceDefaultCommandPermissions(interaction, command, { source: 'interactionCreate', guildConfig })) return;
            await command.execute(interaction, guildConfig, client);
          } catch (error) {
            await handleInteractionError(interaction, error, withTraceContext({ type: 'command', commandName: interaction.commandName, subtype: COMMAND_ERROR_SUBTYPES[interaction.commandName] || error?.context?.subtype }, interactionTraceContext));
          }
        } else if (interaction.isAutocomplete()) {
          const autocompleteCommand = client.commands.get(interaction.commandName);
          if (autocompleteCommand?.autocomplete) { try { await autocompleteCommand.autocomplete(interaction, client); } catch { await interaction.respond([]).catch(() => {}); } return; }
          return;
        } else if (interaction.isButton()) {
          if (interaction.customId.startsWith('shared_todo_')) return;
          const [customId, ...args] = interaction.customId.split(':');
          const button = client.buttons.get(customId);
          if (!button) return;
          try { await button.execute(interaction, client, args); }
          catch (error) { await handleInteractionError(interaction, error, withTraceContext({ type: 'button', customId }, interactionTraceContext)); }
        } else if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isMentionableSelectMenu()) {
          const [customId, ...args] = interaction.customId.split(':');
          const selectMenu = client.selectMenus.get(customId);
          if (!selectMenu) return;
          try { await selectMenu.execute(interaction, client, args); }
          catch (error) { await handleInteractionError(interaction, error, withTraceContext({ type: 'select_menu', customId }, interactionTraceContext)); }
        } else if (interaction.isModalSubmit()) {
          if (interaction.customId.startsWith('app_modal_')) { try { await handleApplicationModal(interaction); } catch (error) { await handleInteractionError(interaction, error, withTraceContext({ type: 'modal', customId: interaction.customId }, interactionTraceContext)); } return; }
          const [customId, ...args] = interaction.customId.split(':');
          const modal = client.modals.get(customId);
          if (!modal) return;
          try { await modal.execute(interaction, client, args); }
          catch (error) { await handleInteractionError(interaction, error, withTraceContext({ type: 'modal', customId }, interactionTraceContext)); }
        }
      } catch (error) {
        logger.error('Unhandled error in interactionCreate:', { event: 'interaction.unhandled_error', errorCode: ErrorCodes.INTERACTION_UNHANDLED, error, traceId: interactionTraceContext.traceId, interactionId: interaction.id, guildId: interaction.guildId, userId: interaction.user?.id });
        await handleInteractionError(interaction, error, withTraceContext({ type: 'interaction' }, interactionTraceContext)).catch(() => {});
      }
    });
  },
};
