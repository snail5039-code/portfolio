const channels=[
  {id:'inapp',name:'앱 내부',state:'앱 내부만',summary:'화면 안 배지와 목록에만 표시합니다.',enabled:true},
  {id:'browser',name:'브라우저',state:'권한 요청 없음',summary:'브라우저 알림 권한은 요청하지 않습니다.',enabled:false},
  {id:'email',name:'이메일',state:'미연결',summary:'메일 서버와 계정은 연결하지 않았습니다.',enabled:false},
  {id:'messenger',name:'메신저',state:'미연결',summary:'메신저 앱과 외부 전송은 없습니다.',enabled:false},
];
const types=[
  {id:'policy',name:'정책 차단',desc:'종목 비중·주문 한도 같은 정책 이벤트',enabled:true},
  {id:'source',name:'출처 미확인',desc:'공시·가격 출처가 확인되지 않은 이벤트',enabled:true},
  {id:'approval',name:'승인 만료',desc:'사용자 승인 제한 시간이 지난 이벤트',enabled:true},
  {id:'data',name:'데이터 연결 문제',desc:'API·DB·계좌 미연결 상태 알림',enabled:true},
  {id:'volatility',name:'변동성 경계',desc:'화면용 변동성 기준 초과 이벤트',enabled:false},
  {id:'cost',name:'비용 한계',desc:'수수료·세금·슬리피지 가정 안내',enabled:false},
];
let selectedChannel='inapp';
let severity='높음';

function severityLabel(){return severity==='중대'?'중대만':severity==='보통'?'보통 포함':`${severity} 이상`;}
function detailFacts(entries){const target=document.querySelector('#detailFacts');target.replaceChildren(...entries.map(([key,value])=>{const row=document.createElement('div');const dt=document.createElement('dt');const dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;row.append(dt,dd);return row;}));}
function updateSummary(){document.querySelector('#activeChannelCount').textContent=`${channels.filter(item=>item.enabled).length}개`;document.querySelector('#activeTypeCount').textContent=`${types.filter(item=>item.enabled).length}개`;document.querySelector('#severitySummary').textContent=severityLabel();}
function renderInspector(channel=channels.find(item=>item.id===selectedChannel)){document.querySelector('#detailTitle').textContent=channel.name;document.querySelector('#detailBadge').textContent=channel.state;document.querySelector('#detailSummary').textContent=channel.summary;detailFacts([['채널 상태',channel.state],['활성 여부',channel.enabled?'화면 표시':'미사용'],['심각도 기준',severityLabel()],['활성 유형',`${types.filter(item=>item.enabled).length}개`]]);}
function renderChannels(){const list=document.querySelector('#channelList');list.replaceChildren(...channels.map(channel=>{const button=document.createElement('button');button.type='button';button.className='channel-card';button.dataset.state=channel.state;button.dataset.id=channel.id;button.innerHTML=`<strong>${channel.name}</strong><span>${channel.state}</span><small>${channel.summary}</small>`;button.addEventListener('click',()=>{selectedChannel=channel.id;renderChannels();renderInspector(channel);});if(channel.id===selectedChannel)button.classList.add('selected');return button;}));}
function renderTypes(){const list=document.querySelector('#typeList');list.replaceChildren(...types.map(type=>{const button=document.createElement('button');button.type='button';button.className=`type-toggle ${type.enabled?'enabled':''}`;button.setAttribute('aria-pressed',String(type.enabled));button.innerHTML=`<strong>${type.name}</strong><span class="switch" aria-hidden="true"></span><p>${type.desc}</p>`;button.addEventListener('click',()=>{type.enabled=!type.enabled;renderTypes();updateSummary();renderInspector();});return button;}));}
function bindSeverity(){document.querySelectorAll('#severityControls button').forEach(button=>button.addEventListener('click',()=>{button.parentElement.querySelectorAll('button').forEach(item=>{const active=item===button;item.classList.toggle('selected',active);item.setAttribute('aria-pressed',String(active));});severity=button.dataset.level;updateSummary();renderInspector();}));}
function bindPreview(){document.querySelector('#previewButton').addEventListener('click',()=>{const card=document.querySelector('#previewCard');card.innerHTML='<strong>화면용 테스트 알림</strong><p>확인이 필요한 리스크 이벤트가 있습니다. 실제 발송·권한 요청·매수/매도 지시는 없습니다.</p>';});}

renderChannels();
renderTypes();
bindSeverity();
bindPreview();
updateSummary();
renderInspector();
