/**
 * Contract between the website and this bot.
 * Must stay in sync with the website's src/types/project-request.ts.
 */
export type ProjectRequest = {
  discordId: string;
  username: string;
  avatarUrl?: string;
  projectType: string;
  budget?: string;
  contact?: string;
  message: string;
  createdAt: string;
  /** Discord OAuth access token (guilds.join) — used once to add the user. */
  accessToken?: string;
};
