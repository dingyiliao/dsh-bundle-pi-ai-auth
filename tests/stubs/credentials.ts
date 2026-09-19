export function credentialKey(scope: string, id: string): string {
  return `${scope}/${id}`
}
