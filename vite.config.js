import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const buildId = `${pad(d.getMonth() + 1)}${pad(d.getDate())}.${pad(d.getHours())}${pad(d.getMinutes())}`;

// Served at a root domain (lindol.app), so base is '/'.
export default defineConfig({
  base: '/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'og-image.png'],
      manifest: {
        name: 'LINDOL - Philippines Earthquake Watch',
        short_name: 'LINDOL',
        description: 'Live earthquake info and safety guidance for the Philippines.',
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
        importScripts: ['/push-sw.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'report-photos', expiration: { maxEntries: 200, maxAgeSeconds: 604800 } },
          },
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'reports-api', expiration: { maxEntries: 20, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.js' },
});
