import {
  ChannelType,
  Events,
  MessageFlags,
  TextChannel,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Interaction,
} from "discord.js";
import { config } from "./config";
import { closeTicket } from "./tickets";

const EPHEMERAL = MessageFlags.Ephemeral;

export function registerHandlers(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) await handleCommand(interaction);
      else if (interaction.isButton()) await handleButton(interaction);
    } catch (err) {
      console.error("Interaction-Fehler:", err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction
          .reply({ content: "❌ Es ist ein Fehler aufgetreten.", flags: EPHEMERAL })
          .catch(() => {});
      }
    }
  });
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case "ping":
      await interaction.reply({
        content: `🏓 Pong! \`${Math.round(interaction.client.ws.ping)}ms\``,
        flags: EPHEMERAL,
      });
      return;
    case "help":
      await interaction.reply({
        content: [
          "**🎫 Tickets**",
          "`/close` — aktuelles Ticket schließen (mit Transcript)",
          "",
          "**🛡️ Moderation**",
          "`/kick` `/ban` `/timeout` `/clear` `/warn`",
          "",
          "**ℹ️ Sonstiges**",
          "`/ping` `/help`",
        ].join("\n"),
        flags: EPHEMERAL,
      });
      return;
    case "close":
      await handleClose(interaction);
      return;
    case "kick":
      await handleKick(interaction);
      return;
    case "ban":
      await handleBan(interaction);
      return;
    case "timeout":
      await handleTimeout(interaction);
      return;
    case "clear":
      await handleClear(interaction);
      return;
    case "warn":
      await handleWarn(interaction);
      return;
  }
}

function isTicketChannel(interaction: ChatInputCommandInteraction | ButtonInteraction): boolean {
  const ch = interaction.channel;
  return !!ch && ch.type === ChannelType.GuildText && ch.name.startsWith("ticket-");
}

async function handleClose(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  if (!isTicketChannel(interaction)) {
    await interaction.reply({
      content: "Dieser Befehl funktioniert nur in einem Ticket-Kanal.",
      flags: EPHEMERAL,
    });
    return;
  }
  await interaction.reply({ content: "🔒 Ticket wird geschlossen…" });
  await closeTicket(interaction.channel as TextChannel, interaction.user.tag);
}

async function handleKick(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return notInGuild(interaction);
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("grund") ?? "Kein Grund angegeben";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "Mitglied nicht gefunden.", flags: EPHEMERAL });
    return;
  }
  if (!member.kickable) {
    await interaction.reply({
      content: "Ich kann dieses Mitglied nicht kicken (Rollen-Hierarchie/Rechte).",
      flags: EPHEMERAL,
    });
    return;
  }
  await member.kick(reason);
  await interaction.reply({ content: `✅ **${user.tag}** wurde gekickt.\nGrund: ${reason}` });
}

async function handleBan(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return notInGuild(interaction);
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("grund") ?? "Kein Grund angegeben";
  try {
    await interaction.guild.members.ban(user.id, { reason });
    await interaction.reply({ content: `✅ **${user.tag}** wurde gebannt.\nGrund: ${reason}` });
  } catch {
    await interaction.reply({
      content: "Bann fehlgeschlagen (Rollen-Hierarchie/Rechte).",
      flags: EPHEMERAL,
    });
  }
}

async function handleTimeout(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return notInGuild(interaction);
  const user = interaction.options.getUser("user", true);
  const minutes = interaction.options.getInteger("minuten", true);
  const reason = interaction.options.getString("grund") ?? "Kein Grund angegeben";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "Mitglied nicht gefunden.", flags: EPHEMERAL });
    return;
  }
  if (!member.moderatable) {
    await interaction.reply({
      content: "Ich kann dieses Mitglied nicht timeouten (Rollen-Hierarchie/Rechte).",
      flags: EPHEMERAL,
    });
    return;
  }
  await member.timeout(minutes * 60_000, reason);
  await interaction.reply({
    content: `✅ **${user.tag}** für ${minutes} Min. in Timeout.\nGrund: ${reason}`,
  });
}

async function handleClear(interaction: ChatInputCommandInteraction): Promise<void> {
  const amount = interaction.options.getInteger("anzahl", true);
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: "Nur in Server-Textkanälen möglich.",
      flags: EPHEMERAL,
    });
    return;
  }
  const deleted = await (channel as TextChannel).bulkDelete(amount, true);
  await interaction.reply({
    content: `🧹 ${deleted.size} Nachricht(en) gelöscht.`,
    flags: EPHEMERAL,
  });
}

async function handleWarn(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return notInGuild(interaction);
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("grund", true);
  await user
    .send(`⚠️ Du wurdest auf **${interaction.guild.name}** verwarnt.\nGrund: ${reason}`)
    .catch(() => {});
  if (config.logChannelId) {
    const log = await interaction.client.channels.fetch(config.logChannelId).catch(() => null);
    if (log && log.isTextBased() && "send" in log) {
      await (log as TextChannel)
        .send(`⚠️ **${user.tag}** verwarnt von **${interaction.user.tag}** — ${reason}`)
        .catch(() => {});
    }
  }
  await interaction.reply({ content: `✅ **${user.tag}** wurde verwarnt.`, flags: EPHEMERAL });
}

async function notInGuild(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    content: "Dieser Befehl ist nur auf einem Server nutzbar.",
    flags: EPHEMERAL,
  });
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  switch (interaction.customId) {
    case "ticket_claim":
      await interaction.reply({
        content: `✋ <@${interaction.user.id}> kümmert sich um dieses Ticket.`,
      });
      return;
    case "ticket_close":
      await handleClose(interaction);
      return;
  }
}
