import { describe, expect, it } from 'vitest'
import { PI_AI_AUTH_REMOTE } from '../src/remote.ts'

describe('provider-card Remote contract', () => {
  it('owns the complete login and logout surface without a DSH controller patch', () => {
    expect(PI_AI_AUTH_REMOTE.package).toBe('@dingyiliao/dsh-pi-ai-auth')
    expect(PI_AI_AUTH_REMOTE.descriptors.map(descriptor => [descriptor.method, descriptor.mode ?? 'unary']))
      .toEqual([
        ['list', 'unary'],
        ['begin', 'stream'],
        ['answer', 'unary'],
        ['cancel', 'unary'],
        ['signOut', 'unary'],
      ])
    expect(PI_AI_AUTH_REMOTE.descriptors.every(descriptor => descriptor.service === 'piAiAuthorization')).toBe(true)
  })

  it('strictly validates browser-bound authorization frames', () => {
    const begin = PI_AI_AUTH_REMOTE.descriptors.find(descriptor => descriptor.method === 'begin')
    expect(begin?.result.mode).toBe('strict')
    if (begin?.result.mode !== 'strict') throw new Error('begin frame codec is not strict')
    expect(begin.result.create().parse({
      type: 'prompt',
      prompt: {
        promptId: 'prompt-1',
        kind: 'select',
        message: 'Choose an account',
        options: [{ id: 'one', label: 'One' }],
      },
    })).toEqual({
      type: 'prompt',
      prompt: {
        promptId: 'prompt-1',
        kind: 'select',
        message: 'Choose an account',
        options: [{ id: 'one', label: 'One' }],
      },
    })
    expect(() => begin.result.mode === 'strict' && begin.result.create().parse({ type: 'unknown' }))
      .toThrow('unknown authorization frame')
  })
})
