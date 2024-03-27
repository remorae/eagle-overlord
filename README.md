# eagle-overlord

A Discord bot application created for my old college CS Majors server.

I created, hosted, and used this bot over the course of many years starting in April 2017. Since I am long since graduated, the bot is no longer being hosted and the server has since become the responsibility of active students.

History may not reflect origin commit dates; it was altered when I moved accounts.

# Architecture

The bot is written in Typescript, uses the Discord.js library, and runs on Node.

It has an embedded CLI and can be partially modified while running.

The bot does not persist any state across sessions.
Errors are logged only to the console and to my Discord account via direct messages.

Discord IDs and sensitive credentials are stored in a JSON file that is excluded from source control.

Various commands can be run both inside of Discord guilds (servers) and direct messages.
These include: User/role management, arbitrary code compilation, information, and 'Advent of Code' event info/leaderboards.

While in use, the bot was deployed automatically to a [Fly.io](https://fly.io) machine using GitHub Actions.

# Build/Run Instructions

```
npm install
tsc
node dist/src/main.js
```

## Config

You *must* create a file in the `src` directory named `config.json` in order to run the bot.
This file stores obvious secrets and specific Discord ids.

An example outlining the contents of this file, sans actual ids/tokens, can be found at `src/config-example.json`.

