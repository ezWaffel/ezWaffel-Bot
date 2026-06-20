# ezWaffel Bot

Discord-Bot für **ezWaffel** — empfängt Projektanfragen von der Website über eine
interne API und macht daraus **Tickets** (private Kanäle, in denen du mit dem
Kunden chatten kannst), plus **Moderations-Commands**.

Stack: **TypeScript + discord.js v14 + Express**. Läuft auf **CT 101** (Port 4000),
betrieben mit **PM2**. Die interne API ist **nicht** öffentlich erreichbar.

---

## 1. Was der Bot macht

- **Interne API** `POST /api/project-request` auf Port 4000, abgesichert mit
  `Authorization: Bearer <BOT_API_SECRET>` (gleiches Secret wie die Website).
- **Ticket-System:** Jede Anfrage erzeugt einen privaten Ticket-Kanal (Kategorie
  „Tickets") mit Embed (Name, Discord-ID, Projektart, Budget, Kontakt, Nachricht),
  **Übernehmen**- und **Schließen**-Button und einem **Einladungslink** für den
  Kunden. Beim Schließen wird ein Transcript erzeugt.
- **Moderation:** `/kick`, `/ban`, `/timeout`, `/clear`, `/warn` (mit Rechte-Prüfung)
  sowie `/ping`, `/help`, `/close`.

---

## 2. Ordnerstruktur

```
ezwaffel-bot/
├── package.json
├── tsconfig.json
├── ecosystem.config.cjs      # PM2
├── .env.example
└── src/
    ├── index.ts              # Start: Client-Login + API
    ├── config.ts             # Env laden/prüfen
    ├── client.ts             # discord.js Client + Intents
    ├── api.ts                # Express-API (:4000, Bearer-Auth)
    ├── tickets.ts            # Ticket erstellen/schließen + Transcript
    ├── commands.ts           # Slash-Command-Definitionen + Registrierung
    ├── handlers.ts           # Command- & Button-Logik
    ├── validation.ts         # zod-Schema der Anfrage
    └── types.ts              # ProjectRequest (Vertrag mit der Website)
```

---

## 3. Discord Developer Portal

Du kannst **dieselbe App** wie für den Website-Login verwenden (`Application ID`
ist `DISCORD_CLIENT_ID`).

1. https://discord.com/developers/applications → deine App → **Bot**.
2. **Reset Token** → Token kopieren → `.env` als `DISCORD_TOKEN` (geheim!).
3. Unter **Privileged Gateway Intents** aktivieren:
   - **Server Members Intent** (für Kick/Ban/Timeout)
   - **Message Content Intent** (für Ticket-Transcripts)
4. Bot einladen (URL anpassen mit deiner Client-ID):
   ```
   https://discord.com/oauth2/authorize?client_id=DEINE_CLIENT_ID&scope=bot%20applications.commands&permissions=1393093854790
   ```
   Die `permissions` decken ab: Kanäle verwalten, Einladung erstellen, Kanal sehen,
   Nachrichten senden/verwalten, Verlauf lesen, Kicken, Bannen, Mitglieder moderieren.
5. **Developer Mode** in Discord aktivieren (Einstellungen → Erweitert), dann per
   Rechtsklick die IDs kopieren: Server-ID (`DISCORD_GUILD_ID`), Kategorie
   (`TICKET_CATEGORY_ID`), Staff-Rolle (`STAFF_ROLE_ID`), Log-Kanal (`LOG_CHANNEL_ID`).

---

## 4. Umgebungsvariablen

| Variable | Zweck |
| --- | --- |
| `DISCORD_TOKEN` | Bot-Token (geheim) |
| `DISCORD_CLIENT_ID` | Application ID (gleiche App wie der Login) |
| `DISCORD_GUILD_ID` | Server, in dem der Bot arbeitet |
| `BOT_API_SECRET` | **muss identisch** zur Website sein |
| `PORT` | API-Port (Standard 4000) |
| `TICKET_CATEGORY_ID` | Kategorie für Ticket-Kanäle (optional) |
| `STAFF_ROLE_ID` | Rolle, die alle Tickets sieht (optional) |
| `LOG_CHANNEL_ID` | Kanal für Transcripts beim Schließen (optional) |

---

## 5. Installation, Build & Betrieb

```bash
npm install
cp .env.example .env     # ausfüllen
npm run build            # tsc -> dist/
npm start                # node dist/index.js
# Entwicklung:
npm run dev              # tsx watch
```

Production mit PM2 (auf CT 101, z. B. /opt/ezwaffel/discord-bot):

```bash
npm install && npm run build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
pm2 logs ezwaffel-bot
```

---

## 6. Verbindung zur Website

Die Website sendet `POST http://<CT101-IP>:4000/api/project-request` mit
`Authorization: Bearer <BOT_API_SECRET>` und folgendem Body:

```ts
type ProjectRequest = {
  discordId: string; username: string; avatarUrl?: string;
  projectType: string; budget?: string; contact?: string;
  message: string; createdAt: string;
};
```

Damit es live geht, auf der **Website** (CT 100) in der `.env`:
`BOT_API_URL=http://192.168.100.47:4000/api/project-request`, `BOT_API_SECRET`
identisch, und `BOT_API_MOCK=false`, dann `pm2 restart ezwaffel-portfolio`.

---

## 7. Sicherheit

- Port **4000 bleibt intern** — niemals über Nginx Proxy Manager veröffentlichen.
- API verlangt das Bearer-Token bei **jeder** Anfrage; alle Eingaben werden
  serverseitig (zod) validiert.
- Moderations-Commands sind über `default_member_permissions` abgesichert und
  prüfen zusätzlich die Rollen-Hierarchie.
- `DISCORD_TOKEN` und `BOT_API_SECRET` gehören nur in die `.env` (nie committen).

Health-Check: `GET http://<CT101-IP>:4000/health`.
