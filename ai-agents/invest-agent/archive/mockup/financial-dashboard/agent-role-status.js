const roles=[
  {id:'proposer',role:'제안자',status:'대기',badge:'대기',task:'DEC-1056 삼성전자 비중 +2% 후보 작성',wait:'검증자 출처 신뢰도 점검 대기',approval:false,history:'DEC-1043 반려 후 근거 보강',decision:'DEC-1056',summary:'제안자는 화면용 후보를 작성한 뒤 검증 역할의 확인을 기다리는 상태로 표시됩니다.',conflict:'출처 보강 전 승인 관리자에게 넘기지 않음',link:'decision-review.html',linkLabel:'결정 회고 보기'},
  {id:'verifier',role:'검증자',status:'실패 이력',badge:'실패 이력',task:'DEC-1056 출처 신뢰도 점검',wait:'공시 원문 미연결 표시 유지',approval:false,history:'DEC-1043 출처 신뢰도 보강 요청',decision:'DEC-1043',summary:'검증자는 실제 공시나 시세를 조회하지 않고, 출처 신뢰도 점검 항목을 화면용으로 정리합니다.',conflict:'출처 부족 이력을 제안자에게 되돌리는 예시',link:'audit-log.html',linkLabel:'감사 로그 보기'},
  {id:'policy',role:'정책 감시자',status:'승인 필요',badge:'승인 필요',task:'금액 한도·종목 집중도 비교',wait:'종목 집중도 조건을 사용자 확인 항목으로 남김',approval:true,history:'DEC-1052 비용 영향 재검토',decision:'DEC-1052',summary:'정책 감시자는 한도와 집중도 조건을 비교하되, 실제 주문 차단이나 외부 정책 실행을 하지 않습니다.',conflict:'비용·집중도 조건이 승인 전 재검토 항목으로 남음',link:'tax-fee-impact.html',linkLabel:'세금·수수료 보기'},
  {id:'approver',role:'승인 관리자',status:'승인 필요',badge:'승인 필요',task:'DEC-1056 승인 항목 정리',wait:'사용자 최종 확인 전 대기',approval:true,history:'DEC-1042 조건부 승인 기록',decision:'DEC-1042',summary:'승인 관리자는 사용자가 볼 확인 항목을 정리하는 화면용 역할이며 금융 행동을 수행하지 않습니다.',conflict:'조건부 승인 기록과 새 승인 필요 항목을 분리',link:'approval-queue.html',linkLabel:'승인 대기 보기'},
];

let statusFilter='all';
let selectedId=roles[0].id;
const roleList=document.querySelector('#roleList');
const emptyState=document.querySelector('#emptyState');
const statusClass=status=>status==='대기'?'wait':status==='승인 필요'?'approval':'history';

function visibleRoles(){
  return roles.filter(item=>statusFilter==='all'||item.status===statusFilter);
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
  const approvals=items.filter(item=>item.approval).length;
  document.querySelector('#visibleCount').textContent=`${items.length}개`;
  document.querySelector('#approvalCount').textContent=`${approvals}개`;
  document.querySelector('#summaryTitle').textContent=items.length?`${items.length}개 역할 가상 상태`:'선택한 조건의 역할 상태 없음';
  document.querySelector('#summaryCopy').textContent=items.length?'제안·검증·정책 감시·승인 정리 역할의 대기 사유와 이력 연결을 확인합니다.':'필터 조건에 맞는 역할이 없으면 이전 선택과 관련 링크를 남기지 않습니다.';
}

function renderList(){
  const items=visibleRoles();
  if(!items.some(item=>item.id===selectedId)){
    selectedId=items[0]?.id||null;
  }
  roleList.hidden=!items.length;
  emptyState.hidden=items.length>0;
  roleList.replaceChildren(...items.map(item=>{
    const button=document.createElement('button');
    const selected=item.id===selectedId;
    button.type='button';
    button.className='role-row';
    button.setAttribute('role','option');
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
    button.innerHTML=`<span><strong>${item.role}</strong><small>${item.decision}</small></span><span><i class="status-pill ${statusClass(item.status)}">${item.status}</i></span><span><strong>${item.task}</strong><small>화면용 샘플</small></span><span>${item.wait}</span><span class="${item.approval?'approval-mark':'muted-mark'}">${item.approval?'필요':'없음'}</span><span>${item.history}</span>`;
    button.addEventListener('click',()=>selectRole(item.id));
    return button;
  }));
  updateSummary(items);
}

function renderInspector(){
  const item=roles.find(entry=>entry.id===selectedId);
  const badge=document.querySelector('#detailBadge');
  if(!item){
    document.querySelector('#detailTitle').textContent='선택 역할 없음';
    document.querySelector('#detailSummary').textContent='현재 필터에 해당하는 화면용 역할 상태가 없습니다.';
    badge.textContent='빈 결과';
    badge.className='wait';
    document.querySelector('#taskText').textContent='표시할 마지막 작업이 없습니다.';
    document.querySelector('#timelineLabel').textContent='빈 결과 · 연결 이력 없음';
    setFacts('#roleFacts',[['필터 상태','항목 없음'],['외부 연결','0건']]);
    setFacts('#waitFacts',[['대기 사유','미표시'],['충돌 이력','미표시']]);
    setFacts('#approvalFacts',[['사용자 승인 필요','미표시'],['금융 행동','수행 안 함']]);
    setFacts('#boundaryFacts',[['실제 AI 실행','없음'],['실제 주문·체결','없음'],['실제 계좌·API·DB','미연결']]);
    const primaryLink=document.querySelector('#primaryLink');
    document.querySelector('#nextActionText').textContent='현재 조건에는 연결할 역할 기록이 없습니다. 필터를 변경해 주세요.';
    primaryLink.hidden=true;
    primaryLink.removeAttribute('href');
    primaryLink.setAttribute('aria-disabled','true');
    primaryLink.tabIndex=-1;
    return;
  }
  badge.textContent=item.badge;
  badge.className=statusClass(item.status);
  document.querySelector('#detailTitle').textContent=item.role;
  document.querySelector('#detailSummary').textContent=item.summary;
  document.querySelector('#taskText').textContent=item.task;
  document.querySelector('#timelineLabel').textContent=`${item.decision} · ${item.role} 선택`;
  setFacts('#roleFacts',[['역할',item.role],['현재 상태',item.status],['결정 ID',item.decision],['기준 시각','2026.08.27 11:40 KST']]);
  setFacts('#waitFacts',[['대기 사유',item.wait],['충돌·반려 이력',item.history],['상태 설명',item.conflict]]);
  setFacts('#approvalFacts',[['사용자 승인 필요',item.approval?'예시 표시':'현재 없음'],['금융 행동','수행 안 함'],['승인 권한','사용자 최종 통제']]);
  setFacts('#boundaryFacts',[['화면 성격','화면 검토용 가상 예시'],['실제 AI 실행','없음'],['실제 주문·체결','없음'],['실제 계좌·API·DB','미연결']]);
  const primaryLink=document.querySelector('#primaryLink');
  document.querySelector('#nextActionText').textContent=`${item.history} 관련 화면으로 이동해도 외부 요청이나 금융 행동은 발생하지 않습니다.`;
  primaryLink.hidden=false;
  primaryLink.href=item.link;
  primaryLink.removeAttribute('aria-disabled');
  primaryLink.tabIndex=0;
  primaryLink.firstChild.textContent=item.linkLabel+' ';
}

function selectRole(id){
  selectedId=id;
  roleList.querySelectorAll('.role-row').forEach(button=>{
    const selected=button.textContent.includes(roles.find(item=>item.id===id)?.role||'');
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
  roleList.querySelectorAll('.role-row').forEach(button=>{
    const item=roles.find(entry=>entry.id===selectedId);
    const selected=item&&button.textContent.includes(item.role);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
  });
  renderInspector();
}

document.querySelectorAll('#statusFilters button').forEach(button=>button.addEventListener('click',()=>{
  statusFilter=button.dataset.status;
  setStatusSegment(statusFilter);
  selectedId=visibleRoles()[0]?.id||null;
  render();
}));

window.__setRoleStatusFilterForTest=value=>{
  statusFilter=value;
  selectedId=visibleRoles()[0]?.id||null;
  setStatusSegment(value);
  render();
};

render();
