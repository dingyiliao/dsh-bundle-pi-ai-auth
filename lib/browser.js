import { spawn } from 'node:child_process';
export function httpUrl(raw) {
    if (raw === undefined)
        return undefined;
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
    }
    catch {
        return undefined;
    }
}
function safeError(error) {
    return error instanceof Error && error.message.length > 0 ? error.message : 'unknown error';
}
/** Open one provider-owned authorization URL with the operating system browser. */
export function openBrowser(ctx, url) {
    const launch = process.platform === 'darwin'
        ? { command: '/usr/bin/open', args: [url] }
        : process.platform === 'win32'
            ? { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] }
            : { command: 'xdg-open', args: [url] };
    try {
        const child = spawn(launch.command, launch.args, { detached: true, stdio: 'ignore' });
        child.once('error', (error) => {
            ctx.logger.warn(`pi-ai-auth: failed to open the sign-in page: ${safeError(error)}`);
        });
        child.unref();
    }
    catch (error) {
        ctx.logger.warn(`pi-ai-auth: failed to open the sign-in page: ${safeError(error)}`);
    }
}
//# sourceMappingURL=browser.js.map