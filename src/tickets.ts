import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  type Client,
  type OverwriteResolvable,
} from "discord.js";
import { config } from "./config";
import {
  effectiveLogChannelId,
  effectiveStaffRoleId,
  effectiveTicketCategoryId,
} from "./settings";
import type { ProjectRequest } from "./types";

const BRAND = 0xa855f7;

function sanitize(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "kunde";
}

/** Creates a private ticket channel for an incoming project request. */
export async function createTicket(
  client: Client,
  data: ProjectRequest,
): Promise<{ channelId: string; invite?: string }> {
  const guild = await client.guilds.fetch(config.guildId);

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: client.user!.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.CreateInstantInvite,
      ],
    },
  ];
  const staffRoleId = effectiveStaffRoleId();
  if (staffRoleId) {
    overwrites.push({
      id: staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: `ticket-${sanitize(data.username)}`,
    type: ChannelType.GuildText,
    parent: effectiveTicketCategoryId(),
    topic: `Projektanfrage von ${data.username} • Discord-ID ${data.discordId}`,
    permissionOverwrites: overwrites,
  });

  // Grant the customer access by user ID. Works once they join via the invite.
  // Setting an overwrite for a non-member can fail — that's fine, the invite + a
  // GuildMemberAdd handler (or manual add) covers it.
  try {
    await channel.permissionOverwrites.create(data.discordId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
  } catch {
    /* customer not in guild yet */
  }

  let invite: string | undefined;
  try {
    const inv = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true });
    invite = inv.url;
  } catch {
    /* missing CreateInstantInvite permission */
  }

  const embed = new EmbedBuilder()
    .setTitle("📨 Neue Projektanfrage")
    .setColor(BRAND)
    .setThumbnail(data.avatarUrl ?? null)
    .addFields(
      { name: "Von", value: `${data.username} (<@${data.discordId}>)` },
      { name: "Discord-ID", value: `\`${data.discordId}\``, inline: true },
      { name: "Projektart", value: data.projectType, inline: true },
      { name: "Budget", value: data.budget ?? "—", inline: true },
      { name: "Kontakt", value: data.contact ?? "—", inline: true },
      { name: "Nachricht", value: data.message.slice(0, 1024) },
    )
    .setFooter({ text: "ezWaffel • Ticket" })
    .setTimestamp(new Date(data.createdAt));

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Übernehmen")
      .setEmoji("✋")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Schließen")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
  );

  const staffPing = staffRoleId ? `<@&${staffRoleId}> ` : "";
  await (channel as TextChannel).send({
    content: `${staffPing}Neues Ticket für <@${data.discordId}>`,
    embeds: [embed],
    components: [buttons],
  });

  if (invite) {
    await (channel as TextChannel).send({
      content:
        `🔗 **Einladungslink für den Kunden** (per Kontakt zusenden, damit er dem Ticket beitreten kann):\n${invite}`,
    });
  }

  return { channelId: channel.id, invite };
}

/** Builds a plain-text transcript of the last 100 messages in a channel. */
async function buildTranscript(channel: TextChannel): Promise<AttachmentBuilder> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const ordered = [...messages.values()].reverse();
  const lines = ordered.map((m) => {
    const time = m.createdAt.toISOString();
    const content = m.content || (m.embeds.length ? "[embed]" : "[anhang]");
    return `[${time}] ${m.author.tag}: ${content}`;
  });
  const text = `Transcript — #${channel.name}\n${"=".repeat(40)}\n\n${lines.join("\n")}\n`;
  return new AttachmentBuilder(Buffer.from(text, "utf-8"), {
    name: `transcript-${channel.name}.txt`,
  });
}

/** Closes a ticket: posts a transcript to the log channel (if set), then deletes it. */
export async function closeTicket(channel: TextChannel, closedBy: string): Promise<void> {
  let transcript: AttachmentBuilder | undefined;
  try {
    transcript = await buildTranscript(channel);
  } catch {
    /* couldn't read history */
  }

  const logChannelId = effectiveLogChannelId();
  if (logChannelId) {
    const logChannel = await channel.client.channels
      .fetch(logChannelId)
      .catch(() => null);
    if (logChannel && logChannel.isTextBased() && "send" in logChannel) {
      await (logChannel as TextChannel)
        .send({
          content: `🔒 Ticket **#${channel.name}** geschlossen von ${closedBy}.`,
          files: transcript ? [transcript] : [],
        })
        .catch(() => {});
    }
  }

  await channel.delete(`Ticket geschlossen von ${closedBy}`).catch(() => {});
}
