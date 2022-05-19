# eagle-overlord

A Discord bot created for my old college CS Majors server.

I created, hosted, and used this bot over the course of many years starting in April 2017.

# Architecture

The bot is written in Typescript, uses the Discord.js library, and runs on Node.

It has an embedded CLI and can be partially modified while running.

The bot is stateless and does not persistently track any information.
Errors are logged only to the console and to my Discord account via direct messages.

Discord IDs and sensitive credentials are stored in a JSON file that is excluded from source control.

Various commands can be run both inside of Discord guilds (servers) and direct messages.
These include: User/role management, arbitrary code compilation, information, and 'Advent of Code' event info/leaderboards.

# Remaining Tasks

I'm currently in the process of updating the bot to use Discord's slash commands.

- [ ] Convert remaining text commands to slash commands
- [ ] Support programmable commands from within Discord?
- [ ] Reduce dependencies on specific IDs
- [ ] Code cleanup
- [ ] Fix/write tests
