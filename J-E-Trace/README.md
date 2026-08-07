# J-E-Trace  
### AI 기반 학습 과정 추적 및 과제 관리 플랫폼

🔗 서비스 바로가기  
(https://j-e-trace-git-test-snail5039-codes-projects.vercel.app)
### 현재 배포 중단

## admin 계정
아이디 : admin
비밀번호 : 1234

---

## 1. 프로젝트 개요

J-E-Trace는 **학생의 학습 과정 자체를 기록하고 분석하는 AI 기반 교육 플랫폼**입니다.

기존 과제 시스템은 결과물 중심 평가에 머물러 있어  
학생이 어떤 사고 과정과 AI 활용을 통해 결과를 도출했는지 확인하기 어렵습니다.

본 프로젝트는 이러한 문제를 해결하기 위해  
**AI 대화 로그 + 과제 제출 + 유사도 분석**을 통합하여  
학습 과정까지 평가 가능한 환경을 제공합니다.

---

## 2. 문제 정의

현재 교육 환경에서의 주요 문제는 다음과 같습니다.

- ❌ 과제 결과만 제출 → 학습 과정 확인 불가  
- ❌ AI 사용 여부만 확인 가능 → 활용 방식 분석 불가  
- ❌ 표절 및 유사도 판단 기준 부족  
- ❌ 교사의 평가 기준이 결과물에 편중됨  

---

## 3. 해결 방안

J-E-Trace는 다음과 같은 방식으로 문제를 해결합니다.

### ✔ 학습 과정 기록
- 학생의 AI 질문 및 응답을 전부 로그로 저장
- 단순 결과가 아닌 사고 흐름 분석 가능

### ✔ 통합 과제 관리 시스템
- 과제 생성 / 제출 / 평가까지 하나의 흐름으로 처리

### ✔ 유사도 분석 기능
- 학생 간 제출물 비교
- AI 활용 패턴 기반 분석 보조

### ✔ 권한 기반 구조
- 학생 / 교사 / 관리자 역할 분리
- 반(Class) 기준 데이터 접근 제한

---

## 4. 주요 기능

### 👨‍🎓 학생
- 과제 조회 및 수행
- AI 채팅 기반 학습
- 과제 제출
- 제출 상태 및 점수 확인

### 👨‍🏫 교사
- 과제 생성 및 관리
- 학생 제출물 확인
- AI 대화 로그 분석
- 유사도 분석 결과 확인
- 점수 및 피드백 입력

### 🛠 관리자
- 교사 계정 승인
- 시스템 운영 관리

---

## 5. 시스템 구조

Frontend (React)
↓
Backend (Spring Boot + MyBatis)
↓
Database (MySQL)


### 구조 특징

- REST API 기반 통신
- 역할(Role) 기반 접근 제어
- 반(Class) 단위 데이터 분리
- AI 로그 / 과제 / 제출 데이터 분리 저장

---

## 6. 핵심 기능 상세

### 1) AI 학습 로그 시스템
- 학생 질문 / AI 응답 저장
- 시간 순 정렬
- 학습 흐름 추적 가능

### 2) 과제 제출 시스템
- 과제 상세 확인
- 제출 여부 관리
- 제출 이후 수정 제한

### 3) 유사도 분석
- 학생 간 결과 비교
- AI 사용 패턴 참고 가능

### 4) 승인 기반 계정 구조
- 학생 / 교사 계정 승인 필요
- 교사는 관리자 승인 후 활성화

---

## 7. 기술 스택

### Frontend
- React
- TypeScript
- React Router
- Tailwind CSS
- Axios

### Backend
- Java 17
- Spring Boot
- MyBatis
- Lombok

### Database
- MySQL

### Deployment
- Vercel (Frontend)
- 서버 배포 (Backend)

---

## 8. 차별성

J-E-Trace의 핵심 차별점은 다음과 같습니다.

### 🔥 1. 결과가 아닌 "과정"을 평가
- AI 사용 자체가 아닌 **사용 방식과 흐름** 분석

### 🔥 2. AI 학습 로그 기반 평가
- 단순 제출물이 아닌 **질문-응답 기록 포함 평가**

### 🔥 3. 교육 환경 최적화 구조
- 반(Class) 단위 권한 관리
- 교사 중심 관리 시스템

### 🔥 4. 실전 교육 적용 가능성
- 과제 관리 + 평가 + AI 활용까지 통합

---

## 9. 기대 효과

- 📈 학생: 사고 과정 기반 학습 강화  
- 📊 교사: 평가 정확도 향상  
- 🏫 교육기관: AI 활용 교육 체계 구축  

---

## 10. 향후 발전 방향

- AI 분석 정확도 향상
- 자동 평가 보조 시스템
- 학습 데이터 기반 추천 기능
- 관리자 기능 고도화
- 통계 및 대시보드 확장

---

## 11. 프로젝트 의의

J-E-Trace는 단순한 과제 제출 시스템이 아니라,

> **"AI 시대의 학습을 어떻게 기록하고 평가할 것인가"**  
> 에 대한 해결을 목표로 한 프로젝트입니다.

학생의 결과물이 아닌  
**생각의 흐름과 학습 과정 자체를 평가하는 새로운 교육 방식**을 제안합니다.

## 배포

- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Railway MySQL

프론트엔드와 백엔드를 분리해서 배포했으며,  
백엔드는 Railway의 MySQL 데이터베이스와 연결되도록 구성했습니다.  
환경변수를 사용해 DB 정보와 서버 설정을 관리했고,  
프론트엔드는 배포된 백엔드 API 주소를 기준으로 통신하도록 설정했습니다.

## 구현 예시

<img width="1428" height="918" alt="2" src="https://github.com/user-attachments/assets/06e5461a-5b8c-465a-996f-b4809be1015a" />
<img width="1458" height="909" alt="1" src="https://github.com/user-attachments/assets/fcb313f2-b764-4936-9a6a-f5b4e1a45bb6" />
<img width="1478" height="902" alt="5" src="https://github.com/user-attachments/assets/ad3cd903-fc1a-4276-926e-2f0c907cb89e" />
<img width="1311" height="901" alt="4" src="https://github.com/user-attachments/assets/a2451134-ff60-43b1-8c9f-53af1239ddbb" />
<img width="1376" height="898" alt="3" src="https://github.com/user-attachments/assets/d6698116-efd2-4a41-825e-01f6046b9e71" />
<img width="1105" height="889" alt="9" src="https://github.com/user-attachments/assets/ee9273cb-8a31-4387-807f-f88af8ff8102" />
<img width="1509" height="919" alt="8" src="https://github.com/user-attachments/assets/b995f1ce-1af9-4c99-b3aa-1810ba3730da" />
<img width="1509" height="919" alt="7" src="https://github.com/user-attachments/assets/a60914f6-3168-4e4c-8897-b28390a27a5e" />
<img width="1478" height="919" alt="6" src="https://github.com/user-attachments/assets/39f9d56b-a684-4cea-922e-b60cff59f216" />
<img width="1185" height="880" alt="17" src="https://github.com/user-attachments/assets/6e161084-9212-484e-ab58-38a829ad4457" />
<img width="1041" height="563" alt="16" src="https://github.com/user-attachments/assets/06668105-8895-419e-b570-d03bb83b9344" />
<img width="1282" height="900" alt="15-2" src="https://github.com/user-attachments/assets/b998a1a3-20fa-4ff9-84b6-7de55593ba28" />
<img width="1152" height="899" alt="15-1" src="https://github.com/user-attachments/assets/4ffd725b-d4dc-47f7-b621-258f86331ac9" />
<img width="1053" height="540" alt="14" src="https://github.com/user-attachments/assets/dc80d11b-f3f0-4274-b28c-1ede8789d2ed" />
<img width="632" height="703" alt="13" src="https://github.com/user-attachments/assets/a78bc809-9644-4b5e-8ef8-45a3b25c2bf6" />
<img width="1294" height="702" alt="12" src="https://github.com/user-attachments/assets/04b95d10-8042-460f-83b1-84822ded7a73" />
<img width="1271" height="909" alt="11" src="https://github.com/user-attachments/assets/aa62bb76-6a7c-43f3-bc69-11b92170bc9b" />
<img width="1104" height="483" alt="10" src="https://github.com/user-attachments/assets/e98f926f-a1c9-4197-b0df-4cc58a8c96de" />
<img width="1330" height="906" alt="19" src="https://github.com/user-attachments/assets/df00edad-bb4b-4d11-9fdc-3c267901ae36" />
<img width="986" height="344" alt="18" src="https://github.com/user-attachments/assets/65961c1d-4573-4f7f-98d9-88e2baf07dd1" />
