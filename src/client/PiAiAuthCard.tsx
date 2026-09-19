import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Input, Modal, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PiAiAuthorizationApi, PiAiAuthorizationEntry, PiAiAuthorizationPrompt } from '../wire.js'
import type { PiAiAuthKey } from './locales.js'

export interface PiAiAuthCardInjected {
  readonly authorization: PiAiAuthorizationApi
}

export type PiAiAuthCardProps =
  & PropsRuntime<'settings.models.provider-card', 'llm-pi-ai'>
  & PropsLocale<'piAiAuth'>
  & InjectFace<PiAiAuthCardInjected>

function message(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error)
}

function remoteValue<T>(result: Awaited<ReturnType<PiAiAuthorizationApi['list']>> | {
  readonly ok: true; readonly value: T
} | { readonly ok: false; readonly error: { readonly message: string } }): T {
  if (result.ok) return result.value as T
  throw new Error(result.error.message)
}

export function PiAiAuthCard({ provider, configured, authorization, t }: PiAiAuthCardProps): ReactNode {
  const key = `llm-pi-ai/${provider.provider}`
  const [entry, setEntry] = useState<PiAiAuthorizationEntry>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<{ message: string; url?: string; code?: string }>()
  const [prompt, setPrompt] = useState<PiAiAuthorizationPrompt>()
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string>()
  const flow = useRef<AbortController>()

  const refresh = useCallback(async () => {
    try {
      const rows = remoteValue<readonly PiAiAuthorizationEntry[]>(await authorization.list())
      setEntry(rows.find(row => row.key === key))
      setError(undefined)
    } catch (cause: unknown) {
      setError(t('requestFailed', { message: message(cause) }))
    } finally {
      setLoading(false)
    }
  }, [authorization, key, t])

  useEffect(() => {
    void refresh()
    return () => { flow.current?.abort('provider card unmounted') }
  }, [refresh])

  const closeFlow = useCallback(() => {
    flow.current?.abort('authorization dialog closed')
    flow.current = undefined
    setOpen(false)
    setBusy(false)
    setPrompt(undefined)
    setAnswer('')
    void authorization.cancel(key)
  }, [authorization, key])

  const login = useCallback(async () => {
    const controller = new AbortController()
    flow.current = controller
    setBusy(true)
    setOpen(true)
    setNotice(undefined)
    setPrompt(undefined)
    setAnswer('')
    setError(undefined)
    try {
      for await (const frame of authorization.begin(key, 'oauth', controller.signal)) {
        if (frame.type === 'notice') {
          setNotice({
            message: frame.message,
            ...(frame.url === undefined ? {} : { url: frame.url }),
            ...(frame.code === undefined ? {} : { code: frame.code }),
          })
        } else if (frame.type === 'prompt') {
          setPrompt(frame.prompt)
          setAnswer(frame.prompt.kind === 'select' ? frame.prompt.options?.[0]?.id ?? '' : '')
        } else if (frame.type === 'prompt-withdrawn') {
          setPrompt(current => current?.promptId === frame.promptId ? undefined : current)
        } else if (frame.type === 'failed') {
          setError(t('loginFailed', { message: frame.message }))
          setBusy(false)
        } else if (frame.type === 'settled') {
          setBusy(false)
          if (frame.status === 'authorized') setOpen(false)
        }
      }
    } catch (cause: unknown) {
      if (!controller.signal.aborted) setError(t('loginFailed', { message: message(cause) }))
    } finally {
      if (flow.current === controller) flow.current = undefined
      setBusy(false)
      await refresh()
    }
  }, [authorization, key, refresh, t])

  const submit = useCallback(async () => {
    if (prompt === undefined || answer.length === 0) return
    try {
      remoteValue<boolean>(await authorization.answer(key, prompt.promptId, answer))
    } catch (cause: unknown) {
      setError(t('loginFailed', { message: message(cause) }))
    }
  }, [answer, authorization, key, prompt, t])

  const logout = useCallback(async () => {
    setBusy(true)
    setError(undefined)
    try {
      remoteValue<boolean>(await authorization.signOut(key))
      await refresh()
    } catch (cause: unknown) {
      setError(t('logoutFailed', { message: message(cause) }))
    } finally {
      setBusy(false)
    }
  }, [authorization, key, refresh, t])

  if (!loading && entry === undefined && error === undefined) return null
  const signedIn = entry?.configured === true
  const ongoing = busy || entry?.inFlight === true
  const statusKey: PiAiAuthKey = !configured
    ? 'statusUnavailable'
    : ongoing
      ? 'statusSigningIn'
      : signedIn
        ? 'statusSignedIn'
        : 'statusSignedOut'

  return (
    <>
      <div className="dsh-pi-auth-row">
        <span className="dsh-pi-auth-status" role="status">
          <StateDot state={ongoing ? 'ongoing' : signedIn ? 'done' : 'idle'} />
          {loading ? t('waiting') : t(statusKey)}
        </span>
        {signedIn
          ? (
            <Button size="sm" variant="ghost" disabled={ongoing} onClick={() => { void logout() }}>
              {t('logout')}
            </Button>
          )
          : (
            <Button size="sm" variant="outline" disabled={!configured || ongoing || entry === undefined} onClick={() => { void login() }}>
              {t('login')}
            </Button>
          )}
      </div>
      {error === undefined ? null : <p className="dsh-pi-auth-error" role="alert">{error}</p>}
      <Modal
        open={open}
        onClose={closeFlow}
        title={t('dialogTitle', { name: entry?.label ?? provider.displayName })}
        description={t('dialogDescription')}
        closeLabel={t('close')}
        footer={(
          <div className="dsh-pi-auth-footer">
            <Button variant="ghost" onClick={closeFlow}>{t('cancel')}</Button>
            {prompt === undefined
              ? null
              : (
                <Button variant="primary" disabled={answer.length === 0} onClick={() => { void submit() }}>
                  {t('submit')}
                </Button>
              )}
          </div>
        )}
      >
        <div className="dsh-pi-auth-modal-body">
          {notice === undefined ? <p className="dsh-pi-auth-waiting">{t('noPrompt')}</p> : (
            <>
              <p className="dsh-pi-auth-notice">{notice.message}</p>
              {notice.url === undefined ? null : (
                <a className="dsh-pi-auth-link" href={notice.url} target="_blank" rel="noreferrer noopener">
                  {t('openPage')}
                </a>
              )}
              {notice.code === undefined ? null : (
                <div className="dsh-pi-auth-code"><span>{t('codeLabel')}</span><code>{notice.code}</code></div>
              )}
            </>
          )}
          {prompt === undefined ? null : (
            <label>
              <p className="dsh-pi-auth-prompt-label">{prompt.message}</p>
              {prompt.kind === 'select'
                ? (
                  <select className="dsh-pi-auth-select" value={answer} onChange={event => { setAnswer(event.target.value) }}>
                    {prompt.options?.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                )
                : (
                  <Input
                    type={prompt.kind === 'secret' ? 'password' : 'text'}
                    value={answer}
                    placeholder={prompt.placeholder}
                    autoFocus
                    onChange={event => { setAnswer(event.target.value) }}
                    onKeyDown={event => { if (event.key === 'Enter') void submit() }}
                  />
                )}
            </label>
          )}
        </div>
      </Modal>
    </>
  )
}
