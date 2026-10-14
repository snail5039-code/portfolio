const groups=[
  {key:'policy',label:'정책 위반',score:58,status:'차단',summary:'종목 비중과 시장가 금지 조건을 먼저 확인해야 합니다.'},
  {key:'source',label:'데이터 미확인',score:61,status:'확인 필요',summary:'공시와 가격 출처가 실제 연결되지 않은 화면 예시입니다.'},
  {key:'risk',label:'리스크 경보',score:66,status:'확인 필요',summary:'변동성·집중도 경고가 승인 전 점검 대상으로 남아 있습니다.'},
  {key:'approval',label:'승인 대기',score:74,status:'확인 필요',summary:'대기 중인 가상 제안의 만료와 정책 조건을 확인합니다.'},
  {key:'strategy',label:'전략 괴리',score:69,status:'확인 필요',summary:'현재 비중과 목표 전략의 차이가 일부 남아 있습니다.'},
  {key:'stress',label:'스트레스 취약',score:63,status:'차단',summary:'반도체 급락과 유동성 경색 시나리오에서 취약 항목이 있습니다.'},
  {key:'complete',label:'완료 점검',score:88,status:'완료',summary:'현금 비중과 지정가 제한은 화면용 기준을 충족합니다.'},
];

const checks=[
  {id:'H-101',group:'policy',title:'SK하이닉스 업종 집중 경계',status:'차단',impact:'높음',next:'정책 설정 확인',link:'policy-settings.html',basis:'반도체 합산 비중 30.0% 예시',summary:'업종 집중 한도 초과 가능성을 표시하지만 실제 매도 가능 판정은 아닙니다.',data:'정책값 고정 예시',risk:'집중도 확대 시 낙폭 민감도 증가'},
  {id:'H-102',group:'source',title:'OpenDART 정정 공시 미확인',status:'확인 필요',impact:'높음',next:'데이터 연결 확인',link:'data-connections.html',basis:'공시 원문 연결 없음',summary:'출처 미확인 상태를 승인 전 확인 대상으로 올립니다.',data:'실제 공시 API 미연결',risk:'근거 확정 전 제안 신뢰도 낮음'},
  {id:'H-103',group:'risk',title:'20일 변동성 경계 근접',status:'확인 필요',impact:'보통',next:'리스크 알림 확인',link:'risk-alerts.html',basis:'가상 변동성 27.4%',summary:'변동성 숫자는 화면 검토용이며 실제 시장 위험 경보가 아닙니다.',data:'실제 시세 미연결',risk:'단기 가격 급변 시 지정가 조건 무효'},
  {id:'H-104',group:'approval',title:'DEC-1042 승인 만료 임박',status:'확인 필요',impact:'보통',next:'승인 대기 확인',link:'approval-queue.html',basis:'남은 시간 9분 예시',summary:'승인 대기 상태만 표시하며 실제 주문을 생성하지 않습니다.',data:'주문·계좌 미연결',risk:'만료 후 재검토 필요'},
  {id:'H-105',group:'strategy',title:'현금 목표와 현재 비중 차이',status:'확인 필요',impact:'낮음',next:'전략 조정 확인',link:'rebalance-plan.html',basis:'현금 18.4%, 균형형 목표 16.0%',summary:'목표 전략과 현재 비중 차이를 보여주는 고정 예시입니다.',data:'실제 계좌 잔고 미반영',risk:'기회비용과 방어력 간 균형 필요'},
  {id:'H-106',group:'stress',title:'반도체 급락 시 손실 민감도',status:'차단',impact:'높음',next:'스트레스 테스트 확인',link:'stress-test.html',basis:'가상 예상 손실 -8.9%',summary:'충격 시나리오 결과를 승인 전 차단 후보로 표시합니다.',data:'실제 시세·모델 미연결',risk:'삼성전자·SK하이닉스 동반 하락 취약'},
  {id:'H-107',group:'complete',title:'시장가 주문 금지 유지',status:'완료',impact:'낮음',next:'정책 유지',link:'policy-settings.html',basis:'시장가 미허용',summary:'지정가 중심 운영 기준을 충족한 화면용 점검입니다.',data:'정책 저장 없음',risk:'체결 가능성은 실제 판단 아님'},
  {id:'H-108',group:'complete',title:'최소 현금 비중 충족',status:'완료',impact:'낮음',next:'주간 리포트 확인',link:'weekly-report.html',basis:'현금 18.4%, 기준 15.0%',summary:'현금 방어력 기준을 충족한 것으로 표시한 예시입니다.',data:'실제 계좌 잔고 미연결',risk:'성과 보장이나 손실 회피 보장 아님'},
];

let statusFilter='all';
let groupFilter='all';
let selectedGroup='policy';
let selectedItemId='H-101';
const groupList=document.querySelector('#groupList');
const checkList=document.querySelector('#checkList');
const emptyState=document.querySelector('#emptyState');
const statusClass=status=>status==='차단'?'blocked':status==='완료'?'done':'need';
const impactClass=impact=>impact==='높음'?'impact-high':impact==='보통'?'impact-mid':'impact-low';

function visibleGroups(){
  return groups.filter(group=>groupFilter==='all'||group.key===groupFilter);
}

function visibleChecks(){
  return checks.filter(item=>(statusFilter==='all'||item.status===statusFilter)&&(groupFilter==='all'||item.group===groupFilter));
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
  const needs=items.filter(item=>item.status==='확인 필요').length;
  const blocked=items.filter(item=>item.status==='차단').length;
  const done=items.filter(item=>item.status==='완료').length;
  const score=Math.max(42,Math.round(88-blocked*10-needs*4));
  document.querySelector('#scoreMetric').textContent=score;
  document.querySelector('#summaryTitle').textContent=`포트폴리오 건강 점수 ${score}점`;
  document.querySelector('#needsMetric').textContent=`${needs}건`;
  document.querySelector('#blockedMetric').textContent=`${blocked}건`;
  document.querySelector('#doneMetric').textContent=`${done}건`;
  document.querySelector('#summaryCopy').textContent=items.length?`현재 조건에서 ${items.length}개 화면용 점검 항목을 확인합니다.`:'선택한 조건에 해당하는 화면용 점검 항목이 없습니다.';
  document.querySelector('#itemCount').textContent=`${items.length}건 · 실제 실행 없음`;
}

function renderGroups(){
  const groupsToShow=visibleGroups();
  if(!groupsToShow.some(group=>group.key===selectedGroup)){
    selectedGroup=groupsToShow[0]?.key||'policy';
  }
  groupList.replaceChildren(...groupsToShow.map(group=>{
    const button=document.createElement('button');
    const selected=group.key===selectedGroup;
    button.type='button';
    button.className='group-card';
    button.setAttribute('role','option');
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
    button.dataset.group=group.key;
    button.innerHTML=`<strong>${group.label}</strong><span class="state-${statusClass(group.status)}">${group.status} · ${group.score}점</span><small>${group.summary}</small>`;
    button.addEventListener('click',()=>selectGroup(group.key));
    return button;
  }));
  document.querySelector('#groupSummary').textContent=`${groupsToShow.length}개 그룹 · 실제 매수·매도 가능 판정 아님`;
}

function renderChecks(){
  const items=visibleChecks();
  if(!items.some(item=>item.id===selectedItemId)){
    selectedItemId=items[0]?.id||null;
  }
  checkList.hidden=!items.length;
  emptyState.hidden=items.length>0;
  checkList.replaceChildren(...items.map(item=>{
    const button=document.createElement('button');
    const selected=item.id===selectedItemId;
    button.type='button';
    button.className='check-row';
    button.setAttribute('role','option');
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
    button.innerHTML=`<span><strong>${item.title}</strong><small>${item.id} · ${item.summary}</small></span><span>${groups.find(group=>group.key===item.group).label}</span><span><i class="status-pill ${statusClass(item.status)}">${item.status}</i></span><span class="${impactClass(item.impact)}">${item.impact}</span><span>${item.next}</span>`;
    button.addEventListener('click',()=>selectItem(item.id));
    return button;
  }));
  updateSummary(items);
}

function renderInspector(){
  const item=checks.find(check=>check.id===selectedItemId);
  const group=groups.find(entry=>entry.key===(item?.group||selectedGroup));
  const badge=document.querySelector('#detailBadge');
  if(!item){
    document.querySelector('#detailTitle').textContent='선택 항목 없음';
    document.querySelector('#detailSummary').textContent='현재 필터에 해당하는 화면용 점검 항목이 없습니다.';
    badge.textContent='빈 결과';
    badge.className='need';
    setFacts('#diagnosisFacts',[['필터 상태','항목 없음'],['그룹',group?.label||'전체']]);
    setFacts('#impactFacts',[['운영 영향','미확인'],['다음 확인','필터 변경']]);
    setFacts('#boundaryFacts',[['실제 주문','없음'],['외부 요청','0건'],['실제 계좌·API·DB','미연결']]);
    document.querySelector('#nextActionText').textContent='상태 또는 그룹 필터를 바꾸면 첫 번째 보이는 항목이 자동 선택됩니다.';
    document.querySelector('#primaryLink').href='index.html';
    return;
  }
  badge.textContent=item.status;
  badge.className=statusClass(item.status);
  document.querySelector('#detailTitle').textContent=item.title;
  document.querySelector('#detailSummary').textContent=item.summary;
  setFacts('#diagnosisFacts',[['점검 ID',item.id],['그룹',group.label],['상태',item.status],['근거',item.basis]]);
  setFacts('#impactFacts',[['영향도',item.impact],['다음 확인',item.next],['위험',item.risk]]);
  setFacts('#boundaryFacts',[['데이터 상태',item.data],['실제 주문','아님'],['실제 계좌·API·DB','미연결'],['외부 요청','0건']]);
  document.querySelector('#nextActionText').textContent=`${item.next} 후에도 이 체크 결과는 실제 매수·매도 가능 판정이 아닙니다.`;
  document.querySelector('#primaryLink').href=item.link;
}

function selectGroup(key){
  selectedGroup=key;
  groupFilter=key;
  setSegment('#groupFilters','group',key);
  selectedItemId=visibleChecks()[0]?.id||null;
  render();
}

function selectItem(id){
  selectedItemId=id;
  checkList.querySelectorAll('.check-row').forEach(button=>{
    const selected=button.textContent.includes(id);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
  });
  renderInspector();
}

function setSegment(selector,name,value){
  document.querySelectorAll(`${selector} button`).forEach(button=>{
    const active=button.dataset[name]===value;
    button.classList.toggle('selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
}

function render(){
  renderGroups();
  renderChecks();
  groupList.querySelectorAll('.group-card').forEach(button=>{
    const selected=button.dataset.group===selectedGroup;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
  });
  renderInspector();
}

document.querySelectorAll('#statusFilters button').forEach(button=>button.addEventListener('click',()=>{
  statusFilter=button.dataset.status;
  setSegment('#statusFilters','status',statusFilter);
  selectedItemId=visibleChecks()[0]?.id||null;
  render();
}));

document.querySelectorAll('#groupFilters button').forEach(button=>button.addEventListener('click',()=>{
  groupFilter=button.dataset.group;
  setSegment('#groupFilters','group',groupFilter);
  selectedGroup=groupFilter==='all'?'policy':groupFilter;
  selectedItemId=visibleChecks()[0]?.id||null;
  render();
}));

render();
