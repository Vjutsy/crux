import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// На GitHub Pages гра живе за адресою https://vjutsy.github.io/crux/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/crux/',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Crux — словацька на скелі',
        short_name: 'Crux',
        description: 'Лізь угору, вивчаючи словацькі слова',
        lang: 'uk',
        theme_color: '#3d4fd6',
        background_color: '#e9e5db',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60_000 },
});
