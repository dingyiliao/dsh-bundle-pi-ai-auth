import type { Context } from '@deepseek-ai/cordis'
import {
  AuthorizationDeclinedError,
  type AuthorizationEntry,
  type AuthorizationPrompt,
} from '@deepseek-ai/dsh-authorization'
import { credentialKey, type CredentialKey } from '@deepseek-ai/dsh-credentials'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { httpUrl, openBrowser } from './browser.js'
import type {
  PiAiAuthorizationEntry,
  PiAiAuthorizationFrame,
  PiAiAuthorizationPrompt,
} from './wire.js'

const SETTINGS_NS = 'llm-pi-ai'
const KEY_PREFIX = `${SETTINGS_NS}/`

interface PendingPrompt {
  readonly id: string
  readonly resolve: (value: string) => void
  readonly reject: (reason: unknown) => void
}

interface ActiveAuthorization {
  readonly key: CredentialKey
  readonly abort: AbortController
  readonly channel: FrameChannel
  openedUrl?: string
  prompt: PendingPrompt | undefined
  cancelled: boolean
}

class FrameChannel implements AsyncIterable<PiAiAuthorizationFrame> {
  private readonly values: PiAiAuthorizationFrame[] = []
  private readonly waiters: Array<(value: IteratorResult<PiAiAuthorizationFrame>) => void> = []
  private closed = false

  push(value: PiAiAuthorizationFrame): void {
    if (this.closed) return
    const waiter = this.waiters.shift()
    if (waiter === undefined) this.values.push(value)
    else waiter({ done: false, value })
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    for (const waiter of this.waiters.splice(0)) waiter({ done: true, value: undefined })
  }

  [Symbol.asyncIterator](): AsyncIterator<PiAiAuthorizationFrame> {
    return {
      next: () => {
        const value = this.values.shift()
        if (value !== undefined) return Promise.resolve({ done: false, value })
        if (this.closed) return Promise.resolve({ done: true, value: undefined })
        return new Promise(resolve => { this.waiters.push(resolve) })
      },
    }
  }
}

function safeError(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : 'Authorization failed'
}

function providerFromRawKey(rawKey: string): string | undefined {
  if (!rawKey.startsWith(KEY_PREFIX)) return undefined
  const provider = rawKey.slice(KEY_PREFIX.length)
  return provider.length > 0 && !provider.includes('/') ? provider : undefined
}

function keyFor(provider: string): CredentialKey {
  return credentialKey(SETTINGS_NS, provider)
}

function isOAuthEntry(entry: AuthorizationEntry | undefined): entry is AuthorizationEntry {
  return entry !== undefined && entry.methods.some(method => method.id === 'oauth')
}

function wirePrompt(promptId: string, prompt: AuthorizationPrompt): PiAiAuthorizationPrompt {
  if (prompt.kind === 'select') {
    return {
      promptId,
      kind: prompt.kind,
      message: prompt.message,
      options: prompt.options.map(option => ({
        id: option.id,
        label: option.label,
        ...(option.description === undefined ? {} : { description: option.description }),
      })),
    }
  }
  return {
    promptId,
    kind: prompt.kind,
    message: prompt.message,
    ...(prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder }),
  }
}

/** Bundle-local Remote bridge used only by the provider-card browser extension. */
export class PiAiAuthorizationController extends TypertRemoteService {
  private readonly active = new Map<string, ActiveAuthorization>()
  private promptSerial = 0

  constructor(ctx: Context) {
    super(ctx, 'piAiAuthorization')
    ctx.effect(() => () => {
      for (const authorization of this.active.values()) {
        authorization.cancelled = true
        authorization.abort.abort('pi-ai authorization controller disposed')
        authorization.prompt?.reject(new AuthorizationDeclinedError('authorization controller disposed'))
        authorization.channel.close()
      }
      this.active.clear()
    }, 'pi-ai-auth: dispose active provider authorizations')
  }

  private entry(rawKey: string): { key: CredentialKey; entry: AuthorizationEntry } {
    const provider = providerFromRawKey(rawKey)
    if (provider === undefined) throw new TypeError('Only llm-pi-ai provider authorization keys are accepted')
    const key = keyFor(provider)
    const entry = this.ctx.authorization.describe(key)
    if (!isOAuthEntry(entry)) throw new TypeError(`Provider ${JSON.stringify(provider)} has no OAuth flow`)
    return { key, entry }
  }

  @Remote('list')
  async list(): Promise<readonly PiAiAuthorizationEntry[]> {
    const entries = this.ctx.authorization.list().filter(isOAuthEntry).filter(entry =>
      providerFromRawKey(String(entry.key)) !== undefined)
    return await Promise.all(entries.map(async (entry) => {
      const record = await this.ctx.credentials.describeRecord(entry.key)
      return {
        key: String(entry.key),
        label: entry.label,
        methods: entry.methods.map(method => ({ id: method.id, label: method.label })),
        inFlight: entry.inFlight || this.active.has(String(entry.key)),
        configured: record.configured,
        ...(record.kind === undefined ? {} : { credentialKind: record.kind }),
      }
    }))
  }

  @Remote({ mode: 'stream' })
  async *begin(rawKey: string, method: string | undefined, signal: AbortSignal): AsyncGenerator<PiAiAuthorizationFrame> {
    const { key, entry } = this.entry(rawKey)
    if (this.active.has(rawKey) || entry.inFlight) throw new Error(`${entry.label} authorization is already running`)
    const selectedMethod = method ?? 'oauth'
    if (!entry.methods.some(candidate => candidate.id === selectedMethod)) {
      throw new TypeError(`Authorization method ${JSON.stringify(selectedMethod)} is not available`)
    }

    const active: ActiveAuthorization = {
      key,
      abort: new AbortController(),
      channel: new FrameChannel(),
      cancelled: false,
      prompt: undefined,
    }
    this.active.set(rawKey, active)
    const onAbort = (): void => {
      active.cancelled = true
      active.abort.abort(signal.reason)
      active.prompt?.reject(new AuthorizationDeclinedError('authorization stream closed'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    active.channel.push({ type: 'started', key: rawKey })
    void this.run(rawKey, entry, selectedMethod, active)

    try {
      for await (const frame of active.channel) yield frame
    } finally {
      signal.removeEventListener('abort', onAbort)
      if (this.active.get(rawKey) === active) {
        active.cancelled = true
        active.abort.abort('authorization stream closed')
        active.prompt?.reject(new AuthorizationDeclinedError('authorization stream closed'))
      }
    }
  }

  private async run(
    rawKey: string,
    entry: AuthorizationEntry,
    method: string,
    active: ActiveAuthorization,
  ): Promise<void> {
    try {
      const outcome = await this.ctx.authorization.begin({
        key: active.key,
        method,
        signal: active.abort.signal,
        interaction: {
          notify: (notice) => {
            const url = httpUrl(notice.url)
            active.channel.push({
              type: 'notice',
              message: notice.message,
              ...(url === undefined ? {} : { url }),
              ...(notice.code === undefined ? {} : { code: notice.code }),
            })
            if (url !== undefined && active.openedUrl !== url) {
              active.openedUrl = url
              openBrowser(this.ctx, url)
            }
          },
          prompt: prompt => this.ask(active, prompt),
        },
      })
      active.channel.push({ type: 'settled', status: outcome.status })
    } catch (error: unknown) {
      if (active.cancelled || active.abort.signal.aborted) {
        active.channel.push({ type: 'settled', status: 'cancelled' })
      } else {
        this.ctx.logger.warn(`pi-ai-auth(${entry.label}): ${safeError(error)}`)
        active.channel.push({ type: 'failed', message: safeError(error) })
      }
    } finally {
      active.prompt?.reject(new AuthorizationDeclinedError('authorization settled'))
      active.prompt = undefined
      if (this.active.get(rawKey) === active) this.active.delete(rawKey)
      active.channel.close()
    }
  }

  private ask(active: ActiveAuthorization, prompt: AuthorizationPrompt): Promise<string> {
    if (active.prompt !== undefined) throw new Error('Provider requested overlapping authorization prompts')
    const promptId = `prompt-${String(++this.promptSerial)}`
    return new Promise<string>((resolve, reject) => {
      const finish = (callback: () => void): void => {
        prompt.signal?.removeEventListener('abort', onAbort)
        if (active.prompt?.id === promptId) active.prompt = undefined
        active.channel.push({ type: 'prompt-withdrawn', promptId })
        callback()
      }
      const onAbort = (): void => {
        finish(() => { reject(new AuthorizationDeclinedError('authorization prompt withdrawn')) })
      }
      active.prompt = {
        id: promptId,
        resolve: value => { finish(() => { resolve(value) }) },
        reject: reason => { finish(() => { reject(reason) }) },
      }
      prompt.signal?.addEventListener('abort', onAbort, { once: true })
      active.channel.push({ type: 'prompt', prompt: wirePrompt(promptId, prompt) })
    })
  }

  @Remote('answer')
  answer(rawKey: string, promptId: string, value: string): boolean {
    this.entry(rawKey)
    const prompt = this.active.get(rawKey)?.prompt
    if (prompt?.id !== promptId) return false
    prompt.resolve(value)
    return true
  }

  @Remote('decline')
  decline(rawKey: string, promptId: string): boolean {
    this.entry(rawKey)
    const prompt = this.active.get(rawKey)?.prompt
    if (prompt?.id !== promptId) return false
    prompt.reject(new AuthorizationDeclinedError('authorization prompt dismissed'))
    return true
  }

  @Remote('cancel')
  cancel(rawKey: string): boolean {
    const { key } = this.entry(rawKey)
    const active = this.active.get(rawKey)
    if (active === undefined) return false
    active.cancelled = true
    this.ctx.authorization.cancel(key)
    active.abort.abort('authorization cancelled')
    active.prompt?.reject(new AuthorizationDeclinedError('authorization cancelled'))
    return true
  }

  @Remote('signOut')
  async signOut(rawKey: string): Promise<boolean> {
    const { key } = this.entry(rawKey)
    const active = this.active.get(rawKey)
    if (active !== undefined) {
      active.cancelled = true
      this.ctx.authorization.cancel(key)
      active.abort.abort('signed out')
      active.prompt?.reject(new AuthorizationDeclinedError('signed out'))
    }
    await this.ctx.credentials.deleteRecord(key)
    return true
  }
}
