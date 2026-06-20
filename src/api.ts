import express from "express";
import type { Client } from "discord.js";
import { config } from "./config";
import { projectRequestSchema } from "./validation";
import { createTicket } from "./tickets";

/**
 * Internal HTTP API the website forwards project requests to.
 * Listens on PORT (4000) and must NOT be exposed publicly.
 */
export function startApiServer(client: Client): void {
  const app = express();
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ready: client.isReady(), bot: client.user?.tag ?? null });
  });

  app.post("/api/project-request", async (req, res) => {
    // 1) Bearer auth — constant string compare.
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${config.botApiSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 2) Validate payload.
    const parsed = projectRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error: "Validierung fehlgeschlagen",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    // 3) Make sure the bot is connected before we try to create a channel.
    if (!client.isReady()) {
      return res.status(503).json({ error: "Bot ist derzeit nicht verbunden. Bitte später erneut." });
    }

    // 4) Create the ticket.
    try {
      const result = await createTicket(client, parsed.data);
      if (result.alreadyOpen) {
        console.log(
          `↩️ Doppelte Anfrage von ${parsed.data.username} (${parsed.data.discordId}) — Ticket existiert bereits.`,
        );
        return res.status(409).json({
          error: "Du hast bereits eine offene Anfrage. Wir melden uns!",
          alreadyOpen: true,
        });
      }
      console.log(
        `🎫 Ticket erstellt (#${result.channelId}) für ${parsed.data.username} (${parsed.data.discordId})`,
      );
      return res.json({ ok: true, ticketChannelId: result.channelId });
    } catch (err) {
      console.error("Ticket-Erstellung fehlgeschlagen:", err);
      return res.status(500).json({ error: "Ticket konnte nicht erstellt werden" });
    }
  });

  app.listen(config.port, () => {
    console.log(`🌐 Interne API läuft auf Port ${config.port}`);
  });
}
