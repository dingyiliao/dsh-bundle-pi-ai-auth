/** Browser-safe authorization state derived from the provider-owned credential record. */
export interface PiAiAuthorizationEntry {
  readonly key: string
  readonly label: string
  readonly methods: readonly { readonly id: string; readonly label: string }[]
  readonly inFlight: boolean
  readonly configured: boolean
  readonly credentialKind?: 'api-key' | 'grant'
}

export interface PiAiAuthorizationPrompt {
  readonly promptId: string
  readonly kind: 'text' | 'secret' | 'select'
  readonly message: string
  readonly placeholder?: string
  readonly options?: readonly {
    readonly id: string
    readonly label: string
    readonly description?: string
  }[]
}

/** Ordered frames emitted by one interactive authorization stream. */
export type PiAiAuthorizationFrame =
  | { readonly type: 'started'; readonly key: string }
  | { readonly type: 'notice'; readonly message: string; readonly url?: string; readonly code?: string }
  | { readonly type: 'prompt'; readonly prompt: PiAiAuthorizationPrompt }
  | { readonly type: 'prompt-withdrawn'; readonly promptId: string }
  | { readonly type: 'settled'; readonly status: 'authorized' | 'cancelled' }
  | { readonly type: 'failed'; readonly message: string }

export interface PiAiAuthorizationApi {
  list(): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<readonly PiAiAuthorizationEntry[]>>
  begin(rawKey: string, method: string | undefined, signal?: AbortSignal): AsyncIterable<PiAiAuthorizationFrame>
  answer(rawKey: string, promptId: string, value: string): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<boolean>>
  decline(rawKey: string, promptId: string): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<boolean>>
  cancel(rawKey: string): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<boolean>>
  signOut(rawKey: string): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<boolean>>
}
