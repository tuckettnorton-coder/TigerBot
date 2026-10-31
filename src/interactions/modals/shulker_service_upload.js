import { MessageFlags } from 'discord.js';
import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { clearShulkerDraft, getShulkerDraft } from '../../utils/shulkerDrafts.js';
import {
  clearTicketEphemeral, clearTicketEphemeralLater, resetMainTicketPanel,
} from '../../utils/ticketEphemeral.js';

function uploadedFile(fields, customId) {
  return fields.getUploadedFiles(customId, false)?.first() || null;
}

function isImage(file) {
  return !file || (
    (file.contentType ? file.contentType.startsWith('image/') : true)
    && /\.(png|jpe?g|gif|webp)$/i.test(file.name || '')
  );
}

async function postImage(channel, name, file) {
  if (!file) return;
  const extension = file.name.split('.').pop().toLowerCase();
  try {
    await channel.send({
      content: `📸 **${name} Screenshot**`,
      files: [{ attachment: file.url, name: `shulker-${name.toLowerCase()}.${extension}` }],
    });
  } catch {
    await channel.send({
      content: `📸 **${name} Screenshot:** ${file.url}`,
    });
  }
}

export default {
  name: 'shulker_service_upload',
  async execute(interaction, client, args = []) {
    const sessionId = args[0];
    const draft = getShulkerDraft(interaction.guildId, interaction.user.id, sessionId);
    if (!draft || !draft.primary) {
      return interaction.reply({
        content: '❌ Your Shulker Service form expired. Please start again.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const hotbar = uploadedFile(interaction.fields, 'hotbar_image');
      const inventory = uploadedFile(interaction.fields, 'inventory_image');
      if (!isImage(hotbar) || !isImage(inventory)) {
        return interaction.reply({
          content: '❌ Please upload screenshots as PNG, JPG, GIF, or WebP images.',
          flags: MessageFlags.Ephemeral,
        });
      }
      if ((draft.includeHotbar && !hotbar) || (draft.includeInventory && !inventory)) {
        return interaction.reply({
          content: '❌ You must upload screenshots for every selected inventory/hotbar.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const answers = {
        shulker_count: String(draft.shulkerCount),
        primary_type: draft.primary === 'inventory' ? 'Inventory' : 'Hotbar',
        include_inventory: draft.includeInventory ? 'Yes' : 'No',
        include_hotbar: draft.includeHotbar ? 'Yes' : 'No',
      };

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await createTicketChannel({
        guild: interaction.guild, user: interaction.user, typeId: 'shulker_service', answers,
      });
      if (result.existing) {
        clearShulkerDraft(interaction.guildId, interaction.user.id);
        return interaction.editReply(`You already have an open Shulker Service ticket: ${result.existing}`);
      }

      await postImage(result.channel, 'Hotbar', hotbar);
      await postImage(result.channel, 'Inventory', inventory);
      await result.channel.send('💬 **Pricing will be discussed with staff in this ticket.** No automatic price calculation is used.');

      const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
      await logTicket(interaction.guild,
        `🎫 **Ticket opened** • Shulker Service • ${displayName} • ${result.channel}`);
      clearShulkerDraft(interaction.guildId, interaction.user.id);
      await resetMainTicketPanel(interaction.user.id);
      await clearTicketEphemeral(interaction.user.id);
      await interaction.editReply(`✅ Shulker Service ticket created: ${result.channel}\nYour screenshots are included below the ticket panel.`);
      clearTicketEphemeralLater(interaction);
    } catch (error) {
      const payload = { content: `❌ Could not create the Shulker Service ticket: ${error.message}` };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
