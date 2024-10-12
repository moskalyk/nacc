import { nodePolyfills } from 'vite-plugin-node-polyfills'

import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [nodePolyfills()],
  resolve: {
  },
  build: {
    commonjsOptions: { transformMixedEsModules: true } // Change
  }
})