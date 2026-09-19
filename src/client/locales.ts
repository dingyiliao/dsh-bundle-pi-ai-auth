export const NS = 'piAiAuth'

export const en = {
  statusSignedIn: 'Signed in',
  statusSignedOut: 'Not signed in',
  statusSigningIn: 'Signing in…',
  statusUnavailable: 'Save this provider before signing in',
  login: 'Sign in',
  logout: 'Sign out',
  cancel: 'Cancel',
  submit: 'Continue',
  close: 'Close',
  dialogTitle: '{name} sign in',
  dialogDescription: 'Complete the provider authorization flow. Credentials are stored by the provider integration.',
  openPage: 'Open sign-in page',
  codeLabel: 'Authorization code',
  waiting: 'Waiting for the provider…',
  loginFailed: 'Sign-in failed: {message}',
  logoutFailed: 'Could not sign out: {message}',
  requestFailed: 'Could not read authorization state: {message}',
  noPrompt: 'Follow the instructions in your browser. This window will update automatically.',
} as const

export const zh: Record<keyof typeof en, string> = {
  statusSignedIn: '已登录',
  statusSignedOut: '未登录',
  statusSigningIn: '正在登录…',
  statusUnavailable: '保存此 Provider 后即可登录',
  login: '登录',
  logout: '退出登录',
  cancel: '取消',
  submit: '继续',
  close: '关闭',
  dialogTitle: '{name} 登录',
  dialogDescription: '完成 Provider 的授权流程。凭据由对应的 Provider 集成负责保存。',
  openPage: '打开登录页面',
  codeLabel: '授权码',
  waiting: '正在等待 Provider…',
  loginFailed: '登录失败：{message}',
  logoutFailed: '退出登录失败：{message}',
  requestFailed: '无法读取授权状态：{message}',
  noPrompt: '请按照浏览器中的说明操作；完成后这里会自动更新。',
}

export type PiAiAuthKey = keyof typeof en
