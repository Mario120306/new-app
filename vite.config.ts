import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/new-app/',
  plugins: [react()],
  server: {
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
