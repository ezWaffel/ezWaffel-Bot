import { ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "./config";

/** Slash command definitions (JSON). */
export const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Zeigt die Latenz des Bots."),

  new SlashCommandBuilder().setName("help").setDescription("Zeigt alle verfügbaren Befehle."),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Schließt das aktuelle Ticket (mit Transcript).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kickt ein Mitglied vom Server.")
    .addUserOption((o) => o.setName("user").setDescription("Das Mitglied").setRequired(true))
    .addStringOption((o) => o.setName("grund").setDescription("Grund"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannt ein Mitglied vom Server.")
    .addUserOption((o) => o.setName("user").setDescription("Das Mitglied").setRequired(true))
    .addStringOption((o) => o.setName("grund").setDescription("Grund"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Versetzt ein Mitglied in einen Timeout.")
    .addUserOption((o) => o.setName("user").setDescription("Das Mitglied").setRequired(true))
    .addIntegerOption((o) =>
      o.setName("minuten").setDescription("Dauer in Minuten (max. 40320)").setRequired(true).setMinValue(1).setMaxValue(40320),
    )
    .addStringOption((o) => o.setName("grund").setDescription("Grund"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Löscht eine Anzahl Nachrichten in diesem Kanal.")
    .addIntegerOption((o) =>
      o.setName("anzahl").setDescription("1–100").setRequired(true).setMinValue(1).setMaxValue(100),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Verwarnt ein Mitglied (DM + Log).")
    .addUserOption((o) => o.setName("user").setDescription("Das Mitglied").setRequired(true))
    .addStringOption((o) => o.setName("grund").setDescription("Grund").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("config")
    .setDescription("Bot-Einstellungen: Ticket-Kategorie, Staff-Rolle, Log-Kanal.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName("view").setDescription("Zeigt die aktuellen Einstellungen."))
    .addSubcommand((s) =>
      s
        .setName("category")
        .setDescription("Setzt die Kategorie für neue Ticket-Kanäle.")
        .addChannelOption((o) =>
          o
            .setName("kategorie")
            .setDescription("Die Kategorie")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("staffrole")
        .setDescription("Setzt die Staff-Rolle, die alle Tickets sieht.")
        .addRoleOption((o) => o.setName("rolle").setDescription("Die Rolle").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("logchannel")
        .setDescription("Setzt den Kanal für Ticket-Transcripts.")
        .addChannelOption((o) =>
          o
            .setName("kanal")
            .setDescription("Der Log-Kanal")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    ),
].map((c) => c.toJSON());

/** Registers the slash commands for the configured guild (instant, no global wait). */
export async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands,
  });
  console.log(`✅ ${commands.length} Slash-Commands registriert (Guild ${config.guildId}).`);
}
