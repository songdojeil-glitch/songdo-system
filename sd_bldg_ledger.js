/* ═════════════════════════════════════════════════════════════════
   🏪 상가 건물 원장 받기 (sd_data.html → 🏗 건축물대장 탭 아래 · window.sdBldLedger)  2026-10-10
   · 법정동(기본 송도동) 하나의 건축물대장 표제부 전체(+총괄표제부)를 지번 없이 한꺼번에 받는다
   · 주건축물 중 주용도 제1·2종근린생활시설·판매시설 = 「상가」 (집합·일반 모두)
     공동주택인데 기타용도에 근린·판매 = 「주상복합」, 업무시설인데 근린·판매 = 「업무복합」 (표시만, 다음 단계용)
   · 결과: ① 화면 요약·목록 ② Firebase sd_bldg_ledger_raw (상가 목록) ③ 「원장 파일 내려받기」
     — 이 파일을 Claude 에게 주면 건물명 정리·중복 묶기·확인을 거쳐 최종 원장 sd_bldg_info.json 으로 완성한다
     (파일에는 오피스 원장 다음 단계에 쓸 전체 주건축물 목록도 함께 담는다)
   · 인증키·법정동코드는 S실거래가 탭의 것(sdKR.key · sdKR.umd)을 그대로 쓴다. 호출은 쪽(page)마다 1회
   · 2026.10.10-10 📒 원장 목록의 건물명 → 🏬 상가건물 종합 정보 창 (sd_bldg_full.js: 원장 + 🏪 상가관리 연결 + 📄 상가분양자료 추가)
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.sdBldLedger) return;
  var W = window, BASE = 'https://apis.data.go.kr/1613000/BldRgstHubService/';
  var SGG = '28185', PAGE = 1000, MAXPG = 120, LS = 'sd_bldg_ledger_raw';   // sdKR.sset 이 Firebase 와 이 브라우저에 함께 남긴다
  var SHOP = /^(제1종근린생활시설|제2종근린생활시설|판매시설)$/;
  var ST = { busy:false, msg:'', dong:'송도동', res:null, view:'상가', q:'', open:true };
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function S(){ return W.sdKR && W.sdKR.key ? W.sdKR : null; }
  function txt(v){ var s = String(v == null ? '' : v).trim(); return s === '0' ? '' : s; }
  function n(v){ var x = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(x) ? 0 : x; }
  function ymd(v){ var s = String(v == null ? '' : v).replace(/[^0-9]/g, ''); return s.length === 8 ? s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6) : ''; }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function me(){ try{ var s = JSON.parse(localStorage.getItem('sd_auth_session') || '{}') || {}; return s.name || s.email || ''; }catch(e){ return ''; } }
  function jibun(t){ var b = parseInt(t.bun, 10), j = parseInt(t.ji, 10); if(!b) return ''; return (String(t.platGbCd) === '1' ? '산 ' : '') + b + (j ? '-' + j : ''); }
  function sayErr(em){
    var e = String(em || '').toUpperCase();
    if(/SERVICE[ _]KEY[ _]IS[ _]NOT[ _]REGISTERED/.test(e)) return '인증키가 등록되지 않았습니다 — S실거래가 탭에서 키를 다시 넣어 주세요.';
    if(/NOT[ _]REGISTERED[ _]FOR[ _]SERVICE|NO[ _]OPENAPI|ACCESS[ _]DENIED/.test(e)) return '건축물대장이 활용신청되어 있지 않습니다 — 공공데이터포털에서 「국토교통부_건축물대장정보 서비스」를 신청해 주세요.';
    if(/LIMITED[ _]NUMBER|REQUEST[ _]EXCEED/.test(e)) return '오늘 호출 한도를 넘었습니다 — 내일 다시 받아 주세요.';
    if(/DEADLINE|EXPIRED/.test(e)) return '인증키 활용기간이 지났습니다 — 공공데이터포털에서 연장해 주세요.';
    return em || '건축물대장 오류';
  }
  async function page(op, sgg, bjd, rows, pg){
    var key = S().key();
    var u = BASE + op + '?serviceKey=' + encodeURIComponent(key) + '&sigunguCd=' + sgg + '&bjdongCd=' + bjd
      + '&numOfRows=' + rows + '&pageNo=' + pg + '&_type=json';
    var t = await fetch(u).then(function(r){ return r.text(); });
    var j; try{ j = JSON.parse(t); }catch(e){ throw new Error('응답을 읽지 못했습니다 (' + op + ' ' + pg + '쪽)'); }
    if(j.OpenAPI_ServiceResponse) throw new Error(sayErr(String((j.OpenAPI_ServiceResponse.cmmMsgHeader || {}).errMsg || '')));
    var body = ((j.response || {}).body) || {}, list = (body.items && body.items.item) || [];
    if(!Array.isArray(list)) list = list ? [list] : [];
    var total = parseInt(body.totalCount, 10);
    return { list:list, total:isNaN(total) ? list.length : total };
  }
  /* 동 전체 받기 — 포털이 numOfRows 를 작게 자르면 그 크기로 이어 받는다 */
  async function all(op, sgg, bjd, label){
    var size = PAGE, first = await page(op, sgg, bjd, size, 1), out = first.list.slice(), total = first.total, pg = 1;
    if(first.list.length < size && first.list.length < total && first.list.length > 0) size = first.list.length;
    while(out.length < total && pg < MAXPG){
      pg++; say('⏳ ' + label + ' 받는 중… ' + out.length.toLocaleString() + ' / ' + total.toLocaleString() + '줄 (' + pg + '쪽)');
      var p = await page(op, sgg, bjd, size, pg);
      if(!p.list.length) break;
      out = out.concat(p.list);
      await new Promise(function(r){ setTimeout(r, 120); });
    }
    return { list:out, total:total, part:out.length < total };
  }
  function catOf(main, etc){
    if(SHOP.test(main)) return '상가';
    if(/공동주택/.test(main) && /근린|판매/.test(etc)) return '주상복합';
    if(/업무시설/.test(main) && /근린|판매/.test(etc)) return '업무복합';
    return '';
  }
  function rec(t){
    var main = txt(t.mainPurpsCdNm), etc = txt(t.etcPurps);
    return { pk:txt(t.mgmBldrgstPk), n:txt(t.bldNm), dn:txt(t.dongNm), jb:jibun(t), bun:txt(t.bun), ji:txt(t.ji), san:String(t.platGbCd) === '1' ? 1 : 0,
      plat:txt(t.platPlc), road:txt(t.newPlatPlc), kind:txt(t.regstrKindCdNm), gb:txt(t.regstrGbCdNm), ma:txt(t.mainAtchGbCdNm),
      main:main, etc:etc, cat:catOf(main, etc), st:txt(t.strctCdNm), gf:n(t.grndFlrCnt), bf:n(t.ugrndFlrCnt), h:n(t.heit),
      plA:n(t.platArea), arA:n(t.archArea), tot:n(t.totArea), bc:n(t.bcRat), vl:n(t.vlRat), ho:n(t.hoCnt), hh:n(t.hhldCnt),
      ev:n(t.rideUseElvtCnt) + n(t.emgenUseElvtCnt), pkg:n(t.indrAutoUtcnt) + n(t.oudrAutoUtcnt) + n(t.indrMechUtcnt) + n(t.oudrMechUtcnt),
      use:ymd(t.useAprDay), pms:ymd(t.pmsDay), crtn:ymd(t.crtnDay) };
  }
  function recapRec(t){
    return { pk:txt(t.mgmBldrgstPk), n:txt(t.bldNm), jb:jibun(t), plat:txt(t.platPlc), road:txt(t.newPlatPlc), kind:txt(t.regstrKindCdNm),
      main:txt(t.mainPurpsCdNm), etc:txt(t.etcPurps), plA:n(t.platArea), arA:n(t.archArea), tot:n(t.totArea), bc:n(t.bcRat), vl:n(t.vlRat),
      mainCnt:n(t.mainBldCnt), atchCnt:n(t.atchBldCnt), ho:n(t.hoCnt), hh:n(t.hhldCnt),
      pkg:n(t.totPkngCnt) || (n(t.indrAutoUtcnt) + n(t.oudrAutoUtcnt) + n(t.indrMechUtcnt) + n(t.oudrMechUtcnt)), use:ymd(t.useAprDay) };
  }
  function say(t, c){ ST.msg = t ? '<span style="color:' + (c || '#1565c0') + '">' + t + '</span>' : ''; var e = $('bl-msg'); if(e) e.innerHTML = ST.msg; }

  async function run(){
    if(ST.busy) return;
    var s = S();
    if(!s){ say('S실거래가 탭을 한 번 열어 주세요 — 인증키와 법정동코드를 그 탭이 갖고 있습니다.', '#c33'); return; }
    if(!s.key()){ say('공공데이터포털 인증키가 없습니다 — S실거래가 탭에서 먼저 넣어 주세요.', '#c33'); return; }
    var dong = (($('bl-dong') || {}).value || '송도동').trim() || '송도동'; ST.dong = dong;
    ST.busy = true; paint(); say('⏳ 법정동코드 확인 중…');
    try{
      var bjd = await s.umd(SGG, dong);
      if(!bjd) throw new Error('「' + dong + '」 법정동코드를 찾지 못했습니다 (연수구 안의 동 이름으로 넣어 주세요)');
      say('⏳ 표제부(동별) 받는 중…');
      var T = await all('getBrTitleInfo', SGG, bjd, '표제부');
      say('⏳ 총괄표제부 받는 중…');
      var R = await all('getBrRecapTitleInfo', SGG, bjd, '총괄표제부');
      /* 건물명 보충 — 표제부에 이름이 없으면 같은 지번의 총괄표제부 이름, 그다음 실거래 건물명 사전 */
      var recap = R.list.map(recapRec), rByJb = {};
      recap.forEach(function(r){ if(r.jb && r.n && !rByJb[r.jb]) rByJb[r.jb] = r.n; });
      var names = {};
      try{ var v = s.sget ? await s.sget('sd_bldg_names') : null; names = v ? (typeof v === 'string' ? JSON.parse(v) : v) || {} : {}; }catch(e){}
      var allMain = T.list.map(rec).filter(function(r){ return !r.ma || /주건축물/.test(r.ma); });
      var nameFix = 0;
      allMain.forEach(function(r){
        if(r.n) return;
        var nm = rByJb[r.jb] || names[SGG + '|' + dong + '|' + r.jb] || '';
        if(nm && typeof nm === 'object') nm = nm.n || nm.name || '';
        if(nm){ r.n = String(nm); r.nmFrom = rByJb[r.jb] ? '총괄표제부' : '실거래 건물명 사전'; nameFix++; }
      });
      var ledger = allMain.filter(function(r){ return r.cat; });
      var cnt = {}; ledger.forEach(function(r){ var k = r.cat + '·' + (r.gb || r.kind || '?'); cnt[k] = (cnt[k] || 0) + 1; });
      ST.res = { ver:1, at:new Date().toISOString(), by:me(), sgg:SGG, bjd:bjd, dong:dong,
        src:'국토교통부 건축물대장정보 서비스 — 표제부(getBrTitleInfo)·총괄표제부(getBrRecapTitleInfo)',
        rule:'주건축물 · 주용도 제1·2종근린생활시설/판매시설 = 상가(집합·일반) · 공동주택+근린/판매 = 주상복합 · 업무시설+근린/판매 = 업무복합',
        totals:{ title:T.total, titleGot:T.list.length, titlePart:T.part, recap:R.total, recapGot:R.list.length, main:allMain.length, ledger:ledger.length, nameFix:nameFix, noName:ledger.filter(function(r){ return !r.n; }).length },
        counts:cnt, ledger:ledger, recap:recap, all:allMain };
      if(s.sset){ try{ await s.sset('sd_bldg_ledger_raw', JSON.stringify({ at:ST.res.at, by:ST.res.by, dong:dong, bjd:bjd, totals:ST.res.totals, counts:cnt, ledger:ledger })); }catch(e){} }
      ST.busy = false; paint();
      say('✅ 표제부 ' + T.list.length.toLocaleString() + '줄 · 주건축물 ' + allMain.length.toLocaleString() + '동 중 상가 원장 대상 ' + ledger.length.toLocaleString() + '동'
        + (T.part ? ' · ⚠ 표제부를 다 받지 못했습니다(' + T.list.length + '/' + T.total + ')' : '') + ' — 아래 「원장 파일 내려받기」로 Claude 에게 주세요', '#0a7');
    }catch(e){ ST.busy = false; paint(); say(String(e && e.message || e), '#c33'); }
  }
  function download(){
    if(!ST.res){ say('먼저 「상가 원장 받기」를 눌러 주세요.', '#c33'); return; }
    var b = new Blob([JSON.stringify(ST.res)], { type:'application/json' }), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = ST.dong + '_상가원장_원본_' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(u); }, 3000);
  }
  function rows(){
    var L = ST.res ? (ST.view === '전체' ? ST.res.all : ST.res.ledger.filter(function(r){ return ST.view === '상가 전체' ? true : r.cat === ST.view; })) : [];
    var q = ST.q.trim().toLowerCase();
    if(q) L = L.filter(function(r){ return (r.n + ' ' + r.dn + ' ' + r.jb + ' ' + r.road + ' ' + r.main + ' ' + r.etc).toLowerCase().indexOf(q) >= 0; });
    return L;
  }
  function table(){
    if(!ST.res) return '';
    var L = rows(), sh = L.slice(0, 400);
    var tabs = ['상가', '주상복합', '업무복합', '상가 전체', '전체'].map(function(v){
      var c = v === '전체' ? ST.res.all.length : v === '상가 전체' ? ST.res.ledger.length : ST.res.ledger.filter(function(r){ return r.cat === v; }).length;
      return '<button type="button" class="bl-tab' + (ST.view === v ? ' on' : '') + '" onclick="sdBldLedger.view(\'' + v + '\')">' + v + ' <b>' + c.toLocaleString() + '</b></button>';
    }).join('');
    return '<div class="bl-tabs">' + tabs + '<input class="bl-q" id="bl-q" placeholder="건물명·지번·도로명 찾기" value="' + esc(ST.q) + '" oninput="sdBldLedger.q(this.value)"></div><div id="bl-tbl">' + tableList() + '</div>';
  }
  /* 찾기 칸은 그대로 두고 표만 다시 그린다 — 칸을 새로 만들면 한글이 조합 중에 끊겨 자모가 따로 들어간다 */
  function tableList(){
    var L = rows(), sh = L.slice(0, 400);
    return '<div class="bl-scroll"><table class="bl-t"><thead><tr><th>건물명</th><th>동</th><th>지번</th><th>도로명</th><th>대장</th><th>주용도</th><th>기타용도</th><th>층(지상/지하)</th><th>연면적㎡</th><th>호수</th><th>주차</th><th>사용승인</th></tr></thead><tbody>'
      + sh.map(function(r){
          return '<tr><td>' + (r.n ? esc(r.n) : '<span style="color:#c33">(이름 없음)</span>') + (r.nmFrom ? ' <small title="' + esc(r.nmFrom) + '에서 가져온 이름">*</small>' : '') + '</td><td>' + esc(r.dn) + '</td><td>' + esc(r.jb) + '</td><td>' + esc(r.road) + '</td>'
            + '<td>' + esc(r.gb || r.kind) + '</td><td>' + esc(r.main) + '</td><td class="bl-etc">' + esc(r.etc) + '</td><td>' + (r.gf || '') + ' / ' + (r.bf || '') + '</td>'
            + '<td style="text-align:right">' + (r.tot ? Math.round(r.tot).toLocaleString() : '') + '</td><td style="text-align:right">' + (r.ho || '') + '</td><td style="text-align:right">' + (r.pkg || '') + '</td><td>' + esc(r.use) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      + (L.length > sh.length ? '<div class="bl-sub">앞 ' + sh.length + '줄만 보입니다 (전체 ' + L.length.toLocaleString() + '줄은 내려받은 파일에 모두 들어 있습니다)</div>' : '');
  }
  /* ── 📒 정리된 상가 원장 (sd_bldg_info.json — Claude 가 원본을 정리해 깃허브에 올린 파일) ── */
  var INFO = { d:null, err:'', t:'', q:'', open:true };
  function infoLoad(){
    if(INFO.d || INFO.busy) return Promise.resolve(INFO.d);
    INFO.busy = true;
    return fetch('sd_bldg_info.json?v=' + encodeURIComponent(W.SD_VERSION || Date.now())).then(function(r){ if(!r.ok) throw new Error('sd_bldg_info.json 을 읽지 못했습니다 (' + r.status + ') — 깃허브에 올렸는지 확인해 주세요'); return r.json(); })
      .then(function(d){ INFO.d = d; INFO.busy = false; paintInfo(); return d; }, function(e){ INFO.err = e.message || String(e); INFO.busy = false; paintInfo(); return null; });
  }
  function infoRows(){
    if(!INFO.d) return [];
    var L = Object.keys(INFO.d.bldg).map(function(k){ return INFO.d.bldg[k]; }), q = INFO.q.trim().toLowerCase();
    if(INFO.t === '확인 필요') L = L.filter(function(r){ return r.chk; }); else if(INFO.t) L = L.filter(function(r){ return r.t === INFO.t; });
    if(q) L = L.filter(function(r){ return (r.n + ' ' + r.jb + ' ' + r.road + ' ' + (r.main || []).join(' ') + ' ' + (r.etc || '')).toLowerCase().indexOf(q) >= 0; });
    return L;
  }
  function infoCsv(){
    var L = infoRows(), e = function(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var head = ['건물명','유형','지번','도로명','집합/일반','주용도','지상층','지하층','연면적㎡','연면적평','대지면적㎡','호수','주차','승강기','사용승인','동 수','단지코드','확인 필요'];
    var lines = [head.map(e).join(',')].concat(L.map(function(r){ return [r.n, r.t, '송도동 ' + r.jb, r.road, r.kind, (r.main || []).join('·'), r.gf, r.bf, r.tot, Math.round(r.tot / 3.3058), r.plA, r.ho, r.pkg, r.ev, r.use, r.dongs ? r.dongs.length : 1, r.apt || '', (r.chk || []).join(' / ')].map(e).join(','); }));
    var b = new Blob(['\ufeff' + lines.join('\r\n')], { type:'text/csv;charset=utf-8' }), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = '송도동_상가건물원장' + (INFO.t ? '_' + INFO.t.replace(/[·\s]/g, '') : '') + '_' + (INFO.d.ver || today()) + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(u); }, 3000);
  }
  function infoHtml(){
    var D = INFO.d;
    var h = '<div class="bl-hd" onclick="sdBldLedger.infoToggle()"><b>📒 송도 상가 건물 원장</b><small>' + (D ? esc(D.ver) + ' 정리 · ' + D.count + '개 건물 · 건축물대장 기준' : '정리된 원장 (sd_bldg_info.json)') + '</small><span style="flex:1"></span><span>' + (INFO.open ? '접기 ▲' : '펼치기 ▼') + '</span></div>';
    if(!INFO.open) return h;
    if(!D) return h + '<div class="bl-in"><div class="bl-sub">' + (INFO.err ? '<span style="color:#c33">' + esc(INFO.err) + '</span>' : '불러오는 중…') + '</div></div>';
    var types = Object.keys(D.types).sort(function(a, b){ return D.types[b] - D.types[a]; }), chk = Object.keys(D.bldg).filter(function(k){ return D.bldg[k].chk; }).length;
    var tabs = '<button type="button" class="bl-tab' + (!INFO.t ? ' on' : '') + '" onclick="sdBldLedger.infoT(\'\')">전체 <b>' + D.count + '</b></button>'
      + types.map(function(t){ return '<button type="button" class="bl-tab' + (INFO.t === t ? ' on' : '') + '" onclick="sdBldLedger.infoT(\'' + t + '\')">' + esc(t) + ' <b>' + D.types[t] + '</b></button>'; }).join('')
      + (chk ? '<button type="button" class="bl-tab' + (INFO.t === '확인 필요' ? ' on' : '') + '" onclick="sdBldLedger.infoT(\'확인 필요\')" style="color:#c62828">확인 필요 <b>' + chk + '</b></button>' : '');
    var L = infoRows();
    return h + '<div class="bl-in"><div class="bl-sub">' + esc(D.rule || '') + ' 제외한 공공·부대시설 ' + (D.excluded || []).length + '동.</div>'
      + '<div class="bl-tabs">' + tabs + '<input class="bl-q" id="bl-iq" placeholder="건물명·지번·도로명 찾기" value="' + esc(INFO.q) + '" oninput="sdBldLedger.infoQ(this.value)">'
      + '<button type="button" class="bl-btn" onclick="sdBldLedger.infoCsv()">📥 엑셀(CSV) 내려받기</button></div>'
      + '<div id="bl-info-list">' + infoList() + '</div></div>';
  }
  function infoList(){
    var D = INFO.d, L = infoRows();
    var SD = W.sdBldFull && CXS ? CXS : null;
    return '<div class="bl-scroll"><table class="bl-t"><thead><tr><th>건물명 <small style="font-weight:400;color:#888">(누르면 종합 정보)</small></th><th title="🏪 상가관리 연결 · 📄 분양자료">종합</th><th>유형</th><th>지번</th><th>도로명</th><th>집합/일반</th><th>주용도</th><th>층(지상/지하)</th><th>연면적</th><th>호수</th><th>주차</th><th>사용승인</th><th>확인</th></tr></thead><tbody>'
      + L.map(function(r){
          return '<tr><td><a href="javascript:void 0" class="bl-nm" onclick="sdBldLedger.open(\'' + esc(r.id) + '\')"><b>' + esc(r.n) + '</b></a>' + (r.dongs ? ' <small>(' + r.dongs.length + '개 동)</small>' : '') + '</td>'
            + '<td>' + (SD && SD.xref[r.id] ? '<span title="상가관리 연결">🏪</span>' : '') + (SD && SD.bun[r.id] ? '<span title="분양자료">📄</span>' : '') + '</td><td>' + esc(r.t) + '</td><td>' + esc(r.jb) + '</td><td>' + esc(r.road) + '</td><td>' + esc(r.kind) + '</td>'
            + '<td class="bl-etc">' + esc((r.main || []).join('·')) + '</td><td>' + r.gf + ' / ' + r.bf + '</td><td style="text-align:right">' + Math.round(r.tot).toLocaleString() + '㎡<br><small>' + Math.round(r.tot / 3.3058).toLocaleString() + '평</small></td>'
            + '<td style="text-align:right">' + (r.ho || '') + '</td><td style="text-align:right">' + (r.pkg || '') + '</td><td>' + esc(r.use) + '</td><td class="bl-etc" style="color:#c62828">' + esc((r.chk || []).join(' / ')) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      + '<div class="bl-sub">' + L.length + '개 건물 · 건물명을 누르면 <b>🏬 상가건물 종합 정보</b>(원장 + 🏪 상가관리 + 📄 분양자료) · 연면적·호수·주차는 건축물대장 표제부 합계(여러 동이면 합친 값) · 일반건축물은 호수가 0으로 나옵니다 · ' + esc(D.src || '') + '</div>';
  }
  function paintInfo(){ var e = $('bl-info'); if(e) e.innerHTML = infoHtml(); }

  function paint(){
    var root = $('bl-root'); if(!root) return;
    var t = ST.res && ST.res.totals;
    root.innerHTML = '<div class="bl-card">'
      + '<div class="bl-hd" onclick="sdBldLedger.toggle()"><b>🏪 상가 건물 원장 받기</b><small>건축물대장 표제부를 동 전체로 한꺼번에 — Claude 가 정리해 최종 원장으로 만듭니다</small><span style="flex:1"></span><span>' + (ST.open ? '접기 ▲' : '펼치기 ▼') + '</span></div>'
      + (ST.open ? '<div class="bl-in">'
        + '<div class="bl-sub">주건축물 가운데 주용도가 <b>제1·2종근린생활시설·판매시설</b>인 건물을 <b>집합·일반 모두</b> 상가로 모읍니다. 주상복합·업무시설 중 근린·판매가 섞인 건물은 따로 표시합니다. '
        + '송도동은 표제부가 수천 줄이라 <b>수십 번 호출</b>합니다(개발계정 하루 한도 안). 오피스 원장(다음 단계)에 쓸 전체 목록도 파일에 함께 담습니다.</div>'
        + '<div class="bl-row"><label>법정동 <input id="bl-dong" class="bl-in-t" value="' + esc(ST.dong) + '" list="bl-dongs" style="width:110px"></label>'
        + '<datalist id="bl-dongs"><option>송도동</option><option>동춘동</option><option>연수동</option><option>청학동</option><option>선학동</option><option>옥련동</option></datalist>'
        + '<button type="button" class="bl-btn pri" onclick="sdBldLedger.run()"' + (ST.busy ? ' disabled' : '') + '>' + (ST.busy ? '⏳ 받는 중…' : '🏪 상가 원장 받기') + '</button>'
        + '<button type="button" class="bl-btn" onclick="sdBldLedger.download()"' + (ST.res ? '' : ' disabled') + '>💾 원장 파일 내려받기 (Claude 정리용)</button>'
        + '<span id="bl-msg" class="bl-msg">' + ST.msg + '</span></div>'
        + (t ? '<div class="bl-sum">표제부 <b>' + t.titleGot.toLocaleString() + '</b>/' + t.title.toLocaleString() + '줄 · 총괄표제부 ' + t.recapGot.toLocaleString() + ' · 주건축물 <b>' + t.main.toLocaleString() + '</b>동 · 원장 대상 <b>' + t.ledger.toLocaleString() + '</b>동'
          + ' (' + Object.keys(ST.res.counts).sort().map(function(k){ return esc(k) + ' ' + ST.res.counts[k]; }).join(' · ') + ')'
          + (t.noName ? ' · <span style="color:#c33">이름 없는 건물 ' + t.noName + '동</span>' : '') + (t.nameFix ? ' · 이름 보충 ' + t.nameFix + '동' : '') + '</div>' : '')
        + table()
        + '<div class="bl-sub" style="margin-top:8px">내려받은 파일을 <b>통합업무시스템 폴더</b>(PC 연결 폴더)에 넣거나 대화창에 첨부해 Claude 에게 「상가 원장 정리해 줘」라고 하시면 됩니다.</div>'
        + '</div>' : '')
      + '</div>';
  }
  var CSS = '.bl-card{background:var(--card,#fff);border:1px solid var(--border,#e0e0e0);border-radius:12px;margin-top:14px}'
    + '.bl-hd{display:flex;gap:10px;align-items:baseline;padding:11px 14px;cursor:pointer;flex-wrap:wrap}.bl-hd b{font-size:14px}.bl-hd small{color:var(--text3,#888);font-size:11.5px}.bl-hd span{font-size:11.5px;color:var(--text3,#888)}'
    + '.bl-in{padding:0 14px 14px}.bl-sub{font-size:11.5px;color:var(--text3,#777);line-height:1.7;margin:4px 0}.bl-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}'
    + '.bl-row label{font-size:12px;display:inline-flex;gap:6px;align-items:center}.bl-in-t,.bl-q{padding:5px 9px;border:1px solid var(--border,#ddd);border-radius:7px;font-size:12px;font-family:inherit}'
    + '.bl-btn{padding:6px 13px;border:1px solid var(--border,#ccc);border-radius:7px;background:#fff;font-size:12px;cursor:pointer;font-family:inherit}.bl-btn.pri{background:#1a2744;color:#fff;border-color:#1a2744;font-weight:700}.bl-btn:disabled{opacity:.45;cursor:not-allowed}'
    + '.bl-msg{font-size:12px}.bl-sum{font-size:12px;background:#f5f8ff;border-radius:8px;padding:8px 10px;margin:6px 0;line-height:1.7}'
    + '.bl-tabs{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin:8px 0}.bl-tab{padding:4px 10px;border:1px solid var(--border,#ddd);border-radius:14px;background:#fff;font-size:11.5px;cursor:pointer;font-family:inherit}.bl-tab.on{background:#1a2744;color:#fff;border-color:#1a2744}.bl-q{margin-left:auto;width:200px}'
    + '.bl-scroll{max-height:460px;overflow:auto;border:1px solid var(--border,#eee);border-radius:8px}.bl-t{border-collapse:collapse;width:100%;font-size:11.5px}.bl-t th{position:sticky;top:0;background:#f3f5f9;font-weight:700;text-align:left;padding:5px 7px;white-space:nowrap;border-bottom:1px solid #dde}'
    + '.bl-t td{padding:4px 7px;border-bottom:1px solid #f0f0f0;white-space:nowrap}.bl-t td.bl-etc{white-space:normal;min-width:160px;max-width:280px;color:#666}'
    + '.bl-nm{color:#1a2744;text-decoration:none}.bl-nm:hover{text-decoration:underline}'
    + '.bl-cx{position:fixed;inset:0;background:rgba(15,20,35,.45);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:28px 12px;overflow:auto}'
    + '.bl-cx-box{background:#fff;border-radius:14px;width:min(880px,100%);box-shadow:0 12px 40px rgba(0,0,0,.25);font-size:12.5px;color:#222}'
    + '.bl-cx-hd{display:flex;gap:10px;align-items:baseline;padding:14px 18px;border-bottom:1px solid #eee;flex-wrap:wrap}.bl-cx-hd h3{margin:0;font-size:17px}.bl-cx-hd small{color:#777}'
    + '.bl-cx-x{margin-left:auto;border:0;background:none;font-size:20px;cursor:pointer;color:#888}'
    + '.bl-cx-sec{padding:12px 18px;border-bottom:1px solid #f1f1f1}.bl-cx-sec h4{margin:0 0 8px;font-size:13px}'
    + '.bl-chips{display:flex;gap:6px;flex-wrap:wrap}.bl-chip{padding:4px 10px;border-radius:14px;font-size:11.5px;background:#f2f4f8;color:#555}.bl-chip.on{background:#e7f1ff;color:#1a4fa0;font-weight:700}'
    + '.bl-ft{width:100%;border-collapse:collapse}.bl-ft td,.bl-ft th{padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:left;vertical-align:top}.bl-ft th{background:#f6f7fa;font-size:11.5px;color:#555}.bl-ft td.k{width:120px;color:#555;white-space:nowrap}'
    + '.bl-src{font-size:10.5px;padding:1px 7px;border-radius:9px;white-space:nowrap}.bl-src.원장{background:#eef2f7;color:#41546f}.bl-src.상가관리{background:#e8f6ec;color:#22783a}.bl-src.분양{background:#fff3e0;color:#a35a00}'
    + '.bl-gh td{background:#fafbfd;font-size:11px;color:#8a93a3;font-weight:700;padding-top:9px}.bl-warn{color:#c62828}'
    + '.bl-rv{background:#fffaf2;border:1px solid #f3dfbf;border-radius:10px;padding:10px 12px;margin-top:8px}.bl-rv input{width:100%;box-sizing:border-box;padding:4px 7px;border:1px solid #ddd;border-radius:6px;font:inherit;font-size:12px}'
    + '.bl-rv .cur{color:#777;font-size:11px}.bl-flr{display:flex;gap:5px;align-items:center;margin:3px 0}.bl-flr input{width:90px}';
  /* ── 🏬 상가건물 종합 정보 창 (원장 + 🏪 상가관리 + 📄 분양자료 — sd_bldg_full.js) ── */
  var CXS = null, CX = null;
  function cxSide(force){ if(!W.sdBldFull) return Promise.resolve(null); return W.sdBldFull.side(force).then(function(S){ CXS = S; var e = $('bl-info-list'); if(e) e.innerHTML = infoList(); return S; }, function(){ return null; }); }
  function cxBadge(src){ return '<span class="bl-src ' + src + '">' + ({ '원장':'🏛 원장', '상가관리':'🏪 상가관리', '분양':'📄 분양자료' }[src] || src) + '</span>'; }
  function cxOpen(id){
    if(!W.sdBldFull){ alert('종합 정보 모듈(sd_bldg_full.js)을 읽지 못했습니다 — 화면을 새로 고쳐 주세요'); return; }
    CX = { id:id, F:null, sug:null, rv:null, busy:'', msg:'' };
    var box = $('bl-cx'); if(!box){ box = document.createElement('div'); box.id = 'bl-cx'; box.className = 'bl-cx'; box.onclick = function(e){ if(e.target === box) cxClose(); }; document.body.appendChild(box); }
    box.style.display = 'flex'; box.innerHTML = '<div class="bl-cx-box"><div class="bl-cx-sec">불러오는 중…</div></div>';
    cxReload(true);
  }
  function cxClose(){ var b = $('bl-cx'); if(b){ b.style.display = 'none'; b.innerHTML = ''; } CX = null; }
  function cxReload(force){
    if(!CX) return; var id = CX.id;
    return cxSide(force).then(function(){ return Promise.all([W.sdBldFull.full(id), W.sdBldFull.suggest(id).catch(function(){ return []; })]); })
      .then(function(a){ if(!CX || CX.id !== id) return; CX.F = a[0]; CX.sug = a[1]; cxPaint(); }, function(e){ if(CX){ CX.msg = '<span class="bl-warn">' + esc(e.message || String(e)) + '</span>'; cxPaint(); } });
  }
  function cxPaint(){
    var box = $('bl-cx'); if(!box || !CX) return;
    var F = CX.F; if(!F){ box.innerHTML = '<div class="bl-cx-box"><div class="bl-cx-hd"><h3>종합 정보</h3><button class="bl-cx-x" onclick="sdBldLedger.close()">✕</button></div><div class="bl-cx-sec">' + (CX.msg || '불러오는 중…') + '</div></div>'; return; }
    var s = F.src, G = { '법적':'건물 (법적값 — 원장 우선)', '현장':'상가 (현장값 — 상가관리 우선)', '추가':'원장에 없는 값' }, lastG = '';
    var rows = F.rows.map(function(r){ var h = ''; if(r.g !== lastG){ lastG = r.g; h = '<tr class="bl-gh"><td colspan="3">' + G[r.g] + '</td></tr>'; } return h + '<tr><td class="k">' + esc(r.label) + '</td><td' + (r.warn ? ' class="bl-warn"' : '') + '>' + esc(r.v) + '</td><td style="width:90px">' + cxBadge(r.src) + '</td></tr>'; }).join('');
    var fl = '';
    if(F.floors){
      var D = F.floors.dongs;
      fl = '<div class="bl-cx-sec"><h4>층별 상가 호실 ' + cxBadge(F.floors.src) + '</h4><table class="bl-ft" style="max-width:520px"><tr><th>층</th>' + D.map(function(d){ return '<th style="text-align:right">' + esc(d) + '</th>'; }).join('') + '<th style="text-align:right">계</th></tr>'
        + F.floors.list.map(function(r){ return '<tr><td>' + esc(r.fl) + '</td>' + D.map(function(d){ return '<td style="text-align:right">' + (r.by[d] || '—') + '</td>'; }).join('') + '<td style="text-align:right"><b>' + r.n + '</b></td></tr>'; }).join('')
        + '<tr><td><b>계</b></td>' + D.map(function(d){ return '<td style="text-align:right"><b>' + F.floors.list.reduce(function(t, r){ return t + (r.by[d] || 0); }, 0) + '</b></td>'; }).join('') + '<td style="text-align:right"><b>' + F.floors.list.reduce(function(t, r){ return t + r.n; }, 0) + '</b></td></tr></table></div>';
    }
    var sug = CX.sug || [], cur = s.sangga ? s.sangga.id : '';
    var opts = '<option value="">— 상가관리 건물 고르기 —</option>' + sug.map(function(g){ return '<option value="' + esc(g.id) + '"' + (g.id === cur ? ' selected' : '') + '>' + (g.score >= 2 && g.id !== cur ? '★ ' : '') + esc(g.name) + ' (' + g.n + '실)' + (g.taken ? ' · 지금 「' + esc(g.taken) + '」에 연결' : '') + '</option>'; }).join('');
    var top = sug.filter(function(g){ return g.score >= 2; })[0];
    var bun = s.bunyang;
    box.innerHTML = '<div class="bl-cx-box">'
      + '<div class="bl-cx-hd"><h3>🏬 ' + esc(F.name) + '</h3><small>' + esc(F.type || '') + ' · 송도동 ' + esc(F.jb) + (F.road ? ' · ' + esc(F.road) : '') + '</small><button class="bl-cx-x" onclick="sdBldLedger.close()" title="닫기">✕</button></div>'
      + '<div class="bl-cx-sec"><div class="bl-chips"><span class="bl-chip on">🏛 원장 ✓</span><span class="bl-chip' + (s.sangga ? ' on' : '') + '">🏪 상가관리 ' + (s.sangga ? '「' + esc(s.sangga.name) + '」' : '연결 안 됨') + '</span><span class="bl-chip' + (bun ? ' on' : '') + '">📄 분양자료 ' + (bun ? esc(bun.at) : '없음') + '</span></div>'
      + '<div class="bl-sub" style="margin-top:6px">세 자료를 볼 때마다 합칩니다. 값이 다르면 <b>건물 항목은 원장</b>, <b>상가 호실·층·입점은 상가관리</b>가 먼저이고, 빈 값·0 은 다음 자료로 넘어갑니다.</div>' + (CX.msg ? '<div class="bl-msg">' + CX.msg + '</div>' : '') + '</div>'
      + '<div class="bl-cx-sec"><h4>종합 정보</h4><table class="bl-ft">' + rows + '</table></div>'
      + fl
      + '<div class="bl-cx-sec"><h4>🏪 상가관리 연결</h4><div class="bl-row" style="margin:0"><select id="bl-cx-sg" class="bl-in-t" style="min-width:280px">' + opts + '</select>'
      + '<button type="button" class="bl-btn pri" onclick="sdBldLedger.link()"' + (CX.busy ? ' disabled' : '') + '>연결</button>' + (cur ? '<button type="button" class="bl-btn" onclick="sdBldLedger.unlink()">연결 끊기</button>' : '') + '</div>'
      + '<div class="bl-sub">' + (cur ? '연결된 상가관리 건물의 호실·층·입점 현황이 종합 정보에 들어갑니다 (소유자·임차인 이름·연락처는 넣지 않습니다).' : top ? '★ 표시가 이름이 비슷한 건물입니다 — 고른 뒤 「연결」을 누르세요.' : '상가관리에 이 건물이 없으면 연결하지 않아도 됩니다.') + '</div></div>'
      + '<div class="bl-cx-sec"><h4>📄 상가분양자료</h4>'
      + (bun ? '<div class="bl-sub">' + esc(bun.at) + (bun.by ? ' · ' + esc(bun.by) : '') + (bun.files && bun.files.length ? ' · ' + esc(bun.files.join(', ')) : '') + '</div>' : '<div class="bl-sub">분양 홍보 PDF·JPEG 를 넣으면 AI 가 주차·전용률·층별 상가 호실 등을 뽑고, 확인한 뒤 저장합니다.</div>')
      + '<div class="bl-row"><label class="bl-btn pri" style="cursor:pointer">' + (CX.busy === 'ai' ? '⏳ 읽는 중…' : '📄 상가분양자료 추가 (PDF·JPEG)') + '<input type="file" id="bl-cx-f" accept="application/pdf,image/*" multiple hidden onchange="sdBldLedger.bunFiles(this.files)"' + (CX.busy ? ' disabled' : '') + '></label>'
      + '<button type="button" class="bl-btn" onclick="sdBldLedger.bunEdit()">' + (bun ? '✏️ 고치기' : '✏️ 직접 입력') + '</button>' + (bun ? '<button type="button" class="bl-btn" onclick="sdBldLedger.bunDel()">지우기</button>' : '') + '</div>'
      + '<div id="bl-cx-rv">' + (CX.rv ? cxRvHtml() : '') + '</div></div>'
      + '</div>';
  }
  /* 확인 화면 — 뽑은 값(고칠 수 있음) 옆에 지금 원장·상가관리 값 */
  var RVCMP = { addr:'주소', scale:'규모', plA:'대지면적', tot:'연면적', pkg:'주차', shopHo:'상가 호실', shopFloors:'상가 층', done:'사용승인' };
  function cxRvHtml(){
    var R = CX.rv, d = R.d, F = CX.F, cmp = function(f){ var lb = RVCMP[f]; if(!lb) return ''; var r = F.rows.filter(function(x){ return x.label === lb && x.src !== '분양'; })[0]; return r ? '<span class="cur">' + (r.src === '상가관리' ? '🏪 ' : '🏛 ') + esc(r.v) + '</span>' : ''; };
    return '<div class="bl-rv"><b>' + (R.files && R.files.length ? '📄 뽑은 값 확인 — ' + esc(R.files.join(', ')) : '✏️ 분양자료 직접 입력') + '</b>'
      + (d.note ? '<div class="bl-sub bl-warn">AI 메모: ' + esc(d.note) + '</div>' : '')
      + '<div class="bl-sub">틀린 값은 고치고 없는 값은 비워 두세요. 오른쪽은 지금 원장·상가관리 값 — 다르면 종합 정보에서는 그쪽이 먼저입니다.</div>'
      + '<table class="bl-ft"><tr><th>항목</th><th>분양자료 값</th><th>지금 원장·상가관리</th></tr>'
      + W.sdBldFull.FIELDS.map(function(f){ return '<tr><td class="k">' + esc(f[1]) + '</td><td><input data-rf="' + f[0] + '" value="' + esc(d[f[0]] == null ? '' : d[f[0]]) + '" oninput="sdBldLedger.rvSet(this)"></td><td>' + cmp(f[0]) + '</td></tr>'; }).join('')
      + '</table><div style="margin-top:8px"><b style="font-size:12px">층별 상가 호실</b> <span class="cur">(예: 1층 · A동 · 36 — 동 구분이 없으면 동은 비움)</span>'
      + (d.floors || []).map(function(x, i){ return '<div class="bl-flr"><input data-fi="' + i + '" data-fk="fl" value="' + esc(x.fl) + '" placeholder="층" oninput="sdBldLedger.rvFl(this)"><input data-fi="' + i + '" data-fk="dong" value="' + esc(x.dong) + '" placeholder="동" oninput="sdBldLedger.rvFl(this)"><input data-fi="' + i + '" data-fk="n" value="' + esc(x.n) + '" placeholder="호실 수" oninput="sdBldLedger.rvFl(this)"><button type="button" class="bl-btn" onclick="sdBldLedger.rvFlDel(' + i + ')">✕</button></div>'; }).join('')
      + '<button type="button" class="bl-btn" style="margin-top:4px" onclick="sdBldLedger.rvFlAdd()">+ 층 더하기</button></div>'
      + '<div class="bl-row" style="margin-top:10px"><button type="button" class="bl-btn pri" onclick="sdBldLedger.rvSave()">💾 저장 — 종합 정보에 반영</button><button type="button" class="bl-btn" onclick="sdBldLedger.rvCancel()">취소</button></div></div>';
  }
  function cxRv(d, files){ CX.rv = { d:JSON.parse(JSON.stringify(d || {})), files:files || [] }; if(!CX.rv.d.floors) CX.rv.d.floors = []; var e = $('bl-cx-rv'); if(e){ e.innerHTML = cxRvHtml(); e.scrollIntoView({ block:'nearest' }); } }
  function cxRvFloorsPaint(){ var e = $('bl-cx-rv'); if(e) e.innerHTML = cxRvHtml(); }
  var CXAPI = {
    open:cxOpen, close:cxClose,
    link:function(){ var v = ($('bl-cx-sg') || {}).value; if(!v){ alert('상가관리 건물을 고르세요'); return; } CX.busy = 'link'; W.sdBldFull.link(CX.id, v).then(function(){ CX.busy = ''; CX.msg = '<span style="color:#22783a">🏪 상가관리와 연결했습니다</span>'; cxReload(true); }, function(e){ CX.busy = ''; CX.msg = '<span class="bl-warn">연결 저장 실패: ' + esc(e.message) + '</span>'; cxPaint(); }); },
    unlink:function(){ if(!confirm('상가관리 연결을 끊을까요? (상가관리 자료는 그대로입니다)')) return; W.sdBldFull.link(CX.id, null).then(function(){ CX.msg = '연결을 끊었습니다'; cxReload(true); }); },
    bunFiles:function(fl){
      var files = Array.prototype.slice.call(fl || []); if(!files.length) return;
      var b = Object.assign({ id:CX.id }, CX.F.raw.ledger); CX.busy = 'ai'; CX.msg = '⏳ 분양자료 ' + files.length + '개를 AI 가 읽는 중… (30초 안팎)'; cxPaint();
      W.sdBldFull.extract(files, b).then(function(d){ CX.busy = ''; CX.msg = '✅ 다 읽었습니다 — 아래에서 확인하고 저장하세요'; cxPaint(); cxRv(d, files.map(function(f){ return f.name; })); },
        function(e){ CX.busy = ''; CX.msg = '<span class="bl-warn">' + esc(e.message || String(e)) + '</span>'; cxPaint(); });
    },
    bunEdit:function(){ var bun = CXS && CXS.bun[CX.id]; cxRv(bun ? bun.d : {}, bun ? bun.files : []); },
    bunDel:function(){ if(!confirm('이 건물의 분양자료를 지울까요? (원장·상가관리는 그대로입니다)')) return; W.sdBldFull.saveBun(CX.id, null).then(function(){ CX.msg = '분양자료를 지웠습니다'; cxReload(true); }); },
    rvSet:function(el){ var k = el.dataset.rf, f = W.sdBldFull.FIELDS.filter(function(x){ return x[0] === k; })[0], v = el.value.trim(); if(!v) delete CX.rv.d[k]; else CX.rv.d[k] = f && f[2] === 'num' ? (parseFloat(v.replace(/[^0-9.]/g, '')) || 0) : v; },
    rvFl:function(el){ var r = CX.rv.d.floors[+el.dataset.fi]; if(!r) return; r[el.dataset.fk] = el.dataset.fk === 'n' ? (parseInt(el.value.replace(/[^0-9]/g, ''), 10) || 0) : el.value.trim(); },
    rvFlAdd:function(){ CX.rv.d.floors.push({ fl:'', dong:'', n:0 }); cxRvFloorsPaint(); },
    rvFlDel:function(i){ CX.rv.d.floors.splice(i, 1); cxRvFloorsPaint(); },
    rvCancel:function(){ CX.rv = null; var e = $('bl-cx-rv'); if(e) e.innerHTML = ''; },
    rvSave:function(){
      var d = CX.rv.d; d.floors = (d.floors || []).filter(function(x){ return x.fl && x.n; }); delete d.note;
      var keep = Object.keys(d).filter(function(k){ return k !== 'floors'; }).length || d.floors.length;
      if(!keep){ alert('넣은 값이 없습니다'); return; }
      W.sdBldFull.saveBun(CX.id, d, CX.rv.files).then(function(){ CX.rv = null; CX.msg = '<span style="color:#22783a">📄 분양자료를 저장했습니다 — 종합 정보에 반영</span>'; cxReload(true); }, function(e){ alert('저장 실패: ' + (e.message || e)); });
    }
  };
  function mount(){
    if(W.__brPopup) return true;
    var tc = $('tc24'), br = $('br-root'); if(!tc || !br) return false;
    if(!$('bl-root')){
      if(!$('bl-css')){ var st = document.createElement('style'); st.id = 'bl-css'; st.textContent = CSS; document.head.appendChild(st); }
      var di = document.createElement('div'); di.id = 'bl-info'; di.className = 'bl-card'; tc.appendChild(di);
      var d = document.createElement('div'); d.id = 'bl-root'; tc.appendChild(d);
      paintInfo(); infoLoad(); setTimeout(function(){ cxSide(); }, 1500);
      try{ ST.open = false; var last = JSON.parse(localStorage.getItem(LS) || 'null'); if(last && last.ledger){ ST.res = { at:last.at, dong:last.dong, totals:last.totals, counts:last.counts || {}, ledger:last.ledger, all:last.ledger, recap:[] }; ST.dong = last.dong || ST.dong; ST.open = false; ST.msg = '<span style="color:#888">' + esc(String(last.at || '').slice(0, 10)) + ' 에 받은 목록 (파일 내려받기는 다시 받은 뒤에 전체 목록이 들어갑니다)</span>'; } }catch(e){}
      paint();
    }
    return true;
  }
  var tries = 0, tm = setInterval(function(){ if(mount() || ++tries > 120) clearInterval(tm); }, 500);
  W.sdBldLedger = { run:run, download:download, paint:paint,
    view:function(v){ ST.view = v; paint(); },
    q:function(v){ ST.q = v; var e = $('bl-tbl'); if(e) e.innerHTML = tableList(); },
    toggle:function(){ ST.open = !ST.open; paint(); },
    state:function(){ return ST; }, _rec:rec, _cat:catOf,
    infoToggle:function(){ INFO.open = !INFO.open; paintInfo(); },
    infoT:function(t){ INFO.t = t; paintInfo(); },
    infoQ:function(v){ INFO.q = v; var e = $('bl-info-list'); if(e) e.innerHTML = infoList(); },
    infoCsv:infoCsv };
  Object.keys(CXAPI).forEach(function(k){ W.sdBldLedger[k] = CXAPI[k]; });
  /* 다른 화면에서 쓰는 상가 원장 — sdBldInfo.load().then(d => …) · find('혜인프라자') · byJibun('21-13') */
  W.sdBldInfo = { load:infoLoad,
    find:function(nm){ var d = INFO.d; if(!d) return null; var k = String(nm || '').trim(); var id = d.alias[k] || d.alias[k.replace(/\s/g, '')] || d.alias[k.replace(/^송도\s*/, '')]; return id ? d.bldg[id] : null; },
    byJibun:function(jb){ var d = INFO.d; if(!d) return []; return (d.jidx['송도동|' + String(jb || '').trim()] || []).map(function(id){ return d.bldg[id]; }); } };
})();
