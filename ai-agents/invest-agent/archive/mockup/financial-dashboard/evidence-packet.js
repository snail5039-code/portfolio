const decisions=[
  {
    id:'DEC-1056',
    name:'삼성전자',
    ticker:'005930',
    action:'비중 +2% 후보',
    status:'확인 필요',
    state:'need',
    evidenceState:'6/7',
    policy:'한도 경계',
    cost:'비용 작음',
    approval:'사용자 승인 필요',
    summary:'비중 확대 후보지만 출처 연결과 리스크 알림 확인이 남아 있어 승인 전 검토가 필요합니다.',
    calc:'기준 총액 10,000,000원 × 2.0% = 200,000원 추가 노출로 재현되는 화면용 계산입니다.',
    source:'실제 공시·시세·계좌 검증 아님',
    risk:'단일 종목 10% 한도에 가까워지는 예시',
    primary:'portfolio-change-compare.html',
    primaryLabel:'변경 비교 보기',
    items:[
      ['계산 재현성','10,000,000원 × 2.0% = 200,000원','done'],
      ['정책 한도','단일 종목 한도 경계, 초과 아님','done'],
      ['세금·수수료·슬리피지','예상 비용 작음, 실제 적용값 아님','done'],
      ['출처 연결 상태','공시·시세 실제 연결 없음','need'],
      ['리스크 알림','집중도 경계 알림 확인 필요','need'],
      ['역할별 확인','제안·정책 확인 완료, 검증자 확인 필요','need'],
      ['사용자 승인 필요','승인 전 금융 행동 없음','done']
    ]
  },
  {
    id:'DEC-1054',
    name:'Apple',
    ticker:'AAPL',
    action:'소액 매수 후보',
    status:'확인 필요',
    state:'need',
    evidenceState:'5/7',
    policy:'해외 한도 확인',
    cost:'비용 재검토',
    approval:'사용자 승인 필요',
    summary:'해외 주식 소액 매수 후보이며 환율, 환전 비용, 슬리피지 가정 재검토가 남아 있습니다.',
    calc:'가상 주문 1주 × 235.00달러 × 1,360원 = 319,600원 노출로 표시합니다.',
    source:'실제 환율·해외 시세 조회 없음',
    risk:'환율 변화와 해외 주식 비용 가정 확인 필요',
    primary:'tax-fee-impact.html',
    primaryLabel:'세금·수수료 보기',
    items:[
      ['계산 재현성','1주 × 235.00달러 × 1,360원 = 319,600원','done'],
      ['정책 한도','해외 주식 한도 예시 안에서 검토','done'],
      ['세금·수수료·슬리피지','환전 비용과 슬리피지 재검토 필요','need'],
      ['출처 연결 상태','해외 시세·환율 실제 연결 없음','need'],
      ['리스크 알림','환율 민감도 확인 필요','need'],
      ['역할별 확인','비용 검토자 보완 요청','need'],
      ['사용자 승인 필요','승인 전 주문 없음','done']
    ]
  },
  {
    id:'DEC-1050',
    name:'KODEX 200',
    ticker:'069500',
    action:'비중 유지 점검',
    status:'확인 완료',
    state:'done',
    evidenceState:'7/7',
    policy:'정책 통과',
    cost:'비용 없음',
    approval:'승인 불필요 예시',
    summary:'비중 유지 후보로 계산, 정책, 비용, 출처, 리스크, 역할 확인이 모두 완료된 화면용 패킷입니다.',
    calc:'현재 비중 33.0%를 유지하는 예시이며 신규 주문 금액은 0원으로 표시합니다.',
    source:'실제 ETF 시세·계좌 잔고 조회 없음',
    risk:'신규 위험 알림 없음으로 표시한 가상 예시',
    primary:'portfolio-health.html',
    primaryLabel:'포트폴리오 건강 보기',
    items:[
      ['계산 재현성','비중 유지, 신규 주문 금액 0원','done'],
      ['정책 한도','ETF 편입 한도 예시 통과','done'],
      ['세금·수수료·슬리피지','신규 주문 없음, 비용 없음 예시','done'],
      ['출처 연결 상태','실제 조회 없이 미연결 상태 명시','done'],
      ['리스크 알림','신규 위험 알림 없음 예시','done'],
      ['역할별 확인','제안·검증·정책 확인 완료','done'],
      ['사용자 승인 필요','승인 행동 없는 유지 점검 예시','done']
    ]
  },
  {
    id:'DEC-1052',
    name:'SK하이닉스',
    ticker:'000660',
    action:'매도 보류 후보',
    status:'차단',
    state:'block',
    evidenceState:'7/7',
    policy:'정책 차단',
    cost:'영향 큼',
    approval:'승인 불가 예시',
    summary:'매도 후보였지만 비용 영향과 역할 검증 충돌로 화면상 차단된 승인 전 패킷입니다.',
    calc:'가상 매도 3주 × 285,000원 = 855,000원이며 비용 차감 후 손익 악화 예시입니다.',
    source:'실제 세금·수수료 계산 아님',
    risk:'반도체 비중 조정 효과보다 비용·정책 경고가 큰 예시',
    primary:'agent-role-status.html',
    primaryLabel:'역할 상태 보기',
    items:[
      ['계산 재현성','3주 × 285,000원 = 855,000원','done'],
      ['정책 한도','비용 영향 규칙으로 차단','block'],
      ['세금·수수료·슬리피지','순손익 악화 예시 확인','block'],
      ['출처 연결 상태','실제 세금·시세 연결 없음','done'],
      ['리스크 알림','매도 보류 알림 표시','block'],
      ['역할별 확인','검증자와 정책 감시자 차단 일치','done'],
      ['사용자 승인 필요','차단 상태에서는 승인 버튼 연결 없음','block']
    ]
  }
];

let filter='all';
let selectedId=decisions[0].id;
const decisionList=document.querySelector('#decisionList');
const emptyState=document.querySelector('#emptyState');
const classForState=state=>state==='done'?'done':state==='block'?'block':'need';

function visibleDecisions(){
  return decisions.filter(item=>filter==='all'||item.status===filter);
}

function setFacts(selector,entries){
  document.querySelector(selector).replaceChildren(...entries.map(([key,value])=>{
    const row=document.createElement('div');
    const dt=document.createElement('dt');
    const dd=document.createElement('dd');
    dt.textContent=key;
    dd.textContent=value;
    row.append(dt,dd);
    return row;
  }));
}

function updateSummary(items){
  const selected=decisions.find(item=>item.id===selectedId);
  document.querySelector('#visibleCount').textContent=`${items.length}건`;
  document.querySelector('#evidenceCount').textContent=selected?`${selected.items.length}개`:'0개';
  document.querySelector('#statusMetric').textContent=selected?selected.status:'빈 결과';
  document.querySelector('#summaryEyebrow').textContent=selected?`${selected.id} · ${selected.status}`:'선택 없음';
  document.querySelector('#summaryTitle').textContent=selected?`${selected.name} ${selected.action}`:'선택한 조건의 근거 패킷 없음';
  document.querySelector('#summaryCopy').textContent=selected?selected.summary:'필터 조건에 맞는 결정이 없어 이전 선택, 근거 목록, 관련 링크를 비웁니다.';
}

function renderList(){
  const items=visibleDecisions();
  if(!items.some(item=>item.id===selectedId)){
    selectedId=items[0]?.id||null;
  }
  decisionList.hidden=!items.length;
  emptyState.hidden=items.length>0;
  decisionList.replaceChildren(...items.map(item=>{
    const button=document.createElement('button');
    const selected=item.id===selectedId;
    button.type='button';
    button.className='decision-row';
    button.setAttribute('role','option');
    button.setAttribute('aria-selected',String(selected));
    button.dataset.id=item.id;
    button.tabIndex=selected?0:-1;
    button.innerHTML=`<span><strong>${item.id}</strong><small>${item.name} · ${item.ticker}</small></span><span>${item.action}</span><span><i class="state-pill ${item.state}">${item.status}</i></span><span>${item.evidenceState}</span><span>${item.policy}</span><span>${item.cost}</span><span>${item.approval}</span>`;
    button.addEventListener('click',()=>selectDecision(item.id));
    return button;
  }));
  updateSummary(items);
}

function renderEvidenceCards(item){
  const list=document.querySelector('#evidenceList');
  if(!item){
    list.replaceChildren();
    return;
  }
  list.replaceChildren(...item.items.map(([title,copy,state])=>{
    const card=document.createElement('article');
    card.className=`evidence-card ${classForState(state)}`;
    card.innerHTML=`<b><span>${title}</span><span>${state==='done'?'확인 완료':state==='block'?'차단':'확인 필요'}</span></b><p>${copy}</p>`;
    return card;
  }));
}

function renderInspector(){
  const item=decisions.find(entry=>entry.id===selectedId);
  const badge=document.querySelector('#detailBadge');
  if(!item){
    document.querySelector('#detailTitle').textContent='선택 패킷 없음';
    document.querySelector('#detailSummary').textContent='현재 필터에 해당하는 승인 전 근거 패킷이 없습니다.';
    badge.textContent='빈 결과';
    badge.className='need';
    document.querySelector('#calcText').textContent='표시할 계산 재현성 항목이 없습니다.';
    setFacts('#decisionFacts',[['필터 상태','항목 없음'],['외부 요청','0건']]);
    setFacts('#policyFacts',[['정책 상태','미표시'],['비용 상태','미표시']]);
    setFacts('#sourceFacts',[['출처 상태','미표시'],['리스크 알림','미표시']]);
    setFacts('#roleFacts',[['역할 확인','미표시'],['사용자 승인','연결 없음']]);
    document.querySelector('#approvalBoundary').textContent='빈 결과 상태에서는 승인 대기 링크와 기본 관련 링크를 표시하지 않습니다.';
    document.querySelector('#nextActionText').textContent='현재 조건에는 이동할 관련 화면이 없습니다.';
    document.querySelector('.related-links').hidden=true;
    const primaryLink=document.querySelector('#primaryLink');
    primaryLink.hidden=true;
    primaryLink.removeAttribute('href');
    primaryLink.setAttribute('aria-disabled','true');
    primaryLink.tabIndex=-1;
    renderEvidenceCards(null);
    return;
  }
  badge.textContent=item.status;
  badge.className=item.state;
  document.querySelector('#detailTitle').textContent=`${item.id} · ${item.name}`;
  document.querySelector('#detailSummary').textContent=item.summary;
  document.querySelector('#calcText').textContent=item.calc;
  setFacts('#decisionFacts',[['후보 행동',item.action],['종목 코드',item.ticker],['검토 상태',item.status],['근거 항목',`${item.items.length}개`]]);
  setFacts('#policyFacts',[['정책 한도',item.policy],['비용 점검',item.cost],['슬리피지','화면용 가정'],['주문 가능 판정','실제 판정 아님']]);
  setFacts('#sourceFacts',[['출처 상태',item.source],['리스크 알림',item.risk],['실제 검증','수행 안 함']]);
  setFacts('#roleFacts',[['제안자','화면용 후보 작성'],['검증자',item.state==='block'?'차단 확인':'확인 필요 표시'],['정책 감시자',item.policy],['승인 관리자','사용자 승인 전 정리']]);
  document.querySelector('#approvalBoundary').textContent='사용자 승인 전 금융 행동 없음. 목업에서는 승인 후에도 실제 매수·매도·체결이 없습니다.';
  document.querySelector('#nextActionText').textContent=`${item.id} 관련 화면으로 이동해도 실제 주문, 계좌 요청, 외부 호출은 발생하지 않습니다.`;
  const primaryLink=document.querySelector('#primaryLink');
  document.querySelector('.related-links').hidden=false;
  primaryLink.hidden=false;
  primaryLink.href=item.primary;
  primaryLink.innerHTML=`${item.primaryLabel} <span>›</span>`;
  primaryLink.removeAttribute('aria-disabled');
  primaryLink.tabIndex=0;
  renderEvidenceCards(item);
}

function markSelected(){
  decisionList.querySelectorAll('.decision-row').forEach(button=>{
    const selected=button.dataset.id===selectedId;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
  });
}

function selectDecision(id){
  selectedId=id;
  markSelected();
  updateSummary(visibleDecisions());
  renderInspector();
}

function setFilterSegment(value){
  document.querySelectorAll('#packetFilters button').forEach(button=>{
    const active=button.dataset.filter===value;
    button.classList.toggle('selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
}

function render(){
  renderList();
  markSelected();
  renderInspector();
}

document.querySelectorAll('#packetFilters button').forEach(button=>button.addEventListener('click',()=>{
  filter=button.dataset.filter;
  selectedId=visibleDecisions()[0]?.id||null;
  setFilterSegment(filter);
  render();
}));

window.__setEvidencePacketFilterForTest=value=>{
  filter=value;
  selectedId=visibleDecisions()[0]?.id||null;
  setFilterSegment(value);
  render();
};

render();
