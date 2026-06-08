import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served at a root domain (lindol.app), so base is '/'.
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'og-image.png'],
      manifest: {
        name: 'LINDÓL — Southern Mindanao Earthquake Watch',
        short_name: 'LINDÓL',
        description: 'Live earthquake info, aftershocks, and safety guidance for southern Mindanao.',
        theme_color: '#14110E',
        background_color: '#EFEAE0',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/earthquake\.usgs\.gov\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'usgs-feed', expiration: { maxEntries: 20, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /^https:\/\/[abc]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 600, maxAgeSeconds: 1209600 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } },
          },
        ],
      },
    }),
  ],
  test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.js' },
});
