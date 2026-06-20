/**
 * PM2 config for the ezWaffel bot (production).
 *
 * Deploy on CT 101 (e.g. /opt/ezwaffel/discord-bot):
 *   npm install && npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "ezwaffel-bot",
      script: "dist/index.js",
      cwd: "/opt/ezwaffel/discord-bot",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
