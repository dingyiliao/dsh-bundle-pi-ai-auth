import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, StateDot } from '@deepseek-ai/dsh-client-ui-primitives';
function message(error) {
    return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}
function remoteValue(result) {
    if (result.ok)
        return result.value;
    throw new Error(result.error.message);
}
export function PiAiAuthCard({ provider, configured, authorization, t }) {
    const key = `llm-pi-ai/${provider.provider}`;
    const [entry, setEntry] = useState();
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);
    const [notice, setNotice] = useState();
    const [prompt, setPrompt] = useState();
    const [answer, setAnswer] = useState('');
    const [error, setError] = useState();
    const flow = useRef();
    const refresh = useCallback(async () => {
        try {
            const rows = remoteValue(await authorization.list());
            setEntry(rows.find(row => row.key === key));
            setError(undefined);
        }
        catch (cause) {
            setError(t('requestFailed', { message: message(cause) }));
        }
        finally {
            setLoading(false);
        }
    }, [authorization, key, t]);
    useEffect(() => {
        void refresh();
        return () => { flow.current?.abort('provider card unmounted'); };
    }, [refresh]);
    const closeFlow = useCallback(() => {
        flow.current?.abort('authorization dialog closed');
        flow.current = undefined;
        setOpen(false);
        setBusy(false);
        setPrompt(undefined);
        setAnswer('');
        void authorization.cancel(key);
    }, [authorization, key]);
    const login = useCallback(async () => {
        const controller = new AbortController();
        flow.current = controller;
        setBusy(true);
        setOpen(true);
        setNotice(undefined);
        setPrompt(undefined);
        setAnswer('');
        setError(undefined);
        try {
            for await (const frame of authorization.begin(key, 'oauth', controller.signal)) {
                if (frame.type === 'notice') {
                    setNotice({
                        message: frame.message,
                        ...(frame.url === undefined ? {} : { url: frame.url }),
                        ...(frame.code === undefined ? {} : { code: frame.code }),
                    });
                }
                else if (frame.type === 'prompt') {
                    setPrompt(frame.prompt);
                    setAnswer(frame.prompt.kind === 'select' ? frame.prompt.options?.[0]?.id ?? '' : '');
                }
                else if (frame.type === 'prompt-withdrawn') {
                    setPrompt(current => current?.promptId === frame.promptId ? undefined : current);
                }
                else if (frame.type === 'failed') {
                    setError(t('loginFailed', { message: frame.message }));
                    setBusy(false);
                }
                else if (frame.type === 'settled') {
                    setBusy(false);
                    if (frame.status === 'authorized')
                        setOpen(false);
                }
            }
        }
        catch (cause) {
            if (!controller.signal.aborted)
                setError(t('loginFailed', { message: message(cause) }));
        }
        finally {
            if (flow.current === controller)
                flow.current = undefined;
            setBusy(false);
            await refresh();
        }
    }, [authorization, key, refresh, t]);
    const submit = useCallback(async () => {
        if (prompt === undefined || answer.length === 0)
            return;
        try {
            remoteValue(await authorization.answer(key, prompt.promptId, answer));
        }
        catch (cause) {
            setError(t('loginFailed', { message: message(cause) }));
        }
    }, [answer, authorization, key, prompt, t]);
    const logout = useCallback(async () => {
        setBusy(true);
        setError(undefined);
        try {
            remoteValue(await authorization.signOut(key));
            await refresh();
        }
        catch (cause) {
            setError(t('logoutFailed', { message: message(cause) }));
        }
        finally {
            setBusy(false);
        }
    }, [authorization, key, refresh, t]);
    if (!loading && entry === undefined && error === undefined)
        return null;
    const signedIn = entry?.configured === true;
    const ongoing = busy || entry?.inFlight === true;
    const statusKey = !configured
        ? 'statusUnavailable'
        : ongoing
            ? 'statusSigningIn'
            : signedIn
                ? 'statusSignedIn'
                : 'statusSignedOut';
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "dsh-pi-auth-row", children: [_jsxs("span", { className: "dsh-pi-auth-status", role: "status", children: [_jsx(StateDot, { state: ongoing ? 'ongoing' : signedIn ? 'done' : 'idle' }), loading ? t('waiting') : t(statusKey)] }), signedIn
                        ? (_jsx(Button, { size: "sm", variant: "ghost", disabled: ongoing, onClick: () => { void logout(); }, children: t('logout') }))
                        : (_jsx(Button, { size: "sm", variant: "outline", disabled: !configured || ongoing || entry === undefined, onClick: () => { void login(); }, children: t('login') }))] }), error === undefined ? null : _jsx("p", { className: "dsh-pi-auth-error", role: "alert", children: error }), _jsx(Modal, { open: open, onClose: closeFlow, title: t('dialogTitle', { name: entry?.label ?? provider.displayName }), description: t('dialogDescription'), closeLabel: t('close'), footer: (_jsxs("div", { className: "dsh-pi-auth-footer", children: [_jsx(Button, { variant: "ghost", onClick: closeFlow, children: t('cancel') }), prompt === undefined
                            ? null
                            : (_jsx(Button, { variant: "primary", disabled: answer.length === 0, onClick: () => { void submit(); }, children: t('submit') }))] })), children: _jsxs("div", { className: "dsh-pi-auth-modal-body", children: [notice === undefined ? _jsx("p", { className: "dsh-pi-auth-waiting", children: t('noPrompt') }) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "dsh-pi-auth-notice", children: notice.message }), notice.url === undefined ? null : (_jsx("a", { className: "dsh-pi-auth-link", href: notice.url, target: "_blank", rel: "noreferrer noopener", children: t('openPage') })), notice.code === undefined ? null : (_jsxs("div", { className: "dsh-pi-auth-code", children: [_jsx("span", { children: t('codeLabel') }), _jsx("code", { children: notice.code })] }))] })), prompt === undefined ? null : (_jsxs("label", { children: [_jsx("p", { className: "dsh-pi-auth-prompt-label", children: prompt.message }), prompt.kind === 'select'
                                    ? (_jsx("select", { className: "dsh-pi-auth-select", value: answer, onChange: event => { setAnswer(event.target.value); }, children: prompt.options?.map(option => _jsx("option", { value: option.id, children: option.label }, option.id)) }))
                                    : (_jsx(Input, { type: prompt.kind === 'secret' ? 'password' : 'text', value: answer, placeholder: prompt.placeholder, autoFocus: true, onChange: event => { setAnswer(event.target.value); }, onKeyDown: event => { if (event.key === 'Enter')
                                            void submit(); } }))] }))] }) })] }));
}
//# sourceMappingURL=PiAiAuthCard.js.map