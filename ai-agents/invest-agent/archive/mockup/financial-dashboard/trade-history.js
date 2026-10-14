const trades = [
  {id:'DEC-1051',days:0,time:'08.26 14:20',name:'삼성전자',ticker:'005930',side:'매수',qty:'10주',price:'지정가 71,200원',amount:'712,000원',status:'대기',summary:'사용자 결정을 기다리는 화면용 제안입니다.',fee:'약 107원',tax:'해당 없음',slippage:'미반영',policyResult:'검토 대기',sourceState:'가격·공시 가상 예시'},
  {id:'DEC-1050',days:1,time:'08.25 15:04',name:'현대차',ticker:'005380',side:'매도',qty:'2주',price:'예상가 241,500원',amount:'483,000원',status:'모의승인',summary:'화면 상태에서만 모의승인된 가상 이력입니다.',fee:'약 72원',tax:'약 868원',slippage:'0.10% 가정',policyResult:'가상 한도 충족',sourceState:'가격·공시 가상 예시'},
  {id:'DEC-1049',days:3,time:'08.23 10:18',name:'NAVER',ticker:'035420',side:'매수',qty:'3주',price:'지정가 184,000원',amount:'552,000원',status:'반려',summary:'사용자가 화면에서 반려한 가상 제안입니다.',fee:'약 83원',tax:'해당 없음',slippage:'미반영',policyResult:'가상 한도 충족',sourceState:'가격·공시 가상 예시'},
  {id:'DEC-1048',days:6,time:'08.20 09:42',name:'삼성SDI',ticker:'006400',side:'매수',qty:'4주',price:'지정가 246,000원',amount:'984,000원',status:'정책 차단',summary:'종목 비중 한도를 넘는다는 가상 정책 판정입니다.',fee:'약 148원',tax:'해당 없음',slippage:'0.15% 가정',policyResult:'종목 비중 한도 초과',sourceState:'가상 출처 표시 완료'},
  {id:'DEC-1047',days:9,time:'08.17 13:11',name:'카카오',ticker:'035720',side:'매수',qty:'8주',price:'예상가 40,100원',amount:'320,800원',status:'만료',summary:'가상 승인 제한 시간이 지나 만료된 제안입니다.',fee:'약 48원',tax:'해당 없음',slippage:'0.20% 가정',policyResult:'승인 시간 만료',sourceState:'가격·공시 가상 예시'},
  {id:'DEC-1046',days:18,time:'08.08 11:27',name:'SK하이닉스',ticker:'000660',side:'매도',qty:'2주',price:'지정가 193,500원',amount:'387,000원',status:'모의승인',summary:'실제 체결 없이 화면에서만 처리된 가상 이력입니다.',fee:'약 58원',tax:'약 696원',slippage:'미반영',policyResult:'가상 한도 충족',sourceState:'가격·공시 가상 예시'},
  {id:'DEC-1042',days:47,time:'07.10 14:32',name:'삼성전자',ticker:'005930',side:'매수',qty:'10주',price:'지정가 71,200원',amount:'712,000원',status:'정책 차단',summary:'출처 미확인으로 차단된 정책 적용 예시입니다.',fee:'약 107원',tax:'해당 없음',slippage:'미반영',policyResult:'출처 규칙으로 차단',sourceState:'출처 미확인'},
];

let period = 30;
let status = 'all';
let selectedId = trades[0].id;
const list = document.querySelector('#historyList');
const empty = document.querySelector('#emptyState');

function facts(container, entries) {
  container.replaceChildren(...entries.map(([key,value]) => {
    const row=document.createElement('div'); const dt=document.createElement('dt'); const dd=document.createElement('dd');
    dt.textContent=key; dd.textContent=value; row.append(dt,dd); return row;
  }));
}

function renderInspector(trade) {
  if (!trade) return;
  document.querySelector('#detailTitle').textContent=`${trade.name} · ${trade.id}`;
  document.querySelector('#detailStatus').textContent=trade.status;
  document.querySelector('#detailSummary').textContent=trade.summary;
  facts(document.querySelector('#orderFacts'), [['구분',trade.side],['수량',trade.qty],['지정가/예상가',trade.price],['예상 금액',trade.amount]]);
  facts(document.querySelector('#limitFacts'), [['수수료 예시',trade.fee],['세금 예시',trade.tax],['슬리피지',trade.slippage],['기준 통화','KRW']]);
  document.querySelector('#policyResult').textContent=trade.policyResult;
  document.querySelector('#sourceState').textContent=trade.sourceState;
}

function selectTrade(id, focus=false) {
  selectedId=id;
  list.querySelectorAll('.history-row').forEach(row => {
    const selected=row.dataset.id===id; row.classList.toggle('selected',selected); row.setAttribute('aria-selected',String(selected)); row.tabIndex=selected?0:-1;
  });
  renderInspector(trades.find(trade=>trade.id===id));
  if (focus) list.querySelector(`[data-id="${id}"]`)?.focus();
}

function render() {
  const visible=trades.filter(trade=>trade.days<=period&&(status==='all'||trade.status===status));
  list.replaceChildren(...visible.map(trade=>{
    const button=document.createElement('button'); button.type='button'; button.className='history-row'; button.dataset.id=trade.id; button.dataset.status=trade.status; button.setAttribute('role','option');
    button.innerHTML=`<span><strong>${trade.time}</strong><small>${trade.id}</small></span><span><strong>${trade.name}</strong><small>${trade.ticker} · 가상</small></span><span>${trade.side}</span><span>${trade.qty}</span><span>${trade.amount}</span><span class="row-status">${trade.status}</span>`;
    button.addEventListener('click',()=>selectTrade(trade.id)); return button;
  }));
  document.querySelector('#visibleCount').textContent=`${visible.length}건`;
  empty.hidden=visible.length!==0; list.hidden=visible.length===0;
  if (!visible.some(trade=>trade.id===selectedId)) selectedId=visible[0]?.id||null;
  if (selectedId) selectTrade(selectedId); else {
    document.querySelector('#detailTitle').textContent='선택 이력 없음'; document.querySelector('#detailStatus').textContent='빈 결과'; document.querySelector('#detailSummary').textContent='필터를 변경하면 화면용 이력 상세를 확인할 수 있습니다.';
    facts(document.querySelector('#orderFacts'), [['표시 이력','0건'],['실제 주문','없음']]); facts(document.querySelector('#limitFacts'), [['외부 요청','0건'],['저장','없음']]);
    document.querySelector('#policyResult').textContent='표시 대상 없음'; document.querySelector('#sourceState').textContent='외부 출처 미연결';
  }
}

function bindFilters(selector,key) {
  document.querySelectorAll(selector).forEach(button=>button.addEventListener('click',()=>{
    button.parentElement.querySelectorAll('button').forEach(item=>{const active=item===button; item.classList.toggle('selected',active); item.setAttribute('aria-pressed',String(active));});
    if(key==='period') period=Number(button.dataset.period); else status=button.dataset.status;
    render();
  }));
}

bindFilters('#periodFilters button','period');
bindFilters('#statusFilters button','status');
render();
