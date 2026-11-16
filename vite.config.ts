import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'

// SINGLE=1 inlines everything into one HTML file (shared as a private link).
const single = !!process.env.SINGLE

export default defineConfig({
  base: './',
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: { chunkSizeWarningLimit: 4000 },
  server: { host: true, port: 5193 },
})
