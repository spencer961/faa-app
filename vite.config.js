import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset paths relative so the app works both on a
// GitHub Pages subpath and on a custom domain without extra config.
export default defineConfig({
  plugins: [react()],
  base: './',
})
