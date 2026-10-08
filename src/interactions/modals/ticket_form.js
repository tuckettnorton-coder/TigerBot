import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { calculateSpawnerPrice, buildSpawnerCalculationMessage } from '../../utils/spawnerPricing.js';
import { calculateDiggingPrice, buildDiggingCalculationMessage } from '../../utils/diggingPricing.js';
import { calculateBuildingPrice, buildBuildingCalculationMessage } from '../../utils/buildingPricing.js';
import { parseAmount } from '../../utils/calculator.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { setBuildingDraft, getBuildingDraft, clearBuildingDraft } from '../../utils/buildingDrafts.js';
import { setMiddlemanDraft } from '../../utils/middlemanDrafts.js';
import { setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { registerTicketEphemeral, clearTicketEphemeral, clearTicketEphemeralLater, resetMainTicketPanel } from '../../utils/ticketEphemeral.js';

const NUMBER_WORDS={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
const SCALE_WORDS={hundred:100,thousand:1_000,million:1_000_000,billion:1_000_000_000};
function parseNumberWord(value){const normalized=String(value??'').toLowerCase().trim().replace(/[-,]/g,' ').replace(/\s+/g,' ');if(!normalized)return null;const words=normalized.split(' ');let total=0,current=0,saw=false;for(const word of words){if(Object.hasOwn(NUMBER_WORDS,word)){current+=NUMBER_WORDS[word];saw=true;continue;}if(word==='hundred'){if(!saw||!current)return null;current*=100;continue;}if(Object.hasOwn(SCALE_WORDS,word)){if(!saw||!current)return null;total+=current*SCALE_WORDS[word];current=0;saw=false;continue;}if(word==='and')continue;return null;}return total+current||null;}
function parseSpawnerAmount(value){const raw=String(value??'').trim().toLowerCase();const cleaned=raw.replace(/\bspawners?\b/g,'').replace(/\s+/g,'').replace(/,/g,'');return parseAmount(cleaned)??parseNumberWord(raw);}
async function addCalculationToPanel(channel,ticketLabel,name,text){const messages=await channel.messages.fetch({limit:20});const panelMessage=messages.find(message=>message.embeds?.some(embed=>embed.title===ticketLabel));if(!panelMessage?.embeds?.[0])throw new Error('Could not find the ticket panel message to add the calculation.');const panelEmbed=EmbedBuilder.from(panelMessage.embeds[0]);panelEmbed.addFields({name,value:text.slice(0,1024),inline:false});await panelMessage.edit({embeds:[panelEmbed]});}
const REGION_LABELS={west:'West',east:'East',ocean:'Ocean',asia:'Asia',europe:'Europe',none:'None'};
function yesNoMenu(customId,placeholder){return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('Yes').setValue('yes').setEmoji('✅'),new StringSelectMenuOptionBuilder().setLabel('No').setDescription('No').setValue('no').setEmoji('❌')));}
function money(value){return `$${Number(value).toFixed(2)}`;}

export default { name:'ticket_form', async execute(interaction,client,args){try{
 const typeId=args?.[0],ticket=TICKET_TYPES[typeId]; if(!ticket)return interaction.reply({content:'That ticket type is unavailable.',ephemeral:true});

 if(typeId==='middleman'){
   const yourIgn=interaction.fields.getTextInputValue('your_ign').trim();
   const personIgn=interaction.fields.getTextInputValue('person_ign').trim();
   if(!yourIgn||!personIgn)return interaction.reply({content:'❌ Please enter both IGNs.',ephemeral:true});
   setMiddlemanDraft(interaction.user.id,{yourIgn,personIgn});
   await interaction.reply({content:'### 🤝 Middleman Service\n**Are spawners involved in this trade?**',components:[yesNoMenu('middleman_spawners','Are spawners involved?')],ephemeral:true});
   registerTicketEphemeral(interaction.user.id,interaction);
   return;
 }

 if(typeId==='advertisement'){
   const adName=interaction.fields.getTextInputValue('ad_name').trim();
   const adLink=interaction.fields.getTextInputValue('ad_link').trim();
   const adContent=interaction.fields.getTextInputValue('ad_content').trim();
   if(!adName||!adLink||!adContent)return interaction.reply({content:'❌ Please complete the advertisement name, invite link, and ad content.',ephemeral:true});
   setPaidAdDraft(interaction.user.id,{adName,adLink,adContent});
   const p=loadPaidAdPrices();
   await interaction.reply({content:'### 💰 Paid Advertisement\n**Which advertisement plan are you choosing?**',components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_plan').setPlaceholder('Choose a plan').addOptions(
     new StringSelectMenuOptionBuilder().setLabel(`Premium Bundle — ${money(p.premium)}`).setDescription('@everyone • Private Channel • Scheduled • +7 Days').setValue('premium'),
     new StringSelectMenuOptionBuilder().setLabel(`Standard Bundle — ${money(p.standard)}`).setDescription('Partner Ping • Private Channel • +3 Days').setValue('standard'),
     new StringSelectMenuOptionBuilder().setLabel(`Basic Bundle — ${money(p.basic)}`).setDescription('@here Ping').setValue('basic'),
   ))],ephemeral:true});
   registerTicketEphemeral(interaction.user.id,interaction);
   return;
 }

 if(typeId==='building_services'){
   const step=args?.[1];
   if(step==='start'){const whatBuilt=interaction.fields.getTextInputValue('what_built').trim();if(!whatBuilt)return interaction.reply({content:'❌ Please describe what you want built.',ephemeral:true});setBuildingDraft(interaction.user.id,{whatBuilt});await interaction.reply({content:'### 🏗️ Building Service\n**Is this a farm?**',components:[yesNoMenu('building_farm','Is this a farm?')],ephemeral:true});registerTicketEphemeral(interaction.user.id,interaction);return;}
   if(step==='value'){const isFarm=args?.[2]==='yes';if(!isFarm)return interaction.reply({content:'❌ Farm earnings are only required for farm builds.',ephemeral:true});const value=interaction.fields.getTextInputValue('value').trim();if(!value)return interaction.reply({content:'❌ Please enter the farm earnings per day.',ephemeral:true});setBuildingDraft(interaction.user.id,{isFarm:true,priceInput:value});await clearTicketEphemeral(interaction.user.id);await interaction.reply({content:'### 🏗️ Building Service\n**Do you have a schematic?**',components:[yesNoMenu('building_schematic','Do you have a schematic?')],ephemeral:true});registerTicketEphemeral(interaction.user.id,interaction);return;}
   if(step==='building_schematic_upload'){
     const uploaded=interaction.fields.getUploadedFiles('schematic_upload',true);
     const file=uploaded?.first();
     if(!file)return interaction.reply({content:'❌ Please upload your schematic.',ephemeral:true});
     setBuildingDraft(interaction.user.id,{schematicUrl:file.url,schematicName:file.name});
     await clearTicketEphemeral(interaction.user.id);
     await interaction.reply({content:'### 🏗️ Building Service\n**Do you have an area dug out?**',components:[yesNoMenu('building_area:yes','Do you have an area dug out?')],ephemeral:true});
     registerTicketEphemeral(interaction.user.id,interaction);
     return;
   }
   if(step==='digstart'){const schematic=args?.[2],areaSize=interaction.fields.getTextInputValue('area_size').trim(),ign=interaction.fields.getTextInputValue('ign').trim();if(!['yes','no'].includes(schematic)||!areaSize||!ign)return interaction.reply({content:'❌ Please complete the digging fields.',ephemeral:true});setBuildingDraft(interaction.user.id,{areaSize,ign,dig:true});await clearTicketEphemeral(interaction.user.id);await interaction.reply({content:'### ⛏️ Area Digging\n**Do you want good coords?**',components:[yesNoMenu(`building_good_coords:${schematic}`,'Do you want good coords?')],ephemeral:true});registerTicketEphemeral(interaction.user.id,interaction);return;}
   if(step==='final'){
     const schematic=args?.[2],area=args?.[3],dig=args?.[4],good=args?.[5],region=args?.[6]||'none';const draft=getBuildingDraft(interaction.user.id);const ign=draft.ign||interaction.fields.getTextInputValue('ign').trim();if(!draft.whatBuilt||!ign)return interaction.reply({content:'❌ Your building ticket session expired. Please start the ticket again.',ephemeral:true});
     const building=draft.isFarm?calculateBuildingPrice({isFarm:true,dailyFarmAmount:draft.priceInput}):null;
     let digging=null;if(dig==='yes'){if(!draft.areaSize)return interaction.reply({content:'❌ Digging area information is missing. Please start again.',ephemeral:true});digging=calculateDiggingPrice({areaSize:draft.areaSize,goodCoords:good==='yes',customRegion:region!=='none'});}
     const answers={what_built:draft.whatBuilt,is_farm:draft.isFarm?'Yes':'No',price_value:draft.isFarm?draft.priceInput:'—',schematic:schematic==='yes'?'Yes':'No',schematic_url:schematic==='yes'?draft.schematicUrl:undefined,schematic_name:schematic==='yes'?draft.schematicName:undefined,area_dug:area==='yes'?'Yes':'No',digging_requested:dig==='yes'?'Yes':'No',digging_area_size:draft.areaSize||'—',good_coords:dig==='yes'?(good==='yes'?'Yes':'No'):'—',region:dig==='yes'?REGION_LABELS[region]:'—',ign};
     await interaction.deferReply({ephemeral:true});const result=await createTicketChannel({guild:interaction.guild,user:interaction.user,typeId,answers});if(result.existing)return interaction.editReply(`You already have an open ticket: ${result.existing}`);
     if(building)await addCalculationToPanel(result.channel,ticket.label,'🧮 Automatic Building Price Calculation',buildBuildingCalculationMessage(building));
     if(digging)await addCalculationToPanel(result.channel,ticket.label,'🧮 Automatic Digging Price Calculation',buildDiggingCalculationMessage(digging));
     if(schematic==='yes')await result.channel.send('📐 **Schematic uploaded:** [Download '+(draft.schematicName||'schematic')+']('+draft.schematicUrl+')');
     const displayName=interaction.member?.displayName||interaction.user.globalName||interaction.user.username;await logTicket(interaction.guild,`🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);clearBuildingDraft(interaction.user.id);await resetMainTicketPanel(interaction.user.id);await clearTicketEphemeral(interaction.user.id);const total=(building?.total||0)+(digging?.total||0);const confirmation=`✅ Ticket created: ${result.channel}${total?`\n💰 **Automatic total: ${new Intl.NumberFormat('en-US').format(total)}**`:''}`;await interaction.editReply(confirmation);clearTicketEphemeralLater(interaction);return;
   }
 }
 if(typeId==='buying_selling_spawners'){const trade=args?.[1],spawnerType=args?.[2],selectedAmount=args?.[3];if(!['buy','sell'].includes(trade)||!['skeleton','creeper','irongolem'].includes(spawnerType))return interaction.reply({content:'❌ Invalid spawner ticket selection.',ephemeral:true});const amountDisplay=selectedAmount==='custom'?interaction.fields.getTextInputValue('amount').trim():(selectedAmount||interaction.fields.getTextInputValue('amount').trim());const amount=parseSpawnerAmount(amountDisplay);const answers={ign:interaction.fields.getTextInputValue('ign').trim(),buy_or_sell:trade,amount:amountDisplay,spawner_type:spawnerType};if(!answers.ign)return interaction.reply({content:'❌ Please enter your IGN.',ephemeral:true});if(amount===null||!Number.isFinite(amount)||amount<3||!Number.isInteger(amount))return interaction.reply({content:'❌ **Minimum is 3 spawners.** Please choose a valid whole-number amount of **3 or more**.',ephemeral:true});const calculation=await calculateSpawnerPrice({trade,spawnerType,amount,client,guildId:interaction.guildId});await interaction.deferReply({ephemeral:true});const result=await createTicketChannel({guild:interaction.guild,user:interaction.user,typeId,answers});if(result.existing)return interaction.editReply(`You already have an open ticket: ${result.existing}`);await addCalculationToPanel(result.channel,ticket.label,'🧮 Automatic Spawner Price Calculation',buildSpawnerCalculationMessage(calculation));const displayName=interaction.member?.displayName||interaction.user.globalName||interaction.user.username;await logTicket(interaction.guild,`🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);await resetMainTicketPanel(interaction.user.id);await clearTicketEphemeral(interaction.user.id);await interaction.editReply(`✅ Ticket created: ${result.channel}\n💰 **Automatic total: ${calculation.totalFormatted}**`);clearTicketEphemeralLater(interaction);return;}
 if(typeId==='digging_services'){const area=args?.[1],goodCoords=args?.[2],region=args?.[3]||'none';if(!['yes','no'].includes(area)||!['yes','no'].includes(goodCoords)||!REGION_LABELS[region])return interaction.reply({content:'❌ Invalid digging ticket selection.',ephemeral:true});const areaSize=interaction.fields.getTextInputValue('area_size').trim(),ign=interaction.fields.getTextInputValue('ign').trim();if(!areaSize||!ign)return interaction.reply({content:'❌ Please complete all digging service fields.',ephemeral:true});const hasArea=area==='yes',useGoodCoords=!hasArea&&goodCoords==='yes',useCustomRegion=!hasArea&&region!=='none';const calculation=calculateDiggingPrice({areaSize,goodCoords:useGoodCoords,customRegion:useCustomRegion});const answers={area_size:areaSize,has_area:hasArea?'Yes':'No',good_chords:hasArea?'—':(useGoodCoords?'Yes':'No'),region:hasArea?'—':REGION_LABELS[region],ign};await interaction.deferReply({ephemeral:true});const result=await createTicketChannel({guild:interaction.guild,user:interaction.user,typeId,answers});if(result.existing)return interaction.editReply(`You already have an open ticket: ${result.existing}`);await addCalculationToPanel(result.channel,ticket.label,'🧮 Automatic Digging Price Calculation',buildDiggingCalculationMessage(calculation));const displayName=interaction.member?.displayName||interaction.user.globalName||interaction.user.username;await logTicket(interaction.guild,`🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);await clearTicketEphemeral(interaction.user.id);await interaction.editReply(`✅ Ticket created: ${result.channel}\n💰 **Automatic total: ${calculation.totalFormatted}**`);clearTicketEphemeralLater(interaction);return;}
 const answers=Object.fromEntries(ticket.form.map(field=>[field.id,interaction.fields.getTextInputValue(field.id)]));await interaction.deferReply({ephemeral:true});const result=await createTicketChannel({guild:interaction.guild,user:interaction.user,typeId,answers});if(result.existing)return interaction.editReply(`You already have an open ticket: ${result.existing}`);const displayName=interaction.member?.displayName||interaction.user.globalName||interaction.user.username;await logTicket(interaction.guild,`🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);await clearTicketEphemeral(interaction.user.id);await interaction.editReply(`✅ Ticket created: ${result.channel}`);clearTicketEphemeralLater(interaction);return;
}catch(error){if(interaction.deferred||interaction.replied)await interaction.editReply(`❌ Could not create the ticket: ${error.message}`).catch(()=>{});else await interaction.reply({content:`❌ Could not create the ticket: ${error.message}`,ephemeral:true}).catch(()=>{});}}};
