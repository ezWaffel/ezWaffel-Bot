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

/** Details embed, shared between the staff ticket and the customer DM. */
function requestEmbed(data: ProjectRequest, forCustomer: boolean): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(forCustomer ? "✅ Deine Projektanfrage ist eingegangen" : "📨 Neue Projektanfrage")
    .setColor(BRAND)
    .setThumbnail(data.avatarUrl ?? null)
    .addFields(
      { name: "Projektart", value: data.projectType, inline: true },
      { name: "Budget", value: data.budget ?? "—", inline: true },
      { name: "Kontakt", value: data.contact ?? "—", inline: true },
      { name: "Nachricht", value: data.message.slice(0, 1024) },
    )
    .setFooter({
      text: forCustomer ? "ezWaffel — wir melden uns!" : `ezWaffel • uid:${data.discordId}`,
    })
    .setTimestamp(new Date(data.createdAt));
}

/**
 * Handles an incoming project request:
 *  1. Adds the customer to the guild (via their OAuth guilds.join token).
 *  2. DMs the customer a confirmation with all details.
 *  3. Creates a STAFF-ONLY ticket with an "Annehmen" button — the customer
 *     only gets channel access once staff accepts.
 */
export async function createTicket(
  client: Client,
  data: ProjectRequest,
): Promise<{ channelId: string; alreadyOpen?: boolean }> {
  const guild = await client.guilds.fetch(config.guildId);

  // 0) Enforce ONE open ticket per customer (anti-spam). A ticket carries the
  //    customer id in its topic (uid:...), so we look for an existing one.
  const channels = await guild.channels.fetch();
  const existing = channels.find(
    (c): c is TextChannel =>
      !!c &&
      c.type === ChannelType.GuildText &&
      c.name.startsWith("ticket-") &&
      (c.topic?.includes(`uid:${data.discordId}`) ?? false),
  );
  if (existing) {
    return { channelId: existing.id, alreadyOpen: true };
  }

  // 1) Add the customer to the server (needed so we can DM + later grant access).
  if (data.accessToken) {
    try {
      await guild.members.add(data.discordId, { accessToken: data.accessToken });
    } catch (err) {
      console.warn("Konnte Kunden nicht zum Server hinzufügen:", (err as Error).message);
    }
  }

  // 2) DM the customer a confirmation (works now that they're a member).
  try {
    const user = await client.users.fetch(data.discordId);
    await user.send({
      content:
        "Danke für deine Anfrage bei **ezWaffel**! Sobald dein Projekt angenommen wird, " +
        "bekommst du hier den Zugang zu deinem Ticket.",
      embeds: [requestEmbed(data, true)],
    });
  } catch {
    console.warn("Konnte dem Kunden keine DM schicken (DMs evtl. deaktiviert).");
  }

  // 3) Create the staff-only ticket channel (NO customer access yet).
  const staffRoleId = effectiveStaffRoleId();
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
      ],
    },
  ];
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
    topic: `Projektanfrage von ${data.username} • uid:${data.discordId}`,
    permissionOverwrites: overwrites,
  });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_accept")
      .setLabel("Annehmen")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Schließen")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
  );

  const staffPing = staffRoleId ? `<@&${staffRoleId}> ` : "";
  await (channel as TextChannel).send({
    content:
      `${staffPing}Neue Anfrage von ${data.username} (<@${data.discordId}>). ` +
      `Mit **Annehmen** gibst du dem Kunden Zugriff auf dieses Ticket und benachrichtigst ihn per DM.`,
    embeds: [requestEmbed(data, false)],
    components: [buttons],
  });

  return { channelId: channel.id };
}

/**
 * Accepts a ticket: grants the customer access to the channel and DMs them the
 * direct link. Returns a short status line for the staff reply.
 */
export async function acceptTicket(channel: TextChannel, acceptedBy: string): Promise<string> {
  const customerId = channel.topic?.match(/uid:(\d+)/)?.[1];
  if (!customerId) {
    return "⚠️ Konnte die Kunden-ID nicht aus dem Ticket ermitteln.";
  }

  try {
    await channel.permissionOverwrites.create(customerId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
  } catch (err) {
    return `⚠️ Zugriff konnte nicht erteilt werden: ${(err as Error).message}`;
  }

  const link = `https://discord.com/channels/${channel.guild.id}/${channel.id}`;
  let dmNote = "und per DM benachrichtigt";
  try {
    const user = await channel.client.users.fetch(customerId);
    await user.send(
      "✅ Gute Neuigkeiten — dein Projekt wurde angenommen!\n" +
        `Hier geht's zu deinem Ticket: ${link}\n` +
        "Dort besprechen wir alles Weitere.",
    );
  } catch {
    dmNote = "(DM fehlgeschlagen — DMs evtl. deaktiviert)";
  }

  return `✅ Angenommen von ${acceptedBy}. Der Kunde hat jetzt Zugriff ${dmNote}.`;
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
    const logChannel = await channel.client.channels.fetch(logChannelId).catch(() => null);
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
