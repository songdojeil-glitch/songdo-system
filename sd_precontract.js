/* ═════════════════════════════════════════════════════════════════
   ✍️ 가계약서 작성 (sd_precontract.js · window.sdPre)  2026-10-09
   · 계약(sd_contracts.html) 의 「✍️ 가계약 작성」 탭 — 단계별로 입력해 가계약서를 만든다
     ① 계약 구분(매매·전세·월세 × 아파트·아파트 분양권·상가·오피스텔·생활형숙박시설·상가 분양권)
     ② 물건 정보(매물에서 불러오기·직접 입력) ③ 가격(계약금·가계약금·중도금·잔금) ④ 일정
     ⑤ 기본 조건 ⑥ 특약 조건 (둘 다 조건 목록에서 고르고 · 목록은 추가·수정·삭제)
     ⑦ 계좌 · 가계약 체결일 · 계약 당사자(입력한 칸만 보임) · 개업공인중개사 2곳
     ⑧ 미리보기 · 저장 · 인쇄 · PDF · JPEG
   · 문서 순서: 물건 정보 / 가격 / 일정 / 기본 조건 / 특약 조건 / 계좌 / 가계약 체결일 / 당사자 / 개업공인중개사
   · 저장: window.storage — sd_precontracts (가계약서 목록) · sd_precontract_terms (기본·특약 조건 목록, 사무실 공용)
   · 조건 글의 {갑} = 매도인·임대인, {을} = 매수인·임차인 (거래 구분에 따라 바뀜)
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.sdPre) return;
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var nv = function(s){ return String(s == null ? '' : s).trim(); };
  var DEALS = ['매매', '전세', '월세'];
  var PT = [['apt', '아파트', '🏢'], ['aptbun', '아파트 분양권', '📜'], ['sangga', '상가', '🏪'], ['op', '오피스텔', '🏬'], ['ss', '생활형숙박시설(생숙)', '🏨'], ['sbun', '상가 분양권', '🧾']];
  var BUN = { aptbun:1, sbun:1 };
  var STEPS = [['type', '계약 구분'], ['prop', '물건 정보'], ['price', '가격'], ['sched', '일정'], ['basic', '기본 조건'], ['special', '특약 조건'], ['people', '계좌·당사자·중개사'], ['done', '미리보기·저장']];
  var LK = 'sd_precontracts', TK = 'sd_precontract_terms';
  function ptN(k){ var p = PT.find(function(x){ return x[0] === k; }); return p ? p[1] : ''; }
  function rent(d){ return (d || D).deal !== '매매'; }
  function gap(d){ return rent(d) ? '임대인' : '매도인'; }
  function eul(d){ return rent(d) ? '임차인' : '매수인'; }
  function sub(t, d){ d = d || D; return String(t || '').replace(/\{갑\}/g, gap(d)).replace(/\{을\}/g, eul(d)).replace(/\{본계약일\}/g, dk(d.sched.main) || '본 계약일').replace(/\{잔금일\}/g, dk(d.sched.bal) || '잔금일'); }
  function uid(p){ return (p || 'pc') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dk(s){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); if(!m) return nv(s); var w = '일월화수목금토'.charAt(new Date(+m[1], +m[2] - 1, +m[3]).getDay()); return m[1] + '년 ' + (+m[2]) + '월 ' + (+m[3]) + '일 (' + w + ')'; }
  function me(){ try{ var s = JSON.parse(localStorage.getItem('sd_auth_session') || '{}') || {}; return s.name || s.email || ''; }catch(e){ return ''; } }
  function toast(m, bad){ if(typeof window.showToast === 'function') return window.showToast(m, bad ? 'err' : ''); var t = document.createElement('div'); t.className = 'pc-toast' + (bad ? ' bad' : ''); t.textContent = m; document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 3000); }
  /* ── 금액 — 숫자(원)로 보관, 화면은 「1억 2,000만」 · 문서는 「금 일억이천만원정 (₩120,000,000)」 ── */
  function num(v){ var n = parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10); return isNaN(n) ? 0 : n; }
  function comma(n){ return (+n || 0).toLocaleString('ko-KR'); }
  function manwon(n){ n = +n || 0; if(!n) return ''; var e = Math.floor(n / 1e8), m = Math.floor((n % 1e8) / 1e4), r = n % 1e4; return [e ? e + '억' : '', m ? comma(m) + '만' : '', r ? comma(r) : ''].filter(Boolean).join(' ') + '원'; }
  function hangul(n){
    n = Math.floor(+n || 0); if(!n) return '영';
    var D1 = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], U1 = ['', '십', '백', '천'], U4 = ['', '만', '억', '조'], out = '', g = 0;
    while(n > 0){ var c = n % 10000, s = ''; for(var i = 0; i < 4 && c > 0; i++){ var d = c % 10; if(d) s = D1[d] + U1[i] + s; c = Math.floor(c / 10); } if(s) out = s + U4[g] + out; n = Math.floor(n / 10000); g++; }
    return out;
  }
  function wonDoc(n){ return n ? '금 ' + hangul(n) + '원정 <span class="w">(₩' + comma(n) + ')</span>' : ''; }
  /* ── 기본 조건 · 특약 조건 처음 목록 (일부 — 나머지는 사무실에서 추가·수정·삭제) ──
     d: 거래(빈 배열 = 모든 거래) · t: 물건(빈 배열 = 모든 물건) · on: 처음부터 골라 둠 */
  var R3 = ['전세', '월세'], SG = ['sangga', 'sbun'];
  var DEF_TERMS = {
    basic:[
      { text:'본 가계약은 위 물건에 대하여 {갑}과 {을}이 위 조건으로 본 계약을 체결하기로 약정하는 것이며, 가계약금이 {갑} 계좌에 입금된 때에 성립한다.', on:true },
      { text:'본 계약은 {본계약일}에 체결하며, 본 계약서는 개업공인중개사가 표준 계약서 양식으로 작성한다.', on:true },
      { text:'{을}이 본 계약을 체결하지 않을 경우 가계약금은 {갑}에게 귀속되며, {을}은 그 반환을 청구하지 않는다.', on:true },
      { text:'{갑}이 본 계약을 체결하지 않을 경우 {갑}은 {을}에게 가계약금의 배액을 상환한다.', on:true },
      { text:'가계약금은 본 계약 시 계약금의 일부로 충당한다.', on:true },
      { text:'{갑}은 본 계약 체결 시까지 위 물건을 제3자와 계약하거나 광고하지 않으며, 등기사항증명서상 권리관계를 현 상태대로 유지한다.', on:true },
      { text:'본 가계약서에 정하지 않은 사항은 본 계약 시 당사자가 협의하여 정하며, 민법 및 부동산 거래 관례에 따른다.', on:true },
      { text:'잔금일 기준으로 제세공과금 및 관리비는 일할 계산하여 정산한다.', d:['매매'], t:['apt', 'op', 'ss', 'sangga'], on:true },
      { text:'{갑}은 잔금일까지 위 물건의 근저당권 등 제한물권을 말소한다. 다만 승계하기로 한 경우에는 특약에 따로 적는다.', d:['매매'], t:['apt', 'op', 'ss', 'sangga'], on:true },
      { text:'{갑}은 본 계약 시 국세·지방세 완납증명서를 제시하고, 선순위 보증금·근저당 등 권리관계를 {을}에게 확인시켜 준다.', d:R3, on:true },
      { text:'{갑}은 {을}이 잔금일에 전입신고 및 확정일자를 받을 수 있도록 협조하며, 잔금일 다음 날까지 위 물건에 새로운 담보권을 설정하지 않는다.', d:R3, t:['apt', 'op'], on:true },
      { text:'분양권 전매 제한·명의변경 가능 여부는 시행사(분양사무소)에 확인한 뒤 본 계약을 체결하며, 전매가 불가능하면 본 가계약은 없던 것으로 하고 가계약금은 {을}에게 돌려준다.', d:['매매'], t:['aptbun', 'sbun'], on:true },
      { text:'분양권 매매대금은 프리미엄과 {갑}이 이미 낸 계약금(·중도금)을 합한 금액이며, 남은 분양대금과 중도금 대출은 {을}이 승계한다.', d:['매매'], t:['aptbun', 'sbun'], on:true },
      { text:'상가의 매매대금·월 차임에 대한 부가가치세는 별도이며, 세금계산서 발행 여부는 본 계약 시 정한다.', t:['sangga', 'sbun'], on:true },
      { text:'권리금은 본 가계약 금액에 포함되지 않는다.', d:R3, t:['sangga'], on:true },
      { text:'생활형숙박시설은 숙박업 신고 대상으로 주거용 사용(전입신고)에 제한이 있음을 {을}은 확인하였다.', t:['ss'], on:true }
    ],
    special:[
      { text:'현 시설 상태 그대로의 매매이며, {을}은 현장을 확인하였다.', d:['매매'] },
      { text:'{을}의 대출이 금융기관 사정으로 실행되지 않을 경우 본 가계약은 해제하고 가계약금은 {을}에게 돌려준다.', d:['매매'] },
      { text:'현 임차인의 임대차(보증금 ○○원, 월 차임 ○○원, 만기 ○○)를 {을}이 승계하며, 승계 보증금은 매매대금에서 공제한다.', d:['매매'], t:['apt', 'op', 'sangga'] },
      { text:'잔금일 전 도배·장판은 {갑}이 부담하여 시공한다.', d:R3, t:['apt', 'op'] },
      { text:'{을}의 전세자금대출이 승인되지 않을 경우 본 가계약은 해제하고 가계약금은 {을}에게 돌려준다.', d:['전세'], t:['apt', 'op'] },
      { text:'전세보증금 반환보증(HUG·HF·SGI) 가입이 거절될 경우 본 가계약은 해제하고 가계약금은 {을}에게 돌려준다.', d:['전세'], t:['apt', 'op'] },
      { text:'반려동물 사육을 허용하며, 퇴거 시 그로 인한 훼손은 {을}이 원상 복구한다.', d:R3, t:['apt', 'op'] },
      { text:'{갑}은 위 건물에 위반건축물 등재·행정처분 사실이 없음을 고지하며, 사실과 다를 경우 {을}은 본 가계약을 해제하고 가계약금 반환을 청구할 수 있다.', t:['sangga', 'op', 'ss'] },
      { text:'영업에 필요한 용도변경·영업허가는 {을}이 자기 책임과 비용으로 진행하며, 허가가 나지 않는 사유가 건물에 있는 경우 서로 협의한다.', d:R3, t:['sangga'] },
      { text:'인테리어 공사는 잔금일 이후(또는 ○월 ○일부터) 시작할 수 있으며, 계약 종료 시 {을}은 원상 복구한다.', d:R3, t:['sangga'] },
      { text:'간판 설치 위치·크기는 건물 관리규약에 따르며, 설치·철거 비용은 {을}이 부담한다.', d:R3, t:['sangga'] },
      { text:'하수도원인자부담금·정화조 용량 부족에 따른 비용은 {갑}·{을} 협의하여 정한다.', t:['sangga'] },
      { text:'영업 양도에 따른 권리금은 기존 임차인과 {을} 사이의 별도 계약으로 하며, {갑}은 신규 임대차 체결에 협조한다.', d:R3, t:['sangga'] },
      { text:'사업의 포괄 양수도로 처리하되, 포괄 양수도가 인정되지 않을 경우 부가가치세는 {을}이 부담한다.', d:['매매'], t:['sangga'] },
      { text:'명의변경 수수료 등 분양권 명의변경 비용은 {을}이 부담한다.', d:['매매'], t:['aptbun', 'sbun'] },
      { text:'{갑}이 선택한 유상 옵션(○○)은 매매대금에 포함한다.', d:['매매'], t:['aptbun'] },
      { text:'월 관리비는 {을}이 부담하며, 장기수선충당금은 {갑}이 부담한다.', d:R3, t:['apt', 'op'] }
    ]
  };
  function seedTerms(){ var o = { basic:[], special:[] }; ['basic', 'special'].forEach(function(k){ o[k] = DEF_TERMS[k].map(function(x){ return { id:uid('t'), text:x.text, d:x.d || [], t:x.t || [], on:!!x.on }; }); }); return o; }
  /* ── 저장 ── */
  function waitStore(){ return new Promise(function(res){ var n = 0; (function chk(){ if(window.storage && window.storage.get) return res(); if(++n > 100) return res(); setTimeout(chk, 100); })(); }); }
  function sget(k){ return waitStore().then(function(){ return window.storage.get(k); }).then(function(r){ try{ return r && r.value ? JSON.parse(r.value) : null; }catch(e){ return null; } }, function(){ return null; }); }
  function sset(k, v){ return waitStore().then(function(){ return window.storage.set(k, JSON.stringify(v)); }); }
  var LIST = null, TERMS = null, D = null, STEP = 'type', VIEW = 'list', Q = '', SHOWALL = { basic:false, special:false }, EDIT = null, OFFICE = null, PROPS = null, CUSTS = null, BRKS = null, DANJI = null;
  function loadAll(force){
    return Promise.all([
      LIST && !force ? LIST : sget(LK).then(function(v){ LIST = Array.isArray(v) ? v : []; return LIST; }),
      TERMS && !force ? TERMS : sget(TK).then(function(v){ TERMS = v && Array.isArray(v.basic) ? v : seedTerms(); if(!v) sset(TK, TERMS).catch(function(){}); return TERMS; }),
      OFFICE ? OFFICE : sget('sd_office').then(function(v){ OFFICE = Object.assign({ name:'송도제일공인중개사사무소', owner:'문형은', tel:'032-851-6688', addr:'인천 연수구 해돋이로 168 혜인프라자 1층 103호', regno:'28185-2016-00161' }, v || {}); return OFFICE; })
    ]);
  }
  /* 목록 저장 — 다른 직원이 그사이 저장한 것을 덮지 않게 최신본을 다시 읽어 합친다 */
  function saveDoc(d){
    d.updatedAt = Date.now(); if(!d.createdAt) d.createdAt = d.updatedAt; if(!d.by) d.by = me();
    return sget(LK).then(function(v){ var L = Array.isArray(v) ? v : []; var i = L.findIndex(function(x){ return x.id === d.id; }); var c = JSON.parse(JSON.stringify(d)); if(i >= 0) L[i] = c; else L.unshift(c); LIST = L; return sset(LK, L); });
  }
  function delDoc(id){ return sget(LK).then(function(v){ var L = (Array.isArray(v) ? v : []).filter(function(x){ return x.id !== id; }); LIST = L; return sset(LK, L); }); }
  function saveTerms(){ return sset(TK, TERMS).then(function(){ toast('조건 목록을 저장했습니다'); }, function(e){ toast('조건 목록을 저장하지 못했습니다: ' + (e && e.message || e), true); }); }
  /* ── 새 가계약서 ── */
  function office1(){ var o = OFFICE || {}; return { name:o.name || '', ceo:o.owner || o.ceo || '', regno:o.regno || '', addr:o.addr || '', tel:o.tel || '', mobile:'' }; }
  function blank(){
    return { id:uid(), no:'', title:'', deal:'매매', ptype:'apt', status:'작성 중',
      prop:{ src:'manual', propId:'', name:'', addr:'', dong:'', ho:'', exArea:'', supArea:'', floor:'', use:'', bunPrice:'', premium:'', option:'', biz:'', memo:'' },
      price:{ total:0, monthly:0, mgmt:'', vatNote:'', down:0, pre:0, mids:[{ amt:0, date:'' }], bal:0, autoBal:true },
      sched:{ main:'', bal:'', handover:'' },
      basic:null, special:null, extraBasic:[], extraSpecial:[],
      acct:{ bank:'', num:'', holder:'' }, signDate:today(),
      parties:{ g:{ name:'', birth:'', tel:'', addr:'' }, e:{ name:'', birth:'', tel:'', addr:'' } },
      brokers:[office1(), { name:'', ceo:'', regno:'', addr:'', tel:'', mobile:'' }], memo:'' };
  }
  function docNo(d){ var t = String(d.signDate || today()).replace(/-/g, ''), n = (LIST || []).filter(function(x){ return x.id !== d.id && String(x.no || '').indexOf('PC-' + t) === 0; }).length + 1; return 'PC-' + t + '-' + String(n).padStart(2, '0'); }
  function title(d){ return [d.prop.name, [d.prop.dong && d.prop.dong + '동', d.prop.ho && d.prop.ho + '호'].filter(Boolean).join(' ')].filter(Boolean).join(' ') || ptN(d.ptype) + ' ' + d.deal; }
  /* 거래 금액 계산 — 잔금 자동 = 총액 − 계약금 − 중도금 */
  function calcBal(d){ var p = d.price, mid = (p.mids || []).reduce(function(a, m){ return a + (+m.amt || 0); }, 0); if(p.autoBal) p.bal = Math.max(0, (+p.total || 0) - (+p.down || 0) - mid); return p.bal; }
  /* 조건 — 이 계약(거래·물건)에 맞는 것 */
  function fits(t, d){ return (!t.d || !t.d.length || t.d.indexOf(d.deal) >= 0) && (!t.t || !t.t.length || t.t.indexOf(d.ptype) >= 0); }
  function initTerms(d, k){ if(d[k]) return; d[k] = TERMS[k].filter(function(t){ return t.on && fits(t, d); }).map(function(t){ return { id:t.id, text:t.text }; }); }
  function stepIdx(k){ return STEPS.findIndex(function(s){ return s[0] === k; }); }
  /* ═════════ 화면 ═════════ */
  var ROOT = null;
  function render(){ if(!ROOT) return; if(VIEW === 'list') return paintList(); paintEdit(); }
  function paintList(){
    var L = (LIST || []).filter(function(d){ if(!Q) return true; var s = [d.no, title(d), d.deal, ptN(d.ptype), d.parties && d.parties.g.name, d.parties && d.parties.e.name, d.by].join(' '); return s.indexOf(Q) >= 0; });
    ROOT.innerHTML = '<div class="pc">'
      + '<div class="pc-card"><div class="pc-h">✍️ 가계약서 <small>단계별로 입력해 가계약서를 만들고, 저장·복제·인쇄·PDF·JPEG 로 냅니다</small><span class="sp"></span><button class="pc-btn pri" id="pc-new">＋ 새 가계약서</button></div>'
      + '<p class="pc-sub">계약서 작성은 렛츠(경인정보)를 쓰고, 여기서는 그 전 단계인 <b>가계약서</b>를 사무실 양식으로 만듭니다. 저장한 가계약서는 아래 목록에서 다시 열어 고치거나 <b>복제</b>해 새 가계약서의 바탕으로 쓸 수 있습니다.</p>'
      + '<div class="pc-row"><input class="pc-in" id="pc-q" placeholder="🔎 단지명·당사자·번호로 찾기" value="' + esc(Q) + '" style="max-width:340px"><span class="sp"></span><button class="pc-btn" id="pc-terms">⚙ 기본·특약 조건 목록 관리</button></div></div>'
      + '<div class="pc-card"><div class="pc-h">📂 저장한 가계약서 <small>' + (LIST || []).length + '건</small></div>'
      + (L.length ? '<div class="pc-list">' + L.map(function(d){ var dt = new Date(d.updatedAt || 0);
          return '<div class="pc-li"><div class="t"><b>' + esc(title(d)) + '</b><span class="tag">' + esc(d.deal) + ' · ' + esc(ptN(d.ptype)) + '</span>' + (d.status === '완료' ? '<span class="tag ok">완료</span>' : '<span class="tag dr">작성 중</span>') + '<small>' + esc(d.no || '') + ' · ' + esc([d.parties.g.name && gap(d) + ' ' + d.parties.g.name, d.parties.e.name && eul(d) + ' ' + d.parties.e.name].filter(Boolean).join(' · ') || '당사자 미입력') + ' · ' + (d.price.total ? manwon(d.price.total) : '') + ' · ' + (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0') + (d.by ? ' · ' + esc(d.by) : '') + '</small></div>'
            + '<div class="b"><button class="pc-btn sm" data-open="' + d.id + '">열기·수정</button><button class="pc-btn sm" data-dup="' + d.id + '">⧉ 복제해서 새로</button><button class="pc-btn sm" data-prt="' + d.id + '">🖨</button><button class="pc-btn sm x" data-del="' + d.id + '">🗑</button></div></div>'; }).join('') + '</div>'
        : '<div class="pc-empty">' + (Q ? '찾는 가계약서가 없습니다.' : '아직 저장한 가계약서가 없습니다. 「＋ 새 가계약서」로 시작하세요.') + '</div>')
      + '</div></div>';
    $('pc-new').onclick = function(){ D = blank(); STEP = 'type'; VIEW = 'edit'; render(); };
    $('pc-terms').onclick = function(){ termsModal(); };
    $('pc-q').oninput = function(){ Q = this.value.trim(); var p = this.selectionStart; paintList(); var i = $('pc-q'); i.focus(); try{ i.setSelectionRange(p, p); }catch(e){} };
    qa('[data-open]').forEach(function(b){ b.onclick = function(){ var d = LIST.find(function(x){ return x.id === b.dataset.open; }); if(!d) return; D = norm(JSON.parse(JSON.stringify(d))); STEP = 'done'; VIEW = 'edit'; render(); }; });
    qa('[data-dup]').forEach(function(b){ b.onclick = function(){ var d = LIST.find(function(x){ return x.id === b.dataset.dup; }); if(!d) return; D = norm(JSON.parse(JSON.stringify(d))); D.id = uid(); D.no = ''; D.status = '작성 중'; D.createdAt = 0; D.by = ''; D.signDate = today(); STEP = 'type'; VIEW = 'edit'; render(); toast('「' + title(d) + '」 을 복제했습니다 — 바꿀 곳만 고쳐 저장하세요'); }; });
    qa('[data-prt]').forEach(function(b){ b.onclick = function(){ var d = LIST.find(function(x){ return x.id === b.dataset.prt; }); if(d) printDoc(norm(JSON.parse(JSON.stringify(d)))); }; });
    qa('[data-del]').forEach(function(b){ b.onclick = function(){ var d = LIST.find(function(x){ return x.id === b.dataset.del; }); if(!d || !confirm('「' + title(d) + '」 가계약서를 지울까요? 되돌릴 수 없습니다.')) return; delDoc(d.id).then(function(){ toast('지웠습니다'); paintList(); }, function(e){ toast('지우지 못했습니다: ' + (e && e.message || e), true); }); }; });
  }
  function qa(s){ return Array.prototype.slice.call(ROOT.querySelectorAll(s)); }
  function norm(d){ var b = blank(); ['prop', 'price', 'sched', 'acct'].forEach(function(k){ d[k] = Object.assign({}, b[k], d[k] || {}); }); d.parties = d.parties || b.parties; ['g', 'e'].forEach(function(k){ d.parties[k] = Object.assign({}, b.parties.g, d.parties[k] || {}); }); d.brokers = (d.brokers || []).concat([{}, {}]).slice(0, 2).map(function(x, i){ return Object.assign({}, b.brokers[1], i === 0 && !x.name ? office1() : {}, x || {}); }); if(!Array.isArray(d.price.mids) || !d.price.mids.length) d.price.mids = [{ amt:0, date:'' }]; d.extraBasic = d.extraBasic || []; d.extraSpecial = d.extraSpecial || []; return d; }
  function paintEdit(){
    var si = stepIdx(STEP);
    ROOT.innerHTML = '<div class="pc">'
      + '<div class="pc-card"><div class="pc-h"><button class="pc-btn sm" id="pc-back">← 목록</button> ✍️ ' + esc(title(D)) + ' <small>' + esc(D.deal + ' · ' + ptN(D.ptype)) + (D.no ? ' · ' + esc(D.no) : '') + '</small><span class="sp"></span><button class="pc-btn" id="pc-save">💾 저장</button></div>'
      + '<div class="pc-steps">' + STEPS.map(function(s, i){ return '<button data-st="' + s[0] + '" class="' + (s[0] === STEP ? 'on' : i < si ? 'dn' : '') + '"><i>' + (i + 1) + '</i>' + s[1] + '</button>'; }).join('') + '</div></div>'
      + '<div class="pc-card" id="pc-body">' + stepHtml() + '</div>'
      + '<div class="pc-foot">' + (si > 0 ? '<button class="pc-btn" id="pc-prev">← 이전</button>' : '<span></span>') + '<span class="sp"></span>' + (si < STEPS.length - 1 ? '<button class="pc-btn pri" id="pc-next">다음: ' + STEPS[si + 1][1] + ' →</button>' : '') + '</div></div>';
    $('pc-back').onclick = function(){ if(D && D._dirty && !confirm('저장하지 않은 내용이 있습니다. 목록으로 갈까요?')) return; VIEW = 'list'; D = null; render(); };
    $('pc-save').onclick = function(){ doSave(); };
    qa('[data-st]').forEach(function(b){ b.onclick = function(){ go(b.dataset.st); }; });
    var pv = $('pc-prev'); if(pv) pv.onclick = function(){ go(STEPS[si - 1][0]); };
    var nx = $('pc-next'); if(nx) nx.onclick = function(){ go(STEPS[si + 1][0]); };
    bindStep();
  }
  function go(k){ STEP = k; render(); try{ ROOT.scrollIntoView({ block:'start' }); }catch(e){} }
  function dirty(){ if(D) D._dirty = true; }
  function doSave(done){
    if(!D.no) D.no = docNo(D); D.title = title(D); if(done) D.status = '완료';
    var d = JSON.parse(JSON.stringify(D)); delete d._dirty;
    return saveDoc(d).then(function(){ D._dirty = false; toast('가계약서를 저장했습니다 (' + D.no + ')'); if(VIEW === 'edit') render(); }, function(e){ toast('저장하지 못했습니다: ' + (e && e.message || e), true); });
  }
  /* 입력칸 */
  function fld(lab, path, ph, opt){ opt = opt || {}; var v = getP(path); return '<div class="pc-f' + (opt.w ? ' ' + opt.w : '') + '"><label>' + lab + (opt.note ? ' <span>' + opt.note + '</span>' : '') + '</label>' + (opt.ta ? '<textarea class="pc-in" data-p="' + path + '" rows="' + (opt.ta || 2) + '" placeholder="' + esc(ph || '') + '">' + esc(v) + '</textarea>' : '<input class="pc-in" data-p="' + path + '"' + (opt.type ? ' type="' + opt.type + '"' : '') + ' value="' + esc(v) + '" placeholder="' + esc(ph || '') + '">') + '</div>'; }
  function money(lab, path, opt){ opt = opt || {}; var v = +getP(path) || 0; return '<div class="pc-f' + (opt.w ? ' ' + opt.w : '') + '"><label>' + lab + (opt.note ? ' <span>' + opt.note + '</span>' : '') + '</label><div class="pc-mn"><input class="pc-in" data-m="' + path + '" inputmode="numeric" value="' + (v ? comma(v) : '') + '" placeholder="' + (opt.ph || '숫자만 (원)') + '"' + (opt.ro ? ' readonly' : '') + '><em data-mk="' + path + '">' + (v ? manwon(v) : '') + '</em></div></div>'; }
  function getP(path){ return path.split('.').reduce(function(o, k){ return o == null ? '' : o[k]; }, D); }
  function setP(path, v){ var ks = path.split('.'), o = D; for(var i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; dirty(); }
  function bindInputs(){
    qa('[data-p]').forEach(function(i){ i.oninput = function(){ setP(i.dataset.p, i.value); }; });
    qa('[data-m]').forEach(function(i){ i.oninput = function(){ var n = num(i.value), p = i.selectionStart, L0 = i.value.length; setP(i.dataset.m, n); i.value = n ? comma(n) : ''; try{ var q = Math.max(0, p + i.value.length - L0); i.setSelectionRange(q, q); }catch(e){} var k = ROOT.querySelector('[data-mk="' + i.dataset.m + '"]'); if(k) k.textContent = n ? manwon(n) : ''; if(STEP === 'price') priceSum(); }; });
  }
  function stepHtml(){
    var R = rent(), G = gap(), E = eul();
    if(STEP === 'type') return '<div class="pc-h2">① 계약 구분</div><p class="pc-sub">거래 구분과 물건 구분을 고르세요. 고른 것에 맞춰 입력 칸과 기본·특약 조건이 바뀝니다.</p>'
      + '<div class="pc-lab">거래 구분</div><div class="pc-big">' + DEALS.map(function(x){ var off = BUN[D.ptype] && x !== '매매'; return '<button data-deal="' + x + '" class="' + (D.deal === x ? 'on' : '') + '"' + (off ? ' disabled title="분양권은 매매만"' : '') + '><b>' + x + '</b><small>' + (x === '매매' ? '매도인 · 매수인' : '임대인 · 임차인') + '</small></button>'; }).join('') + '</div>'
      + '<div class="pc-lab">물건 구분</div><div class="pc-big six">' + PT.map(function(p){ return '<button data-pt="' + p[0] + '" class="' + (D.ptype === p[0] ? 'on' : '') + '"><span>' + p[2] + '</span><b>' + p[1] + '</b></button>'; }).join('') + '</div>'
      + (D.basic ? '<div class="pc-note">💡 거래·물건 구분을 바꾸면 「기본 조건」 고른 것이 그 구분에 맞게 다시 골라집니다.</div>' : '');
    if(STEP === 'prop'){ var p = D.prop, bun = BUN[D.ptype], sg = D.ptype === 'sangga' || D.ptype === 'sbun';
      return '<div class="pc-h2">② 물건 정보</div><p class="pc-sub">매물관리에서 불러오거나 직접 입력하세요. 비운 칸은 가계약서에 나오지 않습니다.</p>'
        + '<div class="pc-row"><button class="pc-btn" id="pc-fromprop">🏢 매물에서 불러오기</button><span class="pc-note" style="margin:0">' + (p.src === 'props' ? '🔗 매물에서 불러옴 — 고친 내용은 이 가계약서에만 반영됩니다' : '직접 입력') + '</span></div><div id="pc-propsel"></div>'
        + '<div class="pc-g3">' + fld(D.ptype === 'apt' || D.ptype === 'aptbun' ? '단지명' : '건물명', 'prop.name', '예: 힐스테이트레이크 송도4차', { w:'s2' }) + fld('동', 'prop.dong', '예: 401') + fld('호', 'prop.ho', '예: 1203') + fld('소재지', 'prop.addr', '인천광역시 연수구 송도동 …', { w:'s2' }) + fld('층', 'prop.floor', '예: 12층 / 총 35층')
        + fld('전용면적 (㎡)', 'prop.exArea', '예: 84.96') + fld(bun ? '공급(계약)면적 (㎡)' : '공급면적 (㎡)', 'prop.supArea', '예: 111.64') + fld('용도·구조', 'prop.use', sg ? '예: 제1종 근린생활시설' : '예: 공동주택(아파트)') + '</div>'
        + (bun ? '<div class="pc-lab">분양권 정보</div><div class="pc-g3">' + money('분양가', 'prop.bunPrice') + money('프리미엄', 'prop.premium') + fld('옵션·확장', 'prop.option', '예: 발코니 확장, 시스템에어컨') + '</div>' : '')
        + (sg ? '<div class="pc-g3">' + fld('업종·현황', 'prop.biz', '예: 공실 / 현 업종 카페') + '</div>' : '')
        + fld('물건 메모', 'prop.memo', '예: 남향, 올수리, 옵션 포함 등 (가계약서에 나옴)', { ta:2 }); }
    if(STEP === 'price'){ var pr = D.price; calcBal(D);
      return '<div class="pc-h2">③ 가격 — 계약금 · 중도금 · 잔금</div><p class="pc-sub">' + (R ? '보증금' : '매매대금') + '을 넣고 계약금·중도금을 넣으면 잔금은 저절로 계산됩니다. <b>가계약금</b>은 오늘 ' + G + ' 계좌로 보내는 금액(계약금의 일부)입니다.</p>'
        + '<div class="pc-g3">' + money(R ? '보증금' : BUN[D.ptype] ? '매매대금 (프리미엄 + 기납부금)' : '매매대금', 'price.total', { w:'s2' }) + (D.deal === '월세' ? money('월 차임 (월세)', 'price.monthly') : '<div></div>')
        + (R ? fld('관리비', 'price.mgmt', '예: 월 25만원 (공용)') : '') + (D.ptype === 'sangga' || D.ptype === 'sbun' ? fld('부가세', 'price.vatNote', '예: 월세 부가세 별도') : '') + '</div>'
        + '<div class="pc-g3">' + money('계약금', 'price.down', { note:'총액의 10% 가 보통' }) + money('그중 가계약금', 'price.pre', { note:'오늘 입금' }) + '<div class="pc-f"><label>&nbsp;</label><button class="pc-btn sm" id="pc-10">계약금 = 총액의 10%</button></div></div>'
        + '<div class="pc-lab">중도금 <span>없으면 비워 두세요 · 지급일은 ④ 일정에서</span></div>'
        + D.price.mids.map(function(m, i){ return '<div class="pc-g3">' + money('중도금 ' + (D.price.mids.length > 1 ? (i + 1) + '차 ' : '') + '금액', 'price.mids.' + i + '.amt') + '<div class="pc-f"><label>&nbsp;</label>' + (i ? '<button class="pc-btn sm x" data-mx="' + i + '">빼기</button>' : '') + '</div></div>'; }).join('')
        + (D.price.mids.length < 3 ? '<button class="pc-btn sm" id="pc-madd">＋ 중도금 추가</button>' : '')
        + '<div class="pc-g3" style="margin-top:10px">' + money('잔금', 'price.bal', { ro:pr.autoBal, note:pr.autoBal ? '자동 계산' : '직접 입력' }) + '<div class="pc-f"><label>&nbsp;</label><label class="pc-ck"><input type="checkbox" id="pc-autobal"' + (pr.autoBal ? ' checked' : '') + '> 잔금 자동 계산</label></div></div>'
        + '<div id="pc-sum" class="pc-sum"></div>'; }
    if(STEP === 'sched') return '<div class="pc-h2">④ 일정</div><p class="pc-sub">비운 날짜는 가계약서에 나오지 않습니다.</p>'
      + '<div class="pc-g3">' + fld('본 계약서 작성일', 'sched.main', '', { type:'date' }) + D.price.mids.map(function(m, i){ return (+m.amt ? fld('중도금 ' + (D.price.mids.length > 1 ? (i + 1) + '차 ' : '') + '지급일', 'price.mids.' + i + '.date', '', { type:'date' }) : ''); }).join('') + fld('잔금 지급일', 'sched.bal', '', { type:'date' }) + fld(R ? '입주(인도)일' : '인도일', 'sched.handover', '', { type:'date', note:'선택 · 잔금일과 같으면 비움' }) + '</div>'
      + (D.price.mids.some(function(m){ return +m.amt; }) ? '' : '<div class="pc-note">중도금이 없어 중도금 지급일 칸은 숨겼습니다.</div>');
    if(STEP === 'basic' || STEP === 'special') return termStep(STEP);
    if(STEP === 'people'){ var b2 = D.brokers;
      return '<div class="pc-h2">⑦ ' + G + ' 계좌 · 가계약 체결일 · 계약 당사자 · 개업공인중개사</div>'
        + '<div class="pc-lab">' + G + ' 은행 계좌 <span>가계약금 받을 계좌</span></div><div class="pc-g3">' + fld('은행', 'acct.bank', '예: 국민은행') + fld('계좌번호', 'acct.num', '123-456-789012') + fld('예금주', 'acct.holder', G + ' 본인 명의') + '</div>'
        + '<div class="pc-g3">' + fld('가계약 체결일', 'signDate', '', { type:'date' }) + '</div>'
        + '<div class="pc-lab">계약 당사자 <span>가계약서 특성상 비워 둘 수 있습니다 — 입력한 칸만 가계약서에 나오고, 한 사람 칸을 모두 비우면 그 사람 칸은 통째로 빠집니다</span></div>'
        + [['g', G], ['e', E]].map(function(x){ return '<div class="pc-party"><div class="pc-row"><b>' + x[1] + '</b><span class="sp"></span><button class="pc-btn sm" data-cust="' + x[0] + '">👥 고객에서</button><button class="pc-btn sm" data-clr="' + x[0] + '">비우기</button></div><div class="pc-g4">' + fld('성명', 'parties.' + x[0] + '.name', '') + fld('생년월일', 'parties.' + x[0] + '.birth', '예: 1975-03-12') + fld('연락처', 'parties.' + x[0] + '.tel', '010-0000-0000') + fld('주소', 'parties.' + x[0] + '.addr', '') + '</div></div>'; }).join('')
        + '<div id="pc-custsel"></div>'
        + '<div class="pc-lab">개업공인중개사 <span>2곳까지 · 두 번째(공동중개)는 비우면 빠집니다</span></div>'
        + [0, 1].map(function(i){ return '<div class="pc-party"><div class="pc-row"><b>' + (i ? '공동중개 사무소' : '우리 사무소') + '</b><span class="sp"></span>' + (i ? '<button class="pc-btn sm" data-brk="1">🤝 중개업소 목록에서</button><button class="pc-btn sm" data-bclr="1">비우기</button>' : '<button class="pc-btn sm" data-bme="0">사무소 정보로</button>') + '</div><div class="pc-g4">' + fld('사무소 명칭', 'brokers.' + i + '.name', '') + fld('대표 공인중개사', 'brokers.' + i + '.ceo', '') + fld('등록번호', 'brokers.' + i + '.regno', '') + fld('전화', 'brokers.' + i + '.tel', '') + fld('소재지', 'brokers.' + i + '.addr', '', { w:'s3' }) + fld('담당 휴대폰', 'brokers.' + i + '.mobile', '') + '</div></div>'; }).join('')
        + '<div id="pc-brksel"></div>'
        + (b2 ? '' : ''); }
    return '<div class="pc-h2">⑧ 미리보기 · 저장</div><p class="pc-sub">아래 미리보기를 확인하고 저장·인쇄·PDF·JPEG 로 내세요. 고칠 곳은 위 단계를 눌러 고치면 됩니다.</p>'
      + '<div class="pc-row"><button class="pc-btn pri" id="pc-done">💾 저장 (완료로 표시)</button><button class="pc-btn" id="pc-print">🖨 인쇄</button><button class="pc-btn" id="pc-pdf">📄 PDF 저장</button><button class="pc-btn" id="pc-jpg">🖼 JPEG 저장</button><span class="sp"></span><span id="pc-outst" class="pc-note" style="margin:0"></span></div>'
      + '<iframe id="pc-pv" class="pc-pv" title="가계약서 미리보기"></iframe>';
  }
  function priceSum(){
    var el = $('pc-sum'); if(!el) return; calcBal(D); var p = D.price, mid = (p.mids || []).reduce(function(a, m){ return a + (+m.amt || 0); }, 0), tot = (+p.down || 0) + mid + (+p.bal || 0);
    var bi = ROOT.querySelector('[data-m="price.bal"]'); if(bi && p.autoBal){ bi.value = p.bal ? comma(p.bal) : ''; var k = ROOT.querySelector('[data-mk="price.bal"]'); if(k) k.textContent = p.bal ? manwon(p.bal) : ''; }
    var warn = []; if(p.pre > p.down && p.down) warn.push('가계약금이 계약금보다 큽니다'); if(!p.autoBal && p.total && tot !== +p.total) warn.push('계약금+중도금+잔금(' + manwon(tot) + ')이 총액과 다릅니다');
    el.innerHTML = '<b>' + (rent() ? '보증금' : '매매대금') + ' ' + (manwon(p.total) || '—') + '</b>' + (D.deal === '월세' && p.monthly ? ' · 월 ' + manwon(p.monthly) : '') + ' = 계약금 ' + (manwon(p.down) || '0원') + (mid ? ' + 중도금 ' + manwon(mid) : '') + ' + 잔금 ' + (manwon(p.bal) || '0원') + (p.pre ? '<br>오늘 가계약금 <b>' + manwon(p.pre) + '</b> · 본 계약 시 나머지 계약금 ' + manwon(Math.max(0, p.down - p.pre)) : '') + (warn.length ? '<div class="pc-warn">⚠ ' + warn.join(' · ') + '</div>' : '');
  }
  /* ── ⑤⑥ 조건 ── */
  function termStep(k){
    initTerms(D, k); var sel = D[k], ids = sel.map(function(x){ return x.id; }), all = TERMS[k], show = SHOWALL[k] ? all : all.filter(function(t){ return fits(t, D) || ids.indexOf(t.id) >= 0; });
    var extra = k === 'basic' ? D.extraBasic : D.extraSpecial;
    return '<div class="pc-h2">' + (k === 'basic' ? '⑤ 기본 조건 <small>가계약에 공통으로 들어가는 내용</small>' : '⑥ 특약 조건 <small>이 계약에만 따로 붙이는 조건</small>') + '</div>'
      + '<p class="pc-sub">☑ 를 한 조건만 가계약서에 들어갑니다. 목록의 조건은 사무실 공용으로 저장되어 다음 가계약서에도 나오며, <b>＋ 조건 추가 · ✎ 수정 · 🗑 삭제</b>로 사무실 양식을 만들어 가세요. 글 안의 <code>{갑}</code>은 ' + gap() + ', <code>{을}</code>은 ' + eul() + '으로 바뀝니다. ' + (k === 'special' ? '○○ 칸은 이 가계약서의 「이 계약에만」 칸에 고쳐 쓰세요.' : '') + '</p>'
      + '<div class="pc-row"><label class="pc-ck"><input type="checkbox" id="pc-showall"' + (SHOWALL[k] ? ' checked' : '') + '> 다른 거래·물건용 조건도 보기</label><span class="sp"></span><button class="pc-btn sm" id="pc-tadd">＋ 조건 추가 (목록에)</button></div>'
      + '<div class="pc-terms">' + show.map(function(t){ var on = ids.indexOf(t.id) >= 0, ed = EDIT && EDIT.id === t.id;
          if(ed) return termEditor(t);
          return '<div class="pc-term' + (on ? ' on' : '') + (fits(t, D) ? '' : ' off') + '"><label><input type="checkbox" data-tsel="' + t.id + '"' + (on ? ' checked' : '') + '><span>' + esc(sub(t.text)) + '</span></label><div class="pc-tb">' + scopeTag(t) + '<button class="pc-btn xs" data-tup="' + t.id + '" title="위로">↑</button><button class="pc-btn xs" data-tdn="' + t.id + '" title="아래로">↓</button><button class="pc-btn xs" data-ted="' + t.id + '">✎ 수정</button><button class="pc-btn xs x" data-tdel="' + t.id + '">🗑</button></div></div>'; }).join('')
      + (EDIT && EDIT.id === 'new' ? termEditor(EDIT) : '') + (show.length ? '' : '<div class="pc-empty">이 거래·물건에 맞는 조건이 아직 없습니다. 「＋ 조건 추가」로 만들어 주세요.</div>') + '</div>'
      + '<div class="pc-lab" style="margin-top:14px">이 계약에만 쓰는 ' + (k === 'basic' ? '기본 조건' : '특약') + ' <span>목록에 저장하지 않고 이 가계약서에만 들어갑니다</span></div>'
      + extra.map(function(x, i){ return '<div class="pc-row"><textarea class="pc-in" data-ex="' + i + '" rows="2" style="flex:1">' + esc(x) + '</textarea><button class="pc-btn sm x" data-exx="' + i + '">빼기</button></div>'; }).join('')
      + '<button class="pc-btn sm" id="pc-exadd">＋ 이 계약에만 쓰는 ' + (k === 'basic' ? '조건' : '특약') + ' 추가</button>'
      + '<div class="pc-note">📌 조건 글은 참고용 예시입니다. 실제 거래에 맞게 고치고, 필요하면 전문가 검토를 받으세요.</div>';
  }
  function scopeTag(t){ var a = (t.d && t.d.length ? t.d.join('·') : '모든 거래') + ' / ' + (t.t && t.t.length ? t.t.map(ptN).map(function(s){ return s.replace('생활형숙박시설(생숙)', '생숙'); }).join('·') : '모든 물건'); return '<span class="pc-scope">' + esc(a) + (t.on ? ' · 기본 선택' : '') + '</span>'; }
  function termEditor(t){
    var isNew = t.id === 'new';
    return '<div class="pc-term ed"><textarea class="pc-in" id="pc-ttext" rows="3" placeholder="조건 글 — {갑} 매도인·임대인, {을} 매수인·임차인, {본계약일}, {잔금일} 을 쓸 수 있습니다">' + esc(t.text || '') + '</textarea>'
      + '<div class="pc-row" style="flex-wrap:wrap"><span class="pc-lab" style="margin:0">거래</span>' + DEALS.map(function(x){ return '<label class="pc-ck"><input type="checkbox" data-ed="' + x + '"' + ((t.d || []).indexOf(x) >= 0 ? ' checked' : '') + '> ' + x + '</label>'; }).join('') + '<span class="pc-note" style="margin:0">(아무것도 안 고르면 모든 거래)</span></div>'
      + '<div class="pc-row" style="flex-wrap:wrap"><span class="pc-lab" style="margin:0">물건</span>' + PT.map(function(p){ return '<label class="pc-ck"><input type="checkbox" data-et="' + p[0] + '"' + ((t.t || []).indexOf(p[0]) >= 0 ? ' checked' : '') + '> ' + p[1] + '</label>'; }).join('') + '<span class="pc-note" style="margin:0">(아무것도 안 고르면 모든 물건)</span></div>'
      + '<div class="pc-row"><label class="pc-ck"><input type="checkbox" id="pc-ton"' + (t.on ? ' checked' : '') + '> 새 가계약서에 처음부터 골라 두기</label><span class="sp"></span><button class="pc-btn sm" id="pc-tcancel">취소</button><button class="pc-btn sm pri" id="pc-tsave">' + (isNew ? '목록에 추가' : '수정 저장') + '</button></div></div>';
  }
  function bindTerms(k){
    var sel = D[k], extraK = k === 'basic' ? 'extraBasic' : 'extraSpecial';
    var sa = $('pc-showall'); if(sa) sa.onchange = function(){ SHOWALL[k] = this.checked; render(); };
    $('pc-tadd').onclick = function(){ EDIT = { id:'new', text:'', d:[D.deal], t:[D.ptype], on:k === 'basic' }; render(); var t = $('pc-ttext'); if(t) t.focus(); };
    qa('[data-tsel]').forEach(function(c){ c.onchange = function(){ var t = TERMS[k].find(function(x){ return x.id === c.dataset.tsel; }); if(!t) return; if(this.checked){ if(!sel.some(function(x){ return x.id === t.id; })) sel.push({ id:t.id, text:t.text }); D[k] = TERMS[k].filter(function(x){ return sel.some(function(y){ return y.id === x.id; }); }).map(function(x){ var o = sel.find(function(y){ return y.id === x.id; }); return { id:x.id, text:o.text }; }).concat(sel.filter(function(y){ return !TERMS[k].some(function(x){ return x.id === y.id; }); })); } else D[k] = sel.filter(function(x){ return x.id !== t.id; }); dirty(); render(); }; });
    var mv = function(id, dlt){ var L = TERMS[k], i = L.findIndex(function(x){ return x.id === id; }), j = i + dlt; if(i < 0 || j < 0 || j >= L.length) return; var t = L[i]; L[i] = L[j]; L[j] = t; D[k] = L.filter(function(x){ return D[k].some(function(y){ return y.id === x.id; }); }).map(function(x){ return { id:x.id, text:D[k].find(function(y){ return y.id === x.id; }).text }; }); saveTerms(); render(); };
    qa('[data-tup]').forEach(function(b){ b.onclick = function(){ mv(b.dataset.tup, -1); }; });
    qa('[data-tdn]').forEach(function(b){ b.onclick = function(){ mv(b.dataset.tdn, 1); }; });
    qa('[data-ted]').forEach(function(b){ b.onclick = function(){ EDIT = JSON.parse(JSON.stringify(TERMS[k].find(function(x){ return x.id === b.dataset.ted; }))); render(); }; });
    qa('[data-tdel]').forEach(function(b){ b.onclick = function(){ var t = TERMS[k].find(function(x){ return x.id === b.dataset.tdel; }); if(!t || !confirm('이 조건을 목록에서 지울까요?\n\n' + sub(t.text) + '\n\n(이미 저장한 가계약서에는 그대로 남습니다)')) return; TERMS[k] = TERMS[k].filter(function(x){ return x.id !== t.id; }); D[k] = D[k].filter(function(x){ return x.id !== t.id; }); saveTerms(); render(); }; });
    var ts = $('pc-tsave'); if(ts) ts.onclick = function(){
      var text = nv($('pc-ttext').value); if(!text) return toast('조건 글을 적어 주세요', true);
      var d = qa('[data-ed]').filter(function(c){ return c.checked; }).map(function(c){ return c.dataset.ed; }), t = qa('[data-et]').filter(function(c){ return c.checked; }).map(function(c){ return c.dataset.et; }), on = $('pc-ton').checked;
      if(EDIT.id === 'new'){ var n = { id:uid('t'), text:text, d:d, t:t, on:on }; TERMS[k].push(n); D[k].push({ id:n.id, text:n.text }); }
      else { var o = TERMS[k].find(function(x){ return x.id === EDIT.id; }); if(o){ o.text = text; o.d = d; o.t = t; o.on = on; var s = D[k].find(function(x){ return x.id === o.id; }); if(s) s.text = text; } }
      EDIT = null; dirty(); saveTerms(); render();
    };
    var tc = $('pc-tcancel'); if(tc) tc.onclick = function(){ EDIT = null; render(); };
    qa('[data-ex]').forEach(function(t){ t.oninput = function(){ D[extraK][+t.dataset.ex] = t.value; dirty(); }; });
    qa('[data-exx]').forEach(function(b){ b.onclick = function(){ D[extraK].splice(+b.dataset.exx, 1); dirty(); render(); }; });
    $('pc-exadd').onclick = function(){ D[extraK].push(''); dirty(); render(); var L = qa('[data-ex]'); if(L.length) L[L.length - 1].focus(); };
  }
  function bindStep(){
    bindInputs();
    if(STEP === 'type'){
      qa('[data-deal]').forEach(function(b){ b.onclick = function(){ if(D.deal !== b.dataset.deal){ D.deal = b.dataset.deal; D.basic = null; dirty(); } render(); }; });
      qa('[data-pt]').forEach(function(b){ b.onclick = function(){ if(D.ptype !== b.dataset.pt){ D.ptype = b.dataset.pt; if(BUN[D.ptype]) D.deal = '매매'; D.basic = null; dirty(); } render(); }; });
    }
    if(STEP === 'prop') $('pc-fromprop').onclick = propPicker;
    if(STEP === 'price'){
      priceSum();
      $('pc-10').onclick = function(){ if(!D.price.total) return toast('총액을 먼저 넣어 주세요', true); D.price.down = Math.round(D.price.total * 0.1 / 1e4) * 1e4; dirty(); render(); };
      var ma = $('pc-madd'); if(ma) ma.onclick = function(){ D.price.mids.push({ amt:0, date:'' }); dirty(); render(); };
      qa('[data-mx]').forEach(function(b){ b.onclick = function(){ D.price.mids.splice(+b.dataset.mx, 1); dirty(); render(); }; });
      $('pc-autobal').onchange = function(){ D.price.autoBal = this.checked; dirty(); render(); };
    }
    if(STEP === 'basic' || STEP === 'special') bindTerms(STEP);
    if(STEP === 'people'){
      qa('[data-clr]').forEach(function(b){ b.onclick = function(){ D.parties[b.dataset.clr] = { name:'', birth:'', tel:'', addr:'' }; dirty(); render(); }; });
      qa('[data-cust]').forEach(function(b){ b.onclick = function(){ custPicker(b.dataset.cust); }; });
      qa('[data-bclr]').forEach(function(b){ b.onclick = function(){ D.brokers[1] = { name:'', ceo:'', regno:'', addr:'', tel:'', mobile:'' }; dirty(); render(); }; });
      qa('[data-bme]').forEach(function(b){ b.onclick = function(){ D.brokers[0] = office1(); dirty(); render(); }; });
      qa('[data-brk]').forEach(function(b){ b.onclick = brkPicker; });
    }
    if(STEP === 'done'){
      var f = $('pc-pv'); f.srcdoc = docHtml(D); f.onload = function(){ try{ f.style.height = (f.contentDocument.documentElement.scrollHeight + 10) + 'px'; }catch(e){} };
      $('pc-done').onclick = function(){ doSave(true); };
      $('pc-print').onclick = function(){ printDoc(D); };
      $('pc-pdf').onclick = function(){ exportDoc(D, 'pdf'); };
      $('pc-jpg').onclick = function(){ exportDoc(D, 'jpg'); };
    }
  }
  /* ── 불러오기 — 매물 · 고객 · 중개업소 ── */
  function picker(boxId, items, label, onPick){
    var box = $(boxId); if(!box) return;
    box.innerHTML = '<div class="pc-pick"><div class="pc-row"><input class="pc-in" id="pc-pq" placeholder="🔎 ' + esc(label) + ' 찾기" style="flex:1"><button class="pc-btn sm" id="pc-px">닫기</button></div><div class="pc-plist" id="pc-pl"></div></div>';
    var paint = function(q){ var L = items.filter(function(x){ return !q || x.s.indexOf(q) >= 0; }).slice(0, 80); $('pc-pl').innerHTML = L.length ? L.map(function(x, i){ return '<button data-pi="' + items.indexOf(x) + '"><b>' + esc(x.t) + '</b><small>' + esc(x.d || '') + '</small></button>'; }).join('') : '<div class="pc-empty">없습니다</div>'; Array.prototype.slice.call(box.querySelectorAll('[data-pi]')).forEach(function(b){ b.onclick = function(){ onPick(items[+b.dataset.pi].v); box.innerHTML = ''; }; }); };
    paint(''); $('pc-pq').oninput = function(){ paint(this.value.trim()); }; $('pc-px').onclick = function(){ box.innerHTML = ''; }; $('pc-pq').focus();
  }
  function propPicker(){
    var go2 = function(){ var items = (PROPS || []).map(function(p){ return { t:(p.complexName || '') + (p.unitInfo ? ' ' + p.unitInfo : ''), d:[p.propertyType, p.status, p.pm, p.areaInfo].filter(Boolean).join(' · '), s:[p.complexName, p.unitInfo, p.propertyType].join(' '), v:p }; }).sort(function(a, b){ return (b.v.status === '활성') - (a.v.status === '활성'); });
      if(!items.length) return toast('매물관리에 매물이 없습니다', true); picker('pc-propsel', items, '매물', fillProp); };
    if(PROPS) return go2(); sget('sd_props').then(function(v){ PROPS = Array.isArray(v) ? v : []; go2(); });
  }
  function nk(s){ return String(s || '').replace(/[\s()·,.\-]/g, '').replace(/아파트$/, '').toLowerCase(); }
  function fillProp(p){
    var P0 = D.prop, t = String(p.propertyType || '');
    P0.src = 'props'; P0.propId = p.id || ''; P0.name = p.complexName || P0.name;
    /* 동·호 — 「401동 1203호」「B동 105호」「401-1203」「105호」 */
    var u = String(p.unitInfo || '').trim(), m1 = /^(.*?)\s*동\s*(.*?)\s*호?$/.exec(u), m2 = /^([0-9A-Za-z가-힣]+)\s*-\s*([0-9A-Za-z]+)$/.exec(u);
    if(m1 && m1[1]){ P0.dong = m1[1].trim(); P0.ho = m1[2].replace(/호$/, '').trim(); } else if(m2){ P0.dong = m2[1]; P0.ho = m2[2]; } else if(u){ var ps = u.split(/\s+/); if(ps.length > 1){ P0.dong = ps[0].replace(/동$/, ''); P0.ho = ps[1].replace(/호$/, ''); } else { P0.dong = ''; P0.ho = u.replace(/호$/, ''); } }
    var a = String(p.areaInfo || ''), am = /([\d.]+)\s*㎡?\s*[\/·]\s*([\d.]+)/.exec(a); if(am){ P0.supArea = am[1]; P0.exArea = am[2]; } else if(/[\d.]+/.test(a)) P0.exArea = (/[\d.]+/.exec(a) || [''])[0];
    if(p.floorInfo) P0.floor = p.floorInfo;
    if(/분양권/.test(t)) D.ptype = /상가/.test(t) ? 'sbun' : 'aptbun'; else if(/상가|사무실|분양상가/.test(t)) D.ptype = 'sangga'; else if(/오피스텔/.test(t)) D.ptype = 'op'; else if(/생숙|생활형/.test(t)) D.ptype = 'ss'; else if(/아파트/.test(t)) D.ptype = 'apt';
    if(/전세/.test(t)) D.deal = '전세'; else if(/월세|임대/.test(t)) D.deal = '월세'; else if(/매매/.test(t)) D.deal = '매매';
    var toWon = function(v){ v = String(v || '').replace(/[,\s]/g, ''); if(!v) return 0; var n = 0, e = /([\d.]+)억/.exec(v); if(e){ n += parseFloat(e[1]) * 1e8; v = v.slice(v.indexOf('억') + 1); } var r = /([\d.]+)/.exec(v); if(r){ var x = parseFloat(r[1]); n += /원/.test(v) && !/만/.test(v) ? x : x * 1e4; } return Math.round(n); };
    if(D.deal === '월세'){ D.price.total = toWon(p.ps) || D.price.total; D.price.monthly = toWon(p.pm) || D.price.monthly; } else if(p.pm){ D.price.total = toWon(p.pm) || D.price.total; }
    D.basic = null; dirty();
    var done = function(){ render(); toast('매물에서 불러왔습니다 — 비거나 틀린 칸을 확인하세요'); };
    if(P0.addr) return done();
    var fin = function(){ var A = (DANJI && DANJI.apt) || {}, k = nk(P0.name), hit = Object.keys(A).map(function(c){ return A[c]; }).find(function(x){ return nk(x.n) === k; }) || Object.keys(A).map(function(c){ return A[c]; }).find(function(x){ var n = nk(x.n); return n && k && (n.indexOf(k) >= 0 || k.indexOf(n) >= 0); }); if(hit && hit.addr){ P0.addr = String(hit.addr).replace(new RegExp('\\s*' + String(hit.n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'), '').trim(); } done(); };
    if(DANJI) return fin(); fetch('sd_danji_info.json', { cache:'force-cache' }).then(function(r){ return r.json(); }).then(function(d){ DANJI = d; fin(); }, function(){ done(); });
  }
  function custPicker(side){
    var go2 = function(){ var items = (CUSTS || []).filter(function(c){ return c && c.name; }).map(function(c){ return { t:c.name, d:[c.tel1, c.type, c.memo && String(c.memo).slice(0, 30)].filter(Boolean).join(' · '), s:[c.name, c.tel1].join(' '), v:c }; });
      if(!items.length) return toast('고객관리에 고객이 없습니다', true); picker('pc-custsel', items, '고객', function(c){ var P1 = D.parties[side]; P1.name = c.name || ''; P1.tel = c.tel1 || c.tel || ''; if(c.addr) P1.addr = c.addr; if(c.birth) P1.birth = c.birth; dirty(); render(); }); };
    if(CUSTS) return go2(); sget('sd_custs').then(function(v){ CUSTS = Array.isArray(v) ? v : v ? Object.keys(v).map(function(k){ return v[k]; }) : []; go2(); });
  }
  function brkPicker(){
    var go2 = function(){ var items = (BRKS || []).filter(function(b){ return b && b.name && !b.closed; }).map(function(b){ return { t:b.name, d:[b.rep, b.tel || b.mobile, b.addr].filter(Boolean).join(' · '), s:[b.name, b.rep, b.addr].join(' '), v:b }; });
      if(!items.length) return toast('고객 → 중개업소 목록이 비어 있습니다', true); picker('pc-brksel', items, '중개업소', function(b){ D.brokers[1] = { name:b.name || '', ceo:b.rep || '', regno:b.regNo || '', addr:[b.addr, b.bldg].filter(Boolean).join(' '), tel:b.tel || '', mobile:b.mobile || '' }; dirty(); render(); }); };
    if(BRKS) return go2(); sget('sd_brokers').then(function(v){ BRKS = Array.isArray(v) ? v : v ? Object.keys(v).map(function(k){ return v[k]; }) : []; go2(); });
  }
  /* ── 조건 목록 관리 (목록 화면에서) ── */
  function termsModal(){
    var m = document.createElement('div'); m.className = 'pc-mask';
    var paint = function(){
      m.innerHTML = '<div class="pc-modal"><div class="pc-h">⚙ 기본·특약 조건 목록 <span class="sp"></span><button class="pc-btn sm" data-x>닫기</button></div><p class="pc-sub">조건마다 쓰는 거래·물건이 붙어 있습니다. 고치기·추가는 가계약서 작성 ⑤⑥ 단계에서 해도 같은 목록에 저장됩니다. <button class="pc-btn xs" data-reset>처음 예시 조건 다시 넣기</button></p>'
        + ['basic', 'special'].map(function(k){ return '<div class="pc-lab">' + (k === 'basic' ? '기본 조건' : '특약 조건') + ' <span>' + TERMS[k].length + '개</span></div>' + TERMS[k].map(function(t){ return '<div class="pc-term"><label><span>' + esc(t.text) + '</span></label><div class="pc-tb">' + scopeTag(t) + '<button class="pc-btn xs x" data-mdel="' + k + ':' + t.id + '">🗑</button></div></div>'; }).join(''); }).join('') + '</div>';
      m.querySelector('[data-x]').onclick = function(){ m.remove(); };
      m.querySelector('[data-reset]').onclick = function(){ if(!confirm('처음 예시 조건을 목록 끝에 다시 넣을까요? (지금 목록은 그대로 두고 더합니다)')) return; var s = seedTerms(); TERMS.basic = TERMS.basic.concat(s.basic.filter(function(x){ return !TERMS.basic.some(function(y){ return y.text === x.text; }); })); TERMS.special = TERMS.special.concat(s.special.filter(function(x){ return !TERMS.special.some(function(y){ return y.text === x.text; }); })); saveTerms(); paint(); };
      Array.prototype.slice.call(m.querySelectorAll('[data-mdel]')).forEach(function(b){ b.onclick = function(){ var a = b.dataset.mdel.split(':'); if(!confirm('이 조건을 목록에서 지울까요?')) return; TERMS[a[0]] = TERMS[a[0]].filter(function(x){ return x.id !== a[1]; }); saveTerms(); paint(); }; });
    };
    paint(); document.body.appendChild(m); m.onclick = function(e){ if(e.target === m) m.remove(); };
  }
  /* ═════════ 가계약서 문서 ═════════ */
  function rowsHtml(rows){ return rows.filter(function(r){ return nv(r[1]); }).map(function(r){ return '<tr class="pb"><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join(''); }
  function docHtml(d){
    calcBal(d); var R = rent(d), G = gap(d), E = eul(d), p = d.prop, pr = d.price, lg = window.sdLogo ? (window.sdLogo.src('contract_head') || window.sdLogo.src('brief_head')) : '', lgF = window.sdLogo ? window.sdLogo.src('doc_foot') : '';
    var sec = 0, H = function(t){ sec++; return '<h2 class="pb">' + sec + '. ' + t + '</h2>'; };
    var unit = [p.dong && p.dong + '동', p.ho && p.ho + '호'].filter(Boolean).join(' ');
    var prop = rowsHtml([['물건 종류', esc(ptN(d.ptype)) + ' · ' + esc(d.deal)], ['소재지', esc(p.addr)], [d.ptype === 'apt' || d.ptype === 'aptbun' ? '단지명' : '건물명', esc([p.name, unit].filter(Boolean).join(' '))], ['층', esc(p.floor)],
      ['면적', [p.exArea && '전용 ' + esc(p.exArea) + '㎡', p.supArea && (BUN[d.ptype] ? '계약 ' : '공급 ') + esc(p.supArea) + '㎡'].filter(Boolean).join(' · ')], ['용도·구조', esc(p.use)], ['분양가', p.bunPrice ? wonDoc(+p.bunPrice) : ''], ['프리미엄', p.premium ? wonDoc(+p.premium) : ''], ['옵션·확장', esc(p.option)], ['업종·현황', esc(p.biz)], ['비고', esc(p.memo).replace(/\n/g, '<br>')]]);
    var mids = (pr.mids || []).filter(function(m){ return +m.amt; });
    var price = rowsHtml([[R ? '보증금' : '매매대금', wonDoc(+pr.total)], ['월 차임', d.deal === '월세' && +pr.monthly ? wonDoc(+pr.monthly) + ' <span class="s">(매월 지급)</span>' : ''], ['관리비', R ? esc(pr.mgmt) : ''], ['부가가치세', esc(pr.vatNote)],
      ['계약금', +pr.down ? wonDoc(+pr.down) + (+pr.pre ? '<div class="s">그중 가계약금 ' + wonDoc(+pr.pre) + '은 가계약 체결일에 ' + G + ' 계좌로 지급하고, 나머지 ' + wonDoc(Math.max(0, pr.down - pr.pre)) + '은 본 계약 시 지급한다.</div>' : '') : (+pr.pre ? '가계약금 ' + wonDoc(+pr.pre) : '')]]
      .concat(mids.map(function(m, i){ return ['중도금' + (mids.length > 1 ? ' ' + (i + 1) + '차' : ''), wonDoc(+m.amt)]; })).concat([['잔금', wonDoc(+pr.bal)]]));
    var sched = rowsHtml([['본 계약서 작성일', esc(dk(d.sched.main))]].concat(mids.map(function(m, i){ return ['중도금' + (mids.length > 1 ? ' ' + (i + 1) + '차' : '') + ' 지급일', esc(dk(m.date))]; })).concat([['잔금 지급일', esc(dk(d.sched.bal))], [R ? '입주(인도)일' : '인도일', esc(dk(d.sched.handover))]]));
    var bl = (d.basic || []).map(function(x){ return x.text; }).concat(d.extraBasic || []).map(nv).filter(Boolean), sl = (d.special || []).map(function(x){ return x.text; }).concat(d.extraSpecial || []).map(nv).filter(Boolean);
    var list = function(L){ return '<ol class="cl">' + L.map(function(t){ return '<li class="pb">' + esc(sub(t, d)).replace(/\n/g, '<br>') + '</li>'; }).join('') + '</ol>'; };
    var acct = rowsHtml([['은행', esc(d.acct.bank)], ['계좌번호', esc(d.acct.num)], ['예금주', esc(d.acct.holder)]]);
    /* 당사자 — 입력한 칸만, 한 사람 칸이 모두 비면 그 사람은 빠진다 */
    var party = function(lab, x){ var r = [['성명', esc(x.name)], ['생년월일', esc(x.birth)], ['연락처', esc(x.tel)], ['주소', esc(x.addr)]].filter(function(y){ return nv(y[1]); }); if(!r.length) return ''; return '<table class="pt pb"><tr><th class="who" rowspan="' + r.length + '">' + lab + '</th>' + r.map(function(y, i){ return (i ? '<tr>' : '') + '<th>' + y[0] + '</th><td>' + y[1] + '</td>' + (i === 0 ? '<td class="sg" rowspan="' + r.length + '">(서명 또는 인)</td>' : '') + '</tr>'; }).join('') + '</table>'; };
    var parties = party(G, d.parties.g) + party(E, d.parties.e);
    var brk = function(lab, b){ var r = [['사무소 명칭', esc(b.name)], ['대표 공인중개사', esc(b.ceo)], ['등록번호', esc(b.regno)], ['소재지', esc(b.addr)], ['전화', esc([b.tel, b.mobile].filter(Boolean).join(' · '))]].filter(function(y){ return nv(y[1]); }); if(!r.length) return ''; return '<table class="pt pb"><tr><th class="who" rowspan="' + r.length + '">' + lab + '</th>' + r.map(function(y, i){ return (i ? '<tr>' : '') + '<th>' + y[0] + '</th><td>' + y[1] + '</td>' + (i === 0 ? '<td class="sg" rowspan="' + r.length + '">(서명 또는 인)</td>' : '') + '</tr>'; }).join('') + '</table>'; };
    var b1 = brk('중개사 1', d.brokers[0] || {}), b2 = brk('중개사 2', d.brokers[1] || {}), brokers = b1 && b2 ? b1 + b2 : (b1 || b2).replace(/>중개사 [12]</, '>중개사<');
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>가계약서 — ' + esc(title(d)) + '</title><style>'
      + '@page{size:A4 portrait;margin:14mm 13mm}*{box-sizing:border-box}body{margin:0;background:#eef0f4;font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1a1a2e;font-size:12.5px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.pg{width:794px;max-width:100%;margin:16px auto;background:#fff;padding:40px 44px 34px;box-shadow:0 4px 18px rgba(0,0,0,.08)}@media print{body{background:#fff}.pg{margin:0;width:auto;box-shadow:none;padding:0}}'
      + '.top{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:3px double #1a2744;padding-bottom:12px}.top img{height:46px;width:auto;max-width:220px;object-fit:contain}.top .no{font-size:10.5px;color:#868e96;text-align:right}'
      + 'h1{font-size:30px;letter-spacing:12px;text-align:center;margin:18px 0 4px;color:#1a2744}.st{text-align:center;color:#495057;font-size:13px;margin-bottom:18px}'
      + 'h2{font-size:14px;color:#1a2744;margin:18px 0 6px;padding-left:9px;border-left:4px solid #1a2744}'
      + 'table{width:100%;border-collapse:collapse}.kv th{width:128px;background:#f3f5f9;color:#3d4560;font-weight:700;text-align:left;padding:7px 10px;border:1px solid #d6dbe6;font-size:12px;vertical-align:top}.kv td{padding:7px 10px;border:1px solid #d6dbe6}'
      + '.w{color:#6b7280;font-size:11.5px}.s{font-size:11.5px;color:#495057;margin-top:3px}'
      + 'ol.cl{margin:0;padding:0 0 0 22px}ol.cl li{padding:4px 0 4px 2px;border-bottom:1px dashed #e3e6ee}'
      + '.pt{margin-bottom:8px}.pt th,.pt td{border:1px solid #d6dbe6;padding:7px 10px;font-size:12px;text-align:left}.pt th{background:#f3f5f9;width:110px;color:#3d4560}.pt th.who{width:78px;text-align:center;background:#1a2744;color:#fff;letter-spacing:1px;word-break:keep-all}.pt td.sg{width:120px;text-align:center;color:#adb5bd;font-size:11px}.pt td.gapr{display:none}'
      + '.date{text-align:center;font-size:16px;font-weight:700;margin:6px 0 2px;letter-spacing:1px}'
      + '.foot{margin-top:18px;border-top:1px solid #d6dbe6;padding-top:8px;font-size:10.5px;color:#868e96;display:flex;justify-content:space-between;align-items:center;gap:12px}.foot img{height:26px;width:auto;max-width:180px;object-fit:contain}'
      + '</style></head><body><div class="pg">'
      + '<div class="top pb">' + (lg ? '<img src="' + lg + '" alt="로고">' : '<b style="font-size:15px;color:#1a2744">' + esc((d.brokers[0] || {}).name || '') + '</b>') + '<div class="no">' + esc(d.no || '') + '<br>작성 ' + esc(dk(d.signDate || today())) + '</div></div>'
      + '<h1 class="pb">가 계 약 서</h1><div class="st pb">' + esc(ptN(d.ptype)) + ' ' + esc(d.deal) + ' — ' + esc(title(d)) + '</div>'
      + (prop ? H('물건의 표시') + '<table class="kv">' + prop + '</table>' : '')
      + (price ? H('거래 금액') + '<table class="kv">' + price + '</table>' : '')
      + (sched ? H('일정') + '<table class="kv">' + sched + '</table>' : '')
      + (bl.length ? H('기본 조건') + list(bl) : '')
      + (sl.length ? H('특약 조건') + list(sl) : '')
      + (acct ? H(G + ' 계좌') + '<table class="kv">' + acct + '</table>' : '')
      + H('가계약 체결일') + '<div class="date pb">' + esc(dk(d.signDate || today()).replace(/ \(.\)$/, '')) + '</div>'
      + (parties ? H('계약 당사자') + parties : '')
      + (brokers ? H('개업공인중개사') + brokers : '')
      + '<div class="foot pb"><span>본 가계약서는 본 계약 체결 전 거래 조건을 확인하기 위한 문서이며, 위 내용을 확인하고 각자 서명(날인)합니다.</span>' + (lgF ? '<img src="' + lgF + '" alt="로고">' : '') + '</div>'
      + '</div></body></html>';
  }
  /* ── 인쇄 · PDF · JPEG ── */
  function fname(d, ext){ var t = String(d.signDate || today()).replace(/-/g, ''); return ('가계약서_' + d.deal + '_' + title(d) + (d.parties.e.name ? '_' + d.parties.e.name : '') + '_' + t).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_') + '.' + ext; }
  function printDoc(d){ var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f); f.onload = function(){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ toast('인쇄 창을 열지 못했습니다 — PDF 로 저장해 인쇄해 주세요', true); } setTimeout(function(){ f.remove(); }, 60000); }; f.srcdoc = docHtml(d); }
  function loadJs(u){ return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = function(){ rej(new Error('도구를 불러오지 못했습니다: ' + u)); }; document.head.appendChild(s); }); }
  function libs(pdf){ var a = []; if(!window.html2canvas) a.push(loadJs('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')); if(pdf && !(window.jspdf && window.jspdf.jsPDF)) a.push(loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')); return Promise.all(a); }
  function exportDoc(d, kind){
    var st = $('pc-outst'), say = function(t){ if(st) st.textContent = t; };
    say('⏳ 만드는 중…');
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0'; document.body.appendChild(f);
    return libs(kind === 'pdf').then(function(){ return new Promise(function(res){ f.onload = res; f.srcdoc = docHtml(d); }); }).then(function(){
      var doc = f.contentDocument, pg = doc.querySelector('.pg'); pg.style.margin = '0'; pg.style.boxShadow = 'none'; doc.body.style.background = '#fff';
      return (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(function(){ return window.html2canvas(pg, { scale:2, backgroundColor:'#ffffff', useCORS:true, logging:false, windowWidth:794 }); }).then(function(cv){
        if(kind === 'jpg'){ return new Promise(function(r){ cv.toBlob(r, 'image/jpeg', 0.92); }).then(function(b){ save(b, fname(d, 'jpg')); }); }
        /* PDF — 표 줄·조건 사이에서 쪽을 나눈다 (글줄이 잘리지 않게) */
        var k = cv.width / pg.offsetWidth, pageH = Math.floor(pg.offsetWidth * 297 / 210), top0 = pg.getBoundingClientRect().top;
        var cuts = Array.prototype.slice.call(pg.querySelectorAll('.pb, tr')).map(function(el){ var r = el.getBoundingClientRect(); return { t:r.top - top0, b:r.bottom - top0 }; });
        var pages = [], y = 0, H = pg.offsetHeight;
        while(y < H - 2){ var lim = y + pageH, best = lim; if(lim < H){ var ok = cuts.filter(function(c){ return c.t > y + 40 && c.t <= lim; }).map(function(c){ return c.t; }); if(ok.length) best = Math.max.apply(null, ok); } else best = H; pages.push([y, best]); y = best; }
        var P = new window.jspdf.jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
        pages.forEach(function(pp, i){ var h = Math.ceil((pp[1] - pp[0]) * k), c = document.createElement('canvas'); c.width = cv.width; c.height = Math.max(1, h); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(cv, 0, Math.floor(pp[0] * k), cv.width, h, 0, 0, cv.width, h); if(i) P.addPage(); P.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 210 * h / cv.width); });
        save(P.output('blob'), fname(d, 'pdf'));
      });
    }).then(function(){ say('✅ 저장했습니다 (다운로드 폴더)'); f.remove(); }, function(e){ say(''); f.remove(); toast((e && e.message) || String(e), true); });
  }
  function save(b, name){ var u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(u); }, 3000); }
  /* ── 스타일 ── */
  var CSS = '.pc{max-width:1100px;margin:0 auto;font-size:13px;color:#1f2937}.pc .sp{flex:1}.pc-card{background:#fff;border:0.5px solid #e0e0e0;border-radius:12px;padding:16px 18px;margin-bottom:12px}'
    + '.pc-h{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700;flex-wrap:wrap}.pc-h small{font-size:12px;font-weight:400;color:#868e96}.pc-h2{font-size:15px;font-weight:700;margin:0 0 4px}.pc-h2 small{font-size:12px;font-weight:400;color:#868e96;margin-left:6px}'
    + '.pc-sub{font-size:12.5px;color:#6b7280;line-height:1.65;margin:4px 0 12px}.pc-sub code{background:#f1f3f5;border-radius:4px;padding:0 4px}.pc-note{font-size:12px;color:#5c3d00;background:#fff9db;border:1px solid #ffe8a1;border-radius:8px;padding:8px 10px;margin:10px 0;line-height:1.6}.pc-warn{color:#c92a2a;margin-top:4px}'
    + '.pc-row{display:flex;gap:8px;align-items:center;margin:6px 0}.pc-btn{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:inherit;color:#1f2937;white-space:nowrap}.pc-btn:hover{border-color:#1a2744}.pc-btn.pri{background:#1a2744;border-color:#1a2744;color:#fff;font-weight:700}.pc-btn.sm{padding:5px 10px;font-size:12px}.pc-btn.xs{padding:2px 7px;font-size:11px;border-radius:6px}.pc-btn.x{color:#c92a2a;border-color:#ffc9c9}.pc-btn:disabled{opacity:.4;cursor:not-allowed}'
    + '.pc-in{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d0d5dd;border-radius:8px;font-size:13px;font-family:inherit;background:#fff}textarea.pc-in{resize:vertical;line-height:1.55}.pc-in[readonly]{background:#f8f9fa;color:#495057}'
    + '.pc-f label{display:block;font-size:12px;font-weight:600;color:#495057;margin-bottom:4px}.pc-f label span{font-weight:400;color:#adb5bd;font-size:11px}.pc-f{margin-bottom:10px;min-width:0}.pc-g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.pc-g4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.s2{grid-column:span 2}.s3{grid-column:span 3}'
    + '.pc-mn{position:relative}.pc-mn em{display:block;font-style:normal;font-size:11.5px;color:#1971c2;margin-top:3px;min-height:15px}'
    + '.pc-lab{font-size:12.5px;font-weight:700;color:#343a40;margin:14px 0 8px}.pc-lab span{font-weight:400;color:#868e96;font-size:11.5px;margin-left:6px}.pc-ck{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;cursor:pointer;margin-right:8px}'
    + '.pc-steps{display:flex;gap:4px;margin-top:12px;overflow-x:auto}.pc-steps button{flex:1;min-width:92px;border:none;background:#f1f3f5;border-radius:8px;padding:8px 6px;font-size:12px;cursor:pointer;font-family:inherit;color:#495057;white-space:nowrap}.pc-steps button i{font-style:normal;display:inline-block;width:18px;height:18px;line-height:18px;border-radius:50%;background:#ced4da;color:#fff;font-size:11px;margin-right:4px}.pc-steps button.on{background:#1a2744;color:#fff;font-weight:700}.pc-steps button.on i{background:#fff;color:#1a2744}.pc-steps button.dn i{background:#2f9e44}'
    + '.pc-big{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:6px}.pc-big.six{grid-template-columns:repeat(3,minmax(0,1fr))}.pc-big button{border:1.5px solid #dee2e6;background:#fff;border-radius:12px;padding:14px;cursor:pointer;font-family:inherit;text-align:left;display:flex;align-items:center;gap:10px}.pc-big button span{font-size:24px}.pc-big button b{font-size:15px;display:block}.pc-big button small{font-size:11.5px;color:#868e96;display:block}.pc-big button.on{border-color:#1a2744;background:#edf2ff;box-shadow:0 2px 8px rgba(26,39,68,.12)}.pc-big button:disabled{opacity:.35;cursor:not-allowed}'
    + '.pc-sum{background:#f8f9fa;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.7;margin-top:10px}'
    + '.pc-terms{border:1px solid #e9ecef;border-radius:10px;overflow:hidden}.pc-term{padding:9px 12px;border-bottom:1px solid #f1f3f5;display:flex;flex-direction:column;gap:6px}.pc-term:last-child{border-bottom:none}.pc-term.on{background:#f4f8ff}.pc-term.off{opacity:.6}.pc-term label{display:flex;gap:9px;align-items:flex-start;cursor:pointer;line-height:1.6}.pc-term label input{margin-top:4px}.pc-term.ed{background:#fffbea}'
    + '.pc-tb{display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding-left:24px}.pc-scope{font-size:10.5px;color:#868e96;margin-right:auto}'
    + '.pc-party{border:1px solid #e9ecef;border-radius:10px;padding:8px 12px;margin-bottom:8px}.pc-pick{border:1px solid #d0d5dd;border-radius:10px;padding:8px;margin:8px 0;background:#fafbfc}.pc-plist{max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:4px}.pc-plist button{border:1px solid #e9ecef;background:#fff;border-radius:8px;padding:7px 10px;text-align:left;cursor:pointer;font-family:inherit}.pc-plist button small{display:block;color:#868e96;font-size:11px}'
    + '.pc-list{display:flex;flex-direction:column}.pc-li{display:flex;gap:10px;align-items:center;padding:10px 4px;border-bottom:1px solid #f1f3f5;flex-wrap:wrap}.pc-li .t{flex:1;min-width:240px}.pc-li .t b{font-size:14px;margin-right:6px}.pc-li .t small{display:block;color:#868e96;font-size:11.5px;margin-top:2px}.pc-li .b{display:flex;gap:4px;flex-wrap:wrap}.tag{font-size:11px;background:#edf2ff;color:#364fc7;border-radius:10px;padding:1px 8px;margin-right:4px}.tag.ok{background:#ebfbee;color:#2b8a3e}.tag.dr{background:#fff4e6;color:#d9480f}'
    + '.pc-empty{padding:24px;text-align:center;color:#adb5bd;font-size:12.5px}.pc-foot{display:flex;gap:8px;margin:0 0 20px}.pc-pv{width:100%;min-height:900px;border:1px solid #e9ecef;border-radius:10px;margin-top:10px;background:#eef0f4}'
    + '.pc-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px}.pc-modal{background:#fff;border-radius:14px;max-width:860px;width:100%;max-height:88vh;overflow:auto;padding:18px 20px}'
    + '.pc-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:8px;padding:9px 16px;font-size:13px}.pc-toast.bad{background:#ffebee;border-color:#ef9a9a}'
    + '@media(max-width:760px){.pc-g3,.pc-g4,.pc-big,.pc-big.six{grid-template-columns:1fr 1fr}.s2,.s3{grid-column:span 2}}';
  function css(){ if($('pc-css')) return; var s = document.createElement('style'); s.id = 'pc-css'; s.textContent = CSS; document.head.appendChild(s); }
  window.sdPre = {
    mount:function(root){ ROOT = root; css(); if(!ROOT.innerHTML) ROOT.innerHTML = '<div class="pc-empty">⏳ 가계약서를 불러오는 중…</div>'; return loadAll(VIEW === 'list').then(function(){ render(); }, function(e){ ROOT.innerHTML = '<div class="pc-empty">불러오지 못했습니다: ' + esc(e && e.message || e) + '</div>'; }); },
    /* 시험용 */
    _t:{ hangul:hangul, manwon:manwon, docHtml:function(){ return D ? docHtml(D) : ''; }, D:function(){ return D; }, list:function(){ return LIST; }, terms:function(){ return TERMS; }, go:go }
  };
})();
