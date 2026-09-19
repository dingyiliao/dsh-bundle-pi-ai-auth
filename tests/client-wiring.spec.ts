import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/client/index.ts'

describe('provider-card client wiring', () => {
  it('declares the dynamically mounted Remote namespace before a slot inject reads it', async () => {
    const authorization = { list: vi.fn() }
    const registered: Array<{ options: Record<string, unknown>; component: unknown }> = []
    const injected: string[][] = []
    const slots = {
      inject: (_name: string, factory: () => unknown) => { factory() },
      register: (options: Record<string, unknown>, component: unknown) => {
        registered.push({ options, component })
        return () => undefined
      },
    }
    const ctx = {
      remote: {
        $mount: vi.fn(() => Promise.resolve(() => Promise.resolve())),
      },
      slots,
      locale: { register: vi.fn(() => () => undefined) },
      effect: (callback: () => unknown, label?: string) => {
        if (label !== 'pi-ai-auth: provider-card styles') callback()
      },
      inject: (names: readonly string[], callback: (child: unknown) => void) => {
        injected.push([...names])
        callback({
          ...ctx,
          remote: { ...ctx.remote, piAiAuthorization: authorization },
        })
        return Promise.resolve()
      },
    }

    await apply(ctx as never)

    expect(injected).toEqual([['remote.piAiAuthorization', 'slots', 'locale']])
    expect(registered).toHaveLength(1)
    expect(registered[0]?.options).toMatchObject({
      name: 'settings.models.provider-card',
      key: 'llm-pi-ai',
      locale: 'piAiAuth',
    })
    const provide = registered[0]?.options['inject']
    expect(typeof provide).toBe('function')
    expect((provide as () => unknown)()).toEqual({ authorization })
  })
})
