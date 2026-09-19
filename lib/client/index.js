import { PI_AI_AUTH_REMOTE } from '../remote.js';
import { PiAiAuthCard } from './PiAiAuthCard.js';
import { en, NS, zh } from './locales.js';
import { STYLE_ID, styles } from './styles.js';
export const inject = ['remote', 'slots', 'locale'];
function registerProviderCard(ctx) {
    ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
        name: 'settings.models.provider-card',
        key: 'llm-pi-ai',
        locale: NS,
        inject: () => ({ authorization: ctx.remote.piAiAuthorization }),
    }, PiAiAuthCard));
}
/** Mount the bundle-owned Remote contract and contribute the pi-ai provider-card controls. */
export async function apply(ctx) {
    const disposeRemote = await ctx.remote.$mount(PI_AI_AUTH_REMOTE);
    ctx.effect(() => disposeRemote, 'pi-ai-auth: Remote contribution');
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'pi-ai-auth: dictionaries');
    ctx.effect(() => {
        if (document.getElementById(STYLE_ID) !== null)
            return () => { };
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = styles;
        document.head.append(style);
        return () => { style.remove(); };
    }, 'pi-ai-auth: provider-card styles');
    // `$mount()` creates `remote.piAiAuthorization` dynamically. A child Fiber
    // declares that service before reading it, preserving Cordis' inject guard
    // instead of reaching around the Context contract.
    await ctx.inject(['remote.piAiAuthorization', 'slots', 'locale'], registerProviderCard);
}
//# sourceMappingURL=index.js.map