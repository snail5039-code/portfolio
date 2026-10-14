import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()
    , tailwindcss()
  ],
  server: {
    open: true,

    // 요청 주소는 src/config/api.js 의 API_BASE 로 전부 절대경로라서
    // 이 프록시는 실제로 타지 않는다. 그래도 남겨두는 이유는, 나중에 상대경로로
    // 바꿀 여지를 두기 위함이다.
    // rewrite 는 뺐다. 백엔드 경로가 /api/usr/... 인데 /api 를 떼어내고 있어서,
    // 상대경로로 전환하는 순간 /usr/... 로 잘못 전달됐을 것이다.
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
})
