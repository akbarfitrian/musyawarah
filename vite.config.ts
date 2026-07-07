import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Multi-page setup:
// - "/"      -> index.html        (static marketing landing page)
// - "/app/"  -> app/index.html    (the actual MUSYAWARAH React dApp)
// Both are part of the same Vite project/build, so one `npm run build`
// produces one deployable dist/ with both pages wired together.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
})
