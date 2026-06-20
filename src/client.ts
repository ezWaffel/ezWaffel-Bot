import { Client, GatewayIntentBits, Partials } from "discord.js";

/**
 * Shared Discord client.
 *
 * Privileged intents used:
 *  - GuildMembers   (for kick/ban/timeout member resolution)
 *  - MessageContent (for ticket transcripts)
 * Both must be enabled in the Developer Portal under Bot -> Privileged Gateway Intents.
 */
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});
