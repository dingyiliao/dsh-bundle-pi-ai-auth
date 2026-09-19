import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { PiAiAuthorizationApi } from './wire.js';
/** Strict Client contract paired with Host source-mode discovery in this bundle. */
export declare const PI_AI_AUTH_REMOTE: TypertRemoteContribution;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteMap {
        'piAiAuthorization/list': PiAiAuthorizationApi['list'];
        'piAiAuthorization/begin': PiAiAuthorizationApi['begin'];
        'piAiAuthorization/answer': PiAiAuthorizationApi['answer'];
        'piAiAuthorization/decline': PiAiAuthorizationApi['decline'];
        'piAiAuthorization/cancel': PiAiAuthorizationApi['cancel'];
        'piAiAuthorization/signOut': PiAiAuthorizationApi['signOut'];
    }
    interface TypertRemoteNamespaceMap {
        readonly piAiAuthorization: PiAiAuthorizationApi;
    }
}
export type PiAiAuthRemoteResult<T> = RemoteResult<T>;
