import { spawn } from 'node:child_process'
import type { Context } from '@deepseek-ai/cordis'

export function httpUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function safeError(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : 'unknown error'
}

/** Open one provider-owned authorization URL with the operating system browser. */
export function openBrowser(ctx: Context, url: string): void {
  const launch = process.platform === 'darwin'
    ? { command: '/usr/bin/open', args: [url] }
    : process.platform === 'win32'
      ? { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] }
      : { command: 'xdg-open', args: [url] }
  try {
    const child = spawn(launch.command, launch.args, { detached: true, stdio: 'ignore' })
    child.once('error', (error: Error) => {
      ctx.logger.warn(`pi-ai-auth: failed to open the sign-in page: ${safeError(error)}`)
    })
    child.unref()
  } catch (error: unknown) {
    ctx.logger.warn(`pi-ai-auth: failed to open the sign-in page: ${safeError(error)}`)
  }
}
