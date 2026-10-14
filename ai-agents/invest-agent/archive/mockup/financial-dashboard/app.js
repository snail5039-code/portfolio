const evidenceToggle = document.querySelector('#evidenceToggle');
const evidenceDetail = document.querySelector('#evidenceDetail');
const rejectButton = document.querySelector('#rejectButton');
const approveButton = document.querySelector('#approveButton');
const decisionMessage = document.querySelector('#decisionMessage');
const chartWrap = document.querySelector('#chartWrap');
const tooltip = document.querySelector('#chartTooltip');
const eventPoint = document.querySelector('.event-point');

evidenceToggle.addEventListener('click', () => {
  const expanded = evidenceToggle.getAttribute('aria-expanded') === 'true';
  evidenceToggle.setAttribute('aria-expanded', String(!expanded));
  evidenceDetail.hidden = expanded;
  evidenceToggle.querySelector('i').textContent = expanded ? '⌄' : '⌃';
});

function decide(type) {
  const approved = type === 'approved';
  decisionMessage.textContent = approved ? '모의승인 처리됨 · 실제 주문은 생성되지 않았습니다.' : '반려 처리됨 · 모의제안이 종료되었습니다.';
  decisionMessage.className = `decision-message visible ${type}`;
  approveButton.disabled = true;
  rejectButton.disabled = true;
}

approveButton.addEventListener('click', () => decide('approved'));
rejectButton.addEventListener('click', () => decide('rejected'));

function showTooltip(clientX, clientY) {
  const bounds = chartWrap.getBoundingClientRect();
  const x = Math.min(Math.max(clientX - bounds.left + 12, 8), bounds.width - 202);
  const y = Math.min(Math.max(clientY - bounds.top - 110, 4), bounds.height - 122);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  tooltip.classList.add('visible');
}

chartWrap.addEventListener('mousemove', event => showTooltip(event.clientX, event.clientY));
chartWrap.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
eventPoint.addEventListener('focus', () => {
  const bounds = eventPoint.getBoundingClientRect();
  showTooltip(bounds.left, bounds.top);
});
eventPoint.addEventListener('blur', () => tooltip.classList.remove('visible'));

const companyRow = document.querySelector('.company-link-row');
companyRow.addEventListener('click', event => {
  if (!event.target.closest('a')) window.location.href = 'company-detail.html';
});
