const evidenceChoices = [...document.querySelectorAll('.detail-choice')];
const filingChoices = [...document.querySelectorAll('.filing-choice')];
const choices = [...evidenceChoices, ...filingChoices];
const inspectorTitle = document.querySelector('#inspectorTitle');
const inspectorType = document.querySelector('#inspectorType');
const inspectorBody = document.querySelector('#inspectorBody');
const sourceId = document.querySelector('#sourceId');

choices.forEach(choice => choice.addEventListener('click', () => {
  const filing = choice.classList.contains('filing-choice');
  if (filing) {
    filingChoices.forEach(item => item.setAttribute('aria-selected', 'false'));
    choice.setAttribute('aria-selected', 'true');
  } else {
    evidenceChoices.forEach(item => item.setAttribute('aria-pressed', 'false'));
    choice.setAttribute('aria-pressed', 'true');
  }
  inspectorTitle.textContent = choice.dataset.title;
  inspectorType.textContent = filing ? '화면 예시 공시 · 선택됨' : `${choice.dataset.type} · 선택됨`;
  inspectorBody.textContent = filing ? '실제 공시 원문과 연결되지 않은 화면 구조 검토용 항목입니다. 실제 공시 검증은 수행되지 않았습니다.' : choice.dataset.body;
  sourceId.textContent = filing ? choice.dataset.id : '근거 예시';
}));

const chart = document.querySelector('#detailChart');
const tooltip = document.querySelector('#detailTooltip');
const points = [...document.querySelectorAll('.chart-points circle')];
function showPoint(point) {
  const chartBounds = chart.getBoundingClientRect();
  const pointBounds = point.getBoundingClientRect();
  tooltip.textContent = `${point.dataset.index}번째 예시 · ${point.dataset.price}`;
  tooltip.style.left = `${Math.min(pointBounds.left - chartBounds.left + 8, chartBounds.width - 128)}px`;
  tooltip.style.top = `${Math.max(pointBounds.top - chartBounds.top - 25, 0)}px`;
  tooltip.classList.add('visible');
}
points.forEach(point => {
  point.addEventListener('mouseenter', () => showPoint(point));
  point.addEventListener('focus', () => showPoint(point));
  point.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
  point.addEventListener('blur', () => tooltip.classList.remove('visible'));
});
