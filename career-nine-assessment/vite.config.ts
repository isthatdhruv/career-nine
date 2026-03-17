import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { compression } from 'vite-plugin-compression2'
import { resolve } from 'path'
import { globSync } from 'glob'
import { unlinkSync } from 'fs'

export default defineConfig({
  plugins: [
    // Remove PNG files from assessment-cache after build (webp versions are used instead)
    // {
    //   name: 'remove-assessment-pngs',
    //   closeBundle() {
    //     const pngs = globSync('dist/assessment-cache/**/*.png')
    //     for (const file of pngs) {
    //       unlinkSync(file)
    //       console.log(`Removed from build: ${file}`)
    //     }
    //   },
    // },
    // Rewrite requests for mediapipe/face_mesh WASM files to /mediapipe/face_mesh/
    // WebGazer resolves these relative to the current page URL, which breaks on
    // nested routes like /studentAssessment/sections/19/questions/0
    {
      name: 'mediapipe-wasm-rewrite',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && req.url.includes('mediapipe/face_mesh/')) {
            req.url = '/mediapipe/face_mesh/' + req.url.split('mediapipe/face_mesh/').pop();
          }
          next();
        });
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,webp,png}'],
        globIgnores: ['assessment-cache/**', 'resource-manifest.json'],
        runtimeCaching: [
          {
            urlPattern: /\.mp4$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'game-videos',
              expiration: { maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/assessment-cache\/.+\.(json|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assessment-data',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/mediapipe\/.+\.(wasm|data|binarypb)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-wasm',
              expiration: { maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
    // Gzip + Brotli compression for text-based assets (JS, CSS, JSON, HTML)
    compression({ algorithm: 'gzip', exclude: [/\.(wasm|mp4|webp|png|jpg)$/] }),
    compression({ algorithm: 'brotliCompress', exclude: [/\.(wasm|mp4|webp|png|jpg)$/] }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          firebase: ['firebase/app', 'firebase/firestore'],
        },
      },
    },
  },
})
