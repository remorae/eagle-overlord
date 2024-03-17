# eagle-overlord

A Discord bot created for my old college CS Majors server.

I created, hosted, and used this bot over the course of many years starting in April 2017.

History may not reflect origin commit dates; it was altered when I moved accounts.

# Architecture

The bot is written in Typescript, uses the Discord.js library, and runs on Node.

It has an embedded CLI and can be partially modified while running.

The bot does not persist any state across sessions.
Errors are logged only to the console and to my Discord account via direct messages.

Discord IDs and sensitive credentials are stored in a JSON file that is excluded from source control.

Various commands can be run both inside of Discord guilds (servers) and direct messages.
These include: User/role management, arbitrary code compilation, information, and 'Advent of Code' event info/leaderboards.

## Config

You *must* create a file in the `src` directory named `config.json` in order to run the bot.

Currently the expected interface of this is determined almost entirely by usage in locations where the file is read.
See lines such as:
```ts
// client.ts
import config from './config.json';
// ...
export class ClientInstance extends EventEmitter {
    private rest = new REST({ version: '9' }).setToken(config.client.token);
}
// ...
```

This file stores obvious secrets and specific Discord ids.
