import { Events } from "discord.js";
import { client } from "./client";
import { config } from "./config";
import { registerCommands } from "./commands";
import { registerHandlers } from "./handlers";
import { startApiServer } from "./api";

async function main(): Promise<void> {
  registerHandlers(client);
  // Start the API immediately so /health responds and the website always gets a
  // clean response, even if Discord is briefly unreachable.
  startApiServer(client);

  client.once(Events.ClientReady, async (ready) => {
    console.log(`🤖 Eingeloggt als ${ready.user.tag}`);
    try {
      await registerCommands();
    } catch (err) {
      console.error("Command-Registrierung fehlgeschlagen:", err);
    }
  });

  // Login failure shouldn't crash the API — log it and let PM2/ops see it.
  client.login(config.token).catch((err) => {
    console.error("Discord-Login fehlgeschlagen:", err);
  });
}

main().catch((err) => {
  console.error("Fataler Fehler beim Start:", err);
  process.exit(1);
});
