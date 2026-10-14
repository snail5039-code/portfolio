const orders=[
  {id:'DEC-1051',name:'삼성전자',ticker:'005930',side:'매수',market:'국내 주식',currency:'KRW',gross:164000,fee:2400,tax:0,slippage:18000,fx:0,status:'영향 작음',basis:'₩77,600 지정가 · 25주',period:'승인 전 1회 주문 예시',assumption:'위탁 수수료 0.12%, 세금 없음 가정, 슬리피지 0.18%',summary:'비용 차감 후에도 화면용 순손익 예시가 양수로 남지만 실제 성과 판단은 아닙니다.',next:'승인 대기에서 수량과 지정가 재확인',link:'approval-queue.html'},
  {id:'DEC-1052',name:'SK하이닉스',ticker:'000660',side:'매도',market:'국내 주식',currency:'KRW',gross:91000,fee:3100,tax:54000,slippage:26000,fx:0,status:'재검토',basis:'₩238,000 지정가 · 12주',period:'매도 제안 1건 예시',assumption:'위탁 수수료 0.11%, 거래세 0.20% 화면 가정, 슬리피지 0.09%',summary:'세금 가정과 슬리피지를 반영하면 순손익 여유가 크게 줄어드는 점검 상태입니다.',next:'정책 설정과 매도 사유 재검토',link:'policy-settings.html'},
  {id:'DEC-1053',name:'현대차',ticker:'005380',side:'매수',market:'국내 주식',currency:'KRW',gross:-28000,fee:1900,tax:0,slippage:21000,fx:0,status:'보류 권장',basis:'₩214,000 지정가 · 10주',period:'승인 전 단일 주문 예시',assumption:'위탁 수수료 0.09%, 세금 없음 가정, 슬리피지 0.10%',summary:'비용 전 손익 예시가 이미 음수라 비용 반영 뒤 보류 검토 대상으로 표시합니다.',next:'리밸런싱 필요성과 대체안 확인',link:'rebalance-plan.html'},
  {id:'DEC-1054',name:'Apple',ticker:'AAPL',side:'매수',market:'해외 주식',currency:'USD 가정',gross:246000,fee:7600,tax:0,slippage:33000,fx:12800,status:'재검토',basis:'$226.40 지정가 · 8주 · 환율 ₩1,335 가정',period:'해외 주식 1건 화면 예시',assumption:'해외 위탁 수수료 0.25%, 환전 비용 0.35%, 세금 없음 화면 가정',summary:'해외 주문은 환율과 환전 비용 가정이 추가되어 실제 조회 없이 비용 영향을 따로 표시합니다.',next:'데이터 연결과 환율 가정 문구 확인',link:'data-connections.html'},
];

let impactFilter='all';
let selectedId=orders[0].id;
const orderList=document.querySelector('#orderList');
const emptyState=document.querySelector('#emptyState');
const won=value=>`${value<0?'-':''}₩${Math.abs(value).toLocaleString('ko-KR')}`;
const pct=value=>`${value.toFixed(1)}%`;
const impactClass=status=>status==='영향 작음'?'low':status==='보류 권장'?'hold':'review';
const netOf=order=>order.gross-order.fee-order.tax-order.slippage-order.fx;
const totalCostOf=order=>order.fee+order.tax+order.slippage+order.fx;

function visibleOrders(){
  return orders.filter(order=>impactFilter==='all'||order.status===impactFilter);
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

function moneyClass(value){
  return value<0?'negative':'positive';
}

function updateSummary(items){
  const totalCost=items.reduce((sum,order)=>sum+totalCostOf(order),0);
  const netTotal=items.reduce((sum,order)=>sum+netOf(order),0);
  const netMetric=document.querySelector('#netTotal');
  document.querySelector('#visibleCount').textContent=`${items.length}건`;
  document.querySelector('#totalCost').textContent=won(totalCost);
  netMetric.textContent=won(netTotal);
  netMetric.className=moneyClass(netTotal);
  document.querySelector('#summaryTitle').textContent=items.length?`${items.length}개 가상 주문의 비용 차감 전후 비교`:'선택한 상태의 가상 주문 없음';
  document.querySelector('#summaryCopy').textContent=items.length?'모든 수치는 원 단위 반올림 화면 예시이며 실제 세금 계산이나 세무 자문이 아닙니다.':'다른 점검 상태를 선택하면 비용 분해가 다시 표시됩니다.';
}

function renderOrders(){
  const items=visibleOrders();
  if(!items.some(order=>order.id===selectedId)){
    selectedId=items[0]?.id||null;
  }
  orderList.hidden=!items.length;
  emptyState.hidden=items.length>0;
  orderList.replaceChildren(...items.map(order=>{
    const net=netOf(order);
    const totalCost=totalCostOf(order);
    const button=document.createElement('button');
    const selected=order.id===selectedId;
    button.type='button';
    button.className='order-row';
    button.setAttribute('role','option');
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
    button.innerHTML=`<span><strong>${order.id} · ${order.name}</strong><small>${order.side} · ${order.ticker} · ${order.market}</small></span><span class="money ${moneyClass(order.gross)}">${won(order.gross)}</span><span class="money cost-value">${won(order.fee)}</span><span class="money cost-value">${won(order.tax)}</span><span class="money cost-value">${won(order.slippage)}</span><span class="money cost-value">${order.fx?won(order.fx):'없음'}</span><span class="money cost-value">${won(totalCost)}</span><span class="money ${moneyClass(net)}">${won(net)}</span><span><i class="impact-pill ${impactClass(order.status)}">${order.status}</i></span>`;
    button.addEventListener('click',()=>selectOrder(order.id));
    return button;
  }));
  updateSummary(items);
}

function renderBreakdown(order){
  const costs=[
    ['위탁 수수료',order.fee,'주문 금액 대비 화면 가정'],
    ['세금 가정',order.tax,order.tax?'매도 거래세 등 고정 예시':'해당 없음으로 표시'],
    ['슬리피지',order.slippage,'지정가와 체결 차이 가능성 예시'],
    ['환전 비용',order.fx,order.fx?'환율 조회 없는 해외 주문 가정':'국내 주문 해당 없음'],
  ];
  const maxCost=Math.max(...costs.map(([,value])=>value),1);
  document.querySelector('#breakdownBars').replaceChildren(...costs.map(([label,value,note])=>{
    const card=document.createElement('div');
    card.className='bar-card';
    const percent=Math.max(4,Math.round(value/maxCost*100));
    card.innerHTML=`<div><strong>${label}</strong><span>${won(value)}</span></div><div class="bar-track"><i class="bar-fill" style="width:${percent}%"></i></div><small>${note}</small>`;
    return card;
  }));
}

function renderInspector(){
  const order=orders.find(item=>item.id===selectedId);
  const badge=document.querySelector('#detailBadge');
  if(!order){
    document.querySelector('#detailTitle').textContent='선택 주문 없음';
    document.querySelector('#detailSummary').textContent='현재 필터에 해당하는 가상 주문이 없습니다.';
    badge.textContent='빈 결과';
    badge.className='review';
    setFacts('#orderFacts',[['필터 상태','항목 없음'],['외부 요청','0건']]);
    setFacts('#costFacts',[['수수료','미표시'],['세금 가정','미표시'],['환전 비용','미표시']]);
    setFacts('#impactFacts',[['승인 영향','미확인'],['다음 확인','필터 변경']]);
    setFacts('#boundaryFacts',[['실제 주문','없음'],['실제 세금 계산','아님'],['실제 계좌·API·DB','미연결']]);
    document.querySelector('#nextActionText').textContent='필터를 바꾸면 첫 번째 보이는 주문이 자동 선택됩니다.';
    document.querySelector('#primaryLink').href='approval-queue.html';
    return;
  }
  const totalCost=totalCostOf(order);
  const net=netOf(order);
  const drag=order.gross===0?0:Math.abs(totalCost/order.gross*100);
  badge.textContent=order.status;
  badge.className=impactClass(order.status);
  document.querySelector('#detailTitle').textContent=`${order.name} ${order.side}`;
  document.querySelector('#detailSummary').textContent=order.summary;
  document.querySelector('#detailAssumptionLabel').textContent=`${order.id} · ${order.currency} · ${order.period}`;
  document.querySelector('#grossMetric').textContent=won(order.gross);
  document.querySelector('#grossMetric').className=moneyClass(order.gross);
  document.querySelector('#grossNote').textContent='비용 차감 전 화면용 총손익';
  document.querySelector('#costMetric').textContent=won(totalCost);
  document.querySelector('#costNote').textContent='수수료·세금·슬리피지·환전 합계';
  document.querySelector('#netMetric').textContent=won(net);
  document.querySelector('#netMetric').className=moneyClass(net);
  document.querySelector('#netNote').textContent='비용 차감 후 순손익 예시';
  document.querySelector('#dragMetric').textContent=pct(drag);
  document.querySelector('#dragNote').textContent='비용 전 손익 대비 비용 비율';
  setFacts('#orderFacts',[['점검 ID',order.id],['종목',`${order.name} (${order.ticker})`],['구분',`${order.side} · ${order.market}`],['조건',order.basis],['기간/단위',order.period]]);
  setFacts('#costFacts',[['위탁 수수료',won(order.fee)],['세금 가정',won(order.tax)],['슬리피지',won(order.slippage)],['환전 비용',order.fx?won(order.fx):'해당 없음'],['반올림','원 단위 화면 표시']]);
  setFacts('#impactFacts',[['비용 전 총손익',won(order.gross)],['총비용',won(totalCost)],['비용 후 순손익',won(net)],['비용 영향률',pct(drag)],['점검 상태',order.status]]);
  setFacts('#boundaryFacts',[['가정',order.assumption],['실제 세금 계산','아님'],['외부 요청','0건'],['실제 계좌·API·DB','미연결']]);
  document.querySelector('#nextActionText').textContent=`${order.next}. 이 상태는 투자 권유가 아니라 승인 전 비용 점검 표시입니다.`;
  document.querySelector('#primaryLink').href=order.link;
  renderBreakdown(order);
}

function selectOrder(id){
  selectedId=id;
  orderList.querySelectorAll('.order-row').forEach(button=>{
    const selected=button.textContent.includes(id);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
  });
  renderInspector();
}

function setSegment(value){
  document.querySelectorAll('#impactFilters button').forEach(button=>{
    const active=button.dataset.impact===value;
    button.classList.toggle('selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
}

function render(){
  renderOrders();
  orderList.querySelectorAll('.order-row').forEach(button=>{
    const selected=selectedId&&button.textContent.includes(selectedId);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
  });
  renderInspector();
}

document.querySelectorAll('#impactFilters button').forEach(button=>button.addEventListener('click',()=>{
  impactFilter=button.dataset.impact;
  setSegment(impactFilter);
  selectedId=visibleOrders()[0]?.id||null;
  render();
}));

render();
