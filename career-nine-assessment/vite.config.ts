import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
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
        runtimeCaching: [
          {
            urlPattern: /\.(mp4)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'game-videos',
              expiration: { maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
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
