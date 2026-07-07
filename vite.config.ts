import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { adminSavePlugin } from './src/plugins/admin-save'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode !== 'production' ? [adminSavePlugin()] : []),
  ],
  base: '/emotions-wheel/',
  build: {
    rollupOptions: {
      input: (mode !== 'production'
        ? { main: 'index.html', admin: 'admin.html' }
        : { main: 'index.html' }) as Record<string, string>,
    },
  },
}))
