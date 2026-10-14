const decisions=[
  {id:'DEC-1042',name:'삼성전자',ticker:'005930',decision:'승인',memo:true,time:'2026.08.25 14:42 KST',statusText:'조건부 승인',reason:'검증 후 지정가와 최대 금액 조건을 붙여 사용자가 모의승인',memoText:'지정가 조건과 출처 미확인 표시가 함께 남아 있어 소액으로만 검토한다는 메모 예시',policy:'한도 통과',verification:'형식·정책 비교 완료',source:'공시 원문 미연결',pathDiff:'+1.2%',chosen:'조건부 승인 경로 유지',alternate:'반려 후 현금 유지 경로',pathCopy:'동일 가정에서 두 경로를 나란히 둔 화면용 비교입니다. 실제 수익, 후회, 성공 여부를 뜻하지 않습니다.',focus:'조건부 기록',link:'approval-queue.html',summary:'승인 당시 근거와 남긴 메모를 함께 보되 실제 투자 판단 평가는 하지 않습니다.'},
  {id:'DEC-1043',name:'NAVER',ticker:'035420',decision:'반려',memo:true,time:'2026.08.25 14:51 KST',statusText:'사용자 반려',reason:'검증 결과는 형식상 정리됐지만 출처 신뢰도와 변동성 설명이 부족해 반려',memoText:'근거 출처가 더 명확해질 때 다시 비교한다는 사용자 메모 예시',policy:'한도 통과',verification:'출처 보강 필요',source:'가격·뉴스 실제 연결 없음',pathDiff:'-0.4%',chosen:'반려 후 대기 경로',alternate:'승인 후 보유 경로',pathCopy:'차이는 가상 가격 경로를 비교한 값이며 투자 판단이 맞았는지 채점하지 않습니다.',focus:'근거 보강',link:'audit-log.html',summary:'반려 이유를 판단 실패나 성공으로 해석하지 않고 당시 확인 부족 항목으로 정리합니다.'},
  {id:'DEC-1044',name:'KODEX 200',ticker:'069500',decision:'보류',memo:false,time:'2026.08.25 15:05 KST',statusText:'보류',reason:'정책에는 큰 충돌이 없지만 리밸런싱 목표와 현금 비중을 더 비교해야 해 보류',memoText:'사용자 메모 없음. 화면은 메모가 없는 결정도 회고 대상에 남깁니다.',policy:'추가 확인',verification:'정책 비교 예시',source:'실제 ETF 데이터 미연결',pathDiff:'+0.0%',chosen:'보류 후 관찰 경로',alternate:'즉시 승인 경로',pathCopy:'보류 경로와 즉시 승인 경로의 차이를 단정하지 않고, 비교 조건만 남긴 화면 예시입니다.',focus:'대기 사유',link:'rebalance-plan.html',summary:'보류 결정은 실행 실패가 아니라 추가 확인을 남긴 사용자 통제 기록으로 표시합니다.'},
  {id:'DEC-1052',name:'SK하이닉스',ticker:'000660',decision:'반려',memo:true,time:'2026.08.27 09:28 KST',statusText:'비용 재검토 후 반려',reason:'세금·수수료 영향 점검에서 비용 가정이 순손익 여유를 크게 줄여 반려',memoText:'비용 가정이 줄어들기 전에는 매도 제안을 다시 올리지 말자는 사용자 메모 예시',policy:'비용 재검토',verification:'비용 화면 연계',source:'실제 세금·수수료 계산 아님',pathDiff:'-1.8%',chosen:'반려 후 보유 경로',alternate:'매도 승인 경로',pathCopy:'비용 화면과 연결된 가상 경로 비교입니다. 실제 매도 권유나 보유 권유가 아닙니다.',focus:'비용 영향',link:'tax-fee-impact.html',summary:'비용 점검과 사용자 메모를 묶어 승인 전 판단 기록을 확인합니다.'},
];

let statusFilter='all';
let memoOnly=false;
let selectedId=decisions[0].id;
const decisionList=document.querySelector('#decisionList');
const emptyState=document.querySelector('#emptyState');
const decisionClass=decision=>decision==='승인'?'approved':decision==='반려'?'rejected':'hold';

function visibleDecisions(){
  return decisions.filter(item=>(statusFilter==='all'||item.decision===statusFilter)&&(!memoOnly||item.memo));
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
  const memoCount=items.filter(item=>item.memo).length;
  document.querySelector('#visibleCount').textContent=`${items.length}건`;
  document.querySelector('#memoCount').textContent=`${memoCount}건`;
  document.querySelector('#summaryTitle').textContent=items.length?`${items.length}개 가상 결정 이력`:'선택한 조건의 결정 이력 없음';
  document.querySelector('#summaryCopy').textContent=items.length?'당시 근거와 메모, 검증 상태, 가상 경로 차이를 중립적으로 확인합니다.':'상태 필터 또는 메모 조건을 바꾸면 결정 회고가 다시 표시됩니다.';
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
    button.tabIndex=selected?0:-1;
    button.innerHTML=`<span><strong>${item.id} · ${item.name}</strong><small>${item.ticker} · ${item.time}</small></span><span><i class="decision-pill ${decisionClass(item.decision)}">${item.decision}</i></span><span class="${item.memo?'memo-mark':'muted-mark'}">${item.memo?'있음':'없음'}</span><span>${item.policy}</span><span>${item.verification}</span><span class="path-diff">${item.pathDiff}</span><span>${item.link.replace('.html','')}</span>`;
    button.addEventListener('click',()=>selectDecision(item.id));
    return button;
  }));
  updateSummary(items);
}

function renderInspector(){
  const item=decisions.find(entry=>entry.id===selectedId);
  const badge=document.querySelector('#detailBadge');
  if(!item){
    document.querySelector('#detailTitle').textContent='선택 결정 없음';
    document.querySelector('#detailSummary').textContent='현재 필터에 해당하는 화면용 결정 이력이 없습니다.';
    badge.textContent='빈 결과';
    badge.className='hold';
    document.querySelector('#decisionMetric').textContent='없음';
    document.querySelector('#decisionNote').textContent='필터 조건에 해당 없음';
    document.querySelector('#reasonMetric').textContent='미표시';
    document.querySelector('#reasonNote').textContent='기록 없음';
    document.querySelector('#pathMetric').textContent='미표시';
    document.querySelector('#pathNote').textContent='가상 경로 없음';
    document.querySelector('#focusMetric').textContent='필터 변경';
    document.querySelector('#focusNote').textContent='조건을 바꿔 주세요';
    document.querySelector('#chosenPath').textContent='선택 경로 없음';
    document.querySelector('#alternatePath').textContent='비교 경로 없음';
    document.querySelector('#pathCopy').textContent='빈 결과 상태에서도 이전 선택과 링크가 남지 않도록 초기화합니다.';
    document.querySelector('#compareLabel').textContent='빈 결과';
    document.querySelector('#userMemo').textContent='표시할 사용자 메모가 없습니다.';
    setFacts('#decisionFacts',[['필터 상태','항목 없음'],['외부 요청','0건']]);
    setFacts('#controlFacts',[['정책','미표시'],['검증','미표시']]);
    setFacts('#pathFacts',[['가상 경로 차이','미표시'],['실제 성과 평가','아님']]);
    setFacts('#boundaryFacts',[['실제 주문·체결','없음'],['실제 계좌·API·DB','미연결']]);
    const primaryLink=document.querySelector('#primaryLink');
    document.querySelector('#nextActionText').textContent='현재 조건에는 연결할 결정 기록이 없습니다. 필터 조건을 변경해 주세요.';
    primaryLink.hidden=true;
    primaryLink.removeAttribute('href');
    primaryLink.setAttribute('aria-disabled','true');
    primaryLink.tabIndex=-1;
    return;
  }
  badge.textContent=item.decision;
  badge.className=decisionClass(item.decision);
  document.querySelector('#detailTitle').textContent=`${item.id} · ${item.name}`;
  document.querySelector('#detailSummary').textContent=item.summary;
  document.querySelector('#decisionMetric').textContent=item.decision;
  document.querySelector('#decisionNote').textContent=item.statusText;
  document.querySelector('#reasonMetric').textContent=item.focus;
  document.querySelector('#reasonNote').textContent=item.reason;
  document.querySelector('#pathMetric').textContent=item.pathDiff;
  document.querySelector('#pathNote').textContent='화면용 가상 경로 비교';
  document.querySelector('#focusMetric').textContent=item.memo?'메모 있음':'메모 없음';
  document.querySelector('#focusNote').textContent=item.memo?'사용자 메모를 함께 표시':'메모 없는 결정도 보존';
  document.querySelector('#chosenPath').textContent=item.chosen;
  document.querySelector('#alternatePath').textContent=item.alternate;
  document.querySelector('#pathCopy').textContent=item.pathCopy;
  document.querySelector('#compareLabel').textContent=`${item.id} · 실제 성과 평가 아님`;
  document.querySelector('#userMemo').textContent=item.memoText;
  setFacts('#decisionFacts',[['결정 ID',item.id],['종목',`${item.name} (${item.ticker})`],['사용자 결정',item.decision],['기준 시각',item.time]]);
  setFacts('#controlFacts',[['당시 근거',item.reason],['정책 상태',item.policy],['검증 상태',item.verification],['출처 상태',item.source]]);
  setFacts('#pathFacts',[['선택 경로',item.chosen],['대체 경로',item.alternate],['가상 차이',item.pathDiff],['실제 성과 평가','아님']]);
  setFacts('#boundaryFacts',[['화면 성격','화면 검토용 가상 예시'],['투자 권유','아님'],['실제 주문·체결','없음'],['실제 계좌·API·DB','미연결']]);
  const primaryLink=document.querySelector('#primaryLink');
  document.querySelector('#nextActionText').textContent=`${item.id}의 관련 화면으로 이동해도 실제 주문이나 외부 요청은 발생하지 않습니다.`;
  primaryLink.hidden=false;
  primaryLink.href=item.link;
  primaryLink.removeAttribute('aria-disabled');
  primaryLink.tabIndex=0;
}

function selectDecision(id){
  selectedId=id;
  decisionList.querySelectorAll('.decision-row').forEach(button=>{
    const selected=button.textContent.includes(id);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
  });
  renderInspector();
}

function setStatusSegment(value){
  document.querySelectorAll('#statusFilters button').forEach(button=>{
    const active=button.dataset.status===value;
    button.classList.toggle('selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
}

function render(){
  renderList();
  decisionList.querySelectorAll('.decision-row').forEach(button=>{
    const selected=selectedId&&button.textContent.includes(selectedId);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
  });
  renderInspector();
}

document.querySelectorAll('#statusFilters button').forEach(button=>button.addEventListener('click',()=>{
  statusFilter=button.dataset.status;
  setStatusSegment(statusFilter);
  selectedId=visibleDecisions()[0]?.id||null;
  render();
}));

document.querySelector('#memoOnly').addEventListener('change',event=>{
  memoOnly=event.target.checked;
  selectedId=visibleDecisions()[0]?.id||null;
  render();
});

render();
