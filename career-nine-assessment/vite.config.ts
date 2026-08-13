import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { compression } from 'vite-plugin-compression2'

export default defineConfig({
  server: {
    host: process.env.VITE_DEV_HOST || undefined,
    port: process.env.VITE_DEV_PORT ? Number(process.env.VITE_DEV_PORT) : undefined,
    hmr: process.env.VITE_HMR_HOST
      ? {
          host: process.env.VITE_HMR_HOST,
          protocol: (process.env.VITE_HMR_PROTOCOL as 'ws' | 'wss') || 'wss',
          clientPort: process.env.VITE_HMR_CLIENT_PORT
            ? Number(process.env.VITE_HMR_CLIENT_PORT)
            : 443,
        }
      : undefined,
  },
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
      /*
       * MUST NOT be 'autoUpdate'.
       *
       * 'autoUpdate' makes vite-plugin-pwa emit `self.skipWaiting()` +
       * `clientsClaim()` into sw.js. A newly deployed service worker then
       * activates INSIDE ALREADY-OPEN TABS and Workbox's cleanupOutdatedCaches
       * purges the previous precache. Because each build emits exactly one hash
       * per chunk (dist/assets is rewritten on every build), the old
       * `/assets/SelectSectionPage-<hash>.js` the running document still points
       * at is now gone from BOTH the cache and the server.
       *
       * The three routes under /studentAssessment are the only code-split pages
       * in this app, so the next navigation there hit a 404 on its chunk, the
       * React.lazy promise rejected, and the student was stranded on the
       * <Suspense> spinner until they manually reloaded. That was the
       * long-standing "/studentAssessment forces every student to reload" bug.
       *
       * With 'prompt' the new SW installs and stays in `waiting`; it only takes
       * over once every tab on the origin has closed. A student mid-assessment
       * therefore keeps the exact build they started on — which is the correct
       * contract for an exam app — and picks up the new one on their next visit.
       * index.html is served no-cache (see public/_headers + nginx), so nothing
       * gets pinned to a stale build across sessions.
       */
      registerType: 'prompt',
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
    compression({ algorithms: ['gzip'], exclude: [/\.(wasm|mp4|webp|png|jpg)$/] }),
    compression({ algorithms: ['brotliCompress'], exclude: [/\.(wasm|mp4|webp|png|jpg)$/] }),
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
