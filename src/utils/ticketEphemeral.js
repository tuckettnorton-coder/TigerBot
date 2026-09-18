const sessions = new Map();
const mainPanels = new Map();

export function registerTicketEphemeral(userId, interaction) {
  if (!userId || !interaction) return;
  sessions.set(userId, interaction);
  if (interaction.message) mainPanels.set(userId, interaction.message);
}

export async function clearTicketEphemeral(userId) {
  const interaction = sessions.get(userId);
  sessions.delete(userId);
  if (!interaction) return;
  await interaction.deleteReply().catch(() => {});
}

export async function resetMainTicketPanel(userId) {
  const message = mainPanels.get(userId);
  mainPanels.delete(userId);
  if (!message?.components?.length) return;
  const components = message.components.map((row) => {
    const data = row.toJSON();
    data.components = data.components.map((component) => {
      if (component.type !== 3 || !Array.isArray(component.options)) return component;
      return { ...component, options: component.options.map((option) => ({ ...option, default: false })) };
    });
    return data;
  });
  await message.edit({ components }).catch(() => {});
}

export function clearTicketEphemeralLater(interaction, delay = 1500) {
  if (!interaction) return;
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, delay);
}
