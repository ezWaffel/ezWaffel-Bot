import { promises as fs } from "fs";
import path from "path";
import { config } from "./config";

/**
 * Runtime-settable configuration, changeable live via /config and persisted to
 * data/settings.json. Each value falls back to the corresponding .env value when
 * not set, so .env acts as the default.
 */
export type Settings = {
  ticketCategoryId?: string;
  staffRoleId?: string;
  logChannelId?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "settings.json");

let cache: Settings = {};

export async function loadSettings(): Promise<void> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    cache = JSON.parse(raw) as Settings;
  } catch {
    cache = {};
  }
}

async function persist(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(cache, null, 2), "utf-8");
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  if (!value) delete cache[key];
  else cache[key] = value;
  await persist();
}

export function getStoredSettings(): Settings {
  return { ...cache };
}

/** Effective values: live store overrides the .env default. */
export function effectiveTicketCategoryId(): string | undefined {
  return cache.ticketCategoryId ?? config.ticketCategoryId;
}
export function effectiveStaffRoleId(): string | undefined {
  return cache.staffRoleId ?? config.staffRoleId;
}
export function effectiveLogChannelId(): string | undefined {
  return cache.logChannelId ?? config.logChannelId;
}
