import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const firebaseKeys = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_OWNER_UID',
]
if (process.env.VITE_REQUIRE_FIREBASE === 'true' && firebaseKeys.some((key) => !process.env[key])) {
  throw new Error('Firebase build configuration is incomplete')
}

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg'],
    manifest: {
      name: 'Soul · Mental Compass',
      short_name: 'Soul',
      description: 'A personal goal map with room to focus.',
      start_url: '/soul/',
      scope: '/soul/',
      display: 'standalone',
      background_color: '#f6f8f6',
      theme_color: '#f6f8f6',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
  })],
  base: '/soul/',
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/data/**/*.ts', 'src/components/**/*.tsx', 'src/App.tsx'],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
  },
})
