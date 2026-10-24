import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            // Ngăn chặn Vite spam console lỗi ECONNREFUSED khi Backend API (:3000) chưa được bật
            const isConnectionRefused =
              ('code' in err && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET')) ||
              (err.message && err.message.includes('ECONNREFUSED'));

            if (isConnectionRefused && res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, {
                'Content-Type': 'application/json',
                'Retry-After': '10',
              });
              res.end(
                JSON.stringify({
                  status: 'offline',
                  message: 'Máy chủ Backend API (:3000) chưa khởi động. Vui lòng chạy "pnpm dev:api" hoặc "npm run start:dev".',
                })
              );
            }
          });
        },
      },
    },
  },
})
