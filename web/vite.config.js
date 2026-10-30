import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [solid()],
  // generated Panda runtime, imported as 'styled-system/css' from any folder
  resolve: { alias: { 'styled-system': fileURLToPath(new URL('./styled-system', import.meta.url)) } },
  server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
})
