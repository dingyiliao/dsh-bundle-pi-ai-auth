import { type ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { PiAiAuthorizationApi } from '../wire.js';
export interface PiAiAuthCardInjected {
    readonly authorization: PiAiAuthorizationApi;
}
export type PiAiAuthCardProps = PropsRuntime<'settings.models.provider-card', 'llm-pi-ai'> & PropsLocale<'piAiAuth'> & InjectFace<PiAiAuthCardInjected>;
export declare function PiAiAuthCard({ provider, configured, authorization, t }: PiAiAuthCardProps): ReactNode;
