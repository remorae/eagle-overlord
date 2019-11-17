import { Interface, createInterface } from 'readline';
import { ClientInstance } from './client';
import { Presence } from 'discord.js';

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

    private setStatus(this: Terminal, args: string[],
        resolve: () => void): boolean {
        if (args.length === 2) {
            console.error(`Missing argument "type".`);
        } else if (args.length === 3) {
            console.error(`Missing argument "name".`);
        } else {
            const typeArg = args[2];
            const type = typeArg.toUpperCase();
            switch (type) {
                case `PLAYING`:
                case `STREAMING`:
                case `LISTENING`:
                case `WATCHING`:
                    const name = args.slice(3).join(' ');
                    this.instance.client.user.setActivity(name, {
                        type: type
                    })
                        .then((presence: Presence) => {
                            console.log(`Activity set to `, presence);
                            resolve();
                        })
                        .catch((err: Error) => {
                            this.instance.reportError(err);
                            resolve();
                        });
                    return false;
                default:
                    console.error(`Unknown type "${typeArg}"`);
                    break;
            }
        }
        return true;
    }

    private processStatus(this: Terminal, args: string[],
        resolve: () => void): boolean {
        if (args.length === 1) {
            console.log(this.instance.client.user.presence);
        } else {
            switch (args[1]) {
                case `set`:
                    return this.setStatus(args, resolve);
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
                        case `status`:
                            resolveImmediately = this.processStatus(args, resolve);
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