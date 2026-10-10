/* ═════════════════════════════════════════════════════════════════
   📄 서식 (sd_tool.html → 도구 → 📄 서식 · window.sdForms)  2026-10-10
   · 부동산 업무용 기본 서식: 위임장 · 영수증 · 반환금 영수증 · 현금차용증 · 현금보관증 · 내용증명서 · 이행각서 · 확약서 · 합의서 · 동의서
   · 카테고리 안에서 기본 서식을 「복제」해 나만의 추가 서식(예: 매매계약 위임장, 전세계약 위임장)을 만들고 고치고 지운다
   · 작성 → 미리보기 → 🖨 인쇄 · 📄 PDF · 🖼 JPEG · 💾 작성 문서 보관
   · A4 1장 기준: 내용이 조금 넘치면 글자를 줄여(최소 75%) 한 장에 맞춘다. 그래도 넘치면(특별한 경우) 2쪽 이상으로 나뉜다
   · 저장: Firebase  sd_media/form_tpl/{id} = 추가 서식 { cat, name, body, at, by }
                     sd_media/form_doc/{id} = 작성 문서 { tid, cat, name, body, vals, opts, who, at, by }
                     sd_media/form_cfg      = { office:{ name, ceo, regno, addr, tel, mobile }, cats:[{ id, n, ic }] }
     (전자명함·로고와 같은 sd_media 규칙 — 새 규칙 필요 없음) · 이 브라우저(localStorage sd_forms_cache)에 사본
   · 서식 본문 쓰는 법: {빈칸 이름} · {빈칸=기본값} · {빈칸:금액|날짜|긴글|글|전화}
     줄 모양: # 제목 · ## 소제목 · | 항목 | {값} | 표 · ^^ 가운데 · >> 오른쪽 · ※ 안내 · 1. 번호 · --- 가로줄 · === 쪽 나눔 · **굵게** · (인)
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.sdForms) return;
  var CFG = {
    apiKey:'AIzaSyCMYoUBhRv_NkKeHmPqgXoqqXUjVsjEJPs', authDomain:'songdojeil-202604.firebaseapp.com',
    databaseURL:'https://songdojeil-202604-default-rtdb.asia-southeast1.firebasedatabase.app', projectId:'songdojeil-202604',
    storageBucket:'songdojeil-202604.firebasestorage.app', messagingSenderId:'567683904975', appId:'1:567683904975:web:65a652a8e7b9a81e034eba'
  };
  var FB = 'https://www.gstatic.com/firebasejs/9.23.0/';
  var RULE = '"sd_media": { ".read": "auth != null", ".write": "auth != null" }';
  var MINK = 0.75;   // 한 장 맞춤 — 글자를 이 이상 줄이지 않는다

  /* ── 작은 도구 ── */
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function me(){ try{ var s = JSON.parse(localStorage.getItem('sd_auth_session') || '{}') || {}; return s.name || s.email || ''; }catch(e){ return ''; } }
  function uid(p){ return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function dkr(s){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? m[1] + '년 ' + (+m[2]) + '월 ' + (+m[3]) + '일' : String(s || ''); }
  function ymd(t){ if(!t) return ''; var d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var R = null, toastT = 0;
  function toast(m, bad){ var t = document.getElementById('fm-toast'); if(!t){ t = document.createElement('div'); t.id = 'fm-toast'; document.body.appendChild(t); } t.className = 'fm-toast' + (bad ? ' bad' : ''); t.textContent = m; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(function(){ t.style.display = 'none'; }, bad ? 5000 : 2600); }

  /* ── 금액: "1억 5천만" · "15,000,000" → 숫자 → 「일금 일억오천만원정 (₩150,000,000)」 ── */
  function parseWon(s){
    s = String(s == null ? '' : s).replace(/[,\s₩원정]/g, '').replace(/^일금|^금/, '');
    if(!s) return NaN;
    if(/^\d+$/.test(s)) return +s;
    if(!/^[\d.천백십조억만]+$/.test(s)) return NaN;
    var tot = 0, pend = 0, re = /([\d.]+)(천|백|십)?(조|억|만)?/g, m, any = false;
    var SM = { '천':1000, '백':100, '십':10 }, BG = { '조':1e12, '억':1e8, '만':1e4 };
    while((m = re.exec(s))){ if(!m[0]) { re.lastIndex++; continue; } any = true; pend += parseFloat(m[1]) * (m[2] ? SM[m[2]] : 1); if(m[3]){ tot += pend * BG[m[3]]; pend = 0; } }
    return any ? Math.round(tot + pend) : NaN;
  }
  function hanNum(n){
    n = Math.floor(Math.abs(n)); if(!n) return '영';
    var D = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], S = ['', '십', '백', '천'], B = ['', '만', '억', '조', '경'], out = '', g = 0;
    while(n > 0){ var part = n % 10000, s = ''; for(var i = 0; i < 4; i++){ var d = Math.floor(part / Math.pow(10, i)) % 10; if(d) s = D[d] + S[i] + s; } if(s) out = s + B[g] + out; n = Math.floor(n / 10000); g++; }
    return out;
  }
  function wonTxt(v){ var n = parseWon(v); return isNaN(n) ? '' : '일금 ' + hanNum(n) + '원정 (₩' + n.toLocaleString('ko-KR') + ')'; }

  /* ── 카테고리 · 기본 서식 ── */
  var CATS = [
    ['wi', '위임장', '📝'], ['rc', '영수증', '🧾'], ['rf', '반환금 영수증', '💸'], ['loan', '현금차용증', '💰'], ['keep', '현금보관증', '🔐'],
    ['cert', '내용증명서', '📮'], ['pledge', '이행각서', '✍️'], ['conf', '확약서', '🤝'], ['agree', '합의서', '📃'], ['consent', '동의서', '✅']
  ];
  var BASE = [
    { id:'b_wi', cat:'wi', name:'위임장', body:[
      '# 위 임 장', '',
      '## 위임인 (본인)',
      '| 성명 | {위임인 성명} | 주민등록번호 | {위임인 주민등록번호} |',
      '| 주소 | {위임인 주소} |',
      '| 연락처 | {위임인 연락처} |', '',
      '## 수임인 (대리인)',
      '| 성명 | {수임인 성명} | 주민등록번호 | {수임인 주민등록번호} |',
      '| 주소 | {수임인 주소} |',
      '| 연락처 | {수임인 연락처} | 위임인과의 관계 | {위임인과의 관계} |', '',
      '## 위임 대상 부동산',
      '| 소재지 | {부동산 소재지} |',
      '| 거래 종류 | {거래 종류=매매 · 전세 · 월세} |', '',
      '## 위임 사항',
      '{위임 사항=위 부동산에 관한 계약의 체결, 계약금·중도금·잔금의 지급 및 수령, 계약서 서명·날인, 그 밖에 계약에 필요한 일체의 행위}', '',
      '위 위임인은 위 수임인을 대리인으로 정하고, 위 부동산에 관한 위 사항 일체의 권한을 위임합니다.',
      '※ 위임인의 인감증명서(또는 본인서명사실확인서)를 첨부합니다.', '',
      '^^ {작성일}', '',
      '>> 위임인  {위임인 성명}  (인)'
    ].join('\n') },
    { id:'b_rc', cat:'rc', name:'영수증', body:[
      '# 영 수 증', '',
      '^^ **{받은 금액}**', '',
      '| 영수 내용 | {영수 내용=부동산 계약금} |',
      '| 부동산 소재지 | {부동산 소재지} |',
      '| 지급인 | {지급인 성명} |',
      '| 받은 날짜 | {받은 날짜} |',
      '| 지급 방법 | {지급 방법=계좌이체} |', '',
      '위 금액을 정히 영수합니다.', '',
      '^^ {작성일}', '',
      '| 영수인 성명 | {영수인 성명}  (인) |',
      '| 주민등록번호 | {영수인 주민등록번호} |',
      '| 주소 | {영수인 주소} |',
      '| 연락처 | {영수인 연락처} |', '',
      '>> **{지급인 성명}  귀하**'
    ].join('\n') },
    { id:'b_rf', cat:'rf', name:'반환금 영수증', body:[
      '# 반 환 금  영 수 증', '',
      '^^ **{반환 금액}**', '',
      '| 반환 내용 | {반환 내용=임대차 보증금 반환} |',
      '| 부동산 소재지 | {부동산 소재지} |',
      '| 원 계약일 | {원 계약일} |',
      '| 반환한 사람 | {반환인 성명} |',
      '| 반환받은 날짜 | {반환일} |',
      '| 반환 방법 | {반환 방법=계좌이체} |',
      '| 비고 | {비고} |', '',
      '위 금액을 정히 반환받았음을 확인합니다.', '',
      '^^ {작성일}', '',
      '| 영수인 성명 | {영수인 성명}  (인) |',
      '| 주민등록번호 | {영수인 주민등록번호} |',
      '| 주소 | {영수인 주소} |',
      '| 연락처 | {영수인 연락처} |', '',
      '>> **{반환인 성명}  귀하**'
    ].join('\n') },
    { id:'b_loan', cat:'loan', name:'현금차용증', body:[
      '# 현 금 차 용 증', '',
      '^^ **{차용 금액}**', '',
      '| 채권자 (빌려준 사람) | {채권자 성명} | 연락처 | {채권자 연락처} |',
      '| 채권자 주소 | {채권자 주소} |',
      '| 채무자 (빌린 사람) | {채무자 성명} | 연락처 | {채무자 연락처} |',
      '| 채무자 주민등록번호 | {채무자 주민등록번호} |',
      '| 채무자 주소 | {채무자 주소} |', '',
      '## 차용 조건',
      '| 차용일 | {차용일} | 변제기한 | {변제기한} |',
      '| 이자 | {이자=없음} | 이자 지급일 | {이자 지급일=매월  일} |',
      '| 변제 방법 | {변제 방법=채권자 계좌로 이체} |',
      '| 입금 계좌 | {입금 계좌} |', '',
      '1. 채무자는 위 금액을 틀림없이 차용하였으며, 변제기한까지 채권자에게 원금과 이자를 변제합니다.',
      '2. 이자를 2회 이상 연체하거나 변제기한을 지키지 못한 때에는 기한의 이익을 잃고 남은 원리금 전부를 즉시 변제합니다.',
      '3. 변제기한이 지난 뒤에는 남은 원금에 대하여 연 {지연손해금 이율=12}%의 지연손해금을 지급합니다.',
      '4. 이 차용에 관한 분쟁은 채권자 주소지 관할 법원으로 합니다.',
      '※ 이자는 이자제한법상 최고 이자율(연 20%)을 넘을 수 없습니다.', '',
      '^^ {작성일}', '',
      '>> 채무자  {채무자 성명}  (인)',
      '>> 채권자  {채권자 성명}  (인)'
    ].join('\n') },
    { id:'b_keep', cat:'keep', name:'현금보관증', body:[
      '# 현 금 보 관 증', '',
      '^^ **{보관 금액}**', '',
      '| 보관 내용 | {보관 내용=부동산 거래 관련 금원 보관} |',
      '| 부동산 소재지 | {부동산 소재지} |',
      '| 맡긴 사람 | {맡긴 사람 성명} | 연락처 | {맡긴 사람 연락처} |',
      '| 보관 기간 | {보관 시작일}  ~  {반환 예정일} |',
      '| 반환 조건 | {반환 조건} |', '',
      '1. 보관인은 위 금액을 틀림없이 보관하며, 맡긴 사람의 요구가 있거나 반환 조건이 이루어지면 즉시 반환합니다.',
      '2. 보관인은 위 금액을 다른 용도로 쓰거나 처분하지 않습니다.', '',
      '^^ {작성일}', '',
      '| 보관인 성명 | {보관인 성명}  (인) |',
      '| 주민등록번호 | {보관인 주민등록번호} |',
      '| 주소 | {보관인 주소} |',
      '| 연락처 | {보관인 연락처} |', '',
      '>> **{맡긴 사람 성명}  귀하**'
    ].join('\n') },
    { id:'b_cert', cat:'cert', name:'내용증명서', body:[
      '# 내 용 증 명', '',
      '| 발신인 | {발신인 성명} | 연락처 | {발신인 연락처} |',
      '| 발신인 주소 | {발신인 주소} |',
      '| 수신인 | {수신인 성명} | 연락처 | {수신인 연락처} |',
      '| 수신인 주소 | {수신인 주소} |',
      '| 제목 | **{제목}** |', '',
      '## 1. 사실관계',
      '{사실관계}', '',
      '## 2. 요청 사항',
      '{요청 사항}', '',
      '## 3. 기한 및 조치',
      '{기한 및 조치=위 요청 사항을 이 서면을 받은 날부터 7일 이내에 이행하여 주시기 바랍니다. 기한 안에 이행되지 않으면 부득이 법적 절차를 진행할 수밖에 없음을 알려 드립니다.}', '',
      '^^ {작성일}', '',
      '>> 발신인  {발신인 성명}  (인)', '',
      '※ 내용증명은 같은 내용 3부(발신인·수신인·우체국 보관용)를 우체국에 제출합니다.'
    ].join('\n') },
    { id:'b_cert2', cat:'cert', name:'내용증명 (임대차 보증금 반환 청구)', body:[
      '# 내 용 증 명', '',
      '| 발신인 (임차인) | {발신인 성명} | 연락처 | {발신인 연락처} |',
      '| 발신인 주소 | {발신인 주소} |',
      '| 수신인 (임대인) | {수신인 성명} | 연락처 | {수신인 연락처} |',
      '| 수신인 주소 | {수신인 주소} |',
      '| 제목 | **임대차 보증금 반환 청구** |', '',
      '## 1. 임대차 계약 내용',
      '| 임대차 목적물 | {부동산 소재지} |',
      '| 보증금 | {보증금} |',
      '| 월 차임 | {월 차임} |',
      '| 임대차 기간 | {임대차 시작일}  ~  {임대차 종료일} |', '',
      '## 2. 요청 사항',
      '발신인은 위 임대차 계약이 {임대차 종료일}에 기간 만료로 끝남을 알려 드리며, 임차 목적물을 인도함과 동시에 위 보증금을 반환하여 주실 것을 요청합니다.',
      '| 반환받을 계좌 | {반환 계좌} |', '',
      '## 3. 알림',
      '보증금이 반환되지 않을 경우 주택임대차보호법에 따른 임차권등기명령 신청, 보증금 반환 청구 소송 등 법적 절차를 진행할 수밖에 없으며, 그에 따른 지연손해금과 비용을 청구할 것임을 알려 드립니다.', '',
      '^^ {작성일}', '',
      '>> 발신인  {발신인 성명}  (인)', '',
      '※ 내용증명은 같은 내용 3부(발신인·수신인·우체국 보관용)를 우체국에 제출합니다.'
    ].join('\n') },
    { id:'b_pledge', cat:'pledge', name:'이행각서', body:[
      '# 이 행 각 서', '',
      '| 각서인 | {각서인 성명} | 주민등록번호 | {각서인 주민등록번호} |',
      '| 주소 | {각서인 주소} |',
      '| 연락처 | {각서인 연락처} |',
      '| 받는 사람 | {상대방 성명} |',
      '| 관련 부동산 | {부동산 소재지} |', '',
      '## 이행할 내용',
      '{이행 내용}', '',
      '## 이행 기한',
      '{이행 기한}', '',
      '각서인은 위 내용을 위 기한까지 틀림없이 이행할 것을 약속하며, 이를 이행하지 않을 때에는 {불이행 시 책임=그로 인하여 상대방이 입은 손해를 배상하고, 민·형사상 어떠한 책임도 지겠습니다}.', '',
      '^^ {작성일}', '',
      '>> 각서인  {각서인 성명}  (인)', '',
      '>> **{상대방 성명}  귀하**'
    ].join('\n') },
    { id:'b_conf', cat:'conf', name:'확약서', body:[
      '# 확 약 서', '',
      '| 확약인 | {확약인 성명} | 연락처 | {확약인 연락처} |',
      '| 주소 | {확약인 주소} |',
      '| 상대방 | {상대방 성명} |',
      '| 관련 부동산 | {부동산 소재지} |', '',
      '## 확약 사항',
      '{확약 사항}', '',
      '확약인은 위 사항을 확인하고 성실히 지킬 것을 확약합니다.', '',
      '^^ {작성일}', '',
      '>> 확약인  {확약인 성명}  (인)', '',
      '>> **{상대방 성명}  귀하**'
    ].join('\n') },
    { id:'b_agree', cat:'agree', name:'합의서', body:[
      '# 합 의 서', '',
      '| 갑 | {갑 성명} | 연락처 | {갑 연락처} |',
      '| 갑 주소 | {갑 주소} |',
      '| 을 | {을 성명} | 연락처 | {을 연락처} |',
      '| 을 주소 | {을 주소} |',
      '| 관련 부동산 | {부동산 소재지} |', '',
      '갑과 을은 위 부동산에 관하여 다음과 같이 합의한다.', '',
      '## 합의 내용',
      '{합의 내용}', '',
      '1. 갑과 을은 이 합의로 위 사항에 관한 분쟁이 모두 끝났음을 확인하고, 앞으로 서로 민·형사상 이의를 제기하지 않는다.',
      '2. 이 합의서는 2부를 작성하여 갑과 을이 서명(날인)한 뒤 각 1부씩 보관한다.', '',
      '^^ {작성일}', '',
      '>> 갑  {갑 성명}  (인)',
      '>> 을  {을 성명}  (인)'
    ].join('\n') },
    { id:'b_consent', cat:'consent', name:'동의서', body:[
      '# 동 의 서', '',
      '| 동의인 | {동의인 성명} | 연락처 | {동의인 연락처} |',
      '| 주소 | {동의인 주소} |',
      '| 동의받는 사람 | {상대방 성명} |',
      '| 관련 부동산 | {부동산 소재지} |', '',
      '## 동의 내용',
      '{동의 내용}', '',
      '동의인은 위 내용을 충분히 이해하고 이에 동의합니다.', '',
      '^^ {작성일}', '',
      '>> 동의인  {동의인 성명}  (인)', '',
      '>> **{상대방 성명}  귀하**'
    ].join('\n') }
  ];
  var BLANK_BODY = ['# 제   목', '', '| 성명 | {성명} | 연락처 | {연락처} |', '| 주소 | {주소} |', '', '## 내용', '{내용}', '', '^^ {작성일}', '', '>> 성명  {성명}  (인)'].join('\n');
  var DEF_OFFICE = { name:'송도제일공인중개사사무소', ceo:'문형은', regno:'', addr:'인천광역시 연수구 해돋이로 168, 혜인프라자 1층 103호', tel:'032-851-6688', mobile:'' };
  var OFFMAP = { '사무소명':'name', '중개사무소':'name', '중개사무소명':'name', '대표자':'ceo', '대표 공인중개사':'ceo', '대표공인중개사':'ceo', '사무소 주소':'addr', '사무소 소재지':'addr', '사무소 전화':'tel', '등록번호':'regno', '사무소 휴대폰':'mobile' };

  /* ── 저장 (Firebase sd_media/form_* + 이 브라우저 사본) ── */
  var LK = 'sd_forms_cache';
  var C = (function(){ try{ return JSON.parse(localStorage.getItem(LK) || 'null') || {}; }catch(e){ return {}; } })();
  C.tpl = C.tpl || {}; C.doc = C.doc || {}; C.cfg = C.cfg || {};
  function cfgFix(){ C.cfg.office = Object.assign({}, DEF_OFFICE, C.cfg.office || {}); C.cfg.cats = Array.isArray(C.cfg.cats) ? C.cfg.cats.filter(Boolean) : (C.cfg.cats ? Object.keys(C.cfg.cats).map(function(k){ return C.cfg.cats[k]; }).filter(Boolean) : []); }
  cfgFix();
  function saveC(){ try{ localStorage.setItem(LK, JSON.stringify(C)); }catch(e){} }
  function loadJs(u){ return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = function(){ rej(new Error('불러오지 못했습니다: ' + u)); }; document.head.appendChild(s); }); }
  var DBP = null;
  function db(){
    if(DBP) return DBP;
    DBP = (async function(){
      if(!window.firebase || !window.firebase.initializeApp) await loadJs(FB + 'firebase-app-compat.js');
      if(!window.firebase.database) await loadJs(FB + 'firebase-database-compat.js');
      if(!window.firebase.apps.length) window.firebase.initializeApp(CFG);
      if(!window.firebase.auth) await loadJs(FB + 'firebase-auth-compat.js');
      await new Promise(function(res){ var done = false, fin = function(){ if(!done){ done = true; res(); } };
        try{ var au = window.firebase.auth(); if(au.currentUser) return fin(); var un = au.onAuthStateChanged(function(u){ if(done) return; try{ un(); }catch(e){} if(u) return fin(); au.signInAnonymously().then(fin, fin); }); }catch(e){ fin(); }
        setTimeout(fin, 8000); });
      return window.firebase.database();
    })();
    DBP.catch(function(){ DBP = null; });
    return DBP;
  }
  var CL = { st:'☁ Firebase 연결 중…', err:'' };
  function clPaint(){ var e = document.getElementById('fm-cloud'); if(e) e.innerHTML = clHtml(); var h = document.getElementById('fm-cloudhelp'); if(h) h.innerHTML = clHelp(); }
  function clHtml(){ return CL.err ? '<span style="color:#e03131">⚠ Firebase 저장 안 됨 — ' + (/PERMISSION|permission/i.test(CL.err) ? '쓰기 권한' : esc(CL.err.slice(0, 60))) + ' (이 브라우저에만 저장)</span>' : esc(CL.st); }
  function clHelp(){ return /PERMISSION|permission/i.test(CL.err) ? '<div class="fm-err">Firebase 쓰기 권한이 막혀 이 브라우저에만 저장했습니다. Firebase 콘솔 → Realtime Database → <b>규칙</b>의 "rules" 안에 아래 줄이 있는지 확인하고 게시해 주세요 (전자명함·로고 관리와 같은 규칙).<pre>' + esc(RULE) + '</pre></div>' : ''; }
  function put(path, v){
    saveC();
    return db().then(function(d){ return d.ref('sd_media/' + path).set(v == null ? null : v); }).then(function(){ CL.err = ''; CL.st = '☁ Firebase 저장됨 · 사무실 모든 PC 공유'; clPaint(); return true; }, function(e){
      CL.err = (e && e.message) || String(e); clPaint();
      var m = /^form_(tpl|doc)\/(.+)$/.exec(path); if(m && v){ var o = C[m[1]][m[2]]; if(o){ o._loc = 1; saveC(); } }
      return false;
    });
  }
  function strip(o){ var x = clone(o); delete x._loc; delete x.id; return x; }
  async function pull(){
    try{
      var d = await db();
      var v = await Promise.all(['form_tpl', 'form_doc', 'form_cfg'].map(function(k){ return d.ref('sd_media/' + k).once('value'); }));
      var tpl = v[0].val() || {}, doc = v[1].val() || {}, cfg = v[2].val();
      /* 권한 문제로 이 브라우저에만 남았던 것은 지우지 않고 다시 올린다 */
      var retry = [];
      ['tpl', 'doc'].forEach(function(k, i){ var remote = i ? doc : tpl; Object.keys(C[k]).forEach(function(id){ var o = C[k][id]; if(o && o._loc && (!remote[id] || (remote[id].at || 0) < (o.at || 0))){ remote[id] = o; retry.push(['form_' + k + '/' + id, o]); } }); C[k] = remote; });
      if(cfg) C.cfg = cfg; cfgFix(); saveC();
      CL.err = ''; CL.st = '☁ Firebase 연결됨 · 사무실 모든 PC 공유'; clPaint();
      retry.forEach(function(r){ var o = r[1]; delete o._loc; put(r[0], strip(o)); });
      if(S.view === 'cat' || S.view === 'docs' || S.view === 'office') paint(); else { var sd = document.querySelector('.fm-side'); if(sd) { sd.innerHTML = side(); } }
    }catch(e){ CL.err = (e && e.message) || String(e); clPaint(); }
  }

  /* ── 서식 → 빈칸 목록 ── */
  var FRE = /\{([^{}=:\n|]+?)(?::([^{}=\n|]+?))?(?:=([^{}\n|]*))?\}/g;
  var TMAP = { '금액':'money', '돈':'money', 'money':'money', '날짜':'date', 'date':'date', '긴글':'long', '여러줄':'long', 'long':'long', '전화':'tel', 'tel':'tel', '글':'text', 'text':'text' };
  var TNAME = { money:'금액', date:'날짜', long:'여러 줄', tel:'전화', text:'글' };
  function infer(n, d){
    var hasD = d != null && d !== '';
    if(/연락처|전화|휴대폰|핸드폰/.test(n)) return 'tel';
    if(/(금액|대금|보증금|원금|차임|월세|권리금|계약금|중도금|잔금|금원|이자액|수수료|중개보수)$/.test(n) && (!hasD || /^[\d,억만천백십\s원]+$/.test(d))) return 'money';
    if(/(일자|날짜|기한|작성일|계약일|차용일|변제일|반환일|지급일|시작일|종료일|만료일|체결일|약정일|예정일|오늘)$/.test(n) && (!hasD || /^\d{4}-\d{2}-\d{2}$/.test(d) || d === '오늘')) return 'date';
    if(/(내용|사항|사유|사실관계|조건|특약|비고|조치|경위|책임)$/.test(n)) return 'long';
    return 'text';
  }
  function parseFields(body){
    var out = [], seen = {}, m; FRE.lastIndex = 0;
    while((m = FRE.exec(String(body || '')))){
      var n = m[1].trim(); if(!n) continue;
      var f = seen[n];
      if(!f){ f = seen[n] = { name:n, tx:'', def:null }; out.push(f); }
      if(m[2] && !f.tx) f.tx = m[2].trim();
      if(m[3] != null && f.def == null) f.def = m[3];
    }
    out.forEach(function(f){ f.type = f.tx ? (TMAP[f.tx] || 'text') : infer(f.name, f.def); });
    return out;
  }
  function initVals(fields, prev){
    var v = {}, o = C.cfg.office || {};
    fields.forEach(function(f){
      if(prev && prev[f.name] != null){ v[f.name] = prev[f.name]; return; }
      if(f.def != null) v[f.name] = f.def === '오늘' ? today() : f.def;
      else if(OFFMAP[f.name]) v[f.name] = o[OFFMAP[f.name]] || '';
      else if(/^(작성일|오늘)$/.test(f.name)) v[f.name] = today();
      else v[f.name] = '';
    });
    return v;
  }

  /* ── 서식 → 문서 HTML ── */
  function renderInner(body, vals, opt){
    opt = opt || {}; vals = vals || {};
    var F = {}; parseFields(body).forEach(function(f){ F[f.name] = f; });
    var val = function(n){ return opt.blank ? '' : (vals[n] == null ? '' : String(vals[n])); };
    function fv(f, v, cell){
      var t = f.type, s = String(v).trim();
      if(t === 'money'){ if(!s) return '일금 <u class="bl w8"></u> 원정 (₩<u class="bl w6"></u>)'; var w = wonTxt(s); return w ? esc(w) : esc(s); }
      if(t === 'date'){ if(!s) return '<span class="bd">년</span><span class="bd">월</span><span class="bd">일</span>'; return esc(dkr(s)); }
      if(t === 'long'){ if(!s) return cell ? '' : '<span class="blbox"></span>'; return esc(s).replace(/\n/g, '<br>'); }
      if(!s) return cell ? '' : '<u class="bl"></u>';
      return esc(s).replace(/\n/g, '<br>');
    }
    function sub(text, cell){
      var toks = [], n = 0, filled = 0, last = 0, h = '', m; FRE.lastIndex = 0; text = String(text);
      while((m = FRE.exec(text))){
        h += esc(text.slice(last, m.index)); last = FRE.lastIndex;
        var name = m[1].trim(), f = F[name] || { type:'text' }, v = val(name); n++; if(String(v).trim()) filled++;
        toks.push(fv(f, v, cell)); h += '\u0001' + (toks.length - 1) + '\u0002';
      }
      h += esc(text.slice(last));
      h = h.replace(/ {2}/g, ' &nbsp;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\(인\)/g, '<span class="seal">(인)</span>').replace(/\u0001(\d+)\u0002/g, function(_, i){ return toks[+i]; });
      return { h:h, n:n, f:filled, seal:/\(인\)/.test(text) };
    }
    function hid(r){ return opt.hide && r.n > 0 && r.f === 0 && !r.seal; }
    var lines = String(body || '').replace(/\r/g, '').split('\n'), B = [], i = 0;
    while(i < lines.length){
      var raw = lines[i], t = raw.trim();
      if(t.charAt(0) === '|'){
        var rows = []; while(i < lines.length && lines[i].trim().charAt(0) === '|'){ rows.push(lines[i].trim()); i++; }
        var cells = rows.map(function(r){ return r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(function(c){ return c.trim(); }); });
        var mx = Math.max.apply(null, cells.map(function(c){ return c.length; }));
        var tr = cells.map(function(cs){
          var rs = cs.map(function(c){ return sub(c, true); }), tot = { n:0, f:0, seal:false };
          rs.forEach(function(r){ tot.n += r.n; tot.f += r.f; tot.seal = tot.seal || r.seal; });
          if(hid(tot)) return '';
          /* 「항목 | 값」 짝 중 값을 안 넣은 짝만 빼기 (예: 성명은 넣고 주민등록번호는 비움) */
          if(opt.hide && rs.length >= 4){
            var keep = [];
            for(var j = 0; j < rs.length; j += 2){ var v = rs[j + 1]; if(v && hid(v)) continue; keep.push(rs[j]); if(v) keep.push(v); }
            rs = keep;
          }
          var h = rs.map(function(r, j){
            var span = j === rs.length - 1 && rs.length < mx ? ' colspan="' + (mx - rs.length + 1) + '"' : '';
            return rs.length > 1 && j % 2 === 0 ? '<th' + span + '>' + r.h + '</th>' : '<td' + (rs.length === 1 ? ' colspan="' + mx + '"' : span) + '>' + r.h + '</td>';
          }).join('');
          return '<tr>' + h + '</tr>';
        }).filter(Boolean);
        B.push({ k:'tb', h:tr.length ? '<table class="c' + (mx >= 4 ? 4 : mx) + ' pb">' + tr.join('') + '</table>' : '', hide:!tr.length });
        continue;
      }
      i++;
      if(!t){ B.push({ k:'gap' }); continue; }
      var m;
      if(/^===+$/.test(t)){ B.push({ k:'pbk', h:'<div class="pbk"></div>' }); continue; }
      if(/^---+$/.test(t)){ B.push({ k:'hr', h:'<hr class="pb">' }); continue; }
      if((m = /^#\s+(.*)$/.exec(t))){ var r1 = sub(m[1]); B.push({ k:'h1', h:'<h1 class="pb">' + r1.h + '</h1>' }); continue; }
      if((m = /^##\s+(.*)$/.exec(t))){ var r2 = sub(m[1]); B.push({ k:'h2', h:'<h2 class="pb">' + r2.h + '</h2>' }); continue; }
      var cls = 'p', txt = t;
      if((m = /^>>\s?(.*)$/.exec(t))){ cls = 'r'; txt = m[1]; }
      else if((m = /^\^\^\s?(.*)$/.exec(t))){ cls = 'c'; txt = m[1]; }
      else if(/^※/.test(t)) cls = 'note';
      var it = cls === 'p' && /^((\d{1,2}|[가나다라마바사아자차카타파하])[.)])\s+(.*)$/.exec(t);
      var r = sub(it ? it[3] : txt);
      var h = it ? '<div class="it pb"><span class="n">' + esc(it[1]) + '</span><span>' + r.h + '</span></div>' : '<div class="' + cls + ' pb">' + r.h + '</div>';
      B.push({ k:cls, h:h, hide:hid(r) });
    }
    /* 숨긴 줄만 남은 소제목은 같이 숨긴다 */
    B.forEach(function(b, j){
      if(b.k !== 'h2' || !opt.hide) return;
      var any = false, gone = false;
      for(var x = j + 1; x < B.length && B[x].k !== 'h2' && B[x].k !== 'h1' && B[x].k !== 'pbk'; x++){ if(B[x].k === 'gap') continue; if(B[x].hide) gone = true; else any = true; }
      if(gone && !any) b.hide = true;
    });
    var out = '', gap = false;
    B.forEach(function(b){ if(b.hide) return; if(b.k === 'gap'){ if(out && !gap) out += '<div class="gap"></div>'; gap = true; return; } gap = false; out += b.h; });
    if(opt.office){
      var o = C.cfg.office || {}, lg = window.sdLogo ? (window.sdLogo.src('form_foot') || window.sdLogo.src('brief_head')) : '';
      var bits = [o.ceo && '대표 공인중개사 ' + o.ceo, o.regno && '등록번호 ' + o.regno, o.addr, [o.tel, o.mobile].filter(Boolean).join(' · ')].filter(Boolean).map(esc).join('  |  ');
      out += '<div class="foot pb">' + (lg ? '<img src="' + lg + '" alt="로고">' : '') + '<div><b>입회 중개사무소  ' + esc(o.name || '') + '</b>  <span class="seal">(인)</span><br><span>' + bits + '</span></div></div>';
    }
    return out;
  }
  var DOC_CSS = '@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0}body{background:#e9ecf1;font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.pg{--k:1;width:794px;height:1123px;margin:0 auto;background:#fff;padding:60px 64px 52px;overflow:hidden;position:relative}.pg.multi{height:auto;min-height:1123px;overflow:visible}'
    + '.ct{font-size:calc(14.5px * var(--k));line-height:1.72}'
    + 'h1{font-size:2.15em;text-align:center;letter-spacing:.32em;margin:.1em 0 .9em;font-weight:900;line-height:1.3}h2{font-size:1.06em;margin:1em 0 .4em;font-weight:800}'
    + 'table{width:100%;border-collapse:collapse;margin:.3em 0}th,td{border:1px solid #2b2b2b;padding:.42em .7em;font-size:.95em;vertical-align:middle;text-align:left;line-height:1.55}th{background:#f2f3f5;font-weight:700;white-space:nowrap}table.c2 th{width:10.5em}table.c4 th{width:8.2em}'
    + '.p{margin:.25em 0}.c{text-align:center;margin:.35em 0;font-size:1.07em}.r{text-align:right;margin:.45em 0;font-size:1.07em}.note{font-size:.8em;color:#555;margin:.35em 0}'
    + '.it{display:flex;gap:.4em;margin:.25em 0}.it .n{flex:0 0 auto;min-width:1.3em}.gap{height:.8em}hr{border:none;border-top:1px solid #888;margin:.8em 0}'
    + 'u.bl{display:inline-block;min-width:9em;border-bottom:1px solid #333;text-decoration:none;height:1.15em;vertical-align:-.15em}u.bl.w8{min-width:11em}u.bl.w6{min-width:7em}'
    + '.bd{display:inline-block;padding-left:3.2em}.bd:first-child{padding-left:4.2em}.blbox{display:block;height:5.2em;background:repeating-linear-gradient(transparent 0,transparent 1.68em,#bdbdbd 1.68em,#bdbdbd calc(1.68em + 1px))}'
    + '.seal{color:#8a8a8a;margin-left:.25em}.foot{margin-top:1.6em;padding-top:.7em;border-top:1px solid #c8c8c8;display:flex;align-items:center;gap:.9em;font-size:.78em;color:#333;line-height:1.6}.foot img{height:2.6em;width:auto;max-width:12em;object-fit:contain}'
    + '.pbk{height:0}'
    + '@media print{body{background:#fff}.pg{margin:0;box-shadow:none}.pg.multi{width:auto;min-height:0;padding:0}.pbk{break-before:page;page-break-before:always}}';
  function docHtml(inner, title){
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title || '서식') + '</title>'
      + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap">'
      + '<style>' + DOC_CSS + '</style><style id="pgst"></style></head><body><div class="pg"><div class="ct">' + inner + '</div></div></body></html>';
  }
  /* A4 한 장 맞춤 — 넘치면 글자 크기(--k)를 줄인다. MINK 까지 줄여도 넘치면 여러 쪽(multi) */
  function fitDoc(doc, on){
    var pg = doc.querySelector('.pg'), ct = doc.querySelector('.ct'); if(!pg || !ct) return { k:1, one:true, pages:1 };
    pg.classList.remove('multi'); pg.style.setProperty('--k', 1);
    var cs = doc.defaultView.getComputedStyle(pg), avail = 1123 - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), k = 1;
    var forced = !!ct.querySelector('.pbk');
    if(on && !forced){ for(var i = 0; i < 6; i++){ var h = ct.scrollHeight; if(h <= avail) break; var nk = Math.max(MINK, k * avail / h * 0.99); if(nk >= k - 0.002){ k = nk; break; } k = nk; pg.style.setProperty('--k', k); if(k <= MINK) break; } }
    var one = !forced && ct.scrollHeight <= avail + 1;
    if(!one){ pg.classList.add('multi'); if(!on) { k = 1; pg.style.setProperty('--k', 1); } }
    var st = doc.getElementById('pgst'); if(st) st.textContent = one ? '@page{size:A4 portrait;margin:0}' : '@page{size:A4 portrait;margin:15mm 16mm 14mm}';
    return { k:k, one:one, pages:one ? 1 : Math.max(2, Math.ceil(ct.scrollHeight / avail)) };
  }
  function whenFonts(doc){ return (doc.fonts && doc.fonts.ready ? Promise.race([doc.fonts.ready, new Promise(function(r){ setTimeout(r, 2500); })]) : Promise.resolve()); }

  /* ── 인쇄 · PDF · JPEG (A4 기준) ── */
  function fileName(d, ext){
    var who = whoOf(d), t = today();
    return ([d.name, who].filter(Boolean).join('_') + '_' + t).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_') + '.' + ext;
  }
  function whoOf(d){ var v = d.vals || {}, k = Object.keys(v).filter(function(n){ return /성명$/.test(n) && String(v[n]).trim(); })[0]; return k ? String(v[k]).trim() : ''; }
  function frameFor(html, cb, hidden){
    var f = document.createElement('iframe');
    f.style.cssText = hidden ? 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0' : 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    f.onload = function(){ cb(f); }; f.srcdoc = html; return f;
  }
  function printHtml(html, fit){
    frameFor(html, function(f){
      var doc = f.contentDocument;
      whenFonts(doc).then(function(){ fitDoc(doc, fit); try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ toast('인쇄 창을 열지 못했습니다 — PDF 로 저장해 인쇄해 주세요', true); } setTimeout(function(){ f.remove(); }, 60000); });
    });
  }
  function libs(pdf){ var a = []; if(!window.html2canvas) a.push(loadJs('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')); if(pdf && !(window.jspdf && window.jspdf.jsPDF)) a.push(loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')); return Promise.all(a); }
  function saveBlob(b, name){ var u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(u); }, 3000); }
  function exportHtml(html, kind, name, fit){
    var st = document.getElementById('fm-outst'), say = function(t){ if(st) st.textContent = t; };
    say('⏳ 만드는 중…');
    return libs(kind === 'pdf').then(function(){ return new Promise(function(res){ frameFor(html, res, true); }); }).then(function(f){
      var doc = f.contentDocument, pg = doc.querySelector('.pg'); doc.body.style.background = '#fff';
      return whenFonts(doc).then(function(){
        var fr = fitDoc(doc, fit);
        f.style.height = Math.max(1123, pg.offsetHeight) + 'px';
        return window.html2canvas(pg, { scale:2, backgroundColor:'#ffffff', useCORS:true, logging:false, windowWidth:794 }).then(function(cv){
          if(kind === 'jpg') return new Promise(function(r){ cv.toBlob(r, 'image/jpeg', 0.93); }).then(function(b){ saveBlob(b, name); });
          var P = new window.jspdf.jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
          if(fr.one){ P.addImage(cv.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297); saveBlob(P.output('blob'), name); return; }
          /* 여러 쪽 — 줄·표 줄 사이에서 나누고, 둘째 쪽부터 위 여백 */
          var k = cv.width / pg.offsetWidth, pageH = 1123, top0 = pg.getBoundingClientRect().top, H = pg.offsetHeight, TOPM = 56, BOTM = 52;
          var cuts = Array.prototype.slice.call(pg.querySelectorAll('.pb, tr')).map(function(el){ return el.getBoundingClientRect().top - top0; });
          var forced = Array.prototype.slice.call(pg.querySelectorAll('.pbk')).map(function(el){ return el.getBoundingClientRect().top - top0; });
          var pages = [], y = 0;
          while(y < H - 2){
            var room = pageH - (pages.length ? TOPM : 0) - BOTM, lim = y + room, best;
            var fz = forced.filter(function(t){ return t > y + 2 && t <= lim; });
            if(fz.length) best = Math.min.apply(null, fz);
            else if(lim < H){ var ok = cuts.filter(function(c){ return c > y + 40 && c <= lim; }); best = ok.length ? Math.max.apply(null, ok) : lim; }
            else best = H;
            pages.push([y, best]); y = best;
          }
          pages.forEach(function(pp, i){
            var c = document.createElement('canvas'); c.width = cv.width; c.height = Math.round(pageH * k); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
            var h = Math.ceil((pp[1] - pp[0]) * k); x.drawImage(cv, 0, Math.floor(pp[0] * k), cv.width, h, 0, i ? Math.round(TOPM * k) : 0, cv.width, h);
            if(i) P.addPage(); P.addImage(c.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297);
          });
          saveBlob(P.output('blob'), name);
        });
      }).then(function(){ f.remove(); }, function(e){ f.remove(); throw e; });
    }).then(function(){ say('✅ 저장했습니다 (다운로드 폴더)'); }, function(e){ say(''); toast((e && e.message) || String(e), true); });
  }

  /* ── 화면 상태 ── */
  var S = { view:'cat', cat:'wi', ed:null, edDirty:false, fd:null, q:'', qcat:'' };
  function cats(){ return CATS.map(function(c){ return { id:c[0], n:c[1], ic:c[2], base:true }; }).concat(C.cfg.cats.map(function(c){ return { id:c.id, n:c.n, ic:c.ic || '📁', base:false }; })); }
  function catOf(id){ return cats().filter(function(c){ return c.id === id; })[0] || { id:id, n:'(지운 카테고리)', ic:'📁' }; }
  function tplsOf(cat){
    var b = BASE.filter(function(t){ return t.cat === cat; }).map(function(t){ return Object.assign({ base:true }, t); });
    var u = Object.keys(C.tpl).map(function(id){ return Object.assign({ id:id }, C.tpl[id]); }).filter(function(t){ return t.cat === cat; }).sort(function(a, b){ return String(a.name).localeCompare(String(b.name), 'ko'); });
    return b.concat(u);
  }
  function tpl(id){ var b = BASE.filter(function(t){ return t.id === id; })[0]; if(b) return Object.assign({ base:true }, b); return C.tpl[id] ? Object.assign({ id:id }, C.tpl[id]) : null; }
  function docs(){ return Object.keys(C.doc).map(function(id){ return Object.assign({ id:id }, C.doc[id]); }).sort(function(a, b){ return (b.at || 0) - (a.at || 0); }); }

  /* ── 그리기 ── */
  function side(){
    var dn = Object.keys(C.doc).length;
    return '<div class="fm-sh">카테고리</div>' + cats().map(function(c){
      var n = tplsOf(c.id).length;
      return '<button class="fm-si' + (S.view === 'cat' && S.cat === c.id ? ' on' : '') + '" data-act="cat" data-id="' + esc(c.id) + '"><span>' + esc(c.ic) + '</span><b>' + esc(c.n) + '</b><small>' + n + '</small></button>';
    }).join('')
      + '<button class="fm-si add" data-act="addcat">＋ 카테고리 추가</button>'
      + '<div class="fm-sh">관리</div>'
      + '<button class="fm-si' + (S.view === 'docs' ? ' on' : '') + '" data-act="docs"><span>🗂</span><b>작성한 문서</b><small>' + dn + '</small></button>'
      + '<button class="fm-si' + (S.view === 'office' ? ' on' : '') + '" data-act="office"><span>🏢</span><b>사무소 정보</b></button>';
  }
  function catView(){
    var c = catOf(S.cat), L = tplsOf(S.cat);
    return '<div class="fm-ch"><h3>' + esc(c.ic) + ' ' + esc(c.n) + ' <small>기본 ' + L.filter(function(t){ return t.base; }).length + ' · 추가 ' + L.filter(function(t){ return !t.base; }).length + '</small></h3><span class="sp"></span>'
      + (c.base ? '' : '<button class="fm-btn sm" data-act="rencat">✏️ 이름 바꾸기</button><button class="fm-btn sm x" data-act="delcat">🗑 카테고리 지우기</button>')
      + '<button class="fm-btn pri" data-act="new">＋ 새 서식</button></div>'
      + '<div class="fm-tip">기본 서식에서 <b>⧉ 복제</b>를 누르면 그 내용으로 새 서식이 열립니다. 이름을 「매매계약 위임장」처럼 바꾸고 글을 고쳐 <b>💾 저장</b>하면 이 카테고리의 <b>추가 서식</b>이 됩니다. 기본 서식은 그대로 남습니다.</div>'
      + '<div class="fm-grid">' + L.map(function(t){
        var n = parseFields(t.body).length, dc = Object.keys(C.doc).filter(function(k){ return C.doc[k].tid === t.id; }).length;
        return '<div class="fm-card' + (t.base ? ' base' : '') + '"><div class="fm-ct"><b>' + esc(t.name) + '</b><span class="tag ' + (t.base ? 'b' : 'u') + '">' + (t.base ? '기본' : '추가') + '</span>' + (t._loc ? '<span class="tag w">이 PC만</span>' : '') + '</div>'
          + '<div class="fm-cs">빈칸 ' + n + '개' + (dc ? ' · 작성 문서 ' + dc + '건' : '') + (t.base ? ' · 기본 제공' : ' · ' + esc(t.by || '') + ' ' + esc(ymd(t.at))) + '</div>'
          + '<div class="fm-cb"><button class="fm-btn sm pri" data-act="fill" data-id="' + esc(t.id) + '">✍️ 작성</button><button class="fm-btn sm" data-act="dup" data-id="' + esc(t.id) + '">⧉ 복제</button>'
          + (t.base ? '' : '<button class="fm-btn sm" data-act="edit" data-id="' + esc(t.id) + '">✏️ 수정</button><button class="fm-btn sm x" data-act="del" data-id="' + esc(t.id) + '">🗑</button>') + '</div></div>';
      }).join('') + '<button class="fm-card add" data-act="new"><b>＋</b>새 서식 만들기</button></div>';
  }
  var TOOLS = [
    ['{빈칸}', '빈칸', 'field'], ['표 줄', '| 항목 | {항목} |', 'line'], ['소제목', '## 소제목', 'line'], ['가운데', '^^ ', 'pre'], ['오른쪽', '>> ', 'pre'],
    ['작성일', '^^ {작성일}', 'line'], ['서명 줄', '>> 성명  {성명}  (인)', 'line'], ['귀하', '>> **{상대방 성명}  귀하**', 'line'], ['※ 안내', '※ ', 'pre'],
    ['사무소 정보', '| 중개사무소 | {사무소명} |\n| 대표 공인중개사 | {대표자}  (인) |\n| 등록번호 | {등록번호} |\n| 소재지 | {사무소 주소} |\n| 전화 | {사무소 전화} |', 'line'],
    ['가로줄', '---', 'line'], ['쪽 나눔', '===', 'line']
  ];
  var HELP = '<div class="fm-help"><b>빈칸</b> — <code>{매수인 성명}</code> 처럼 중괄호로 쓰면 작성할 때 입력하는 칸이 됩니다. 같은 이름은 한 번만 입력하면 모든 자리에 들어갑니다.<br>'
    + '<b>기본값</b> — <code>{거래 종류=매매}</code> 처럼 <code>=</code> 뒤에 쓰면 미리 채워집니다 (매매계약 위임장 · 전세계약 위임장처럼 서식마다 다르게).<br>'
    + '<b>빈칸 종류</b> — 이름으로 자동: 「금액·대금·보증금·계약금·잔금·차임…」 → <b>금액</b> (일금 일천만원정 (₩10,000,000) 자동) · 「…일·날짜·기한」 → <b>날짜</b> · 「내용·사항·조건·비고…」 → <b>여러 줄</b> · 「연락처·전화」 → <b>전화</b>. 직접 정하려면 <code>{이름:금액}</code> <code>{이름:날짜}</code> <code>{이름:긴글}</code> <code>{이름:글}</code><br>'
    + '<b>자동으로 채워지는 칸</b> — <code>{작성일}</code> = 오늘 · <code>{사무소명}</code> <code>{대표자}</code> <code>{등록번호}</code> <code>{사무소 주소}</code> <code>{사무소 전화}</code> = 🏢 사무소 정보<br>'
    + '<b>줄 모양</b> — <code># 제목</code> · <code>## 소제목</code> · <code>| 항목 | {값} | 항목 | {값} |</code> 표 (항목·값 번갈아) · <code>^^</code> 가운데 · <code>>></code> 오른쪽 · <code>※</code> 작은 안내 · <code>1.</code> 번호 · <code>---</code> 가로줄 · <code>===</code> 쪽 나눔(특별한 경우만) · <code>**굵게**</code> · <code>(인)</code> 도장 자리<br>'
    + '<b>A4 1장</b> — 서식은 A4 한 장 기준입니다. 조금 넘치면 글자를 줄여(최소 75%) 한 장에 맞추고, 그래도 넘치면 2쪽으로 나뉩니다.</div>';
  function fieldChips(body){ var F = parseFields(body); return F.length ? '<div class="fm-chips">빈칸 ' + F.length + '개 — ' + F.map(function(f){ return '<span class="chip ' + f.type + '">' + esc(f.name) + '<i>' + TNAME[f.type] + '</i></span>'; }).join('') + '</div>' : '<div class="fm-chips">빈칸이 없습니다 — <code>{이름}</code> 으로 만드세요</div>'; }
  function editView(){
    var e = S.ed;
    return '<div class="fm-bar"><button class="fm-btn" data-act="back">← 목록</button><b class="fm-bt">' + (e.id ? '✏️ 서식 수정' : '＋ 새 서식') + '</b>'
      + '<input class="fm-in" id="fm-ename" value="' + esc(e.name) + '" placeholder="서식 이름 (예: 매매계약 위임장)" style="max-width:300px">'
      + '<select class="fm-in" id="fm-ecat" style="max-width:170px">' + cats().map(function(c){ return '<option value="' + esc(c.id) + '"' + (c.id === e.cat ? ' selected' : '') + '>' + esc(c.ic + ' ' + c.n) + '</option>'; }).join('') + '</select>'
      + '<span class="sp"></span><span class="fm-fit" id="fm-fit"></span><button class="fm-btn" data-act="etry">✍️ 저장하고 작성</button><button class="fm-btn pri" data-act="esave">💾 서식 저장</button></div>'
      + '<div class="fm-two"><div class="fm-l"><div class="fm-tools">' + TOOLS.map(function(t, i){ return '<button class="fm-btn xs" data-ins="' + i + '">' + esc(t[0]) + '</button>'; }).join('') + '</div>'
      + '<textarea id="fm-ebody" class="fm-in fm-code" spellcheck="false">' + esc(e.body) + '</textarea><div id="fm-echips">' + fieldChips(e.body) + '</div>'
      + '<details class="fm-det" open><summary>✍️ 서식 쓰는 법</summary>' + HELP + '</details></div>'
      + '<div class="fm-r">' + pvBox('미리보기 — 기본값·사무소 정보·오늘 날짜로') + '</div></div>';
  }
  function fieldInput(f, v){
    var id = 'fm-v-' + esc(f.name), a = ' data-f="' + esc(f.name) + '" id="' + id + '"';
    if(f.type === 'date') return '<input class="fm-in" type="date"' + a + ' value="' + esc(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '') + '">' + (v && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? '<em>' + esc(v) + '</em>' : '');
    if(f.type === 'long') return '<textarea class="fm-in" rows="3"' + a + '>' + esc(v) + '</textarea>';
    if(f.type === 'money') return '<input class="fm-in" inputmode="numeric"' + a + ' value="' + esc(v) + '" placeholder="예: 10000000 또는 1억 5천만"><em class="fm-won" data-won="' + esc(f.name) + '">' + esc(wonTxt(v)) + '</em>';
    return '<input class="fm-in"' + (f.type === 'tel' ? ' inputmode="tel"' : '') + a + ' value="' + esc(v) + '">';
  }
  function fieldsForm(){
    var d = S.fd.doc, F = parseFields(d.body);
    if(!F.length) return '<div class="fm-empty">이 서식에는 빈칸이 없습니다</div>';
    return F.map(function(f){ return '<div class="fm-f' + (f.type === 'long' ? ' wide' : '') + '"><label>' + esc(f.name) + ' <i>' + TNAME[f.type] + (OFFMAP[f.name] ? ' · 사무소 정보' : '') + '</i></label>' + fieldInput(f, d.vals[f.name] == null ? '' : String(d.vals[f.name])) + '</div>'; }).join('');
  }
  function fillView(){
    var d = S.fd.doc, o = d.opts;
    return '<div class="fm-bar"><button class="fm-btn" data-act="back">← 목록</button><b class="fm-bt">' + esc(d.name) + '</b><span class="tag">' + esc(catOf(d.cat).n) + '</span>'
      + '<span class="fm-dst" id="fm-dst">' + dstHtml() + '</span><span class="sp"></span><span class="fm-fit" id="fm-fit"></span>'
      + '<button class="fm-btn" data-act="print">🖨 인쇄</button><button class="fm-btn" data-act="pdf">📄 PDF 저장</button><button class="fm-btn" data-act="jpg">🖼 JPEG 저장</button><button class="fm-btn pri" data-act="dsave">💾 문서 보관</button></div>'
      + '<div class="fm-outst" id="fm-outst"></div>'
      + '<div class="fm-two"><div class="fm-l">'
      + '<div class="fm-opts"><label><input type="checkbox" id="fm-o-hide"' + (o.hide ? ' checked' : '') + '> 입력 안 한 줄 숨기기</label><label><input type="checkbox" id="fm-o-fit"' + (o.fit !== false ? ' checked' : '') + '> A4 한 장에 맞추기</label><label><input type="checkbox" id="fm-o-office"' + (o.office ? ' checked' : '') + '> 입회 중개사무소 표시 (로고)</label>'
      + '<button class="fm-lnk" data-act="blank" title="빈칸을 모두 비운 채 A4 로 인쇄 — 손으로 써서 쓰는 용도">🖨 빈 서식 인쇄</button><button class="fm-lnk" data-act="reset">↺ 처음 값으로</button></div>'
      + '<div class="fm-fields" id="fm-fields">' + fieldsForm() + '</div>'
      + '<details class="fm-det"' + (S.fd.bodyOpen ? ' open' : '') + ' id="fm-bdet"><summary>📝 본문 고치기 (이 문서만)</summary><textarea id="fm-dbody" class="fm-in fm-code" spellcheck="false" style="min-height:260px">' + esc(d.body) + '</textarea>'
      + '<div class="fm-row"><span class="fm-sub">서식 원본은 그대로 두고 이 문서만 바뀝니다.</span><span class="sp"></span><button class="fm-btn sm" data-act="astpl">⧉ 이 본문을 새 서식으로 저장</button></div></details>'
      + '</div><div class="fm-r">' + pvBox('미리보기 — A4') + '</div></div>';
  }
  function dstHtml(){ var f = S.fd; if(!f) return ''; if(f.dirty) return '<span style="color:#e8590c">● 보관 안 됨</span>'; return f.doc.id ? '<span style="color:#2b8a3e">✓ 보관됨 ' + esc(ymd(f.doc.at)) + '</span>' : ''; }
  function docsView(){
    var q = S.q.trim().toLowerCase(), L = docs().filter(function(d){ return (!S.qcat || d.cat === S.qcat) && (!q || (d.name + ' ' + (d.who || '') + ' ' + JSON.stringify(d.vals || {})).toLowerCase().indexOf(q) >= 0); });
    return '<div class="fm-ch"><h3>🗂 작성한 문서 <small>' + Object.keys(C.doc).length + '건</small></h3><span class="sp"></span>'
      + '<select class="fm-in" id="fm-qcat" style="max-width:170px"><option value="">모든 카테고리</option>' + cats().map(function(c){ return '<option value="' + esc(c.id) + '"' + (c.id === S.qcat ? ' selected' : '') + '>' + esc(c.n) + '</option>'; }).join('') + '</select>'
      + '<input class="fm-in" id="fm-q" placeholder="이름·내용 검색" value="' + esc(S.q) + '" style="max-width:220px"></div>'
      + '<div id="fm-dlist">' + docsList() + '</div>';
  }
  /* 찾기 칸은 그대로 두고 목록만 다시 그린다 (한글 조합이 끊기지 않게) */
  function docsList(){
    var q = S.q.trim().toLowerCase(), L = docs().filter(function(d){ return (!S.qcat || d.cat === S.qcat) && (!q || (d.name + ' ' + (d.who || '') + ' ' + JSON.stringify(d.vals || {})).toLowerCase().indexOf(q) >= 0); });
    return (L.length ? '<div class="fm-list">' + L.map(function(d){
        return '<div class="fm-li"><div class="t"><b>' + esc(d.name) + '</b>' + (d.who ? '<span class="tag">' + esc(d.who) + '</span>' : '') + '<span class="tag g">' + esc(catOf(d.cat).n) + '</span>' + (d._loc ? '<span class="tag w">이 PC만</span>' : '') + '<small>' + esc(ymd(d.at)) + (d.by ? ' · ' + esc(d.by) : '') + '</small></div>'
          + '<div class="b"><button class="fm-btn sm pri" data-act="open" data-id="' + esc(d.id) + '">열기</button><button class="fm-btn sm" data-act="dprint" data-id="' + esc(d.id) + '">🖨</button><button class="fm-btn sm" data-act="ddup" data-id="' + esc(d.id) + '">⧉ 복제</button><button class="fm-btn sm x" data-act="ddel" data-id="' + esc(d.id) + '">🗑</button></div></div>';
      }).join('') + '</div>' : '<div class="fm-empty">' + (Object.keys(C.doc).length ? '찾는 문서가 없습니다' : '아직 보관한 문서가 없습니다.<br>서식을 작성한 뒤 <b>💾 문서 보관</b>을 누르면 여기에 모입니다.') + '</div>');
  }
  function officeView(){
    var o = C.cfg.office, row = function(k, l, ph){ return '<div class="fm-f"><label>' + l + ' <i>{' + Object.keys(OFFMAP).filter(function(x){ return OFFMAP[x] === k; })[0] + '}</i></label><input class="fm-in" data-o="' + k + '" value="' + esc(o[k] || '') + '" placeholder="' + esc(ph || '') + '"></div>'; };
    return '<div class="fm-ch"><h3>🏢 사무소 정보</h3></div><div class="fm-tip">서식의 <code>{사무소명}</code> <code>{대표자}</code> <code>{등록번호}</code> <code>{사무소 주소}</code> <code>{사무소 전화}</code> 칸과 「입회 중개사무소 표시」에 자동으로 들어갑니다. 로고는 🏷 로고 관리의 「서식 — 아래쪽 사무소 로고」에서 고릅니다.</div>'
      + '<div class="fm-fields" style="max-width:640px">' + row('name', '사무소 이름') + row('ceo', '대표 공인중개사') + row('regno', '중개사무소 등록번호', '예: 28185-2016-00000') + row('addr', '소재지') + row('tel', '전화') + row('mobile', '휴대폰') + '</div>'
      + '<div class="fm-row" style="max-width:640px"><span class="sp"></span><button class="fm-btn pri" data-act="osave">💾 저장</button></div>';
  }
  function pvBox(t){ return '<div class="fm-pv"><div class="fm-pvh">' + esc(t) + '</div><div class="fm-pvw" id="fm-pvw"><iframe id="fm-pvf" title="미리보기"></iframe></div></div>'; }
  function paint(){
    if(!R) return;
    var wide = S.view === 'edit' || S.view === 'fill';
    var main = S.view === 'edit' ? editView() : S.view === 'fill' ? fillView() : S.view === 'docs' ? docsView() : S.view === 'office' ? officeView() : catView();
    R.innerHTML = '<div class="fm">'
      + '<div class="fm-top"><h2>📄 서식 <small>위임장 · 영수증 · 차용증 · 내용증명 등 부동산 업무 서식 — A4 1장 기준 · 인쇄 · PDF · JPEG</small></h2><span class="fm-cloud" id="fm-cloud">' + clHtml() + '</span></div><div id="fm-cloudhelp">' + clHelp() + '</div>'
      + '<div class="fm-main' + (wide ? ' wide' : '') + '">' + (wide ? '' : '<aside class="fm-side">' + side() + '</aside>') + '<section class="fm-body">' + main + '</section></div></div>';
    bind();
    if(S.view === 'edit') pvEdit(); else if(S.view === 'fill') pvFill();
  }

  /* ── 미리보기 ── */
  var pvT = 0;
  function pvSet(inner, fit){
    var f = document.getElementById('fm-pvf'); if(!f) return;
    f._inner = inner; f._fit = fit;
    var go = function(){
      var d = f.contentDocument; if(!d || !d.body) return;
      d.body.innerHTML = '<div class="pg"><div class="ct">' + f._inner + '</div></div>';
      var r = fitDoc(d, f._fit); pvFitBox(f); fitBadge(r);
      whenFonts(d).then(function(){ var r2 = fitDoc(d, f._fit); pvFitBox(f); fitBadge(r2); });
    };
    if(!f._ready){ if(!f._loading){ f._loading = 1; f.onload = function(){ f._ready = 1; go(); }; f.srcdoc = docHtml('', '미리보기'); } }
    else go();
  }
  function pvFitBox(f){
    var w = document.getElementById('fm-pvw'); if(!w || !f.contentDocument) return;
    var pg = f.contentDocument.querySelector('.pg'), h = pg ? pg.offsetHeight : 1123, s = Math.min(1, (w.clientWidth - 2) / 794);
    f.style.width = '794px'; f.style.height = h + 'px'; f.style.transform = 'scale(' + s + ')'; w.style.height = Math.ceil(h * s) + 'px';
  }
  function fitBadge(r){ var e = document.getElementById('fm-fit'); if(!e) return; e.innerHTML = r.one ? '<span class="ok">A4 1장 ✓' + (r.k < 0.995 ? ' · 글자 ' + Math.round(r.k * 100) + '%' : '') + '</span>' : '<span class="wn">⚠ A4 ' + r.pages + '장 — 내용이 많아 나뉩니다</span>'; }
  function pvEdit(){ clearTimeout(pvT); pvT = setTimeout(function(){ var b = S.ed.body; pvSet(renderInner(b, initVals(parseFields(b), null), { hide:false }), true); }, 160); }
  function pvFill(){ clearTimeout(pvT); pvT = setTimeout(function(){ var d = S.fd.doc; pvSet(renderInner(d.body, d.vals, d.opts), d.opts.fit !== false); }, 120); }
  window.addEventListener('resize', function(){ var f = document.getElementById('fm-pvf'); if(f && f._ready) pvFitBox(f); });

  /* ── 동작 ── */
  function go(view, extra){ S.view = view; if(extra) Object.assign(S, extra); paint(); var w = document.getElementById('form-wrap'); if(w) w.scrollTop = 0; }
  function leaveOk(){
    if(S.view === 'edit' && S.edDirty) return confirm('저장하지 않은 서식 내용이 있습니다. 나갈까요?');
    if(S.view === 'fill' && S.fd && S.fd.dirty && S.fd.touched) return confirm('보관하지 않은 문서입니다. 나갈까요?\n(인쇄·PDF 는 보관과 상관없이 됩니다)');
    return true;
  }
  function openFill(t){
    var F = parseFields(t.body);
    S.fd = { doc:{ id:null, tid:t.id, cat:t.cat, name:t.name, body:t.body, vals:initVals(F, null), opts:{ hide:true, fit:true, office:false } }, dirty:true, touched:false };
    go('fill');
  }
  function openEd(o){ S.ed = { id:o.id || null, cat:o.cat || S.cat, name:o.name || '', body:o.body || BLANK_BODY }; S.edDirty = !o.id; go('edit'); }
  function saveTpl(then){
    var e = S.ed, name = (document.getElementById('fm-ename').value || '').trim(), cat = document.getElementById('fm-ecat').value, body = document.getElementById('fm-ebody').value;
    if(!name){ toast('서식 이름을 넣어 주세요 (예: 매매계약 위임장)', true); document.getElementById('fm-ename').focus(); return null; }
    if(!body.trim()){ toast('서식 본문이 비어 있습니다', true); return null; }
    var dup = tplsOf(cat).filter(function(t){ return t.name === name && t.id !== e.id; })[0];
    if(dup && !confirm('같은 카테고리에 「' + name + '」 서식이 이미 있습니다. 그래도 저장할까요?')) return null;
    var id = e.id && C.tpl[e.id] ? e.id : uid('t'), old = C.tpl[id] || {};
    var o = { cat:cat, name:name, body:body, at:Date.now(), by:old.by || me() };
    if(old.by && old.by !== me()) o.upd = me();
    C.tpl[id] = o; put('form_tpl/' + id, o);
    S.edDirty = false; S.cat = cat; toast('💾 「' + name + '」 서식을 저장했습니다');
    return Object.assign({ id:id }, o);
  }
  function saveDoc(){
    var d = S.fd.doc, id = d.id || uid('d');
    var o = { tid:d.tid || '', cat:d.cat, name:d.name, body:d.body, vals:d.vals, opts:d.opts, who:whoOf(d), at:Date.now(), by:me() };
    C.doc[id] = o; d.id = id; d.at = o.at; S.fd.dirty = false; put('form_doc/' + id, o);
    var s = document.getElementById('fm-dst'); if(s) s.innerHTML = dstHtml();
    toast('💾 문서를 보관했습니다 — 🗂 작성한 문서에서 다시 열 수 있습니다');
  }
  function insertSnip(i){
    var t = TOOLS[i], ta = document.getElementById('fm-ebody'); if(!ta) return;
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, ins = t[1];
    if(t[2] === 'field'){ var n = prompt('빈칸 이름을 적어 주세요 (예: 매수인 성명, 계약금, 잔금 지급일)\n기본값을 넣으려면 「이름=값」', ''); if(!n || !n.trim()) return; ins = '{' + n.trim().replace(/[{}|]/g, '') + '}'; }
    else if(t[2] === 'line'){ var ls = v.lastIndexOf('\n', s - 1) + 1; if(s > ls || v.slice(ls, s).trim()) ins = '\n' + ins; if(v.charAt(e) && v.charAt(e) !== '\n') ins += '\n'; }
    else if(t[2] === 'pre'){ var l0 = v.lastIndexOf('\n', s - 1) + 1; ta.value = v.slice(0, l0) + ins + v.slice(l0); ta.selectionStart = ta.selectionEnd = s + ins.length; ta.focus(); ta.dispatchEvent(new Event('input')); return; }
    ta.value = v.slice(0, s) + ins + v.slice(e); ta.selectionStart = ta.selectionEnd = s + ins.length; ta.focus(); ta.dispatchEvent(new Event('input'));
  }
  function outDoc(kind, blank){
    var d = S.fd.doc, html = docHtml(renderInner(d.body, d.vals, blank ? { hide:false, office:d.opts.office, blank:true } : d.opts), d.name), fit = blank ? true : d.opts.fit !== false;
    if(kind === 'print') return printHtml(html, fit);
    exportHtml(html, kind, blank ? (d.name + '_빈서식.' + kind).replace(/\s+/g, '_') : fileName(d, kind), fit);
  }
  function bind(){
    R.onclick = function(ev){
      var b = ev.target.closest('[data-act],[data-ins]'); if(!b || !R.contains(b)) return;
      if(b.dataset.ins != null){ insertSnip(+b.dataset.ins); return; }
      var a = b.dataset.act, id = b.dataset.id;
      if(a === 'cat'){ if(!leaveOk()) return; go('cat', { cat:id }); }
      else if(a === 'docs'){ if(!leaveOk()) return; go('docs'); }
      else if(a === 'office'){ if(!leaveOk()) return; go('office'); }
      else if(a === 'back'){ if(!leaveOk()) return; var back = S.fd && S.fd.fromDocs && S.view === 'fill' ? 'docs' : 'cat'; if(S.view === 'fill' && S.fd) S.cat = S.fd.doc.cat; if(S.view === 'edit' && S.ed) S.cat = S.ed.cat; go(back); }
      else if(a === 'fill'){ var t = tpl(id); if(t) openFill(t); }
      else if(a === 'dup'){ var t2 = tpl(id); if(t2) openEd({ cat:t2.cat, name:t2.name + ' (복사)', body:t2.body }); }
      else if(a === 'edit'){ var t3 = tpl(id); if(t3) openEd(t3); }
      else if(a === 'new'){ openEd({ cat:S.cat, name:'', body:BLANK_BODY }); }
      else if(a === 'del'){ var t4 = tpl(id); if(t4 && confirm('「' + t4.name + '」 서식을 지울까요?\n(이 서식으로 보관한 문서는 그대로 남습니다)')){ delete C.tpl[id]; put('form_tpl/' + id, null); paint(); toast('서식을 지웠습니다'); } }
      else if(a === 'addcat'){ var n = prompt('새 카테고리 이름 (예: 계약해제 통지서, 확인서)', ''); if(n && n.trim()){ var c = { id:uid('c'), n:n.trim().slice(0, 30), ic:'📁' }; C.cfg.cats.push(c); put('form_cfg/cats', C.cfg.cats); go('cat', { cat:c.id }); } }
      else if(a === 'rencat'){ var c2 = C.cfg.cats.filter(function(x){ return x.id === S.cat; })[0]; if(!c2) return; var n2 = prompt('카테고리 이름', c2.n); if(n2 && n2.trim()){ c2.n = n2.trim().slice(0, 30); put('form_cfg/cats', C.cfg.cats); paint(); } }
      else if(a === 'delcat'){ var nn = tplsOf(S.cat).length; if(nn){ toast('이 카테고리에 서식이 ' + nn + '개 있습니다. 서식을 먼저 지우거나 다른 카테고리로 옮겨 주세요', true); return; } if(!confirm('이 카테고리를 지울까요?')) return; C.cfg.cats = C.cfg.cats.filter(function(x){ return x.id !== S.cat; }); put('form_cfg/cats', C.cfg.cats); go('cat', { cat:'wi' }); }
      else if(a === 'esave'){ var sv = saveTpl(); if(sv) go('cat'); }
      else if(a === 'etry'){ var sv2 = saveTpl(); if(sv2) openFill(sv2); }
      else if(a === 'print' || a === 'pdf' || a === 'jpg'){ outDoc(a); }
      else if(a === 'blank'){ outDoc('print', true); }
      else if(a === 'dsave'){ saveDoc(); }
      else if(a === 'reset'){ if(!confirm('입력한 값을 지우고 처음 값(기본값·사무소 정보·오늘)으로 돌릴까요?')) return; S.fd.doc.vals = initVals(parseFields(S.fd.doc.body), null); S.fd.dirty = true; document.getElementById('fm-fields').innerHTML = fieldsForm(); bindFields(); pvFill(); }
      else if(a === 'astpl'){ var d = S.fd.doc; openEd({ cat:d.cat, name:d.name + ' (수정본)', body:d.body }); }
      else if(a === 'open'){ var o = C.doc[id]; if(!o) return; var dd = clone(o); dd.id = id; dd.opts = Object.assign({ hide:true, fit:true, office:false }, dd.opts || {}); dd.vals = dd.vals || {}; S.fd = { doc:dd, dirty:false, touched:false, fromDocs:true }; go('fill'); }
      else if(a === 'ddup'){ var o2 = C.doc[id]; if(!o2) return; var d2 = clone(o2); delete d2._loc; d2.id = null; d2.opts = Object.assign({ hide:true, fit:true, office:false }, d2.opts || {}); S.fd = { doc:d2, dirty:true, touched:true, fromDocs:true }; go('fill'); toast('복제했습니다 — 고친 뒤 💾 문서 보관을 누르면 새 문서로 저장됩니다'); }
      else if(a === 'ddel'){ var o3 = C.doc[id]; if(o3 && confirm('「' + o3.name + (o3.who ? ' — ' + o3.who : '') + '」 문서를 지울까요?')){ delete C.doc[id]; put('form_doc/' + id, null); paint(); } }
      else if(a === 'dprint'){ var o4 = C.doc[id]; if(o4) printHtml(docHtml(renderInner(o4.body, o4.vals, Object.assign({ hide:true }, o4.opts)), o4.name), !o4.opts || o4.opts.fit !== false); }
      else if(a === 'osave'){ R.querySelectorAll('[data-o]').forEach(function(i){ C.cfg.office[i.dataset.o] = i.value.trim(); }); put('form_cfg/office', C.cfg.office); toast('🏢 사무소 정보를 저장했습니다'); }
    };
    if(S.view === 'edit'){
      var ta = document.getElementById('fm-ebody'), ch = document.getElementById('fm-echips');
      ta.oninput = function(){ S.ed.body = ta.value; S.edDirty = true; ch.innerHTML = fieldChips(ta.value); pvEdit(); };
      document.getElementById('fm-ename').oninput = function(){ S.ed.name = this.value; S.edDirty = true; };
      document.getElementById('fm-ecat').onchange = function(){ S.ed.cat = this.value; S.edDirty = true; };
    }
    if(S.view === 'fill'){
      bindFields();
      var dirty = function(){ S.fd.dirty = true; S.fd.touched = true; var s = document.getElementById('fm-dst'); if(s) s.innerHTML = dstHtml(); };
      ['hide', 'fit', 'office'].forEach(function(k){ var c = document.getElementById('fm-o-' + k); c.onchange = function(){ S.fd.doc.opts[k] = c.checked; dirty(); pvFill(); }; });
      var db2 = document.getElementById('fm-dbody'), det = document.getElementById('fm-bdet');
      det.ontoggle = function(){ S.fd.bodyOpen = det.open; };
      db2.oninput = function(){ var d = S.fd.doc; d.body = db2.value; d.vals = initVals(parseFields(d.body), d.vals); dirty(); clearTimeout(db2._t); db2._t = setTimeout(function(){ document.getElementById('fm-fields').innerHTML = fieldsForm(); bindFields(); }, 500); pvFill(); };
    }
    if(S.view === 'docs'){
      var q = document.getElementById('fm-q'), qc = document.getElementById('fm-qcat');
      q.oninput = function(){ S.q = q.value; var e = document.getElementById('fm-dlist'); if(e) e.innerHTML = docsList(); };
      qc.onchange = function(){ S.qcat = qc.value; paint(); };
    }
  }
  function bindFields(){
    var box = document.getElementById('fm-fields'); if(!box) return;
    box.querySelectorAll('[data-f]').forEach(function(el){
      el.oninput = el.onchange = function(){
        var n = el.dataset.f; S.fd.doc.vals[n] = el.value; S.fd.dirty = true; S.fd.touched = true;
        var w = box.querySelector('[data-won="' + (window.CSS && CSS.escape ? CSS.escape(n) : n) + '"]'); if(w) w.textContent = wonTxt(el.value) || (el.value ? '금액을 읽지 못했습니다 — 숫자로 넣어 주세요' : '');
        var s = document.getElementById('fm-dst'); if(s) s.innerHTML = dstHtml();
        pvFill();
      };
    });
  }

  /* ── 화면 스타일 ── */
  var UI_CSS = '.fm{max-width:1500px;margin:0 auto;padding:16px 18px 60px;font-family:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1f2937;font-size:13px}'
    + '.fm .sp{flex:1}.fm-top{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px}.fm-top h2{margin:0;font-size:18px;font-weight:800}.fm-top h2 small{font-size:12px;font-weight:500;color:#6b7280;margin-left:6px}.fm-cloud{margin-left:auto;font-size:12px;color:#1971c2}'
    + '.fm-err{font-size:12px;color:#c92a2a;background:#fff5f5;border:1px solid #ffc9c9;border-radius:10px;padding:10px 12px;margin-bottom:10px;line-height:1.6}.fm-err pre{white-space:pre-wrap;margin:6px 0 0;font-size:11.5px}'
    + '.fm-main{display:grid;grid-template-columns:210px minmax(0,1fr);gap:14px;align-items:start}.fm-main.wide{grid-template-columns:minmax(0,1fr)}'
    + '.fm-side{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:8px;position:sticky;top:8px}.fm-sh{font-size:11px;font-weight:700;color:#9ca3af;padding:8px 8px 4px;letter-spacing:.04em}'
    + '.fm-si{display:flex;align-items:center;gap:8px;width:100%;border:none;background:none;border-radius:9px;padding:7px 9px;cursor:pointer;font-family:inherit;font-size:13px;color:#374151;text-align:left}.fm-si b{flex:1;font-weight:600}.fm-si small{font-size:11px;color:#9ca3af;background:#f3f4f6;border-radius:9px;padding:0 7px}.fm-si:hover{background:#f6f7fb}.fm-si.on{background:#1a2744;color:#fff}.fm-si.on small{background:rgba(255,255,255,.18);color:#fff}.fm-si.add{color:#1971c2;font-size:12px}'
    + '.fm-body{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px 18px;min-width:0}'
    + '.fm-ch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.fm-ch h3{margin:0;font-size:16px;font-weight:800}.fm-ch h3 small{font-size:12px;font-weight:500;color:#9ca3af;margin-left:6px}'
    + '.fm-tip{font-size:12px;color:#5c3d00;background:#fff9db;border:1px solid #ffe8a1;border-radius:10px;padding:9px 12px;line-height:1.65;margin-bottom:12px}.fm-tip code,.fm-help code,.fm-chips code{background:#f1f3f5;border-radius:4px;padding:0 4px;font-size:11.5px}'
    + '.fm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}.fm-card{border:1px solid #e5e7eb;border-radius:12px;padding:12px 13px;display:flex;flex-direction:column;gap:7px;background:#fff}.fm-card.base{background:#fbfcfe}'
    + '.fm-ct{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.fm-ct b{font-size:14.5px;margin-right:2px}.fm-cs{font-size:11.5px;color:#9ca3af}.fm-cb{display:flex;gap:5px;flex-wrap:wrap;margin-top:auto}'
    + '.fm-card.add{border:2px dashed #ced4da;align-items:center;justify-content:center;color:#868e96;cursor:pointer;min-height:110px;font-family:inherit;font-size:13px}.fm-card.add b{font-size:24px}.fm-card.add:hover{border-color:#1a2744;color:#1a2744}'
    + '.tag{font-size:11px;background:#edf2ff;color:#364fc7;border-radius:10px;padding:1px 8px}.tag.b{background:#f1f3f5;color:#495057}.tag.u{background:#e6fcf5;color:#087f5b}.tag.w{background:#fff4e6;color:#d9480f}.tag.g{background:#f8f0fc;color:#862e9c}'
    + '.fm-btn{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:7px 13px;font-size:13px;cursor:pointer;font-family:inherit;color:#1f2937;white-space:nowrap}.fm-btn:hover{border-color:#1a2744}.fm-btn.pri{background:#1a2744;border-color:#1a2744;color:#fff;font-weight:700}.fm-btn.sm{padding:4px 10px;font-size:12px}.fm-btn.xs{padding:3px 8px;font-size:11.5px;border-radius:6px}.fm-btn.x{color:#c92a2a;border-color:#ffc9c9}'
    + '.fm-lnk{border:none;background:none;color:#1971c2;font-size:12px;cursor:pointer;font-family:inherit;padding:2px 4px}'
    + '.fm-in{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d0d5dd;border-radius:8px;font-size:13px;font-family:inherit;background:#fff}textarea.fm-in{resize:vertical;line-height:1.55}'
    + '.fm-code{font-family:"D2Coding","Consolas","Noto Sans KR",monospace;font-size:12.5px;min-height:440px;line-height:1.6;tab-size:2}'
    + '.fm-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid #f1f3f5;margin-bottom:12px}.fm-bt{font-size:15px}.fm-dst{font-size:12px}'
    + '.fm-fit{font-size:12px}.fm-fit .ok{color:#2b8a3e;font-weight:600}.fm-fit .wn{color:#e8590c;font-weight:600}.fm-outst{font-size:12px;color:#1971c2;min-height:0}'
    + '.fm-two{display:grid;grid-template-columns:minmax(360px,0.9fr) minmax(0,1.1fr);gap:16px;align-items:start}.fm-r{position:sticky;top:8px}'
    + '.fm-tools{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}.fm-chips{font-size:11.5px;color:#6b7280;margin:6px 0;line-height:2}.chip{display:inline-flex;align-items:center;gap:3px;background:#f1f3f5;border-radius:10px;padding:0 8px;margin:0 3px 0 0;color:#343a40}.chip i{font-style:normal;font-size:10px;color:#868e96}.chip.money{background:#fff4e6}.chip.date{background:#e7f5ff}.chip.long{background:#f3f0ff}.chip.tel{background:#ebfbee}'
    + '.fm-det{margin-top:8px;border:1px solid #e9ecef;border-radius:10px;padding:8px 10px}.fm-det summary{cursor:pointer;font-weight:700;font-size:12.5px;color:#495057}.fm-help{font-size:12px;line-height:1.85;color:#495057;margin-top:6px}'
    + '.fm-opts{display:flex;gap:4px 14px;flex-wrap:wrap;align-items:center;background:#f8f9fa;border-radius:10px;padding:8px 10px;margin-bottom:10px;font-size:12.5px}.fm-opts label{display:inline-flex;gap:5px;align-items:center;cursor:pointer}'
    + '.fm-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}.fm-f{min-width:0}.fm-f.wide{grid-column:1 / -1}.fm-f label{display:block;font-size:12px;font-weight:600;color:#495057;margin-bottom:3px}.fm-f label i{font-style:normal;font-weight:400;color:#adb5bd;font-size:10.5px}.fm-f em{display:block;font-style:normal;font-size:11.5px;color:#1971c2;margin-top:2px;min-height:14px}'
    + '.fm-pv{background:#eef0f4;border:1px solid #e1e4ea;border-radius:12px;padding:10px;max-height:calc(100vh - 140px);overflow:auto}.fm-pvh{font-size:11.5px;color:#6b7280;margin-bottom:6px}.fm-pvw{position:relative;width:100%;overflow:hidden}.fm-pvw iframe{border:0;transform-origin:0 0;display:block;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.08)}'
    + '.fm-list{display:flex;flex-direction:column}.fm-li{display:flex;gap:10px;align-items:center;padding:10px 4px;border-bottom:1px solid #f1f3f5;flex-wrap:wrap}.fm-li .t{flex:1;min-width:240px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}.fm-li .t b{font-size:14px}.fm-li .t small{width:100%;color:#9ca3af;font-size:11.5px}.fm-li .b{display:flex;gap:4px}'
    + '.fm-empty{padding:30px;text-align:center;color:#adb5bd;font-size:12.5px;line-height:1.8}.fm-row{display:flex;gap:8px;align-items:center;margin-top:8px}.fm-sub{font-size:11.5px;color:#868e96}'
    + '.fm-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#212529;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;z-index:9999;display:none}.fm-toast.bad{background:#c92a2a}'
    + '@media(max-width:1100px){.fm-two{grid-template-columns:minmax(0,1fr)}.fm-r{position:static}}@media(max-width:760px){.fm-main{grid-template-columns:minmax(0,1fr)}.fm-side{position:static}.fm-fields{grid-template-columns:minmax(0,1fr)}}';

  var PULLED = false;
  window.sdForms = {
    _v:1,
    mount:function(root){
      R = root;
      if(!document.getElementById('fm-css')){ var st = document.createElement('style'); st.id = 'fm-css'; st.textContent = UI_CSS; document.head.appendChild(st); }
      paint();
      if(!PULLED){ PULLED = true; pull(); }
    },
    go:function(){ if(R) paint(); },
    /* 다른 화면·시험용 */
    parseFields:parseFields, renderInner:renderInner, docHtml:docHtml, wonTxt:wonTxt, parseWon:parseWon, BASE:BASE, CATS:CATS
  };
  window.addEventListener('beforeunload', function(e){ if((S.view === 'edit' && S.edDirty && S.ed && S.ed.id) || (S.view === 'fill' && S.fd && S.fd.dirty && S.fd.touched)){ e.preventDefault(); e.returnValue = ''; } });
})();
