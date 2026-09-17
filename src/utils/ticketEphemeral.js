const sessions = new Map();

export function registerTicketEphemeral(userId, interaction) {
  if (!userId || !interaction) return;
  sessions.set(userId, interaction);
}

export async function clearTicketEphemeral(userId) {
  const interaction = sessions.get(userId);
  sessions.delete(userId);
  if (!interaction) return;
  await interaction.deleteReply().catch(() => {});
}

export function clearTicketEphemeralLater(interaction, delay = 1500) {
  if (!interaction) return;
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, delay);
}
