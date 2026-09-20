import { Events } from 'discord.js';
import { getActive,recordAnswer,APP_CONFIG } from '../commands/Community/modules/tigerApplications.js';
export default {name:Events.MessageCreate,async execute(message,client){try{if(message.author.bot||message.guild)return;for(const g of client.guilds.cache.values())for(const t of Object.keys(APP_CONFIG)){const a=await getActive(client,g.id,message.author.id,t);if(a&&a.status==='in_progress'){await recordAnswer(client,a,message.content);return}}}catch{}}};
