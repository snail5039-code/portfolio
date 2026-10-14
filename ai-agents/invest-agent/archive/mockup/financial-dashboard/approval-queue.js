const orders = [
  {id:'DEC-1042',company:'삼성전자',code:'005930',side:'매수',quantity:10,price:71200,amount:712000,status:'조건부 승인',filter:'conditional',verification:'조건부',expiry:'14:42',policy:'통과',source:'실제 공시 미연결 · 미확인',warning:'변동성 주의',warningText:'지정가 이하에서만 유효한 화면용 조건입니다.'},
  {id:'DEC-1043',company:'NAVER',code:'035420',side:'매도',quantity:8,price:220000,amount:1760000,status:'검증 완료',filter:'verified',verification:'검증 완료',expiry:'14:51',policy:'통과',source:'화면용 예시 · 실제 출처 미연결',warning:'가격 조건 확인',warningText:'지정가 조건은 실제 시세와 비교되지 않았습니다.'},
  {id:'DEC-1044',company:'KODEX 200',code:'069500',side:'매수',quantity:20,price:35000,amount:700000,status:'정책 확인 필요',filter:'attention',verification:'한도 확인',expiry:'15:03',policy:'확인 필요',source:'화면용 예시 · 실제 출처 미연결',warning:'정책 확인 필요',warningText:'사용자 정책 한도를 실제 시스템에서 확인하지 않았습니다.'},
  {id:'DEC-1045',company:'TIGER 미국S&P500',code:'360750',side:'매수',quantity:15,price:21000,amount:315000,status:'출처 미확인',filter:'attention',verification:'출처 미확인',expiry:'15:10',policy:'확인 필요',source:'출처 미확인 · 확인으로 표시하지 않음',warning:'출처 주의',warningText:'외부 출처가 연결되지 않아 검증 완료로 취급할 수 없습니다.'}
];
const states = Object.fromEntries(orders.map(order => [order.id, 'pending']));
let selectedId = orders[0].id;
let activeFilter = 'all';
const won = value => `${value.toLocaleString('ko-KR')}원`;
const rows = document.querySelector('#orderRows');
const message = document.querySelector('#queueMessage');
const approve = document.querySelector('#queueApprove');
const reject = document.querySelector('#queueReject');

function renderRows(){
  rows.innerHTML = '';
  const visible = orders.filter(order => activeFilter === 'all' || order.filter === activeFilter);
  visible.forEach(order => {
    const row = document.createElement('div');
    row.className = 'order-row'; row.setAttribute('role','row'); row.tabIndex = 0; row.dataset.id = order.id;
    row.setAttribute('aria-selected', String(order.id === selectedId));
    const state = states[order.id];
    const stateText = state === 'approved' ? '모의승인됨' : state === 'rejected' ? '반려됨' : order.status;
    row.innerHTML = `<span class="state ${state !== 'pending' ? 'processed' : ''}" role="gridcell">${stateText}</span><span role="gridcell"><strong>${order.company}</strong><small>${order.code}</small></span><span class="${order.side === '매수' ? 'buy' : 'sell'}" role="gridcell">${order.side}</span><span role="gridcell">${order.quantity}주</span><span role="gridcell"><strong>지정가</strong><small>${won(order.price)}</small></span><span role="gridcell">${won(order.amount)}</span><span class="${order.verification.includes('미확인') || order.verification.includes('확인') ? 'verify-unconfirmed' : ''}" role="gridcell">${order.verification}</span><span role="gridcell">${order.expiry}</span>`;
    row.addEventListener('click',()=>selectOrder(order.id));
    row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectOrder(order.id)}});
    rows.appendChild(row);
  });
  document.querySelector('#visibleCount').textContent = visible.length;
  document.querySelector('#emptyState').hidden = visible.length > 0;
}

function selectOrder(id){selectedId=id;renderRows();renderDetail()}
function renderDetail(){
  const order=orders.find(item=>item.id===selectedId); const state=states[selectedId];
  document.querySelector('#detailCompany').textContent=order.company;
  document.querySelector('#detailId').textContent=`${order.id} · ${order.code}`;
  const status=document.querySelector('#detailStatus'); status.textContent=state==='approved'?'모의승인됨':state==='rejected'?'반려됨':order.status; status.className=`detail-status ${state==='pending'?'warn':'processed'}`;
  document.querySelector('#detailExpiryShort').textContent=order.expiry;
  document.querySelector('#detailSide').textContent=order.side; document.querySelector('#detailQuantity').textContent=`${order.quantity}주`;
  document.querySelector('#detailPrice').textContent=won(order.price); document.querySelector('#detailAmount').textContent=won(order.amount);
  document.querySelector('#detailCalculation').textContent=`${order.quantity} × ${order.price.toLocaleString('ko-KR')} = ${won(order.amount)}`;
  const policy=document.querySelector('#policyState');policy.textContent=order.policy;policy.className=order.policy==='통과'?'pass':'';
  document.querySelector('#sourceState').textContent=order.source;document.querySelector('#warningTitle').textContent=order.warning;document.querySelector('#warningText').textContent=order.warningText;
  document.querySelector('#invalidPrice').textContent=`지정가가 ${won(order.price)}을 초과할 때`;document.querySelector('#auditId').textContent=order.id;
  document.querySelector('#expiryText').textContent=`이 모의승인은 ${order.expiry}에 만료됩니다.`;approve.textContent=`${won(order.amount)} 한도 내 모의승인`;
  const processed=state!=='pending';approve.disabled=processed;reject.disabled=processed;
  message.className=`queue-message ${processed?'visible':''}`;message.textContent=state==='approved'?'모의승인됨 · 실제 주문은 생성되지 않았습니다.':state==='rejected'?'반려됨 · 가상 요청이 종료되었습니다.':'';
}

document.querySelectorAll('.queue-filters button').forEach(button=>button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter;document.querySelectorAll('.queue-filters button').forEach(item=>{const on=item===button;item.classList.toggle('selected',on);item.setAttribute('aria-pressed',String(on))});
  const visible=orders.filter(order=>activeFilter==='all'||order.filter===activeFilter);if(visible.length&&!visible.some(order=>order.id===selectedId))selectedId=visible[0].id;renderRows();renderDetail();
}));
reject.addEventListener('click',()=>{states[selectedId]='rejected';renderRows();renderDetail()});
approve.addEventListener('click',()=>{states[selectedId]='approved';renderRows();renderDetail()});
renderRows();renderDetail();
