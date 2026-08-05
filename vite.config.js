import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-180.png'],
      manifest: {
        name: 'Craigaoke',
        short_name: 'Craigaoke',
        description: 'Lyrics that scroll in time with the song.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f3f2f2',
        theme_color: '#f3f2f2',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        // Android share sheet: share a lyrics page from any browser and
        // Craigaoke opens straight into the import preview (spec §5.3).
        // iOS does not support this for web apps — iPhones use the
        // PASTE FROM CLIPBOARD path instead.
        share_target: {
          action: '/',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        navigateFallback: '/index.html',
        // Never intercept Firebase's reserved paths — /__/auth/handler is the
        // page Google redirects back to after sign-in.
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
});
