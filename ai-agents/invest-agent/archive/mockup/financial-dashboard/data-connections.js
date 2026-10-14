const sources = {
  opendart: {
    title: 'OpenDART 공시',
    summary: '실제 OpenDART API 키나 공시 원문 요청 없이 미연결 상태만 표시합니다.',
    facts: [['상태', '미연결'], ['권한', 'API 키 없음'], ['마지막 확인', '화면용 14:32'], ['외부 요청', '0건']],
  },
  price: {
    title: '가격 데이터',
    summary: '현재가와 벤치마크는 실제 시세가 아닌 고정 예시입니다.',
    facts: [['상태', '가상'], ['현재가 예시', '71,200원'], ['실시간 구독', '없음'], ['저장', '없음']],
  },
  broker: {
    title: '증권사 계좌·주문',
    summary: '잔고 조회, 주문 생성, 매수·매도 권한이 모두 차단된 목업 상태입니다.',
    facts: [['상태', '차단'], ['계좌 권한', '없음'], ['주문 생성', '0건'], ['실거래', '불가']],
  },
  database: {
    title: '운영 데이터베이스',
    summary: '설정과 결정 기록은 실제 DB에 저장되지 않고 화면 상태로만 표현됩니다.',
    facts: [['상태', '미사용'], ['DB 연결', '없음'], ['쓰기 작업', '0건'], ['복구 대상', '없음']],
  },
  report: {
    title: '주간 리포트 산출물',
    summary: '리포트의 성과와 위험 수치는 화면 검토용 고정 계산입니다.',
    facts: [['상태', '가상'], ['기간', '2026.08.19~08.25'], ['통화', 'KRW'], ['외부 전송', '없음']],
  },
  unknown: {
    title: '출처 미확인 2건',
    summary: '미확인 출처는 실제 투자 판단에 쓰지 않도록 경고로 분리합니다.',
    facts: [['미확인', '2건'], ['정책 처리', '차단'], ['표시', '텍스트 경고'], ['실제 검증', '없음']],
  },
  stale: {
    title: '기준 시각 고정',
    summary: '모든 시각은 목업 표시용이며 최신 데이터 조회를 뜻하지 않습니다.',
    facts: [['기준', '2026.08.25 14:32'], ['갱신', '수동 목업'], ['자동 동기화', '없음'], ['외부 요청', '0건']],
  },
  permission: {
    title: '권한 범위 없음',
    summary: '읽기·쓰기·주문 권한을 부여하지 않은 상태를 명확히 보여줍니다.',
    facts: [['공시 읽기', '없음'], ['계좌 읽기', '없음'], ['주문 쓰기', '없음'], ['비밀키', '없음']],
  },
  paper: {
    title: '모의투자 전용',
    summary: '모든 동작은 실거래와 분리된 화면용 시뮬레이션입니다.',
    facts: [['환경', '모의투자'], ['실계좌', '미연결'], ['주문', '생성 안 함'], ['데이터', '고정 예시']],
  },
};

const title = document.querySelector('#inspectorTitle');
const summary = document.querySelector('#inspectorSummary');
const facts = document.querySelector('#inspectorFacts');
const statusText = document.querySelector('#mockCheckStatus');

function render(sourceKey) {
  const source = sources[sourceKey] || sources.opendart;
  title.textContent = source.title;
  summary.textContent = source.summary;
  facts.replaceChildren(...source.facts.map(([key, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = key;
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  }));
  statusText.textContent = '아직 점검하지 않았습니다.';
}

function selectSource(button) {
  document.querySelectorAll('.status-card,.source-row,.quality-chip').forEach(item => {
    const selected = item === button;
    item.classList.toggle('selected', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  render(button.dataset.source);
}

document.querySelectorAll('[data-source]').forEach(button => {
  button.addEventListener('click', () => selectSource(button));
});

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    button.parentElement.querySelectorAll('button').forEach(item => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('.source-row').forEach(row => {
      row.hidden = filter !== 'all' && row.dataset.kind !== filter;
    });
    const selected = document.querySelector('.source-row.selected');
    if (selected?.hidden) {
      const firstVisible = document.querySelector('.source-row:not([hidden])');
      if (firstVisible) selectSource(firstVisible);
    }
  });
});

document.querySelector('#mockCheckButton').addEventListener('click', () => {
  statusText.textContent = `${title.textContent}: 화면용 점검 완료 · 실제 요청 0건 · 저장 없음`;
});

render('opendart');
