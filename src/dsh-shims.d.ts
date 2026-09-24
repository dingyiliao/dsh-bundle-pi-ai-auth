declare module '@deepseek-ai/cordis' {
  export interface Context {
    readonly logger: { info(message: string): void; warn(message: string): void }
    readonly authorization: import('@deepseek-ai/dsh-authorization').AuthorizationService
    readonly commands: {
      register(definition: import('@deepseek-ai/dsh-commands').CommandDefinition): () => void
    }
    readonly credentials: import('@deepseek-ai/dsh-credentials').CredentialProvider
    readonly settings: import('@deepseek-ai/dsh-settings').SettingsForms
    readonly userQuestions: {
      ask(request: import('@deepseek-ai/dsh-user-questions').AskUserQuestionRequest):
        Promise<import('@deepseek-ai/dsh-user-questions').AskUserQuestionAnswer>
    }
    readonly remote: import('@deepseek-ai/dsh-typert-protocol').TypertClientRemote
    readonly slots: {
      inject(name: string, factory: () => unknown): void
      register(options: Record<string, unknown>, component: (props: never) => import('react').ReactNode): () => void
    }
    readonly locale: {
      register(namespace: string, dictionaries: {
        zh: Record<string, string>
        en: Record<string, string>
      }): () => void
    }
    inject(names: readonly string[], callback: (ctx: Context) => void): PromiseLike<unknown>
    effect(callback: () => (() => void | Promise<void>), label?: string): unknown
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  import type { Context } from '@deepseek-ai/cordis'

  export interface TypertSchema<Output = unknown> {
    parse(value: unknown): Output
  }
  export type TypertCodec =
    | { readonly mode: 'strict'; readonly typeSymbol: string; readonly create: () => TypertSchema }
    | { readonly mode: 'src-json' }
  export interface InvocationParameterDescriptor {
    readonly name: string
    readonly wire: string
    readonly source: 'json' | 'lookup'
    readonly lookup?: string
    readonly codec: TypertCodec
    readonly acceptsUndefined?: true
  }
  export interface InvocationDescriptor {
    readonly id: string
    readonly service: string
    readonly namespace: string
    readonly method: string
    readonly implementation?: string
    readonly mode?: 'stream'
    readonly invocation: { readonly kind: 'direct' }
    readonly parameters: readonly InvocationParameterDescriptor[]
    readonly cancellation?: { readonly parameter: 'signal' }
    readonly result: TypertCodec
  }
  export interface TypertRemoteContribution {
    readonly package: string
    readonly descriptors: readonly InvocationDescriptor[]
  }
  export interface RemoteFailure { readonly message: string }
  export type RemoteResult<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: RemoteFailure }
  export interface TypertRemoteMap {}
  export interface TypertRemoteNamespaceMap {}
  export interface TypertClientRemote extends TypertRemoteNamespaceMap {
    $mount(contribution: TypertRemoteContribution): Promise<() => Promise<void>>
  }
  export abstract class TypertRemoteService {
    protected readonly ctx: Context
    protected constructor(ctx: Context, serviceKey: string, options?: { namespace?: string })
  }
  export function Remote<This extends object, Args extends unknown[], Result>(
    method: (this: This, ...args: Args) => Result,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
  ): void
  export function Remote(option: string | { readonly mode: 'stream' }):
  <This extends object, Args extends unknown[], Result>(
    method: (this: This, ...args: Args) => Result,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
  ) => void
}

declare module '@deepseek-ai/dsh-api-remotes/client' {}
declare module '@deepseek-ai/dsh-client-locale/client' {}
declare module '@deepseek-ai/dsh-client-ui-renderer/client' {}

declare module '@deepseek-ai/dsh-client-ui-settings-models/client' {
  export interface ProviderDirectoryEntry {
    readonly provider: string
    readonly displayName: string
    readonly settingsNs: string
    readonly settingsPath: readonly string[]
    readonly active: boolean
    readonly declared?: boolean
    readonly error?: string
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  import type { ProviderDirectoryEntry } from '@deepseek-ai/dsh-client-ui-settings-models/client'
  export interface SlotMap {
    'settings.models.provider-card': {
      kind: 'keyed'
      scope: 'root'
      owner: { provider: ProviderDirectoryEntry; configured: boolean; keyConfigured: boolean }
    }
  }
  export interface LocaleNamespaceMap {}
  export type Translate<Key extends string = string> =
    (key: Key, params?: Record<string, unknown>) => string
  export type PropsLocale<Namespace extends keyof LocaleNamespaceMap & string> = {
    t: Translate<LocaleNamespaceMap[Namespace] & string>
  }
  export type PropsRuntime<
    Key extends keyof SlotMap & string,
    _EntryKey extends string = string,
  > = SlotMap[Key] extends { owner: infer Owner extends object } ? Owner : object
  export type InjectFace<Injected extends object> = Injected
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
  export function Button(props: {
    variant?: 'primary' | 'ghost' | 'outline' | 'toolbar'
    size?: 'md' | 'sm'
    icon?: ReactNode
  } & ButtonHTMLAttributes<HTMLButtonElement>): ReactNode
  export function Input(props: { icon?: ReactNode } & InputHTMLAttributes<HTMLInputElement>): ReactNode
  export function StateDot(props: {
    state: 'done' | 'warning' | 'ongoing' | 'error' | 'idle'
    size?: number
  }): ReactNode
  export function Modal(props: {
    open: boolean
    onClose: () => void
    title: string
    closeLabel: string
    description?: string
    children?: ReactNode
    footer?: ReactNode
  }): ReactNode
}

declare module '@deepseek-ai/dsh-authorization' {
  import type { CredentialKey } from '@deepseek-ai/dsh-credentials'

  export interface AuthorizationNotice {
    message: string
    url?: string
    code?: string
  }
  export interface AuthorizationPromptOption {
    id: string
    label: string
    description?: string
  }
  export type AuthorizationPrompt = {
    signal?: AbortSignal
  } & ({
    kind: 'text' | 'secret'
    message: string
    placeholder?: string
  } | {
    kind: 'select'
    message: string
    options: readonly AuthorizationPromptOption[]
  })
  export interface AuthorizationInteraction {
    notify(notice: AuthorizationNotice): void
    prompt(prompt: AuthorizationPrompt): Promise<string>
  }
  export interface AuthorizationEntry {
    key: CredentialKey
    label: string
    methods: readonly { id: string; label: string }[]
    inFlight: boolean
  }
  export class AuthorizationDeclinedError extends Error {}
  export interface AuthorizationService {
    list(): AuthorizationEntry[]
    describe(key: CredentialKey): AuthorizationEntry | undefined
    begin(request: {
      key: CredentialKey
      method?: string
      interaction: AuthorizationInteraction
      signal?: AbortSignal
    }): Promise<{ status: 'authorized' | 'cancelled' }>
    cancel(key: CredentialKey): void
  }
}

declare module '@deepseek-ai/dsh-settings' {
  export interface SettingsDescriptor {
    ns: string
    value: unknown
    base?: unknown
    user?: unknown
  }
  export interface SettingsPathOp {
    op: 'set' | 'unset'
    path: readonly string[]
    value?: unknown
  }
  export interface SettingsForms {
    describe(): SettingsDescriptor[]
    mutate(ns: string, ops: readonly SettingsPathOp[]): Promise<void>
  }
}

declare module '@deepseek-ai/dsh-commands' {
  export interface CommandInvocation {
    readonly agent: unknown
    readonly rawInput: string
    readonly signal: AbortSignal
  }
  export type CommandResult =
    | { readonly kind: 'success'; readonly text?: string }
    | { readonly kind: 'error'; readonly text: string }
  export interface CommandDefinition {
    readonly name: string
    readonly description: string
    readonly input?: { readonly hint: string }
    readonly handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>
  }
}

declare module '@deepseek-ai/dsh-credentials' {
  export type CredentialKey = string & { readonly __credentialKey: unique symbol }
  export function credentialKey(scope: string, id: string): CredentialKey
  export interface CredentialRecordInfo {
    configured: boolean
    kind?: 'api-key' | 'grant'
    writable: boolean
  }
  export interface CredentialProvider {
    describeRecord(key: CredentialKey): Promise<CredentialRecordInfo>
    deleteRecord(key: CredentialKey): Promise<void>
  }
}

declare module '@deepseek-ai/dsh-user-questions' {
  export interface AskUserQuestionOption {
    label: string
    description?: string
  }
  export interface AskUserQuestionRequest {
    questions: Array<{
      id: string
      question: string
      detail?: string
      header?: string
      options?: AskUserQuestionOption[]
    }>
    agent?: unknown
    signal?: AbortSignal
  }
  export interface AskUserQuestionAnswer {
    answers: Array<{ id: string; selected: string[]; custom?: string }>
  }
}
