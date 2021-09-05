import { Interface, createInterface } from 'readline';
import { ClientInstance } from './client';
import { ActivityType } from 'discord.js';
import { UnionProperties } from './types';

export class Terminal {
    private readonly cli: Interface;

    public constructor(private readonly instance: ClientInstance) {
        this.cli = createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'Eagle Overlord> '
        });
        this.instance.client.on(`ready`, () => {
            this.cli.prompt();
        });
        this.cli.on('line', (line) => {
            this.processInput(line)
                .then(() => this.cli.prompt());
        });
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
        console.log(`Now handling server commands.`);
    }

    private disconnectClient(this: Terminal): void {
        this.instance.shouldRespond = false;
        console.log(`No longer handling server commands.`);
    }

    private setActivity(this: Terminal, args: string[],
        resolve: () => void): boolean {
        if (args.length === 2) {
            console.error(`Missing argument "type".`);
        } else if (args.length === 3) {
            console.error(`Missing argument "name".`);
        } else {
            const typeArg = args[2];
            const type = typeArg.toUpperCase();
            const validTypes: UnionProperties<Exclude<ActivityType, "CUSTOM">> = {
                PLAYING: undefined,
                STREAMING: undefined,
                LISTENING: undefined,
                WATCHING: undefined,
                COMPETING: undefined,
            };
            if (type in validTypes) {
                const name = args.slice(3).join(' ');
                const presence = this.instance.client.user?.setActivity(name, {
                    type: type as ActivityType
                });
                console.log(`Activity set to `, presence);
                resolve();
                return false;
            }
            else {
                console.error(`Unknown type "${typeArg}"`);
            }
        }
        return true;
    }

    private processActivity(this: Terminal, args: string[],
        resolve: () => void): boolean {
        if (args.length === 1) {
            const user = this.instance.client.user;
            const guild = this.instance.client.guilds.cache.first();
            if (user && guild) {
                console.log(`Activity: ${guild.members.cache.get(user.id)?.presence}`);
            }
        } else {
            switch (args[1]) {
                case `set`:
                    return this.setActivity(args, resolve);
                default:
                    console.error(`Unknown argument "${args[1]}".`);
                    break;
            }
        }
        return true;
    }

    private processInput(this: Terminal, line: string): Promise<void> {
        return new Promise((resolve) => {
            let resolveImmediately = true;
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
                default:
                    const args = line.split(' ');
                    if (args.length === 0) {
                        break;
                    }
                    switch (args[0]) {
                        case `activity`:
                            resolveImmediately = this.processActivity(args, resolve);
                            break;
                        default:
                            console.error(`Unknown command.`);
                            break;
                    }
                    break;
            }
            if (resolveImmediately) {
                resolve();
            }
        });
    }
}