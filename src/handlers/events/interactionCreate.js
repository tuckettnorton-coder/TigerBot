import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getBotMessage, isBotOwner, isCommandCategoryEnabled, isMaintenanceMode } from '../config/bot.js';
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
import { addTicketUser } from '../services/ticketParticipantService.js';
import { TICKET_TYPES } from '../config/ticketTypes.js';
import { getTicketFromChannel, isStaffForTicket } from '../services/ticketService.js';

const COMMAND_ERROR_SUBTYPES = { warn:'warn_failed',kick:'kick_failed',ban:'ban_failed',unban:'unban_failed',timeout:'timeout_failed',untimeout:'untimeout_failed',warnings:'warnings_view_failed',ticket:'ticket_failed',serverstats:'serverstats_failed',gcreate:'giveaway_failed',gend:'giveaway_failed',gdelete:'giveaway_failed',greroll:'giveaway_failed' };
function withTraceContext(context={}, traceContext={}) { return { traceId:traceContext.traceId,guildId:context.guildId||traceContext.guildId,userId:context.userId||traceContext.userId,command:context.commandName||traceContext.command,...context }; }
export default { name:Events.InteractionCreate, async execute(interaction,client) {
 const tc=createInteractionTraceContext(interaction); interaction.traceContext=tc; interaction.traceId=tc.traceId;
 return runWithTraceContext(tc,async()=>{ try {
  InteractionHelper.patchInteractionResponses(interaction); ResponseCoordinator.attach(interaction);
  if(interaction.isChatInputCommand()){ try { validateChatInputPayloadOrThrow(interaction,withTraceContext({type:'command_input_validation',commandName:interaction.commandName},tc)); const command=client.commands.get(interaction.commandName); if(!command) throw createError(`No command matching ${interaction.commandName} was found.`,ErrorTypes.CONFIGURATION,'Sorry, that command does not exist.'); if(isMaintenanceMode()&&!isBotOwner(interaction.user.id)) throw createError('Bot is in maintenance mode',ErrorTypes.CONFIGURATION,getBotMessage('maintenanceMode')); if(!isCommandCategoryEnabled(command.category)) throw createError(`Feature disabled for category ${command.category}`,ErrorTypes.CONFIGURATION,getBotMessage('commandDisabled')); const sec=Number(botConfig.commands?.defaultCooldown)||0; if(sec&&!isBotOwner(interaction.user.id)){const key=`${interaction.user.id}:${interaction.commandName}`,exp=client.cooldowns.get(key); if(exp&&Date.now()<exp) throw createError('Cooldown',ErrorTypes.RATE_LIMIT,getBotMessage('cooldownActive',{time:`${Math.ceil((exp-Date.now())/1000)}s`})); client.cooldowns.set(key,Date.now()+sec*1000);} const abuse=await enforceAbuseProtection(interaction,command,interaction.commandName); if(!abuse.allowed) throw createError('Risky command cooldown',ErrorTypes.RATE_LIMIT,`This command is on cooldown. Please wait ${formatCooldownDuration(abuse.remainingMs)} before trying again.`); let guildConfig=null; if(interaction.guild){guildConfig=await getGuildConfig(client,interaction.guild.id,tc); const key=resolveSlashAccessKey(interaction); if(!(await isCommandEnabled(client,interaction.guild.id,key,command.category))) throw createError('Command disabled',ErrorTypes.CONFIGURATION,'This command has been disabled for this server.');} if(!await enforceDefaultCommandPermissions(interaction,command,{source:'interactionCreate',guildConfig})) return; await command.execute(interaction,guildConfig,client); } catch(error){await handleInteractionError(interaction,error,withTraceContext({type:'command',commandName:interaction.commandName,subtype:COMMAND_ERROR_SUBTYPES[interaction.commandName]||error?.context?.subtype},tc));}
  } else if(interaction.isAutocomplete()){ const cmd=client.commands.get(interaction.commandName); if(cmd?.autocomplete){try{await cmd.autocomplete(interaction,client);}catch{await interaction.respond([]).catch(()=>{});} } return;
  } else if(interaction.isButton()){ const [id,...args]=interaction.customId.split(':'); const button=client.buttons.get(id); if(!button)return; try{await button.execute(interaction,client,args);}catch(error){await handleInteractionError(interaction,error,withTraceContext({type:'button',customId:interaction.customId},tc));}
  } else if(interaction.isStringSelectMenu()||interaction.isUserSelectMenu()||interaction.isRoleSelectMenu()||interaction.isChannelSelectMenu()||interaction.isMentionableSelectMenu()){ 
    if(interaction.customId==='ticket_add_user_select_v2'){
      try{
        await interaction.deferUpdate();
        const ticket=getTicketFromChannel(interaction.channel);
        if(!ticket) return await interaction.editReply({content:'❌ This ticket is no longer active.',components:[]});
        if(!isStaffForTicket(interaction.member,TICKET_TYPES[ticket.typeId])) return await interaction.editReply({content:'❌ Only members with a support team role for this ticket can add members.',components:[]});
        const userId=interaction.values?.[0];
        if(!userId) return await interaction.editReply({content:'❌ No member was selected.',components:[]});
        const member=await interaction.guild.members.fetch(userId);
        const result=await addTicketUser(interaction.channel,interaction.member,member.user);
        return await interaction.editReply({content:result.alreadyAdded?`ℹ️ <@${member.id}> is already a member of this ticket.`:`✅ Added <@${member.id}> to this ticket. They now have the same channel access as the ticket creator.`,components:[],allowedMentions:{users:[member.id]}});
      }catch(error){
        if(interaction.deferred||interaction.replied) await interaction.editReply({content:`❌ ${error?.message||'I could not add that member to the ticket.'}`,components:[]}).catch(()=>{});
        else await interaction.reply({content:`❌ ${error?.message||'I could not add that member to the ticket.'}`,ephemeral:true}).catch(()=>{});
      }
      return;
    }
    const [id,...args]=interaction.customId.split(':'); const menu=client.selectMenus.get(id); if(!menu)return; try{await menu.execute(interaction,client,args);}catch(error){await handleInteractionError(interaction,error,withTraceContext({type:'select_menu',customId:interaction.customId},tc));}
  } else if(interaction.isModalSubmit()){ if(interaction.customId.startsWith('app_modal_')){try{await handleApplicationModal(interaction);}catch(error){await handleInteractionError(interaction,error,withTraceContext({type:'modal',customId:interaction.customId},tc));}return;} const [id,...args]=interaction.customId.split(':'); const modal=client.modals.get(id); if(!modal)return; try{await modal.execute(interaction,client,args);}catch(error){await handleInteractionError(interaction,error,withTraceContext({type:'modal',customId:interaction.customId},tc));}
  }
 } catch(error){logger.error('Unhandled error in interactionCreate:',{event:'interaction.unhandled_error',errorCode:ErrorCodes.INTERACTION_UNHANDLED,error,traceId:tc.traceId,interactionId:interaction.id,guildId:interaction.guildId,userId:interaction.user?.id}); await handleInteractionError(interaction,error,withTraceContext({type:'interaction'},tc)).catch(()=>{});} }); }};
