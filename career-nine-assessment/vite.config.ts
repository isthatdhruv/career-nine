import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { compression } from 'vite-plugin-compression2'

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
