var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { AuthorizationDeclinedError, } from '@deepseek-ai/dsh-authorization';
import { credentialKey } from '@deepseek-ai/dsh-credentials';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { httpUrl, openBrowser } from './browser.js';
import { registerCommands } from './commands.js';
const SETTINGS_NS = 'llm-pi-ai';
const KEY_PREFIX = `${SETTINGS_NS}/`;
class FrameChannel {
    values = [];
    waiters = [];
    closed = false;
    push(value) {
        if (this.closed)
            return;
        const waiter = this.waiters.shift();
        if (waiter === undefined)
            this.values.push(value);
        else
            waiter({ done: false, value });
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        for (const waiter of this.waiters.splice(0))
            waiter({ done: true, value: undefined });
    }
    [Symbol.asyncIterator]() {
        return {
            next: () => {
                const value = this.values.shift();
                if (value !== undefined)
                    return Promise.resolve({ done: false, value });
                if (this.closed)
                    return Promise.resolve({ done: true, value: undefined });
                return new Promise(resolve => { this.waiters.push(resolve); });
            },
        };
    }
}
function safeError(error) {
    return error instanceof Error && error.message.length > 0 ? error.message : 'Authorization failed';
}
function providerFromRawKey(rawKey) {
    if (!rawKey.startsWith(KEY_PREFIX))
        return undefined;
    const provider = rawKey.slice(KEY_PREFIX.length);
    return provider.length > 0 && !provider.includes('/') ? provider : undefined;
}
function keyFor(provider) {
    return credentialKey(SETTINGS_NS, provider);
}
function isOAuthEntry(entry) {
    return entry !== undefined && entry.methods.some(method => method.id === 'oauth');
}
function wirePrompt(promptId, prompt) {
    if (prompt.kind === 'select') {
        return {
            promptId,
            kind: prompt.kind,
            message: prompt.message,
            options: prompt.options.map(option => ({
                id: option.id,
                label: option.label,
                ...(option.description === undefined ? {} : { description: option.description }),
            })),
        };
    }
    return {
        promptId,
        kind: prompt.kind,
        message: prompt.message,
        ...(prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder }),
    };
}
/** Bundle-local Remote bridge used only by the provider-card browser extension. */
let PiAiAuthorizationController = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _list_decorators;
    let _begin_decorators;
    let _answer_decorators;
    let _cancel_decorators;
    let _signOut_decorators;
    return class PiAiAuthorizationController extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _list_decorators = [Remote('list')];
            _begin_decorators = [Remote({ mode: 'stream' })];
            _answer_decorators = [Remote('answer')];
            _cancel_decorators = [Remote('cancel')];
            _signOut_decorators = [Remote('signOut')];
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _begin_decorators, { kind: "method", name: "begin", static: false, private: false, access: { has: obj => "begin" in obj, get: obj => obj.begin }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _answer_decorators, { kind: "method", name: "answer", static: false, private: false, access: { has: obj => "answer" in obj, get: obj => obj.answer }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _cancel_decorators, { kind: "method", name: "cancel", static: false, private: false, access: { has: obj => "cancel" in obj, get: obj => obj.cancel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _signOut_decorators, { kind: "method", name: "signOut", static: false, private: false, access: { has: obj => "signOut" in obj, get: obj => obj.signOut }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['authorization', 'commands', 'credentials', 'settings', 'userQuestions'];
        active = (__runInitializers(this, _instanceExtraInitializers), new Map());
        promptSerial = 0;
        constructor(ctx) {
            super(ctx, 'piAiAuthorization');
            registerCommands(ctx);
            ctx.effect(() => () => {
                for (const authorization of this.active.values()) {
                    authorization.abort.abort('pi-ai authorization controller disposed');
                    authorization.prompt?.reject(new AuthorizationDeclinedError('authorization controller disposed'));
                    authorization.channel.close();
                }
                this.active.clear();
            }, 'pi-ai-auth: dispose active provider authorizations');
        }
        entry(rawKey) {
            const provider = providerFromRawKey(rawKey);
            if (provider === undefined)
                throw new TypeError('Only llm-pi-ai provider authorization keys are accepted');
            const key = keyFor(provider);
            const entry = this.ctx.authorization.describe(key);
            if (!isOAuthEntry(entry))
                throw new TypeError(`Provider ${JSON.stringify(provider)} has no OAuth flow`);
            return { key, entry };
        }
        async list() {
            const entries = this.ctx.authorization.list().filter(isOAuthEntry).filter(entry => providerFromRawKey(String(entry.key)) !== undefined);
            return Promise.all(entries.map(async (entry) => {
                const record = await this.ctx.credentials.describeRecord(entry.key);
                return {
                    key: String(entry.key),
                    label: entry.label,
                    inFlight: entry.inFlight || this.active.has(String(entry.key)),
                    configured: record.configured,
                };
            }));
        }
        async *begin(rawKey, signal) {
            const { key, entry } = this.entry(rawKey);
            if (this.active.has(rawKey) || entry.inFlight)
                throw new Error(`${entry.label} authorization is already running`);
            const active = {
                key,
                abort: new AbortController(),
                channel: new FrameChannel(),
                prompt: undefined,
            };
            this.active.set(rawKey, active);
            const onAbort = () => {
                active.abort.abort(signal.reason);
                active.prompt?.reject(new AuthorizationDeclinedError('authorization stream closed'));
            };
            signal.addEventListener('abort', onAbort, { once: true });
            void this.run(rawKey, entry, active);
            try {
                for await (const frame of active.channel)
                    yield frame;
            }
            finally {
                signal.removeEventListener('abort', onAbort);
                if (this.active.get(rawKey) === active) {
                    active.abort.abort('authorization stream closed');
                    active.prompt?.reject(new AuthorizationDeclinedError('authorization stream closed'));
                }
            }
        }
        async run(rawKey, entry, active) {
            try {
                const outcome = await this.ctx.authorization.begin({
                    key: active.key,
                    method: 'oauth',
                    signal: active.abort.signal,
                    interaction: {
                        notify: (notice) => {
                            const url = httpUrl(notice.url);
                            active.channel.push({
                                type: 'notice',
                                message: notice.message,
                                ...(url === undefined ? {} : { url }),
                                ...(notice.code === undefined ? {} : { code: notice.code }),
                            });
                            if (url !== undefined && active.openedUrl !== url) {
                                active.openedUrl = url;
                                openBrowser(this.ctx, url);
                            }
                        },
                        prompt: prompt => this.ask(active, prompt),
                    },
                });
                active.channel.push({ type: 'settled', status: outcome.status });
            }
            catch (error) {
                if (active.abort.signal.aborted) {
                    active.channel.push({ type: 'settled', status: 'cancelled' });
                }
                else {
                    this.ctx.logger.warn(`pi-ai-auth(${entry.label}): ${safeError(error)}`);
                    active.channel.push({ type: 'failed', message: safeError(error) });
                }
            }
            finally {
                active.prompt?.reject(new AuthorizationDeclinedError('authorization settled'));
                active.prompt = undefined;
                if (this.active.get(rawKey) === active)
                    this.active.delete(rawKey);
                active.channel.close();
            }
        }
        ask(active, prompt) {
            if (active.prompt !== undefined)
                throw new Error('Provider requested overlapping authorization prompts');
            const promptId = `prompt-${String(++this.promptSerial)}`;
            return new Promise((resolve, reject) => {
                const finish = (callback) => {
                    prompt.signal?.removeEventListener('abort', onAbort);
                    if (active.prompt?.id === promptId)
                        active.prompt = undefined;
                    active.channel.push({ type: 'prompt-withdrawn', promptId });
                    callback();
                };
                const onAbort = () => {
                    finish(() => { reject(new AuthorizationDeclinedError('authorization prompt withdrawn')); });
                };
                active.prompt = {
                    id: promptId,
                    resolve: value => { finish(() => { resolve(value); }); },
                    reject: reason => { finish(() => { reject(reason); }); },
                };
                prompt.signal?.addEventListener('abort', onAbort, { once: true });
                active.channel.push({ type: 'prompt', prompt: wirePrompt(promptId, prompt) });
            });
        }
        answer(rawKey, promptId, value) {
            this.entry(rawKey);
            const prompt = this.active.get(rawKey)?.prompt;
            if (prompt?.id !== promptId)
                return false;
            prompt.resolve(value);
            return true;
        }
        cancel(rawKey) {
            const { key } = this.entry(rawKey);
            const active = this.active.get(rawKey);
            if (active === undefined)
                return false;
            this.ctx.authorization.cancel(key);
            active.abort.abort('authorization cancelled');
            active.prompt?.reject(new AuthorizationDeclinedError('authorization cancelled'));
            return true;
        }
        async signOut(rawKey) {
            const { key } = this.entry(rawKey);
            const active = this.active.get(rawKey);
            if (active !== undefined) {
                this.ctx.authorization.cancel(key);
                active.abort.abort('signed out');
                active.prompt?.reject(new AuthorizationDeclinedError('signed out'));
            }
            await this.ctx.credentials.deleteRecord(key);
            return true;
        }
    };
})();
export { PiAiAuthorizationController };
export default PiAiAuthorizationController;
//# sourceMappingURL=authorization-controller.js.map