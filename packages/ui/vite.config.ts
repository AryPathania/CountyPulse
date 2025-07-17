import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: resolve(__dirname, '../../'), // Look for .env files in the root directory
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@connectors': resolve(__dirname, '../connectors'),
      '@pipeline': resolve(__dirname, '../pipeline/src'),
      '@db': resolve(__dirname, '../db/migrations'),
      '@functions': resolve(__dirname, '../functions'),
      '@ui': resolve(__dirname, './src'),
    },
  },
})
