import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { PiAiAuthorizationEntry, PiAiAuthorizationFrame } from './wire.js';
/** Bundle-local Remote bridge used only by the provider-card browser extension. */
export declare class PiAiAuthorizationController extends TypertRemoteService {
    static inject: string[];
    private readonly active;
    private promptSerial;
    constructor(ctx: Context);
    private entry;
    list(): Promise<readonly PiAiAuthorizationEntry[]>;
    begin(rawKey: string, signal: AbortSignal): AsyncGenerator<PiAiAuthorizationFrame>;
    private run;
    private ask;
    answer(rawKey: string, promptId: string, value: string): boolean;
    cancel(rawKey: string): boolean;
    signOut(rawKey: string): Promise<boolean>;
}
export default PiAiAuthorizationController;
