import { AuthorizationDeclinedError, } from '@deepseek-ai/dsh-authorization';
import { credentialKey } from '@deepseek-ai/dsh-credentials';
import { httpUrl, openBrowser } from './browser.js';
const SETTINGS_NS = 'llm-pi-ai';
const KEY_PREFIX = `${SETTINGS_NS}/`;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasProvider(value, provider) {
    if (!isRecord(value))
        return false;
    const providers = value['providers'];
    return isRecord(providers) && Object.hasOwn(providers, provider);
}
function providerLayers(ctx, provider) {
    const descriptor = ctx.settings.describe().find(candidate => candidate.ns === SETTINGS_NS);
    return {
        enabled: hasProvider(descriptor?.value, provider),
        base: hasProvider(descriptor?.base, provider),
        user: hasProvider(descriptor?.user, provider),
    };
}
function providerId(entry) {
    const key = String(entry.key);
    if (!key.startsWith(KEY_PREFIX))
        return undefined;
    const provider = key.slice(KEY_PREFIX.length);
    if (provider.length === 0 || provider.includes('/'))
        return undefined;
    return entry.methods.some(method => method.id === 'oauth') ? provider : undefined;
}
function oauthEntries(ctx) {
    return ctx.authorization.list().flatMap((entry) => {
        const provider = providerId(entry);
        return provider === undefined ? [] : [{ provider, entry }];
    });
}
function entryFor(ctx, provider) {
    return oauthEntries(ctx).find(candidate => candidate.provider === provider)?.entry;
}
function keyFor(provider) {
    return credentialKey(SETTINGS_NS, provider);
}
function answerValue(answer, id) {
    const item = answer.answers.find(candidate => candidate.id === id);
    const custom = item?.custom?.trim();
    if (custom !== undefined && custom.length > 0)
        return custom;
    const selected = item?.selected[0];
    if (selected !== undefined && selected.length > 0)
        return selected;
    throw new AuthorizationDeclinedError('authorization question was dismissed');
}
function combinedSignal(invocation, prompt) {
    return prompt.signal === undefined
        ? invocation.signal
        : AbortSignal.any([invocation.signal, prompt.signal]);
}
function promptOptions(prompt) {
    if (prompt.kind !== 'select')
        return undefined;
    return prompt.options.map(option => ({
        label: option.label,
        ...option.description === undefined ? {} : { description: option.description },
    }));
}
function promptDetail(state, prompt) {
    const parts = [];
    const notice = state.latest;
    if (notice !== undefined && notice.message !== prompt.message)
        parts.push(notice.message);
    const url = httpUrl(notice?.url);
    if (url !== undefined)
        parts.push(`[打开登录页面](${url})`);
    if (notice?.code !== undefined)
        parts.push(`授权码：\`${notice.code.replaceAll('`', "'")}\``);
    if (url !== undefined && prompt.kind !== 'select') {
        parts.push('浏览器未自动返回时，可以在下方粘贴完整回调地址或授权码。');
    }
    return parts.length === 0 ? undefined : parts.join('\n\n');
}
function safeError(error) {
    if (error instanceof Error && error.message.length > 0)
        return error.message;
    return '未知错误';
}
function openNoticeUrl(ctx, state, notice) {
    const url = httpUrl(notice.url);
    if (url === undefined || state.openedUrls.has(url))
        return;
    state.openedUrls.add(url);
    openBrowser(ctx, url);
}
async function askPrompt(ctx, invocation, provider, label, state, prompt) {
    const id = `pi-ai-auth-${provider}-${prompt.kind}`;
    const options = promptOptions(prompt);
    const detail = promptDetail(state, prompt);
    const signal = combinedSignal(invocation, prompt);
    try {
        const answer = await ctx.userQuestions.ask({
            agent: invocation.agent,
            signal,
            questions: [{
                    id,
                    header: `${label} 登录`,
                    question: prompt.message,
                    ...(detail === undefined ? {} : { detail }),
                    ...options === undefined ? {} : { options },
                }],
        });
        const value = answerValue(answer, id);
        if (prompt.kind !== 'select')
            return value;
        const selected = prompt.options.find(option => option.label === value)?.id
            ?? prompt.options.find(option => option.id === value)?.id;
        if (selected === undefined)
            throw new Error('authorization method is not recognized');
        return selected;
    }
    catch (error) {
        if (signal.aborted)
            throw error;
        throw new AuthorizationDeclinedError('authorization question was dismissed');
    }
}
function showCodeNotice(ctx, invocation, provider, label, state, notice) {
    const url = httpUrl(notice.url);
    if (url === undefined || notice.code === undefined)
        return;
    const controller = new AbortController();
    const signal = AbortSignal.any([invocation.signal, controller.signal]);
    const handle = {
        controller,
        settled: ctx.userQuestions.ask({
            agent: invocation.agent,
            signal,
            questions: [{
                    id: `pi-ai-auth-${provider}-device-code`,
                    header: `${label} 设备码`,
                    question: '打开验证页面并输入设备码，然后等待登录完成。',
                    detail: `[打开设备登录页面](${url})\n\n设备码：\`${notice.code.replaceAll('`', "'")}\``,
                    options: [{ label: '已提交设备码', description: 'DSH 会继续等待授权结果。' }],
                }],
        }).then(() => undefined, (error) => {
            if (!signal.aborted)
                ctx.logger.warn(`pi-ai-auth: device-code notice failed: ${safeError(error)}`);
        }),
    };
    state.transient.add(handle);
    void handle.settled.finally(() => { state.transient.delete(handle); });
}
function splitInput(raw) {
    return raw.trim().split(/\s+/u).filter(part => part.length > 0);
}
async function chooseProvider(ctx, invocation, entries, action) {
    if (entries.length === 0)
        return undefined;
    const id = `pi-ai-auth-${action}-provider`;
    const labels = new Map(entries.map(candidate => [
        `${candidate.entry.label} (${candidate.provider})`, candidate,
    ]));
    const answer = await ctx.userQuestions.ask({
        agent: invocation.agent,
        signal: invocation.signal,
        questions: [{
                id,
                header: '模型 Provider 授权',
                question: `选择要${action}的 Provider。`,
                options: [...labels.keys()].map(label => ({ label })),
            }],
    });
    return labels.get(answerValue(answer, id));
}
async function resolveTarget(ctx, invocation, rawProvider, candidates, action) {
    if (rawProvider !== undefined) {
        const entry = entryFor(ctx, rawProvider);
        return entry === undefined
            ? { error: { kind: 'error', text: `Provider ${JSON.stringify(rawProvider)} 没有可用的 OAuth 授权流程。` } }
            : { target: { provider: rawProvider, entry } };
    }
    try {
        const target = await chooseProvider(ctx, invocation, candidates, action);
        return target === undefined
            ? { error: { kind: 'error', text: `没有可${action}的 OAuth Provider。` } }
            : { target };
    }
    catch (error) {
        return { error: { kind: 'error', text: `${action}已取消：${safeError(error)}` } };
    }
}
async function runLogin(ctx, invocation, provider, entry) {
    if (entry.inFlight) {
        return { kind: 'error', text: `${entry.label} 的另一个登录正在进行。` };
    }
    const state = { openedUrls: new Set(), transient: new Set() };
    try {
        const outcome = await ctx.authorization.begin({
            key: entry.key,
            method: 'oauth',
            signal: invocation.signal,
            interaction: {
                notify: (notice) => {
                    state.latest = notice;
                    ctx.logger.info(`pi-ai-auth(${provider}): ${notice.message}`);
                    openNoticeUrl(ctx, state, notice);
                    showCodeNotice(ctx, invocation, provider, entry.label, state, notice);
                },
                prompt: prompt => askPrompt(ctx, invocation, provider, entry.label, state, prompt),
            },
        });
        return outcome.status === 'authorized'
            ? { kind: 'success', text: `${entry.label} 登录成功；${provider} 已可用于模型选择。` }
            : { kind: 'error', text: `${entry.label} 登录已取消。` };
    }
    catch (error) {
        return { kind: 'error', text: `${entry.label} 登录失败：${safeError(error)}` };
    }
    finally {
        for (const notice of state.transient)
            notice.controller.abort('authorization settled');
        await Promise.allSettled([...state.transient].map(notice => notice.settled));
    }
}
async function list(ctx, invocation) {
    if (splitInput(invocation.rawInput).length > 0)
        return { kind: 'error', text: '用法：/auth-list' };
    const entries = oauthEntries(ctx);
    if (entries.length === 0)
        return { kind: 'error', text: '当前 DSH 没有注册支持 OAuth 的 pi-ai Provider。' };
    const rows = await Promise.all(entries.map(async ({ provider, entry }) => {
        const layers = providerLayers(ctx, provider);
        if (!layers.enabled)
            return `- ${entry.label}（${provider}）：未添加`;
        const record = await ctx.credentials.describeRecord(keyFor(provider));
        const source = layers.base ? 'Bundle 配置' : '用户添加';
        const state = entry.inFlight ? '登录中' : record.configured ? '已登录' : '未登录';
        return `- ${entry.label}（${provider}）：已启用 · ${state} · ${source}`;
    }));
    return { kind: 'success', text: `OAuth Provider：\n${rows.join('\n')}` };
}
async function add(ctx, invocation) {
    const [rawProvider, extra] = splitInput(invocation.rawInput);
    if (extra !== undefined)
        return { kind: 'error', text: '用法：/auth-add [provider]' };
    const candidates = oauthEntries(ctx).filter(candidate => !providerLayers(ctx, candidate.provider).enabled);
    const resolved = await resolveTarget(ctx, invocation, rawProvider, candidates, '添加');
    if (resolved.error !== undefined)
        return resolved.error;
    const target = resolved.target;
    if (target === undefined)
        return { kind: 'error', text: '没有可添加的 OAuth Provider。' };
    if (providerLayers(ctx, target.provider).enabled) {
        return { kind: 'error', text: `${target.entry.label}（${target.provider}）已经启用；请使用 /auth-login ${target.provider}。` };
    }
    try {
        await ctx.settings.mutate(SETTINGS_NS, [{
                op: 'set', path: ['providers', target.provider], value: {},
            }]);
    }
    catch (error) {
        return { kind: 'error', text: `无法启用 ${target.provider}：${safeError(error)}` };
    }
    const result = await runLogin(ctx, invocation, target.provider, target.entry);
    if (result.kind === 'success')
        return result;
    try {
        await ctx.settings.mutate(SETTINGS_NS, [{ op: 'unset', path: ['providers', target.provider] }]);
    }
    catch (rollbackError) {
        return {
            kind: 'error',
            text: `${result.text} Provider 已启用，但回滚失败：${safeError(rollbackError)}`,
        };
    }
    return { kind: 'error', text: `${result.text} 本次新增已回滚，Provider 未启用。` };
}
async function login(ctx, invocation) {
    const [rawProvider, extra] = splitInput(invocation.rawInput);
    if (extra !== undefined)
        return { kind: 'error', text: '用法：/auth-login [provider]' };
    const candidates = oauthEntries(ctx).filter(candidate => providerLayers(ctx, candidate.provider).enabled);
    const resolved = await resolveTarget(ctx, invocation, rawProvider, candidates, '登录');
    if (resolved.error !== undefined)
        return resolved.error;
    const target = resolved.target;
    if (target === undefined)
        return { kind: 'error', text: '没有已启用的 OAuth Provider。' };
    if (!providerLayers(ctx, target.provider).enabled) {
        return { kind: 'error', text: `${target.provider} 尚未启用；请先运行 /auth-add ${target.provider}。` };
    }
    return await runLogin(ctx, invocation, target.provider, target.entry);
}
async function status(ctx, invocation) {
    const [rawProvider, extra] = splitInput(invocation.rawInput);
    if (extra !== undefined)
        return { kind: 'error', text: '用法：/auth-status [provider]' };
    if (rawProvider === undefined)
        return list(ctx, invocation);
    const entry = entryFor(ctx, rawProvider);
    if (entry === undefined)
        return { kind: 'error', text: `Provider ${JSON.stringify(rawProvider)} 没有可用的 OAuth 授权流程。` };
    const layers = providerLayers(ctx, rawProvider);
    if (!layers.enabled) {
        return { kind: 'success', text: `${entry.label}（${rawProvider}）：未添加。运行 /auth-add ${rawProvider} 开始授权。` };
    }
    if (entry.inFlight)
        return { kind: 'success', text: `${entry.label}（${rawProvider}）：正在登录。` };
    const record = await ctx.credentials.describeRecord(keyFor(rawProvider));
    return record.configured
        ? { kind: 'success', text: `${entry.label}（${rawProvider}）：已启用并已登录（${record.kind ?? 'credential'}）。` }
        : { kind: 'success', text: `${entry.label}（${rawProvider}）：已启用但未登录。运行 /auth-login ${rawProvider}。` };
}
async function logout(ctx, invocation) {
    const [rawProvider, extra] = splitInput(invocation.rawInput);
    if (extra !== undefined)
        return { kind: 'error', text: '用法：/auth-logout [provider]' };
    const candidates = oauthEntries(ctx).filter(candidate => providerLayers(ctx, candidate.provider).enabled);
    const resolved = await resolveTarget(ctx, invocation, rawProvider, candidates, '退出');
    if (resolved.error !== undefined)
        return resolved.error;
    const target = resolved.target;
    if (target === undefined)
        return { kind: 'error', text: '没有已启用的 OAuth Provider。' };
    if (!providerLayers(ctx, target.provider).enabled) {
        return { kind: 'error', text: `${target.provider} 尚未启用，不能退出登录。` };
    }
    ctx.authorization.cancel(target.entry.key);
    try {
        await ctx.credentials.deleteRecord(keyFor(target.provider));
        return {
            kind: 'success',
            text: `${target.entry.label} 的本地登录凭据已删除；${target.provider} 仍保持启用。`,
        };
    }
    catch (error) {
        return { kind: 'error', text: `无法删除 ${target.entry.label} 凭据：${safeError(error)}` };
    }
}
async function remove(ctx, invocation) {
    const [rawProvider, extra] = splitInput(invocation.rawInput);
    if (extra !== undefined)
        return { kind: 'error', text: '用法：/auth-remove [provider]' };
    const candidates = oauthEntries(ctx).filter(candidate => providerLayers(ctx, candidate.provider).enabled);
    const resolved = await resolveTarget(ctx, invocation, rawProvider, candidates, '移除');
    if (resolved.error !== undefined)
        return resolved.error;
    const target = resolved.target;
    if (target === undefined)
        return { kind: 'error', text: '没有已启用的 OAuth Provider。' };
    const layers = providerLayers(ctx, target.provider);
    if (!layers.enabled)
        return { kind: 'error', text: `${target.provider} 尚未启用。` };
    if (layers.base) {
        return {
            kind: 'error',
            text: `${target.provider} 由已安装 Bundle 的基础配置启用，不能从用户设置中移除。`,
        };
    }
    if (!layers.user)
        return { kind: 'error', text: `${target.provider} 不属于可移除的用户配置。` };
    ctx.authorization.cancel(target.entry.key);
    try {
        await ctx.credentials.deleteRecord(keyFor(target.provider));
        await ctx.settings.mutate(SETTINGS_NS, [{ op: 'unset', path: ['providers', target.provider] }]);
        return { kind: 'success', text: `${target.entry.label} 已移除，本地登录凭据也已删除。` };
    }
    catch (error) {
        return { kind: 'error', text: `无法移除 ${target.entry.label}：${safeError(error)}` };
    }
}
/** Register the optional command-line surface on the owning Service's Fiber. */
export function registerCommands(ctx) {
    const definitions = [
        { name: 'auth-list', description: '列出支持 OAuth 的 pi-ai Provider', handler: (value) => list(ctx, value) },
        { name: 'auth-add', description: '添加 Provider 并完成 OAuth 登录', input: { hint: '[provider]' }, handler: (value) => add(ctx, value) },
        { name: 'auth-login', description: '登录一个已启用的 OAuth Provider', input: { hint: '[provider]' }, handler: (value) => login(ctx, value) },
        { name: 'auth-status', description: '查看 OAuth Provider 状态', input: { hint: '[provider]' }, handler: (value) => status(ctx, value) },
        { name: 'auth-logout', description: '退出登录但保留 Provider 配置', input: { hint: '[provider]' }, handler: (value) => logout(ctx, value) },
        { name: 'auth-remove', description: '移除 Provider 及其本地凭据', input: { hint: '[provider]' }, handler: (value) => remove(ctx, value) },
    ];
    for (const definition of definitions)
        ctx.commands.register(definition);
}
//# sourceMappingURL=commands.js.map