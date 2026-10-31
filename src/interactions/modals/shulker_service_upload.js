import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { clearShulkerDraft, getShulkerDraft, patchShulkerDraft } from '../../utils/shulkerDrafts.js';
import { getNextShulkerUpload, getShulkerUploadOrder } from '../selectMenus/shulker_service.js';
import {
  clearTicketEphemeral, clearTicketEphemeralLater, registerTicketEphemeral,
  resetMainTicketPanel, ticketCancelRow,
} from '../../utils/ticketEphemeral.js';

function isImage(file) {
  return Boolean(file
    && (file.contentType ? file.contentType.startsWith('image/') : true)
    && /\.(png|jpe?g|gif|webp)$/i.test(file.name || ''));
}

async function postImage(channel, kind, file) {
  const label = kind === 'inventory' ? 'Inventory' : 'Hotbar';
  const extension = file.name.split('.').pop().toLowerCase();
  try {
    await channel.send({
      content: `📸 **${label} Screenshot**`,
      files: [{ attachment: file.url, name: `shulker-${kind}.${extension}` }],
    });
  } catch {
    await channel.send({ content: `📸 **${label} Screenshot:** ${file.url}` });
  }
}

export default {
  name: 'shulker_service_upload',
  async execute(interaction, client, args = []) {
    const [sessionId, kind] = args;
    const draft = getShulkerDraft(interaction.guildId, interaction.user.id, sessionId);
    if (!draft || !draft.primary) {
      return interaction.reply({
        content: '❌ Your Shulker Service form expired. Please start again.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const nextExpected = getNextShulkerUpload(draft);
      if (!draft.amountsComplete || draft.completing || !nextExpected || nextExpected !== kind) {
        return interaction.reply({
          content: '❌ That screenshot step is no longer active. Please use the current upload step.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const file = interaction.fields.getUploadedFiles(`${kind}_image`, false)?.first();
      if (!isImage(file)) {
        return interaction.reply({
          content: '❌ Upload one valid PNG, JPG, GIF, or WebP screenshot.',
          flags: MessageFlags.Ephemeral,
        });
      }

      patchShulkerDraft(interaction.guildId, interaction.user.id, sessionId, {
        screenshots: {
          ...draft.screenshots,
          [kind]: { name: file.name, url: file.url, contentType: file.contentType },
        },
      });
      const remaining = getNextShulkerUpload(draft);
      if (remaining) {
        const label = kind === 'inventory' ? 'Inventory' : 'Hotbar';
        const nextLabel = remaining === 'inventory' ? 'Inventory' : 'Hotbar';
        await interaction.reply({
          content: `✅ **${label} screenshot uploaded.**\nNow upload your **${nextLabel} screenshot** to finish your Shulker Service ticket.`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`shulker_service_next_upload:${sessionId}`)
                .setLabel(`Upload ${nextLabel} Image`)
                .setStyle(ButtonStyle.Primary),
            ),
            ticketCancelRow(),
          ],
          flags: MessageFlags.Ephemeral,
        });
        registerTicketEphemeral(interaction.user.id, interaction);
        return;
      }

      draft.completing = true;
      if (!draft.amountsComplete
        || (draft.includeInventory && (!Number.isSafeInteger(draft.inventoryAmount) || draft.inventoryAmount < 27))
        || (draft.includeHotbar && (!Number.isSafeInteger(draft.hotbarAmount) || draft.hotbarAmount < 27))) {
        throw new Error('Each selected option requires a quantity of at least 27 shulkers.');
      }
      const answers = {
        inventory_amount: draft.includeInventory ? String(draft.inventoryAmount) : undefined,
        hotbar_amount: draft.includeHotbar ? String(draft.hotbarAmount) : undefined,
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

      for (const screenshotKind of getShulkerUploadOrder(draft)) {
        await postImage(result.channel, screenshotKind, draft.screenshots[screenshotKind]);
      }
      await result.channel.send('💬 **Pricing will be discussed with staff in this ticket.** No automatic price calculation is used.');

      const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
      await logTicket(interaction.guild,
        `🎫 **Ticket opened** • Shulker Service • ${displayName} • ${result.channel}`);

      clearShulkerDraft(interaction.guildId, interaction.user.id);
      await resetMainTicketPanel(interaction.user.id);
      await clearTicketEphemeral(interaction.user.id);
      await interaction.editReply(`✅ Shulker Service ticket created: ${result.channel}\nYour screenshot${getShulkerUploadOrder(draft).length === 1 ? ' is' : 's are'} included below the ticket panel.`);
      clearTicketEphemeralLater(interaction);
    } catch (error) {
      draft.completing = false;
      const payload = { content: `❌ Could not create the Shulker Service ticket: ${error.message}` };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
