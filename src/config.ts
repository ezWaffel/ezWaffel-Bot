import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Fehlende Pflicht-Umgebungsvariable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}

export const config = {
  token: required("DISCORD_TOKEN"),
  clientId: required("DISCORD_CLIENT_ID"),
  guildId: required("DISCORD_GUILD_ID"),
  botApiSecret: required("BOT_API_SECRET"),
  port: Number(process.env.PORT ?? 4000),
  ticketCategoryId: optional("TICKET_CATEGORY_ID"),
  staffRoleId: optional("STAFF_ROLE_ID"),
  logChannelId: optional("LOG_CHANNEL_ID"),
} as const;
