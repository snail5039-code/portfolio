const ranges = {
  week: {
    label: '2026.08.19~2026.08.25',
    start: '128,420,000원',
    end: '130,180,000원',
    profit: '+1,760,000원',
    portfolio: '+1.37%',
    benchmark: '+0.82%',
    alpha: '+0.55%p',
    drawdown: '-0.64%',
    drawdownLabel: '가상 주간 저점',
    formula: '수익률 계산: 1,760,000 ÷ 128,420,000 = 1.37%',
    portfolioBar: '74%',
    benchmarkBar: '48%',
    alphaBar: '32%',
  },
  month: {
    label: '2026.07.26~2026.08.25',
    start: '125,600,000원',
    end: '130,180,000원',
    profit: '+4,580,000원',
    portfolio: '+3.65%',
    benchmark: '+2.14%',
    alpha: '+1.51%p',
    drawdown: '-1.42%',
    drawdownLabel: '가상 월간 저점',
    formula: '수익률 계산: 4,580,000 ÷ 125,600,000 = 3.65%',
    portfolioBar: '82%',
    benchmarkBar: '54%',
    alphaBar: '41%',
  },
  quarter: {
    label: '2026.05.26~2026.08.25',
    start: '121,900,000원',
    end: '130,180,000원',
    profit: '+8,280,000원',
    portfolio: '+6.79%',
    benchmark: '+3.91%',
    alpha: '+2.88%p',
    drawdown: '-2.35%',
    drawdownLabel: '가상 3개월 저점',
    formula: '수익률 계산: 8,280,000 ÷ 121,900,000 = 6.79%',
    portfolioBar: '88%',
    benchmarkBar: '58%',
    alphaBar: '49%',
  },
};

let currentRange = ranges.week;

const details = {
  return: {
    title: '주간 수익률',
    summary: () => `총자산 ${currentRange.start}에서 ${currentRange.end}으로 증가한 화면용 계산입니다.`,
    facts: () => [['기간', currentRange.label], ['손익', currentRange.profit], ['수익률', currentRange.portfolio], ['벤치마크', currentRange.benchmark]],
  },
  risk: {
    title: '주간 위험 요약',
    summary: '가상 주간 저점 기준 최대 낙폭과 변동성 근접 여부를 함께 표시합니다.',
    facts: () => [['최대 낙폭', currentRange.drawdown], ['20일 변동성', '27.4%'], ['정책 경계', '28.0%'], ['판정', '주의']],
  },
  cash: {
    title: '현금 비중',
    summary: '최소 현금 비중 15.0%보다 높은 18.4%로 표시되는 가상 상태입니다.',
    facts: () => [['현금성 자산', '23,953,000원'], ['총자산', '130,180,000원'], ['비중', '18.4%'], ['정책 하한', '15.0%']],
  },
  benchmark: {
    title: 'KOSPI 비교',
    summary: '포트폴리오와 벤치마크 수익률 차이를 한 주 단위로 비교합니다.',
    facts: () => [['포트폴리오', currentRange.portfolio], ['KOSPI', currentRange.benchmark], ['초과수익', currentRange.alpha], ['통화', 'KRW']],
  },
  alpha: {
    title: '초과수익',
    summary: '벤치마크 대비 초과분은 가상 수익률 차이로만 계산합니다.',
    facts: () => [['포트폴리오', currentRange.portfolio], ['벤치마크', currentRange.benchmark], ['초과수익', currentRange.alpha], ['세금', '미반영']],
  },
  samsung: {
    title: '삼성전자 주간 기여',
    summary: '가상 보유 종목 중 이번 주 수익 기여가 가장 큰 축으로 표시됩니다.',
    facts: () => [['기여 손익', '+420,000원'], ['비중', '6.65%'], ['연결 결정', 'DEC-1042'], ['출처', '미확인 포함']],
  },
  hynix: {
    title: 'SK하이닉스 기여',
    summary: '반도체 업종 상승을 화면용 기여 수치로 보여줍니다.',
    facts: () => [['기여 손익', '+610,000원'], ['비중', '13.90%'], ['상태', '관찰'], ['데이터', '가상 예시']],
  },
  naver: {
    title: 'NAVER 부담',
    summary: '플랫폼 종목의 주간 하락 기여를 손실 가능성 예시로 표시합니다.',
    facts: () => [['기여 손익', '-180,000원'], ['비중', '7.47%'], ['상태', '유지'], ['위험', '단기 변동']],
  },
  approved: {
    title: '모의승인 기록',
    summary: '사용자 승인 과정을 거친 화면용 기록이며 실제 주문은 생성되지 않습니다.',
    facts: () => [['건수', '1건'], ['상태', '화면 상태 변경'], ['실제 주문', '없음'], ['연결', '승인 대기']],
  },
  rejected: {
    title: '반려 기록',
    summary: '근거 미확인 또는 정책 충돌로 종료된 가상 제안을 요약합니다.',
    facts: () => [['건수', '1건'], ['사유', '근거 미확인'], ['영향', '주문 없음'], ['연결', '감사 로그']],
  },
  blocked: {
    title: '정책 차단 기록',
    summary: 'DEC-1042는 출처 미확인 상태라 기본 정책에서 차단 예시로 남습니다.',
    facts: () => [['건수', '1건'], ['결정', 'DEC-1042'], ['차단 조건', '출처 미확인'], ['실제 주문', '없음']],
  },
  source: {
    title: '출처 미확인',
    summary: '일부 근거는 화면용 미확인 데이터로 표시되며 실제 투자 판단에 쓰지 않습니다.',
    facts: () => [['미확인', '2건'], ['처리', '정책 차단'], ['표시 방식', '텍스트 경고'], ['외부 연결', '없음']],
  },
  volatility: {
    title: '변동성 근접',
    summary: '20일 변동성 27.4%는 정책 경계 28.0%에 근접한 가상 위험입니다.',
    facts: () => [['현재', '27.4%'], ['경계', '28.0%'], ['차이', '0.6%p'], ['판정', '주의']],
  },
  slippage: {
    title: '슬리피지 한계',
    summary: '체결 가격 차이는 실제 시장 데이터 없이 단순 위험 항목으로만 표시합니다.',
    facts: () => [['반영', '미반영'], ['주문 유형', '지정가 예시'], ['영향', '미확인'], ['실거래', '없음']],
  },
  tax: {
    title: '세금·수수료 단순화',
    summary: '세금과 수수료는 화면 목업 범위 밖이므로 성과 계산에 실제 반영하지 않습니다.',
    facts: () => [['수수료', '단순화'], ['세금', '미반영'], ['성과', '가상'], ['통화', 'KRW']],
  },
};

const title = document.querySelector('#inspectorTitle');
const summary = document.querySelector('#inspectorSummary');
const facts = document.querySelector('#inspectorFacts');
const selectable = document.querySelectorAll('[data-topic]');

function render(topic) {
  const item = details[topic] || details.return;
  title.textContent = item.title;
  summary.textContent = typeof item.summary === 'function' ? item.summary() : item.summary;
  const rows = typeof item.facts === 'function' ? item.facts() : item.facts;
  facts.replaceChildren(...rows.map(([key, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = key;
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  }));
}

function applyRange(rangeKey) {
  currentRange = ranges[rangeKey] || ranges.week;
  document.querySelector('#periodLabel').textContent = currentRange.label;
  document.querySelector('#profitValue').textContent = currentRange.profit;
  document.querySelector('#assetSummary').textContent = `총자산 ${currentRange.start}에서 ${currentRange.end}으로 증가했습니다.`;
  document.querySelector('#returnValue').textContent = currentRange.portfolio;
  document.querySelector('#benchmarkValue').textContent = `KOSPI ${currentRange.benchmark}`;
  document.querySelector('#drawdownValue').textContent = currentRange.drawdown;
  document.querySelector('#drawdownLabel').textContent = currentRange.drawdownLabel;
  document.querySelector('#formulaText').textContent = currentRange.formula;
  document.querySelector('#portfolioReturn').textContent = currentRange.portfolio;
  document.querySelector('#benchmarkReturn').textContent = currentRange.benchmark;
  document.querySelector('#alphaReturn').textContent = currentRange.alpha;
  document.querySelector('#portfolioBar').style.setProperty('--value', currentRange.portfolioBar);
  document.querySelector('#benchmarkBar').style.setProperty('--value', currentRange.benchmarkBar);
  document.querySelector('#alphaBar').style.setProperty('--value', currentRange.alphaBar);
  const selectedTopic = document.querySelector('.metric-card.selected,.return-bar.selected,.report-row.selected,.risk-chip.selected')?.dataset.topic || 'samsung';
  render(selectedTopic);
}

function selectControl(button) {
  const topic = button.dataset.topic;
  document.querySelectorAll('.metric-card,.return-bar,.report-row,.risk-chip').forEach(control => {
    const selected = control === button;
    control.classList.toggle('selected', selected);
    control.setAttribute('aria-pressed', String(selected));
  });
  render(topic);
}

selectable.forEach(button => button.addEventListener('click', () => selectControl(button)));

document.querySelectorAll('.segments button').forEach(button => {
  button.addEventListener('click', () => {
    button.parentElement.querySelectorAll('button').forEach(item => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    applyRange(button.dataset.range);
  });
});

render('samsung');
