const { Client, GatewayIntentBits } = require("discord.js");
const c = require("./colors");
const log = require("./log");
const { devices, broadcast } = require("./state");

module.exports = function createDiscordBot({ gameApi, onStatus }) {
  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

  discord.once("clientReady", () => {
    if (onStatus) {
      onStatus("discord", true);
      onStatus("discordTag", discord.user.tag);
    }
    log.discord(`Logged in as ${c.bold}${discord.user.tag}${c.reset}`);
  });

  discord.on("messageCreate", (message) => {
    if (message.author.bot) return;
    if (CHANNEL_ID && message.channel.id !== CHANNEL_ID) return;
    if (!message.mentions.has(discord.user, { ignoreEveryone: true, ignoreRoles: true })) return;

    const text = message.content
      .replace(/<@!?\d+>/g, "")
      .trim()
      .toLowerCase();

    if (!text) {
      const names = Object.keys(devices);
      if (names.length === 0) {
        message.reply("No buildings found — is Timberborn running?");
      } else {
        const list = names.map((n) => {
          const d = devices[n];
          const state = d.on ? "on" : "off";
          return `• **${n}** (${d.type}, ${state})`;
        });
        message.reply(`Available buildings:\n${list.join("\n")}`);
      }
      return;
    }

    const names = Object.keys(devices);
    let matchedName = null;
    let command = null;

    for (let i = text.length; i >= 0; i--) {
      if (i < text.length && text[i] !== " ") continue;
      const candidate = text.slice(0, i).trim();
      if (!candidate) continue;
      const found = names.find((n) => n.toLowerCase() === candidate);
      if (found) {
        matchedName = found;
        command = i < text.length ? text.slice(i + 1).trim() : null;
        break;
      }
    }

    if (!matchedName) {
      const lastSpace = text.lastIndexOf(" ");
      const guess = lastSpace !== -1 ? text.slice(0, lastSpace).trim() : text;
      let hint = "";
      if (names.length > 0) {
        const similar = names.filter((n) => n.toLowerCase().includes(guess) || guess.includes(n.toLowerCase()));
        if (similar.length > 0) {
          hint = ` Did you mean: ${similar.map((n) => `**${n}**`).join(", ")}?`;
        } else {
          hint = ` Available buildings: ${names.map((n) => `**${n}**`).join(", ")}`;
        }
      } else {
        hint = " No buildings are currently known — is Timberborn running?";
      }
      message.reply(`Unknown building **${guess}**.${hint}`);
      return;
    }

    const device = devices[matchedName];

    if (!command) {
      message.reply(
        `Matched **${matchedName}** (${device.type}, ${device.on ? "on" : "off"}) ` +
        `but no command was given. Usage: \`@${discord.user.username} ${matchedName} on\``
      );
      return;
    }

    if (device.type === "adapter") {
      message.reply(`**${matchedName}** is currently **${device.on ? "on" : "off"}**`);
      return;
    }

    if (command !== "on" && command !== "off") {
      message.reply(
        `Unknown command **${command}** for lever **${matchedName}**. ` +
        `Valid commands: **on**, **off**.`
      );
      return;
    }

    const on = command === "on";
    const endpoint = on ? "switch-on" : "switch-off";
    const gameUrl = `${gameApi}/${endpoint}/${encodeURIComponent(matchedName)}`;

    fetch(gameUrl, { method: "POST" })
      .then(() => {
        devices[matchedName].on = on;
        broadcast();
        log.discord(`${c.bold}${message.author.username}${c.reset} => ${matchedName} ${command}`);
        log.lever(matchedName, on, "discord", message.author.username);
        message.reply(`Lever **${matchedName}** switched **${command}**`);
      })
      .catch((err) => {
        log.error("DISCORD", `Game API error: ${err.message}`);
        message.reply(`Could not reach the game API — is Timberborn running?`);
      });
  });

  if (process.env.DISCORD_BOT_TOKEN) {
    discord.login(process.env.DISCORD_BOT_TOKEN);
  } else {
    log.error("DISCORD", "DISCORD_BOT_TOKEN not set — bot disabled");
  }

  return discord;
};
