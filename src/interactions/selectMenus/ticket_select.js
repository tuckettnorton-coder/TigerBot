import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { createTicketChannel, logTicket, findExistingTicket } from '../../services/ticketService.js';
import { registerTicketEphemeral, clearTicketEphemeralLater, ticketCancelRow } from '../../utils/ticketEphemeral.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { setPaidAdDraft } from '../../utils/paidAdDrafts.js';
function buildSpawnerTradeMenu() { return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('spawner_trade_type').setPlaceholder('Select Buy or Sell...').addOptions(new StringSelectMenuOptionBuilder().setLabel('Buy').setDescription('I want to buy spawners').setValue('buy').setEmoji('💰'),new StringSelectMenuOptionBuilder().setLabel('Sell').setDescription('I want to sell spawners').setValue('sell').setEmoji('💵'))); }
function buildYesNoMenu(customId, placeholder, yesDescription, noDescription) { return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription(yesDescription).setValue('yes').setEmoji('✅'),new StringSelectMenuOptionBuilder().setLabel('No').setDescription(noDescription).setValue('no').setEmoji('❌'))); }

async function resetMainTicketMenu(interaction) {
  const message = interaction.message;
  if (!message?.components?.length) return;

  const components = message.components.map((row) => {
    const data = row.toJSON();
    data.components = data.components.map((component) => {
      if (component.type !== 3 || !Array.isArray(component.options)) return component;
      return {
        ...component,
        options: component.options.map((option) => ({ ...option, default: false })),
      };
    });
    return data;
  });

  await message.edit({ components }).catch(() => {});
}

function buildPaidAdPlanMenu() { const p=loadPaidAdPrices(); return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_plan').setPlaceholder('Choose your advertisement plan...').addOptions(new StringSelectMenuOptionBuilder().setLabel(`💎 Premium Bundle — $${Number(p.premium).toFixed(2)}`).setDescription('@everyone • Private Channel • Scheduled • +7 Days').setValue('premium'),new StringSelectMenuOptionBuilder().setLabel(`🚀 Standard Bundle — $${Number(p.standard).toFixed(2)}`).setDescription('Partner Ping • Private Channel • +3 Days').setValue('standard'),new StringSelectMenuOptionBuilder().setLabel(`📢 Basic Bundle — $${Number(p.basic).toFixed(2)}`).setDescription('@here Ping').setValue('basic'))); }
export default { name:'ticket_select', async execute(interaction) {
  try {
    const typeId=interaction.values?.[0]; const ticket=TICKET_TYPES[typeId]; if(!ticket)return interaction.reply({content:'That ticket type is unavailable.',ephemeral:true});
    // Reset the main ticket dropdown immediately so it returns to its placeholder after every selection.\n    await resetMainTicketMenu(interaction);\n    const existing=await findExistingTicket(interaction.guild,interaction.user.id,ticket.categoryName); if(existing)return interaction.reply({content:`You already have an open ${ticket.label} ticket: ${existing}`,ephemeral:true});
    if(typeId==='advertisement'){setPaidAdDraft(interaction.user.id,{});await interaction.reply({content:'### 💰 Paid Advertisement\n**What paid advertisement would you like?**\n\nChoose one of the current plans below.',components:[buildPaidAdPlanMenu(), ticketCancelRow()],ephemeral:true});registerTicketEphemeral(interaction.user.id,interaction);return;}
    if(typeId==='buying_selling_spawners'){await interaction.reply({content:'### 💸 Buying/Selling Spawners\nFirst, select whether you want to **Buy** or **Sell**.',components:[buildSpawnerTradeMenu(), ticketCancelRow()],ephemeral:true});registerTicketEphemeral(interaction.user.id,interaction);return;}
    if(typeId==='digging_services'){await interaction.reply({content:'### ⛏️ Digging Service\n**Do you have an area?**\nSelect an option below.',components:[buildYesNoMenu('digging_area','Do you have an area?','I have an area/location','I need the builder to choose the area'), ticketCancelRow()],ephemeral:true});registerTicketEphemeral(interaction.user.id,interaction);return;}
    if(typeId==='building_services'){const modal=new ModalBuilder().setCustomId('ticket_form:building_services:start').setTitle('Building Service').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('what_built').setLabel('What do you want built?').setStyle(TextInputStyle.Paragraph).setPlaceholder('Describe the farm, stash, or custom build').setRequired(true)));return interaction.showModal(modal);}
    if(!ticket.form?.length){await interaction.deferReply({ephemeral:true});const result=await createTicketChannel({guild:interaction.guild,user:interaction.user,typeId});if(result.existing)return interaction.editReply(`You already have an open ticket: ${result.existing}`);const displayName=interaction.member?.displayName||interaction.user.globalName||interaction.user.username;await logTicket(interaction.guild,`🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);clearTicketEphemeralLater(interaction);return interaction.editReply(`✅ Ticket created: ${result.channel}`);}
    const modal=new ModalBuilder().setCustomId(`ticket_form:${typeId}`).setTitle(ticket.label.slice(0,45));for(const field of ticket.form.slice(0,5)){const input=new TextInputBuilder().setCustomId(field.id).setLabel(field.label.slice(0,45)).setStyle(field.style==='paragraph'?TextInputStyle.Paragraph:TextInputStyle.Short).setRequired(field.required!==false);if(field.placeholder)input.setPlaceholder(field.placeholder.slice(0,100));modal.addComponents(new ActionRowBuilder().addComponents(input));}await interaction.showModal(modal);
  }catch(error){if(interaction.deferred||interaction.replied)await interaction.editReply(`❌ Could not open the ticket: ${error.message}`).catch(()=>{});else await interaction.reply({content:`❌ Could not open the ticket: ${error.message}`,ephemeral:true}).catch(()=>{});}
} };
