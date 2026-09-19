import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type {} from '../remote.js'
import { PI_AI_AUTH_REMOTE } from '../remote.js'
import { PiAiAuthCard } from './PiAiAuthCard.js'
import { en, NS, zh, type PiAiAuthKey } from './locales.js'
import { STYLE_ID, styles } from './styles.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    piAiAuth: PiAiAuthKey
  }
}

export const inject = ['remote', 'slots', 'locale']

function registerProviderCard(ctx: ClientContext): void {
  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
    name: 'settings.models.provider-card',
    key: 'llm-pi-ai',
    locale: NS,
    inject: () => ({ authorization: ctx.remote.piAiAuthorization }),
  }, PiAiAuthCard))
}

/** Mount the bundle-owned Remote contract and contribute the pi-ai provider-card controls. */
export async function apply(ctx: ClientContext): Promise<void> {
  const disposeRemote = await ctx.remote.$mount(PI_AI_AUTH_REMOTE)
  ctx.effect(() => disposeRemote, 'pi-ai-auth: Remote contribution')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'pi-ai-auth: dictionaries')
  ctx.effect(() => {
    if (document.getElementById(STYLE_ID) !== null) return () => {}
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = styles
    document.head.append(style)
    return () => { style.remove() }
  }, 'pi-ai-auth: provider-card styles')
  // `$mount()` creates `remote.piAiAuthorization` dynamically. A child Fiber
  // declares that service before reading it, preserving Cordis' inject guard
  // instead of reaching around the Context contract.
  await ctx.inject(['remote.piAiAuthorization', 'slots', 'locale'], registerProviderCard)
}

export type { PiAiAuthCardInjected, PiAiAuthCardProps } from './PiAiAuthCard.js'
