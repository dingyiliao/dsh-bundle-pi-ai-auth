import { beforeEach, describe, expect, it, vi } from 'vitest'

const child = vi.hoisted(() => ({ once: vi.fn(), unref: vi.fn() }))
const spawn = vi.hoisted(() => vi.fn(() => child))
vi.mock('node:child_process', () => ({ spawn }))

import { registerCommands } from '../src/commands.ts'

beforeEach(() => {
  spawn.mockClear()
  child.once.mockClear()
  child.unref.mockClear()
})

function invocation(rawInput = '') {
  return { agent: {}, rawInput, signal: new AbortController().signal }
}

interface HarnessOptions {
  base?: string[]
  user?: string[]
  configured?: string[]
  outcome?: 'authorized' | 'cancelled'
}

function harness(options: HarnessOptions = {}) {
  const commands = new Map<string, { handler(value: ReturnType<typeof invocation>): Promise<unknown> }>()
  const base = new Set(options.base ?? [])
  const user = new Set(options.user ?? [])
  const configured = new Set(options.configured ?? [])
  const deleted: string[] = []
  const mutations: Array<{ op: string; path: readonly string[]; value?: unknown }> = []
  const entries = [
    {
      key: 'llm-pi-ai/anthropic', label: 'Anthropic',
      methods: [{ id: 'oauth', label: 'Claude subscription' }, { id: 'api-key', label: 'API key' }], inFlight: false,
    },
    {
      key: 'llm-pi-ai/openai-codex', label: 'OpenAI Codex',
      methods: [{ id: 'oauth', label: 'ChatGPT' }], inFlight: false,
    },
    {
      key: 'llm-pi-ai/openai', label: 'OpenAI',
      methods: [{ id: 'api-key', label: 'API key' }], inFlight: false,
    },
  ]
  const ask = vi.fn((request: { questions: Array<{ id: string; options?: Array<{ label: string }> }> }) => {
    const question = request.questions[0]
    if (question === undefined) return Promise.reject(new Error('missing question'))
    if (question.options !== undefined) {
      return Promise.resolve({ answers: [{ id: question.id, selected: [question.options[0]?.label ?? ''], custom: '' }] })
    }
    return Promise.resolve({
      answers: [{ id: question.id, selected: [], custom: 'http://localhost/callback?code=ok' }],
    })
  })
  const begin = vi.fn(async ({ key, interaction }: {
    key: string
    interaction: { notify(value: unknown): void; prompt(value: unknown): Promise<string> }
  }) => {
    interaction.notify({ message: 'Continue in the browser', url: 'https://auth.example/start' })
    await interaction.prompt({ kind: 'text', message: 'Paste the callback URL' })
    if ((options.outcome ?? 'authorized') === 'authorized') configured.add(key)
    return { status: options.outcome ?? 'authorized' }
  })
  const providerObject = (values: Set<string>) => Object.fromEntries([...values].map(provider => [provider, {}]))
  const ctx = {
    logger: { info: vi.fn(), warn: vi.fn() },
    authorization: {
      list: () => entries,
      describe: (key: string) => entries.find(entry => entry.key === key),
      begin,
      cancel: vi.fn(),
    },
    commands: {
      register: (definition: { name: string; handler(value: ReturnType<typeof invocation>): Promise<unknown> }) => {
        commands.set(definition.name, definition)
        return () => { commands.delete(definition.name) }
      },
    },
    credentials: {
      describeRecord: (key: string) => Promise.resolve({
        configured: configured.has(key), writable: true,
        ...(configured.has(key) ? { kind: 'grant' } : {}),
      }),
      deleteRecord: (key: string) => {
        deleted.push(key)
        configured.delete(key)
        return Promise.resolve()
      },
    },
    settings: {
      describe: () => [{
        ns: 'llm-pi-ai',
        value: { providers: providerObject(new Set([...base, ...user])) },
        base: { providers: providerObject(base) },
        user: { providers: providerObject(user) },
      }],
      mutate: (_ns: string, ops: Array<{ op: 'set' | 'unset'; path: readonly string[]; value?: unknown }>) => {
        for (const op of ops) {
          mutations.push(op)
          const provider = op.path[1]
          if (provider !== undefined) op.op === 'set' ? user.add(provider) : user.delete(provider)
        }
        return Promise.resolve()
      },
    },
    userQuestions: { ask },
    effect: (callback: () => unknown) => callback(),
  }
  registerCommands(ctx as never)
  return { commands, deleted, mutations, ask, begin, base, user }
}

describe('generic pi-ai OAuth command bundle', () => {
  it('registers the fallback commands used by the Remote Service plugin', () => {
    const test = harness()
    expect([...test.commands.keys()]).toEqual([
      'auth-list', 'auth-add', 'auth-login', 'auth-status', 'auth-logout', 'auth-remove',
    ])
  })

  it('lists OAuth-capable providers separately from enablement and credential state', async () => {
    const test = harness({ user: ['anthropic'], configured: ['llm-pi-ai/anthropic'] })
    const result = await test.commands.get('auth-list')?.handler(invocation())
    expect(result).toEqual({ kind: 'success', text: expect.stringContaining('Anthropic（anthropic）：已启用 · 已登录') as string })
    expect(result).toEqual({ kind: 'success', text: expect.stringContaining('OpenAI Codex（openai-codex）：未添加') as string })
    expect(JSON.stringify(result)).not.toContain('OpenAI（openai）')
  })

  it('enables only the selected provider and then drives its existing OAuth flow', async () => {
    const test = harness()
    const result = await test.commands.get('auth-add')?.handler(invocation('openai-codex'))
    expect(result).toEqual({ kind: 'success', text: expect.stringContaining('登录成功') as string })
    expect(test.mutations).toContainEqual({
      op: 'set', path: ['providers', 'openai-codex'], value: {},
    })
    expect(test.begin).toHaveBeenCalledWith(expect.objectContaining({
      key: 'llm-pi-ai/openai-codex', method: 'oauth', interaction: expect.any(Object),
    }))
    expect(test.ask).toHaveBeenCalledOnce()
    expect(spawn).toHaveBeenCalledOnce()
    expect(spawn.mock.calls[0]?.[1]).toContain('https://auth.example/start')
  })

  it('offers only disabled OAuth providers when auth-add omits the provider id', async () => {
    const test = harness({ user: ['anthropic'] })
    await expect(test.commands.get('auth-add')?.handler(invocation()))
      .resolves.toEqual({ kind: 'success', text: expect.stringContaining('OpenAI Codex') as string })
    const selection = test.ask.mock.calls[0]?.[0].questions[0]
    expect(selection.options).toEqual([{ label: 'OpenAI Codex (openai-codex)' }])
    expect(test.user.has('openai-codex')).toBe(true)
  })

  it('rolls back a newly enabled provider when authorization is cancelled', async () => {
    const test = harness({ outcome: 'cancelled' })
    const result = await test.commands.get('auth-add')?.handler(invocation('anthropic'))
    expect(result).toEqual({ kind: 'error', text: expect.stringContaining('新增已回滚') as string })
    expect(test.mutations.map(op => op.op)).toEqual(['set', 'unset'])
    expect(test.user.has('anthropic')).toBe(false)
  })

  it('refuses login and logout until that provider has been enabled', async () => {
    const test = harness()
    await expect(test.commands.get('auth-login')?.handler(invocation('anthropic')))
      .resolves.toEqual({ kind: 'error', text: expect.stringContaining('请先运行 /auth-add anthropic') as string })
    await expect(test.commands.get('auth-logout')?.handler(invocation('anthropic')))
      .resolves.toEqual({ kind: 'error', text: expect.stringContaining('尚未启用') as string })
    expect(test.begin).not.toHaveBeenCalled()
    expect(test.deleted).toEqual([])
  })

  it('logs out without disabling the provider', async () => {
    const test = harness({ user: ['anthropic'], configured: ['llm-pi-ai/anthropic'] })
    await expect(test.commands.get('auth-logout')?.handler(invocation('anthropic')))
      .resolves.toEqual({ kind: 'success', text: expect.stringContaining('仍保持启用') as string })
    expect(test.deleted).toEqual(['llm-pi-ai/anthropic'])
    expect(test.user.has('anthropic')).toBe(true)
  })

  it('removes a user-added provider and credential but refuses a bundle-owned provider', async () => {
    const user = harness({ user: ['anthropic'], configured: ['llm-pi-ai/anthropic'] })
    await expect(user.commands.get('auth-remove')?.handler(invocation('anthropic')))
      .resolves.toEqual({ kind: 'success', text: expect.stringContaining('已移除') as string })
    expect(user.deleted).toEqual(['llm-pi-ai/anthropic'])
    expect(user.user.has('anthropic')).toBe(false)

    const base = harness({ base: ['openai-codex'], configured: ['llm-pi-ai/openai-codex'] })
    await expect(base.commands.get('auth-remove')?.handler(invocation('openai-codex')))
      .resolves.toEqual({ kind: 'error', text: expect.stringContaining('Bundle') as string })
    expect(base.deleted).toEqual([])
  })
})
