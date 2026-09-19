import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-authorization': fileURLToPath(new URL('./tests/stubs/authorization.ts', import.meta.url)),
      '@deepseek-ai/dsh-credentials': fileURLToPath(new URL('./tests/stubs/credentials.ts', import.meta.url)),
      '@deepseek-ai/dsh-typert-protocol': fileURLToPath(new URL('./tests/stubs/typert-protocol.ts', import.meta.url)),
      '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(new URL('./tests/stubs/ui-primitives.tsx', import.meta.url)),
    },
  },
})
