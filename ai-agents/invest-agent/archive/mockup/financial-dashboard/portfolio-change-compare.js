const assets=[
  {id:'cash',name:'현금성 자산',ticker:'KRW',current:18.4,next:16.0,amount:-240000,policy:'최소 현금 충족',policyType:'pass',risk:'현금 완충 여지 감소',check:'최소 현금 15% 이상 예시 충족',source:'실제 계좌 잔고 미연결',direction:'down',summary:'현금 비중은 줄지만 화면용 최소 현금 조건은 충족한 예시입니다.'},
  {id:'kodex',name:'KODEX 200',ticker:'069500',current:31.6,next:33.0,amount:140000,policy:'통과 예시',policyType:'pass',risk:'시장 대표 지수 비중 확대',check:'ETF 편입 한도 예시 통과',source:'실제 ETF 시세 미연결',direction:'up',summary:'국내 지수 비중을 소폭 늘리는 가상 승인 전 비교입니다.'},
  {id:'samsung',name:'삼성전자',ticker:'005930',current:7.2,next:8.0,amount:80000,policy:'한도 경계 예시',policyType:'pass',risk:'단일 종목 한도 근접',check:'종목 한도 8% 경계 예시를 표시하지만 종합 확인 필요 건수에는 넣지 않습니다.',source:'공시·시세 실제 연결 없음',direction:'up',summary:'비중 증가 후 단일 종목 한도 경계에 가까워지는 예시입니다.'},
  {id:'sk',name:'SK하이닉스',ticker:'000660',current:22.8,next:20.0,amount:-280000,policy:'집중도 완화 예시',policyType:'pass',risk:'반도체 집중도 완화',check:'섹터 집중도 예시 완화',source:'실제 세금·수수료 계산 아님',direction:'down',summary:'반도체 합산 비중을 낮추는 화면용 조정 예시입니다.'},
  {id:'naver',name:'NAVER',ticker:'035420',current:20.0,next:18.0,amount:-200000,policy:'변동성 확인 필요',policyType:'check',risk:'변동성 확인 필요',check:'최근 변동성 근거 미연결',source:'뉴스·가격 실제 연결 없음',direction:'down',summary:'비중은 줄지만 변동성 근거 확인이 남아 있는 예시입니다.'},
  {id:'sp500',name:'TIGER 미국S&P500',ticker:'360750',current:0.0,next:5.0,amount:500000,policy:'환율·출처 확인 필요',policyType:'check',risk:'환율 가정 확인 필요',check:'신규 편입 전 출처 확인 필요',source:'실제 환율 조회 없음',direction:'up',summary:'신규 편입 후보이며 환율과 출처 확인이 필요한 화면용 예시입니다.'},
];

let filter='all';
let selectedId=assets[0].id;
const assetList=document.querySelector('#assetList');
const emptyState=document.querySelector('#emptyState');
const formatWon=value=>`${value<0?'-':'+'}${Math.abs(value).toLocaleString('ko-KR')}원`;
const policyClass=type=>type==='pass'?'pass':type==='block'?'block':'check';

function visibleAssets(){
  return assets.filter(item=>filter==='all'||(filter==='up'&&item.direction==='up')||(filter==='down'&&item.direction==='down')||(filter==='check'&&item.policyType==='check')||(filter==='none'&&false));
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
  const checkCount=items.filter(item=>item.policyType==='check').length;
  document.querySelector('#policyCount').textContent=checkCount?`확인 ${checkCount}건`:'확인 0건';
  document.querySelector('#summaryTitle').textContent=items.length?`DEC-1056 자산 ${items.length}개 변경 비교`:'선택한 조건의 자산 없음';
  document.querySelector('#summaryCopy').textContent=items.length?'현재 비중과 변경 후 가정 비중을 승인 전 비교로만 표시합니다.':'필터 조건을 바꾸면 전후 비교 항목이 다시 표시됩니다.';
}

function renderList(){
  const items=visibleAssets();
  if(!items.some(item=>item.id===selectedId)){
    selectedId=items[0]?.id||null;
  }
  assetList.hidden=!items.length;
  emptyState.hidden=items.length>0;
  assetList.replaceChildren(...items.map(item=>{
    const button=document.createElement('button');
    const selected=item.id===selectedId;
    const delta=item.next-item.current;
    button.type='button';
    button.className='asset-row';
    button.setAttribute('role','option');
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
    button.innerHTML=`<span><strong>${item.name}</strong><small>${item.ticker} · 화면용 예시</small></span><span>${item.current.toFixed(1)}%</span><span>${item.next.toFixed(1)}%</span><span class="${delta>=0?'change-up':'change-down'}">${delta>=0?'+':''}${delta.toFixed(1)}%p</span><span>${formatWon(item.amount)}</span><span><i class="policy-pill ${policyClass(item.policyType)}">${item.policy}</i></span>`;
    button.addEventListener('click',()=>selectAsset(item.id));
    return button;
  }));
  updateSummary(items);
}

function renderInspector(){
  const item=assets.find(entry=>entry.id===selectedId);
  const badge=document.querySelector('#detailBadge');
  if(!item){
    document.querySelector('#detailTitle').textContent='선택 자산 없음';
    document.querySelector('#detailSummary').textContent='현재 필터에 해당하는 화면용 자산 비교가 없습니다.';
    badge.textContent='빈 결과';
    badge.className='check';
    document.querySelector('#amountText').textContent='표시할 가상 금액 변화가 없습니다.';
    document.querySelector('#currentWeight').textContent='미표시';
    document.querySelector('#nextWeight').textContent='미표시';
    document.querySelector('#currentBar').style.width='0%';
    document.querySelector('#nextBar').style.width='0%';
    setFacts('#weightFacts',[['필터 상태','항목 없음'],['외부 요청','0건']]);
    setFacts('#policyFacts',[['정책 상태','미표시'],['승인 상태','승인 전 비교 없음']]);
    setFacts('#riskFacts',[['예상 위험','미표시'],['보장 표현','없음']]);
    const primaryLink=document.querySelector('#primaryLink');
    document.querySelector('#nextActionText').textContent='현재 조건에는 승인 대기와 연결할 자산 비교가 없습니다. 필터를 변경해 주세요.';
    primaryLink.hidden=true;
    primaryLink.removeAttribute('href');
    primaryLink.setAttribute('aria-disabled','true');
    primaryLink.tabIndex=-1;
    return;
  }
  const delta=item.next-item.current;
  badge.textContent=item.policy;
  badge.className=policyClass(item.policyType);
  document.querySelector('#detailTitle').textContent=item.name;
  document.querySelector('#detailSummary').textContent=item.summary;
  document.querySelector('#amountText').textContent=`기준 총액 10,000,000원에서 ${formatWon(item.amount)} 변화로 표시한 가상 승인 전 비교입니다.`;
  document.querySelector('#currentWeight').textContent=`${item.current.toFixed(1)}%`;
  document.querySelector('#nextWeight').textContent=`${item.next.toFixed(1)}%`;
  document.querySelector('#currentBar').style.width=`${Math.min(item.current*2,100)}%`;
  document.querySelector('#nextBar').style.width=`${Math.min(item.next*2,100)}%`;
  setFacts('#weightFacts',[['현재 비중',`${item.current.toFixed(1)}%`],['변경 후 비중',`${item.next.toFixed(1)}%`],['변화폭',`${delta>=0?'+':''}${delta.toFixed(1)}%p`],['기준 시각','2026.08.27 15:20 KST']]);
  setFacts('#policyFacts',[['정책 상태',item.policy],['정책 점검',item.check],['승인 상태','사용자 승인 대기 전 비교'],['출처 상태',item.source]]);
  setFacts('#riskFacts',[['예상 변동성','13.2% → 12.6%'],['예상 최대 낙폭','-8.4% → -7.9%'],['자산별 위험',item.risk],['수익 개선 보장','아님']]);
  const primaryLink=document.querySelector('#primaryLink');
  document.querySelector('#nextActionText').textContent=`DEC-1056 승인 대기 화면으로 이동해도 실제 주문이나 외부 요청은 발생하지 않습니다.`;
  primaryLink.hidden=false;
  primaryLink.href='approval-queue.html';
  primaryLink.removeAttribute('aria-disabled');
  primaryLink.tabIndex=0;
}

function selectAsset(id){
  selectedId=id;
  assetList.querySelectorAll('.asset-row').forEach(button=>{
    const item=assets.find(entry=>entry.id===id);
    const selected=item&&button.textContent.includes(item.name);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
  });
  renderInspector();
}

function setFilterSegment(value){
  document.querySelectorAll('#changeFilters button').forEach(button=>{
    const active=button.dataset.filter===value;
    button.classList.toggle('selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
}

function render(){
  renderList();
  assetList.querySelectorAll('.asset-row').forEach(button=>{
    const item=assets.find(entry=>entry.id===selectedId);
    const selected=item&&button.textContent.includes(item.name);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
  });
  renderInspector();
}

document.querySelectorAll('#changeFilters button').forEach(button=>button.addEventListener('click',()=>{
  filter=button.dataset.filter;
  setFilterSegment(filter);
  selectedId=visibleAssets()[0]?.id||null;
  render();
}));

window.__setPortfolioCompareFilterForTest=value=>{
  filter=value;
  selectedId=visibleAssets()[0]?.id||null;
  setFilterSegment(value);
  render();
};

render();
