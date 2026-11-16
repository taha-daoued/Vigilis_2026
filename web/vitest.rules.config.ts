// Configuration séparée : ces tests ont besoin de l'émulateur Firestore (npm run test:rules).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['rules-tests/**/*.test.ts'], testTimeout: 20000, fileParallelism: false },
})
