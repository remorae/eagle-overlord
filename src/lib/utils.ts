import Path from 'path';

export function loadAtRuntime(path: string, reload: boolean): any {
    if (reload) {
        delete require.cache[path];
    }
    return require(path);
}

export function resolveRelativeToMain(relativePath: string): string | null {
    if (require.main) {
        return Path.resolve(Path.dirname(require.main.filename), ...relativePath.split('/'));
    }
    return null;
}

export function escapeCodeBlocks(input: string): string {
    let escaped = input.replace(/```/g, '\\`\\`\\`');
    if (escaped.endsWith('`')) {
        escaped += ' ';
    }
    return escaped;
}