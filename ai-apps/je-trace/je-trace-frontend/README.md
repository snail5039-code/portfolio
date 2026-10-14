# J·E TRACE Frontend

J·E TRACE의 React Router 기반 프런트엔드입니다. 프로젝트 소개와 전체 실행 방법은 [루트 README](../README.md)를 확인하세요.

## 실행 명령

```powershell
npm install
npm run dev
```

```powershell
npm run typecheck
npm run build
npm run test:e2e
```

로컬 개발 환경에서는 API 주소가 `http://localhost:8080`으로 설정됩니다. 다른 API 서버를 사용하려면 `.env.example`을 `.env`로 복사한 뒤 `VITE_API_BASE_URL`을 변경하세요.
