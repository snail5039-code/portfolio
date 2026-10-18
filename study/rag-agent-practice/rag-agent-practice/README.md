### RAG Agent 실습

데이터 출처: [Allganize RAG-Evaluation-Dataset-KO](https://huggingface.co/datasets/allganize/RAG-Evaluation-Dataset-KO)

과제 안내는 [PRACTICE.md](PRACTICE.md), 설계·추출 정리는 [../docs/](../docs/)에 있다.

## 폴더 구조

```
rag_agent_practice/
├─ docs/                      설계·정리 문서
│   ├─ 설계.md                 처음 설계 메모
│   ├─ agent와_설계.md          결정한 설계 (파이프라인, 추출·청킹·검색 기준)
│   └─ 추출.md                 추출에 쓴 라이브러리·방법·결과 정리
│
└─ rag-agent-practice/
    ├─ README.md               (이 파일)
    ├─ PRACTICE.md             과제 안내
    ├─ .env                    GOOGLE_API_KEY (git 제외)
    │
    ├─ data/                   제공 PDF 59개 + golden_set.csv (git 제외)
    │   ├─ goldenset_my.csv     직접 만든 골든셋 77문제
    │   ├─ goldenset_all.csv    제공 + 내 골든셋 합본 309문제 (겹치는 35문제는 한 번만)
    │   └─ commerce · finance · law · medical · public
    │
    ├─ pipeline/               실행 순서대로
    │   ├─ extract.py          1. PDF → 글·표 추출, 이미지 위치 표시
    │   ├─ ocr_images.py       2. 이미지 OCR + 이미지 속 표
    │   ├─ find_figures.py     3. 그래프·다이어그램 찾기
    │   ├─ vision_gemini.py    4. Gemini로 그래프·다이어그램 → 마크다운
    │   ├─ chunk.py            5. 청킹 (논문=문단, 일반=300/50, 표=행 단위)
    │   ├─ embed.py            6. 임베딩 → Chroma 저장, 검색 확인
    │   ├─ evaluate_retrievers.py  7. 검색기 비교 평가 (similarity·MMR·BM25·Hybrid)
    │   ├─ retriever.py        검색기 (표 질문=MMR, 나머지=Hybrid)
    │   ├─ agent.py            8. RAG 에이전트 (검색 최대 3회, 답변/보류)
    │   └─ evaluate_agent.py   9. 에이전트 평가 (골든셋, openevals 채점)
    │
    ├─ experiments/            단발성 실험 (table_ocr.py: 표 구조 인식 시험)
    │
    ├─ output/
    │   ├─ extracted/          추출 결과
    │   │   ├─ INDEX.md         ← 여기서 파일별 미리보기를 연다
    │   │   ├─ jsonl/           페이지별 추출 데이터 (청킹 입력)
    │   │   ├─ preview/         파일별 미리보기 md
    │   │   ├─ images/          이미지 영역 PNG (OCR 대상)
    │   │   └─ figures/         그래프·다이어그램 PNG + Gemini 결과
    │   ├─ chunks/
    │   │   ├─ base_500_60/     기본(최종) - chunks.jsonl, STATS.md, preview/
    │   │   └─ base_300_50/, base_800_100/   비교용
    │   ├─ experiments/        실험 결과
    │   └─ logs/               실행 로그
    │
    └─ vectordb/               Chroma 벡터DB (git 제외, embed로 다시 생성)
```

## 실행 순서

모든 명령은 `rag-agent-practice/` 폴더에서 실행한다.

```bash
python -m pipeline.extract         # 1. 글·표 추출 (이어서 실행 가능)
python -m pipeline.ocr_images      # 2. 이미지 OCR + 이미지 속 표
python -m pipeline.find_figures    # 3. 그래프·다이어그램 찾기
python -m pipeline.vision_gemini   # 4. Gemini 변환 (.env 필요)
python -m pipeline.chunk           # 5. 청킹 → output/chunks/base_500_60/ (--size/--overlap로 변경)
python -m pipeline.embed           # 6. 임베딩 → vectordb/ (.env 필요)
python -m pipeline.evaluate_retrievers --golden data/goldenset_my.csv   # 7. 검색기 비교
python -m pipeline.agent "질문" --show-searches                          # 8. 에이전트에 질문 하나
python -m pipeline.evaluate_agent --limit 5                              # 9. 에이전트 평가 (앞 5문제로 확인)
python -m pipeline.evaluate_agent                                        #    전체 (끊겨도 다시 실행하면 이어서)
python -m pipeline.evaluate_ragas --run <에이전트 결과 폴더>               # 10. 실패 원인 분석 (RAGAS, pip install jsonref 필요)
python -m pipeline.evaluate_trajectory --run <에이전트 결과 폴더>          # 11. 검색 과정 채점 (agentevals)
```

에이전트 평가 결과는 `output/eval/agent/<골든셋>__<청킹설정>__<모델>__<검색설정>/report.md`에 저장된다.
검색설정 `nb1_hybrid_fb` = 앞뒤 청크 1개 붙이기 + 표도 Hybrid + 분야 결과에 전체 결과 섞기 (기본). 검색설정 표시가 없는 폴더는 처음 검색 방식의 결과.
모델: 에이전트 기본 `gemini-3.5-flash-lite` (`--model`로 변경), 채점은 `gemini-3.5-flash-lite`로 고정.
채점: 답변 정확도(openevals CORRECTNESS, LLM 채점), 근거 쪽 적중, 검색 적중, 보류 판단, 검색 횟수, 응답 시간.

검색만 확인:

```bash
python -m pipeline.embed --query "보험업권 상생금융이 뭐야?" --k 5
```

## 현재 상태

| 단계 | 상태 |
|---|---|
| 추출 (글·표·OCR·Gemini) | 완료 - 59개 PDF, 1,258쪽 |
| 청킹 | 완료 - 기본 500/60 (4,747개), 비교용 300/50 (6,382개)·800/100 (3,960개) |
| 임베딩·벡터DB | 완료 - gemini-embedding-2, Chroma 컬렉션 `base_500_60`·`base_300_50`·`base_800_100` |
| 골든셋 | 완료 - 내 골든셋 77문제, 합본 309문제, 비율 맞춰 뽑은 200문제 |
| 검색기 비교 | 완료 - 처음엔 표=MMR·나머지=Hybrid, 실패 분석 후 모두 Hybrid + 앞뒤 청크 + 분야 보완 |
| 에이전트 | 완료 - `pipeline/agent.py` (gemini-3.5-flash-lite) |
| 에이전트 평가 | 완료 - 최종 설정 200문제 정답률 0.888·0.903 (아래 비교들) |
| 기본 RAG 비교 | 완료 - 기본 RAG 0.867·0.842, 에이전트가 약 4%p 높고 1.7배 느림 |

## 청킹 비교 (검색 방식 고정: 표=MMR, 나머지=Hybrid)

| 청킹 | 검색 Hybrid MRR (309문제) | 에이전트 정답률 (200문제, 1차/2차) | 평균 검색 | 평균 시간 |
|---|---|---|---|---|
| 300/50 | **0.830** | 0.786 / 0.796 | 1.77회 | 4.1초 |
| **500/60** | 0.819 | **0.827 / 0.811** | **1.60회** | **3.8초** |
| 800/100 | 0.812 | 0.806 / - | 1.54회 | 3.9초 |

- 검색 지표는 300/50이 가장 좋지만, 에이전트 정답률은 500/60이 두 번 모두 더 높아서 500/60 선택
- 같은 설정을 두 번 돌려도 정답률이 1~2%p 흔들린다 (LLM 응답이 매번 조금씩 다름). 차이는 약 3%p로 작다
- 표 질문 정답률은 세 설정 모두 0.55~0.61 -> 청킹으로는 해결되지 않음

## 실패 분석과 검색 개선 (500/60, 200문제)

**RAGAS** (`output/eval/ragas/`): 실패 34개 중 24개는 "검색 실패" - 정답 쪽의 청크는 찾았지만 답이 적힌 청크는 못 찾음.
잘못된 보류 22개 중 19개는 받은 근거에 정말 답이 없어서 보류한 것 (판단 문제가 아니라 검색 문제). 지어낸 답은 거의 없음 (faithfulness 0.89~0.97).

**agentevals** (`output/eval/trajectory/`): 분야(domain)를 잘못 지정하면 정답률 0.25~0.33, 표 질문에 MMR을 쓰면 Hybrid보다 정답률이 크게 낮음.

| 검색 설정 | 정답률 | 근거 쪽 적중 | 잘못된 보류 | 표 정답률 | 평균 검색 | 평균 시간 |
|---|---|---|---|---|---|---|
| 처음 (표=MMR, 분야 필터) 1차/2차 | 0.827 / 0.811 | 0.781 / 0.765 | 0.112 / 0.143 | 0.576 / 0.545 | 1.60회 | 3.8초 |
| ① 앞뒤 청크 1개 붙이기 | 0.806 | 0.760 | 0.128 | 0.545 | 1.34회 | 3.6초 |
| ① + ② 표도 Hybrid | 0.842 | 0.770 | 0.107 | 0.667 | 1.33회 | 3.6초 |
| **① + ② + ③ 분야 결과에 전체 결과 섞기** 1차/2차 | **0.872 / 0.898** | **0.832 / 0.827** | **0.066 / 0.056** | **0.667 / 0.758** | **1.27회** | 4.0~4.2초 |

- ①만으로는 효과가 없었고, ②·③을 더하자 올라감. 세 가지를 모두 기본값으로 함
- 두 번 다 맞힌 문제: 처음 158개 -> 172개

## 프롬프트 수정 (p1 -> p2, 같은 검색 설정)

남은 실패(두 번 다 틀린 17문제)에서 프롬프트로 고칠 수 있는 패턴을 반영:
표 숫자로 계산할 수 있는데 "비교 문장이 없다"며 보류, 질문 일부만 답함, 연도가 다른 숫자를 고름.

- `is_table` 인자 제거 (표도 Hybrid라 효과가 없었음)
- 질문의 부분마다 근거 확인, 빠진 부분은 재검색 / 표 수치로 계산할 수 있으면 계산해서 답함 / 연도·대상·단위 일치
- 출력 순서: `judgement`(근거 판단)를 먼저 쓰고 `status`를 정함

| 프롬프트 | 정답률 1차/2차 | 표 정답률 | 잘못된 보류 | 답변 불가 보류 | 평균 검색 |
|---|---|---|---|---|---|
| p1 | 0.872 / 0.898 | 0.667 / 0.758 | 0.066 / 0.056 | 1.000 | 1.27회 |
| **p2** | **0.888 / 0.903** | **0.818 / 0.818** | 0.066 / 0.061 | 1.000 | 1.31~1.36회 |

- 표 질문은 두 번 모두 0.818로 확실히 좋아짐. 전체는 평균 +1%p로 흔들림 범위 안
- 계산 허용으로 억지 답변이 늘지 않았음 (답변 불가 문제 보류 100% 유지)

## 기본 RAG vs 에이전트 (최종 설정, 200문제, `--mode rag`)

기본 RAG(`pipeline.agent.BasicRag`)는 질문 그대로 한 번만 검색하고 바로 답변/보류한다.
검색기·모델·답변 형식·답변 규칙은 에이전트와 같고, 재검색과 검색어 고르기만 없다.

| | 에이전트 1차 / 2차 | 기본 RAG 1차 / 2차 |
|---|---|---|
| 정답률 (답 있는 196문제) | **0.888 / 0.903** | 0.867 / 0.842 |
| 답했는데 틀림 | 9 / 7 | 8 / 12 |
| 잘못된 보류 | **13 / 12** | 18 / 19 |
| 답변 불가 보류 | 1.000 | 1.000 |
| 표 질문 정답률 | **0.818 / 0.818** | 0.758 / 0.697 |
| 평균 검색 / 시간 | 1.3회 / 4.1초 | 1회 / **2.4초** |

- 에이전트가 평균 약 4%p 높고(0.896 vs 0.855), 약 1.7배 느림. 차이는 주로 잘못된 보류가 줄어서
- 두 번 다 에이전트만 맞힌 문제 9개(재검색 덕분 5, 검색어를 핵심어로 다듬어서 4) / 기본 RAG만 맞힌 문제 3개
- 에이전트도 76%는 검색 1번으로 끝냄 -> 재검색은 어려운 문제에서만 쓰임
