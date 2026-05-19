import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/new-app/',
  plugins: [react()],
  server: {
      watch: {
        // Windows/XAMPP/AV setups can briefly lock files (EBUSY).
        // Polling is more resilient than native FS events in this case.
        usePolling: true,
        interval: 200,
      },
      proxy: {
        '/prestashop': {
          target: 'http://localhost',
          changeOrigin: true,
          secure: false,
          autoRewrite: true,
          protocolRewrite: 'http',
          cookieDomainRewrite: {
            '*': '',
          },
        },
        '/ps': {
        target: 'http://localhost/prestashop',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ps/, ''),
      },
    },
  }
})
