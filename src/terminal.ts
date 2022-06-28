import { Interface, createInterface } from 'readline';
import type { ClientInstance } from './client.js';
import type { ActivityType } from 'discord.js';
import type { UnionProperties } from './types.js';

export class Terminal {
    private readonly cli: Interface;

    public constructor(private readonly instance: ClientInstance) {
        this.cli = createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'Eagle Overlord> '
        });
        this.setupEvents();
    }

    private setupEvents() {
        this.cli.on('line', async (line) => {
            try {
                await this.processInput(line);
            }
            catch (e) {
                console.log(e);
            }
            this.cli.prompt();
        });
    }

    public prompt(this: Terminal): void {
        this.cli.prompt();
    }

    public close(this: Terminal): void {
        this.cli.close();
    }

    private exit(): void {
        console.log('Exiting...');
        process.exit(0);
    }

    private connectClient(this: Terminal): void {
        this.instance.shouldRespond = true;
        console.log('Now handling server commands.');
    }

    private disconnectClient(this: Terminal): void {
        this.instance.shouldRespond = false;
        console.log('No longer handling server commands.');
    }

    private handleSetActivity(this: Terminal, args: string[]) {
        const typeArg = args.shift();
        if (!typeArg) {
            console.error('Missing argument "type".');
        } else if (args.length === 0) {
            console.error('Missing argument "name".');
        } else {
            const name = args.join(' ');
            this.setActivity(typeArg, name);
        }
    }

    private setActivity(typeArg: string, name: string) {
        const type = typeArg.toUpperCase();
        const validTypes: UnionProperties<Exclude<ActivityType, 'CUSTOM'>> = {
            PLAYING: undefined,
            STREAMING: undefined,
            LISTENING: undefined,
            WATCHING: undefined,
            COMPETING: undefined,
        };
        if (type in validTypes) {
            const presence = this.instance.client.user?.setActivity(name, {
                type: type as Exclude<ActivityType, 'CUSTOM'>
            });
            console.log('Activity set to ', presence);
        }
        else {
            console.error(`Unknown type "${typeArg}"`);
        }
    }

    private processActivity(this: Terminal, args: string[]) {
        const subcommand = args.shift();
        if (subcommand) {
            switch (subcommand) {
                case 'set':
                    this.handleSetActivity(args);
                    break;
                default:
                    console.error(`Unknown argument "${subcommand}".`);
                    break;
            }
        }
        else {
            const {user} = this.instance.client;
            const guild = this.instance.client.guilds.cache.first();
            if (user && guild) {
                console.log(`Activity: ${guild.members.cache.get(user.id)?.presence}`);
            }
        }
    }

    private async refreshCommands(this: Terminal, global: boolean): Promise<void> {
        console.log('Setting up commands...');
        await this.instance.setupCommands();
        console.log('Pushing commands to Discord...');
        await this.instance.deployCommands(global);
        console.log('Setting command permissions...');
        await this.instance.setCommandPermissions();
        console.log('Refreshed commands.');
    }

    private async processInput(this: Terminal, line: string): Promise<void> {
        switch (line.trim()) {
            case 'quit':
            case 'exit':
                this.exit();
                break;
            case 'connect':
                this.connectClient();
                break;
            case 'disconnect':
                this.disconnectClient();
                break;
            case 'refresh-commands':
                await this.refreshCommands(false);
                break;
            case 'refresh-global-commands':
                await this.refreshCommands(true);
                break;
            default: {
                const args = line.split(' ');
                const subcommand = args.shift();
                if (subcommand) {
                    switch (args[0]) {
                        case 'activity':
                            this.processActivity(args);
                            break;
                        default:
                            console.error('Unknown command.');
                            break;
                    }
                }
                break;
            }
        }
    }
}