/* ═════════════════════════════════════════════════════════════════
   🏪 상가 건물 원장 받기 (sd_data.html → 🏗 건축물대장 탭 아래 · window.sdBldLedger)  2026-10-10
   · 법정동(기본 송도동) 하나의 건축물대장 표제부 전체(+총괄표제부)를 지번 없이 한꺼번에 받는다
   · 주건축물 중 주용도 제1·2종근린생활시설·판매시설 = 「상가」 (집합·일반 모두)
     공동주택인데 기타용도에 근린·판매 = 「주상복합」, 업무시설인데 근린·판매 = 「업무복합」 (표시만, 다음 단계용)
   · 결과: ① 화면 요약·목록 ② Firebase sd_bldg_ledger_raw (상가 목록) ③ 「원장 파일 내려받기」
     — 이 파일을 Claude 에게 주면 건물명 정리·중복 묶기·확인을 거쳐 최종 원장 sd_bldg_info.json 으로 완성한다
     (파일에는 오피스 원장 다음 단계에 쓸 전체 주건축물 목록도 함께 담는다)
   · 인증키·법정동코드는 S실거래가 탭의 것(sdKR.key · sdKR.umd)을 그대로 쓴다. 호출은 쪽(page)마다 1회
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
    return '<div class="bl-tabs">' + tabs + '<input class="bl-q" id="bl-q" placeholder="건물명·지번·도로명 찾기" value="' + esc(ST.q) + '" oninput="sdBldLedger.q(this.value)"></div>'
      + '<div class="bl-scroll"><table class="bl-t"><thead><tr><th>건물명</th><th>동</th><th>지번</th><th>도로명</th><th>대장</th><th>주용도</th><th>기타용도</th><th>층(지상/지하)</th><th>연면적㎡</th><th>호수</th><th>주차</th><th>사용승인</th></tr></thead><tbody>'
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
      + '<div class="bl-scroll"><table class="bl-t"><thead><tr><th>건물명</th><th>유형</th><th>지번</th><th>도로명</th><th>집합/일반</th><th>주용도</th><th>층(지상/지하)</th><th>연면적</th><th>호수</th><th>주차</th><th>사용승인</th><th>확인</th></tr></thead><tbody>'
      + L.map(function(r){
          return '<tr><td><b>' + esc(r.n) + '</b>' + (r.dongs ? ' <small>(' + r.dongs.length + '개 동)</small>' : '') + '</td><td>' + esc(r.t) + '</td><td>' + esc(r.jb) + '</td><td>' + esc(r.road) + '</td><td>' + esc(r.kind) + '</td>'
            + '<td class="bl-etc">' + esc((r.main || []).join('·')) + '</td><td>' + r.gf + ' / ' + r.bf + '</td><td style="text-align:right">' + Math.round(r.tot).toLocaleString() + '㎡<br><small>' + Math.round(r.tot / 3.3058).toLocaleString() + '평</small></td>'
            + '<td style="text-align:right">' + (r.ho || '') + '</td><td style="text-align:right">' + (r.pkg || '') + '</td><td>' + esc(r.use) + '</td><td class="bl-etc" style="color:#c62828">' + esc((r.chk || []).join(' / ')) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      + '<div class="bl-sub">' + L.length + '개 건물 · 연면적·호수·주차는 건축물대장 표제부 합계(여러 동이면 합친 값) · 일반건축물은 호수가 0으로 나옵니다 · ' + esc(D.src || '') + '</div></div>';
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
    + '.bl-t td{padding:4px 7px;border-bottom:1px solid #f0f0f0;white-space:nowrap}.bl-t td.bl-etc{white-space:normal;min-width:160px;max-width:280px;color:#666}';
  function mount(){
    if(W.__brPopup) return true;
    var tc = $('tc24'), br = $('br-root'); if(!tc || !br) return false;
    if(!$('bl-root')){
      if(!$('bl-css')){ var st = document.createElement('style'); st.id = 'bl-css'; st.textContent = CSS; document.head.appendChild(st); }
      var di = document.createElement('div'); di.id = 'bl-info'; di.className = 'bl-card'; tc.appendChild(di);
      var d = document.createElement('div'); d.id = 'bl-root'; tc.appendChild(d);
      paintInfo(); infoLoad();
      try{ ST.open = false; var last = JSON.parse(localStorage.getItem(LS) || 'null'); if(last && last.ledger){ ST.res = { at:last.at, dong:last.dong, totals:last.totals, counts:last.counts || {}, ledger:last.ledger, all:last.ledger, recap:[] }; ST.dong = last.dong || ST.dong; ST.open = false; ST.msg = '<span style="color:#888">' + esc(String(last.at || '').slice(0, 10)) + ' 에 받은 목록 (파일 내려받기는 다시 받은 뒤에 전체 목록이 들어갑니다)</span>'; } }catch(e){}
      paint();
    }
    return true;
  }
  var tries = 0, tm = setInterval(function(){ if(mount() || ++tries > 120) clearInterval(tm); }, 500);
  W.sdBldLedger = { run:run, download:download, paint:paint,
    view:function(v){ ST.view = v; paint(); },
    q:function(v){ ST.q = v; var keep = $('bl-q'), pos = keep ? keep.selectionStart : 0; paint(); var k2 = $('bl-q'); if(k2){ k2.focus(); k2.selectionStart = k2.selectionEnd = pos; } },
    toggle:function(){ ST.open = !ST.open; paint(); },
    state:function(){ return ST; }, _rec:rec, _cat:catOf,
    infoToggle:function(){ INFO.open = !INFO.open; paintInfo(); },
    infoT:function(t){ INFO.t = t; paintInfo(); },
    infoQ:function(v){ INFO.q = v; var k = $('bl-iq'), pos = k ? k.selectionStart : 0; paintInfo(); var k2 = $('bl-iq'); if(k2){ k2.focus(); k2.selectionStart = k2.selectionEnd = pos; } },
    infoCsv:infoCsv };
  /* 다른 화면에서 쓰는 상가 원장 — sdBldInfo.load().then(d => …) · find('혜인프라자') · byJibun('21-13') */
  W.sdBldInfo = { load:infoLoad,
    find:function(nm){ var d = INFO.d; if(!d) return null; var k = String(nm || '').trim(); var id = d.alias[k] || d.alias[k.replace(/\s/g, '')] || d.alias[k.replace(/^송도\s*/, '')]; return id ? d.bldg[id] : null; },
    byJibun:function(jb){ var d = INFO.d; if(!d) return []; return (d.jidx['송도동|' + String(jb || '').trim()] || []).map(function(id){ return d.bldg[id]; }); } };
})();
