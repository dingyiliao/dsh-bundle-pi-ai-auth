import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type PiAiAuthKey } from './locales.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        piAiAuth: PiAiAuthKey;
    }
}
export declare const inject: string[];
/** Mount the bundle-owned Remote contract and contribute the pi-ai provider-card controls. */
export declare function apply(ctx: ClientContext): Promise<void>;
export type { PiAiAuthCardInjected, PiAiAuthCardProps } from './PiAiAuthCard.js';
