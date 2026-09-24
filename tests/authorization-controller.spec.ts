import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthorizationDeclinedError } from '@deepseek-ai/dsh-authorization'
import type { PiAiAuthorizationFrame } from '../src/wire.ts'

vi.mock('node:child_process', () => ({ spawn: vi.fn() }))

// Use the production TypeScript build to lower standard @Remote decorators.
import { PiAiAuthorizationController } from '../lib/authorization-controller.js'

const KEY = 'llm-pi-ai/openai-codex'
const disposers: Array<() => void> = []

interface BeginRequest {
  key: string
  method: string
  signal: AbortSignal
  interaction: {
    notify(notice: { message: string }): void
    prompt(prompt: { kind: 'text'; message: string; placeholder?: string; signal?: AbortSignal }): Promise<string>
  }
}

type Outcome = { status: 'authorized' | 'cancelled' }

function harness(run: (request: BeginRequest) => Promise<Outcome> = async () => ({ status: 'authorized' })) {
  const entry = {
    key: KEY, label: 'OpenAI Codex', inFlight: false,
    methods: [{ id: 'oauth', label: 'ChatGPT' }],
  }
  const begin = vi.fn(run)
  let dispose = (): void => {}
  const ctx = {
    authorization: {
      describe: (key: string) => key === KEY ? entry : undefined,
      list: () => [entry],
      begin,
      cancel: vi.fn(),
    },
    commands: { register: vi.fn() },
    credentials: { describeRecord: async () => ({ configured: false }) },
    logger: { warn: vi.fn() },
    effect: (callback: () => () => void) => { dispose = callback() },
  }
  const controller = new PiAiAuthorizationController(ctx as never)
  disposers.push(() => { dispose() })
  return { controller, begin, dispose: () => { dispose() } }
}

async function nextPrompt(stream: AsyncGenerator<PiAiAuthorizationFrame>) {
  const frame = await stream.next()
  if (frame.done || frame.value.type !== 'prompt') throw new Error('Expected an authorization prompt')
  return frame.value.prompt
}

async function remainingFrames(stream: AsyncGenerator<PiAiAuthorizationFrame>) {
  const frames: PiAiAuthorizationFrame[] = []
  for await (const frame of stream) frames.push(frame)
  return frames
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})

describe('provider-card authorization controller', () => {
  it('forwards a prompt answer, withdraws the prompt and settles the stream', async () => {
    const received = vi.fn()
    const test = harness(async ({ interaction }) => {
      received(await interaction.prompt({ kind: 'text', message: 'Paste callback URL', placeholder: 'https://…' }))
      return { status: 'authorized' }
    })
    const stream = test.controller.begin(KEY, new AbortController().signal)
    const prompt = await nextPrompt(stream)

    expect(prompt).toMatchObject({ kind: 'text', message: 'Paste callback URL', placeholder: 'https://…' })
    expect(test.begin).toHaveBeenCalledWith(expect.objectContaining({ key: KEY, method: 'oauth' }))
    expect((await test.controller.list())[0]?.inFlight).toBe(true)
    expect(test.controller.answer(KEY, 'stale-prompt', 'ignored')).toBe(false)
    expect(test.controller.answer(KEY, prompt.promptId, 'callback-code')).toBe(true)
    expect(test.controller.answer(KEY, prompt.promptId, 'second answer')).toBe(false)
    expect(await remainingFrames(stream)).toEqual([
      { type: 'prompt-withdrawn', promptId: prompt.promptId },
      { type: 'settled', status: 'authorized' },
    ])
    expect(received).toHaveBeenCalledExactlyOnceWith('callback-code')
    expect((await test.controller.list())[0]?.inFlight).toBe(false)
  })

  it('aborts the provider and rejects its pending prompt when the stream signal is cancelled', async () => {
    const rejected = vi.fn()
    const test = harness(async ({ interaction }) => {
      try {
        await interaction.prompt({ kind: 'text', message: 'Paste callback URL' })
      } catch (error) {
        rejected(error)
        throw error
      }
      return { status: 'authorized' }
    })
    const abort = new AbortController()
    const stream = test.controller.begin(KEY, abort.signal)
    const prompt = await nextPrompt(stream)
    const reason = new Error('client disconnected')

    abort.abort(reason)

    expect(test.begin.mock.calls[0]?.[0].signal.reason).toBe(reason)
    expect(test.controller.answer(KEY, prompt.promptId, 'too late')).toBe(false)
    expect(await remainingFrames(stream)).toEqual([
      { type: 'prompt-withdrawn', promptId: prompt.promptId },
      { type: 'settled', status: 'cancelled' },
    ])
    expect(rejected).toHaveBeenCalledWith(expect.any(AuthorizationDeclinedError))
    expect((await test.controller.list())[0]?.inFlight).toBe(false)
  })

  it('withdraws a prompt cancelled by the provider signal', async () => {
    const abort = new AbortController()
    const reason = new Error('provider completed its browser callback')
    const rejected = vi.fn()
    const test = harness(async ({ interaction }) => {
      try {
        await interaction.prompt({ kind: 'text', message: 'Paste callback URL', signal: abort.signal })
      } catch (error) {
        rejected(error)
      }
      return { status: 'cancelled' }
    })
    const stream = test.controller.begin(KEY, new AbortController().signal)
    const prompt = await nextPrompt(stream)

    abort.abort(reason)

    expect(await remainingFrames(stream)).toEqual([
      { type: 'prompt-withdrawn', promptId: prompt.promptId },
      { type: 'settled', status: 'cancelled' },
    ])
    expect(rejected).toHaveBeenCalledExactlyOnceWith(expect.any(Error))
    expect(rejected.mock.calls[0]?.[0]).not.toBeInstanceOf(AuthorizationDeclinedError)
    expect(rejected.mock.calls[0]?.[0].cause).toBe(reason)
    expect(test.controller.answer(KEY, prompt.promptId, 'too late')).toBe(false)
  })

  it('rejects duplicate login and disposes the active provider and prompt', async () => {
    const rejected = vi.fn()
    const test = harness(async ({ interaction }) => {
      try {
        await interaction.prompt({ kind: 'text', message: 'Paste callback URL' })
      } catch (error) {
        rejected(error)
        throw error
      }
      return { status: 'authorized' }
    })
    const stream = test.controller.begin(KEY, new AbortController().signal)
    const prompt = await nextPrompt(stream)
    const duplicate = test.controller.begin(KEY, new AbortController().signal)

    await expect(duplicate.next()).rejects.toThrow('authorization is already running')
    expect(test.begin).toHaveBeenCalledOnce()
    test.dispose()

    expect(test.begin.mock.calls[0]?.[0].signal.aborted).toBe(true)
    expect(test.controller.answer(KEY, prompt.promptId, 'too late')).toBe(false)
    expect(await remainingFrames(stream)).toEqual([{ type: 'prompt-withdrawn', promptId: prompt.promptId }])
    expect(rejected).toHaveBeenCalledWith(expect.any(AuthorizationDeclinedError))
    expect((await test.controller.list())[0]?.inFlight).toBe(false)
  })

  it('does not start authorization for an already-aborted stream', async () => {
    const test = harness()
    const abort = new AbortController()
    const reason = new Error('stream already closed')
    abort.abort(reason)

    await expect(test.controller.begin(KEY, abort.signal).next()).rejects.toBe(reason)
    expect(test.begin).not.toHaveBeenCalled()
    expect((await test.controller.list())[0]?.inFlight).toBe(false)
  })

  it('rejects an already-aborted prompt without retaining an interaction', async () => {
    const abort = new AbortController()
    const reason = new Error('prompt already withdrawn')
    abort.abort(reason)
    const rejected = vi.fn()
    const test = harness(async ({ interaction }) => {
      try {
        await interaction.prompt({ kind: 'text', message: 'Obsolete prompt', signal: abort.signal })
      } catch (error) {
        rejected(error)
      }
      await interaction.prompt({ kind: 'text', message: 'Current prompt' })
      return { status: 'authorized' }
    })
    const stream = test.controller.begin(KEY, new AbortController().signal)
    const prompt = await nextPrompt(stream)

    expect(rejected).toHaveBeenCalledExactlyOnceWith(expect.any(Error))
    expect(rejected.mock.calls[0]?.[0]).not.toBeInstanceOf(AuthorizationDeclinedError)
    expect(rejected.mock.calls[0]?.[0].cause).toBe(reason)
    expect(prompt.message).toBe('Current prompt')
    expect(test.controller.answer(KEY, prompt.promptId, 'current answer')).toBe(true)
    expect(await remainingFrames(stream)).toEqual([
      { type: 'prompt-withdrawn', promptId: prompt.promptId },
      { type: 'settled', status: 'authorized' },
    ])
  })

  it('rejects a provider prompt requested after the stream was aborted', async () => {
    const ready = Promise.withResolvers<void>()
    const rejected = vi.fn()
    const test = harness(async ({ interaction }) => {
      interaction.notify({ message: 'Waiting for provider' })
      await ready.promise
      try {
        await interaction.prompt({ kind: 'text', message: 'Late prompt' })
      } catch (error) {
        rejected(error)
        throw error
      }
      return { status: 'authorized' }
    })
    const abort = new AbortController()
    const stream = test.controller.begin(KEY, abort.signal)
    await expect(stream.next()).resolves.toEqual({ done: false, value: { type: 'notice', message: 'Waiting for provider' } })
    const reason = new Error('stream closed before provider prompted')

    abort.abort(reason)
    ready.resolve()

    await expect(stream.next()).resolves.toEqual({ done: false, value: { type: 'settled', status: 'cancelled' } })
    expect(rejected).toHaveBeenCalledExactlyOnceWith(expect.any(AuthorizationDeclinedError))
    await expect(stream.next()).resolves.toEqual({ done: true, value: undefined })
    expect((await test.controller.list())[0]?.inFlight).toBe(false)
  })
})
