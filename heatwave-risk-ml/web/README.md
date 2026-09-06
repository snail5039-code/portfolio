# 온열질환자 수 예측 웹 화면

기존 Streamlit 화면과 별도로 실행하는 Next.js 대시보드입니다. Random Forest 모델과 학습 데이터, 기상 API 로직은 Python 원본을 기준으로 TypeScript로 이식했으며, 요청마다 Python을 실행하지 않아 Vercel 같은 서버리스 환경에서도 그대로 동작합니다.

## 실행 방법

```powershell
cd web
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열면 됩니다.

## 화면 구성

- 전국 하루 평균 기상정보 기반 예상 환자 수
- 선택 도시와 외출 시간대 기상정보 기반 참고 예측
- 선택 지역의 기온, 습도, 풍속, 강수량과 폭염특보 표시
- 전체 연령과 65세 이상 모델 성능 비교
- 학습 데이터 추이, 기온과 환자 수 관계, 변수 중요도 차트

## 내부 연결

- `web/src/data/model-*.json`: `model/saved`의 RandomForestRegressor를 트리 구조 그대로 내보낸 파일. `web/src/lib/randomForest.ts`가 Python 없이 동일한 예측값을 계산한다.
- `web/src/data/analysis-*.json`: `data/processed` 학습 데이터로 만든 차트용 자료. 학습 데이터가 2022~2025년으로 고정돼 있어 요청마다 다시 계산하지 않고 미리 만들어 둔 값을 그대로 쓴다.
- `web/src/lib/weather.ts`: Open-Meteo 예보 조회와 전국/외출 시간대 집계를 `weather_api.py`와 동일한 방식으로 수행한다. `web/src/lib/kmaKey.ts`가 기상청 특보 인증키(`KMA_API_KEY`)를 읽는데, Vercel에서는 환경변수로, 로컬에서는 기존 `.streamlit/secrets.toml`로도 설정할 수 있다.
- `web/src/lib/riskLevel.ts`: `model/risk_level.py`의 등급·외출 안내 규칙을 그대로 이식했다.

모델이나 학습 데이터를 다시 만들면 아래 명령으로 JSON을 다시 내보내야 한다 (프로젝트 루트 `.venv` 필요).

```powershell
.\.venv\Scripts\python.exe web\scripts\export_static_data.py
```

운영 빌드는 다음 명령으로 확인할 수 있습니다.

```powershell
npm run build
npm start
```
