import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css';
import './index.css' 
import App from './App.jsx'

// AuthProvider 는 App.jsx 안에 하나만 둔다.
// 여기서도 감싸면 Provider 가 두 겹이 되어 각각 따로 세션을 조회한다.
// 안쪽이 바깥을 가리므로 바깥 상태는 아무도 안 쓰는데 요청만 나갔다.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
