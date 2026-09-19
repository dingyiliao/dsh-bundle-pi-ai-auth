export class TypertRemoteService {
  protected readonly ctx: unknown

  constructor(ctx: unknown, _serviceKey: string) {
    this.ctx = ctx
  }
}

export function Remote(...args: unknown[]): unknown {
  if (args.length === 2) return undefined
  return () => undefined
}
