/* ═════════════════════════════════════════════════════════════════
   🏬 상가건물 종합 정보 (window.sdBldFull)  2026-10-10
   종합 정보 = ① 상가 원장(건축물대장 · sd_bldg_info.json)
             + ② 상가관리 시스템(sd_buildings — 연결된 건물만)
             + ③ 상가 분양홍보자료(sd_bldg_bunyang — 「📄 상가분양자료 추가」로 넣은 것)
   · 종합 정보는 따로 저장하지 않는다 — 볼 때마다 세 자료를 합친다 (상가관리를 고치면 바로 반영)
   · 값이 다르면 항목별 우선순위 (2026-10-10 대표님 결정)
       현장값  (상가 호실 수·층별 호실·입점 현황)            : 상가관리 → 분양자료 → 원장
       법적값  (대지·연면적·층수·주용도·사용승인·지번·주소·주차) : 원장 → 상가관리 → 분양자료
       원장에 없는 값 (전용률·용도지역·용적률·건폐율·시행·시공) : 상가관리 → 분양자료
   · 빈 값과 0 은 「자료 없음」 — 다음 순위로 넘어간다
   · 복합건물(주상복합·업무복합)의 대장 호실 수는 업무·주거가 섞여 있어 상가 호실로 쓰지 않는다
   · 상가관리의 소유자·임차인 이름·전화는 절대 꺼내지 않는다 (호실 수·층·입점 여부만 센다)
   저장 키 (sd_bldg_* — 데이터 백업 「상가」 묶음에 자동 포함)
     sd_bldg_xref     { 원장id: 상가관리 건물 id }
     sd_bldg_bunyang  { 원장id: { at, by, files[], d:{…뽑은 값} } }
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.sdBldFull) return;
  var W = window, XKEY = 'sd_bldg_xref', BKEY = 'sd_bldg_bunyang';
  var MIX = /복합/;                         // 「오피스텔·업무 복합 상가」「주상복합 상가」
  var LED = null, LEDP = null, SIDE = null, SIDEAT = 0, storeFn = null;

  function num(v){ var x = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(x) ? 0 : x; }
  function has(v){ if(v == null) return false; if(typeof v === 'number') return v !== 0 && !isNaN(v); var s = String(v).trim(); return !!s && s !== '0' && s !== '-'; }
  function nk(s){ return String(s || '').replace(/^\(이름 없음\)\s*/, '').replace(/[\s()·,.\-_]/g, '').replace(/^송도/, '').replace(/(상가|아파트)$/, '').toLowerCase(); }
  function me(){ try{ var s = JSON.parse(localStorage.getItem('sd_auth_session') || '{}') || {}; return s.name || s.email || ''; }catch(e){ return ''; } }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function m2(v){ return Math.round(num(v)).toLocaleString() + '㎡ (약 ' + Math.round(num(v) / 3.3058).toLocaleString() + '평)'; }

  /* ── 자료 창고 ── */
  function store(){
    if(storeFn) return Promise.resolve(storeFn());
    return W.storage && W.storage.get ? Promise.resolve(W.storage) : Promise.reject(new Error('자료 창고(Firebase)가 아직 연결되지 않았습니다'));
  }
  function sget(k){
    var ls = null; try{ ls = localStorage.getItem(k); }catch(e){}
    return store().then(function(S){ return S.get(k); }).then(function(r){ return r && r.value ? r.value : ls; }, function(){ return ls; });
  }
  function sset(k, v){
    try{ localStorage.setItem(k, v); }catch(e){}
    return store().then(function(S){ return S.set(k, v); });
  }
  function pj(s, d){ try{ var v = JSON.parse(s); return v == null ? d : v; }catch(e){ return d; } }

  function load(){
    if(LED) return Promise.resolve(LED);
    if(LEDP) return LEDP;
    LEDP = fetch('sd_bldg_info.json?v=' + encodeURIComponent(W.SD_VERSION || W.SD_VER || Date.now()), { cache:'no-cache' })
      .then(function(r){ if(!r.ok) throw new Error('상가 원장 파일(sd_bldg_info.json)을 읽지 못했습니다 (' + r.status + ')'); return r.json(); })
      .then(function(d){ LED = d; return d; });
    LEDP.catch(function(){ LEDP = null; });
    return LEDP;
  }
  /* 상가관리·연결·분양자료 — 30초 안에 다시 부르면 가진 것을 쓴다 (force 면 새로) */
  function side(force){
    if(SIDE && !force && Date.now() - SIDEAT < 30000) return Promise.resolve(SIDE);
    return Promise.all([sget(XKEY), sget(BKEY), sget('sd_buildings')]).then(function(a){
      var bl = pj(a[2], []); if(!Array.isArray(bl)) bl = [];
      SIDE = { xref:pj(a[0], {}) || {}, bun:pj(a[1], {}) || {}, bldgs:bl };
      SIDEAT = Date.now(); return SIDE;
    });
  }
  function sanggaOf(S, id){ var sid = S.xref[id]; return sid ? (S.bldgs.filter(function(b){ return b && b.id === sid; })[0] || null) : null; }

  /* ── 상가관리 호실 → 층·동 집계 (이름·전화는 읽지 않는다) ── */
  function flNo(f){ var s = String(f || ''), m = /(지하|B)\s*(\d+)/i.exec(s); if(m) return -(+m[2]); m = /(\d+)/.exec(s); return m ? +m[1] : 0; }
  function flNm(n){ return n < 0 ? '지하' + (-n) + '층' : n + '층'; }
  function dongOf(ho){ var m = /^\s*([A-Za-z])\s*-?\s*\d/.exec(String(ho || '')); return m ? m[1].toUpperCase() + '동' : ''; }
  function sgStat(b){
    var P = (b && Array.isArray(b.props)) ? b.props : [];
    if(!P.length) return null;
    var fl = {}, dongs = {}, occ = 0, unsold = 0, aMin = 0, aMax = 0;
    P.forEach(function(p){
      var f = flNo(p.floor) || flNo(p.ho && String(p.ho).replace(/^[A-Za-z]\s*-?/, '').slice(0, -2)), d = dongOf(p.ho);
      var r = fl[f] = fl[f] || { fl:flNm(f), no:f, by:{}, n:0 }; r.n++; if(d){ r.by[d] = (r.by[d] || 0) + 1; dongs[d] = 1; }
      if(has(p.tenant)) occ++;
      if(/미분양/.test(p.status || '')) unsold++;
      var a = num(p.area); if(a > 0){ aMin = aMin ? Math.min(aMin, a) : a; aMax = Math.max(aMax, a); }
    });
    var list = Object.keys(fl).map(function(k){ return fl[k]; }).sort(function(x, y){ return x.no - y.no; });
    return { n:P.length, floors:list, dongs:Object.keys(dongs).sort(), occ:occ, vac:P.length - occ, unsold:unsold, aMin:aMin, aMax:aMax };
  }
  function floorSpan(list, dongs){
    var span = function(ns){ ns = ns.filter(function(x){ return x; }).sort(function(a, b){ return a - b; }); if(!ns.length) return ''; var a = ns[0], z = ns[ns.length - 1]; return a === z ? flNm(a) : (a < 0 ? '지하' + (-a) : a) + '~' + flNm(z); };
    if(dongs && dongs.length) return dongs.map(function(d){ return d + ' ' + span(list.filter(function(r){ return r.by[d]; }).map(function(r){ return r.no; })); }).join(' · ');
    return span(list.map(function(r){ return r.no; }));
  }
  function bunFloors(d){
    var F = (d && Array.isArray(d.floors)) ? d.floors : [];
    if(!F.length) return null;
    var fl = {}, dongs = {};
    F.forEach(function(x){ var no = flNo(x.fl), n = num(x.n); if(!n) return; var r = fl[no] = fl[no] || { fl:flNm(no), no:no, by:{}, n:0 }; r.n += n; var dn = String(x.dong || '').trim(); if(dn){ dn = /동$/.test(dn) ? dn : dn + '동'; r.by[dn] = (r.by[dn] || 0) + n; dongs[dn] = 1; } });
    var list = Object.keys(fl).map(function(k){ return fl[k]; }).sort(function(x, y){ return x.no - y.no; });
    return list.length ? { floors:list, dongs:Object.keys(dongs).sort(), n:list.reduce(function(s, r){ return s + r.n; }, 0) } : null;
  }

  /* ── 합치기 ── */
  function merge(b, sg, bun){
    var d = (bun && bun.d) || {}, st = sgStat(sg), bf = bunFloors(d), rows = [];
    var pick = function(g, label, cands){   // cands: [[src, raw, shown]] — 앞에서부터 값이 있는 것
      for(var i = 0; i < cands.length; i++){ var c = cands[i]; if(c && has(c[1])) return rows.push({ g:g, label:label, v:c[2] != null ? c[2] : String(c[1]), src:c[0] }); }
    };
    var dongN = b.dongs ? b.dongs.length : 0;
    /* 법적값 — 원장 → 상가관리 → 분양 */
    pick('법적', '주소', [['원장', b.road, '인천광역시 연수구 ' + b.road], ['분양', d.addr]]);
    pick('법적', '지번', [['원장', b.jb, '송도동 ' + b.jb]]);
    pick('법적', '규모', [['원장', b.gf, (b.bf ? '지하 ' + b.bf + '층 · ' : '') + '지상 ' + b.gf + '층' + (dongN > 1 ? ' · ' + dongN + '개 동' : '')], ['분양', d.scale]]);
    pick('법적', '대지면적', [['원장', b.plA, m2(b.plA)], ['분양', d.plA, m2(d.plA)]]);
    pick('법적', '연면적', [['원장', b.tot, m2(b.tot)], ['분양', d.tot, m2(d.tot)]]);
    var use = String(b.etc || (b.main || []).join(', ')).split(/[,·]/).map(function(x){ return x.replace(/\(.*?\)/g, '').trim(); }).filter(function(x, i, a){ return x && a.indexOf(x) === i; }).slice(0, 4).join(' · ');
    pick('법적', '주용도', [['원장', use]]);
    var u = /(\d{4})\D?(\d{1,2})/.exec(b.use || '');
    pick('법적', '사용승인', [['원장', b.use, u ? u[1] + '년 ' + (+u[2]) + '월' : b.use], ['분양', d.done]]);
    pick('법적', '주차', [['원장', b.pkg, num(b.pkg).toLocaleString() + '대'], ['분양', d.pkg, num(d.pkg).toLocaleString() + '대' + (has(d.pkgLegal) ? ' (법정 ' + num(d.pkgLegal).toLocaleString() + '대)' : '')]]);
    pick('법적', '승강기', [['원장', b.ev, b.ev + '대']]);
    /* 현장값 — 상가관리 → 분양 → 원장 (복합건물 대장 호실은 상가 호실이 아님) */
    var mix = MIX.test(b.t || ''), ledHo = !mix && b.kind === '집합' ? b.ho : 0;
    pick('현장', '상가 호실', [['상가관리', st && st.n, st && st.n + '실'], ['분양', d.shopHo, num(d.shopHo) + '실'], ['분양', bf && bf.n, bf && bf.n + '실'], ['원장', ledHo, ledHo + '실']]);
    if(!rows.some(function(r){ return r.label === '상가 호실'; }) && mix && has(b.ho)) rows.push({ g:'현장', label:'상가 호실', v:'확인 필요 — 대장 전체 ' + num(b.ho).toLocaleString() + '실은 업무·주거 포함', src:'원장', warn:true });
    pick('현장', '상가 층', [['상가관리', st && floorSpan(st.floors, st.dongs)], ['분양', d.shopFloors], ['분양', bf && floorSpan(bf.floors, bf.dongs)]]);
    if(st) pick('현장', '입점 현황', [['상가관리', st.n, '업종 입점 ' + st.occ + '실 · 빈 호실 ' + st.vac + '실' + (st.unsold ? ' (미분양 ' + st.unsold + ')' : '')]]);
    if(st && st.aMax) pick('현장', '호실 전용면적', [['상가관리', st.aMax, (st.aMin === st.aMax ? '' : Math.round(st.aMin * 10) / 10 + ' ~ ') + Math.round(st.aMax * 10) / 10 + '㎡']]);
    /* 원장에 없는 값 — 상가관리 → 분양 */
    pick('추가', '상가 전용률', [['분양', d.shopRate]]);
    pick('추가', '용도지역', [['분양', d.zone]]);
    pick('추가', '용적률', [['분양', d.far]]);
    pick('추가', '건폐율', [['분양', d.bcr]]);
    pick('추가', '건축면적', [['분양', d.archA, m2(d.archA)]]);
    pick('추가', '시행', [['분양', d.developer]]);
    pick('추가', '시공', [['분양', d.builder]]);
    pick('추가', '컨셉', [['분양', d.concept]]);
    var floors = st ? { src:'상가관리', list:st.floors, dongs:st.dongs } : bf ? { src:'분양', list:bf.floors, dongs:bf.dongs } : null;
    return {
      id:b.id, name:String(b.n || '').replace(/^\(이름 없음\)\s*/, ''), type:b.t, jb:b.jb, road:b.road, mix:mix,
      addr:'인천광역시 연수구 ' + (b.road || '송도동 ' + b.jb),
      src:{ ledger:true, sangga:sg ? { id:sg.id, name:sg.name } : null, bunyang:bun ? { at:bun.at, by:bun.by, files:bun.files || [] } : null },
      rows:rows, floors:floors, raw:{ ledger:b, bunyang:d }
    };
  }
  function val(F, label){ var r = F.rows.filter(function(x){ return x.label === label; })[0]; return r && !r.warn ? r.v : ''; }
  /* 영상 개요 카드처럼 짧게 — 상가 기준 */
  function facts(F){
    var f = [], add = function(k, v){ if(v) f.push([k, v]); };
    add('유형', F.type); add('규모', val(F, '규모')); add('연면적', val(F, '연면적'));
    add('상가', val(F, '상가 호실') + (val(F, '상가 층') ? ' · ' + val(F, '상가 층') : ''));
    add('사용승인', val(F, '사용승인')); add('주차', val(F, '주차')); add('주용도', val(F, '주용도')); add('용도지역', val(F, '용도지역'));
    return f.slice(0, 8);
  }
  function full(id){
    return load().then(function(L){
      var b = L.bldg[id]; if(!b) throw new Error('원장에 없는 건물입니다 (' + id + ')');
      b = Object.assign({ id:id }, b);
      return side().then(function(S){ return merge(b, sanggaOf(S, id), S.bun[id] || null); }, function(){ return merge(b, null, null); });
    });
  }

  /* ── 상가관리 연결 ── */
  function suggest(id){
    return Promise.all([load(), side()]).then(function(a){
      var b = a[0].bldg[id], S = a[1], k = nk(b && b.n), taken = {};
      Object.keys(S.xref).forEach(function(x){ if(x !== id) taken[S.xref[x]] = x; });
      return S.bldgs.filter(function(g){ return g && g.id; }).map(function(g){
        var gk = nk(g.name), sc = !k || !gk ? 0 : gk === k ? 3 : (gk.indexOf(k) >= 0 || k.indexOf(gk) >= 0) ? 2 : 0;
        return { id:g.id, name:g.name, n:(g.props || []).length, score:sc, taken:taken[g.id] ? (a[0].bldg[taken[g.id]] || {}).n || taken[g.id] : '' };
      }).sort(function(x, y){ return y.score - x.score || String(x.name).localeCompare(String(y.name), 'ko'); });
    });
  }
  function link(id, sgId){
    return sget(XKEY).then(function(v){
      var X = pj(v, {}) || {};
      if(sgId){ Object.keys(X).forEach(function(k){ if(X[k] === sgId && k !== id) delete X[k]; }); X[id] = sgId; } else delete X[id];
      return sset(XKEY, JSON.stringify(X)).then(function(){ if(SIDE) SIDE.xref = X; return X; });
    });
  }
  /* 상가관리에서 건물을 새로 만들 때 — 이름이 원장과 (거의) 같으면 연결해 둔다 */
  function autoLink(sgId, name){
    return load().then(function(L){
      var k = nk(name); if(!k) return null;
      var ids = Object.keys(L.bldg).filter(function(i){ return nk(L.bldg[i].n) === k; });
      if(ids.length > 1) return null;   // 같은 이름 건물이 여러 곳(예: 풍림아이원 상가동) — 종합 정보 창에서 직접 고른다
      if(!ids.length){ var al = Object.keys(L.alias || {}).filter(function(a){ return nk(a) === k; }).map(function(a){ return L.alias[a]; }).filter(function(x, i, arr){ return arr.indexOf(x) === i; }); if(al.length === 1) ids = al; }
      if(ids.length !== 1) return null;
      return sget(XKEY).then(function(v){ var X = pj(v, {}) || {}; if(X[ids[0]]) return null; return link(ids[0], sgId).then(function(){ return ids[0]; }); });
    });
  }
  function names(){ return load().then(function(L){ return Object.keys(L.bldg).map(function(i){ return L.bldg[i].n; }).filter(function(n){ return !/^\(이름 없음\)/.test(n); }).filter(function(n, i, a){ return a.indexOf(n) === i; }).sort(); }); }

  /* ── 분양자료 저장 ── */
  function saveBun(id, d, files){
    return sget(BKEY).then(function(v){
      var B = pj(v, {}) || {};
      if(d) B[id] = { at:today(), by:me(), files:files || (B[id] && B[id].files) || [], d:d }; else delete B[id];
      return sset(BKEY, JSON.stringify(B)).then(function(){ if(SIDE) SIDE.bun = B; return B[id] || null; });
    });
  }

  /* ── 분양홍보자료에서 뽑기 (Claude — SJRWS 에 등록된 Anthropic 키) ── */
  var FIELDS = [
    ['addr', '대지위치·주소', 'text'], ['scale', '규모 (예: 지하 2층 ~ 지상 20층, 2개 동)', 'text'], ['plA', '대지면적 ㎡', 'num'], ['archA', '건축면적 ㎡', 'num'], ['tot', '연면적 ㎡', 'num'],
    ['zone', '용도지역·지구', 'text'], ['far', '용적률', 'text'], ['bcr', '건폐율', 'text'], ['pkg', '주차 대수', 'num'], ['pkgLegal', '법정 주차', 'num'],
    ['shopHo', '상가 호실 수', 'num'], ['shopFloors', '상가 층 (예: A동 1~4층 · B동 1~3층)', 'text'], ['shopRate', '상가 전용률', 'text'],
    ['developer', '시행', 'text'], ['builder', '시공', 'text'], ['done', '준공·입점 시기', 'text'], ['concept', '컨셉 문구', 'text']
  ];
  function ckey(){ try{ return (typeof W.getClaudeKey === 'function' ? W.getClaudeKey() : localStorage.getItem('sdj_claude_api_key')) || ''; }catch(e){ return ''; } }
  function b64(file){ return new Promise(function(res, rej){ var r = new FileReader(); r.onload = function(){ res(String(r.result).split(',')[1]); }; r.onerror = function(){ rej(new Error('파일을 읽지 못했습니다')); }; r.readAsDataURL(file); }); }
  function shrink(file){   // 사진은 긴 변 2000px JPEG 로 줄여 보낸다 (Claude 한 장 5MB 한도)
    return new Promise(function(res, rej){
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function(){ var k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.88).split(',')[1]); };
      im.onerror = function(){ URL.revokeObjectURL(u); rej(new Error('그림을 열지 못했습니다: ' + file.name)); };
      im.src = u;
    });
  }
  function extract(files, b){
    var k = ckey();
    if(!k){ if(typeof W.setClaudeKey === 'function' && confirm('Anthropic(Claude) API 키가 설정되지 않았습니다.\n지금 설정하시겠습니까?')) W.setClaudeKey(); k = ckey(); if(!k) return Promise.reject(new Error('Claude API 키가 없습니다 — 「✏️ 직접 입력」으로 넣을 수도 있습니다')); }
    return Promise.all(files.map(function(f){
      if(/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)){ if(f.size > 30 * 1024 * 1024) throw new Error('PDF 가 30MB 를 넘습니다: ' + f.name); return b64(f).then(function(x){ return { type:'document', source:{ type:'base64', media_type:'application/pdf', data:x } }; }); }
      return shrink(f).then(function(x){ return { type:'image', source:{ type:'base64', media_type:'image/jpeg', data:x } }; });
    })).then(function(parts){
      var prompt = '첨부한 것은 「' + (b.n || '') + '」(인천 연수구 송도동 ' + (b.jb || '') + ') 상가 분양 홍보자료입니다. 부동산 중개사무소가 상가 매매·임대 영업에 쓸 건물 정보만 뽑아 주세요.\n'
        + '규칙\n- 자료에 적힌 값만. 없거나 읽을 수 없으면 null. 추측·계산으로 채우지 말 것\n- 상가(근린생활시설·판매시설·상업시설) 기준. 업무시설(오피스)·오피스텔·주거 호실은 상가 호실에 넣지 말 것\n- 면적은 ㎡ 숫자만(평 아님). 주차·호실은 숫자만\n- 분양 문의 전화번호·분양가·분양 조건은 뽑지 말 것\n'
        + '- floors 는 상가 층별 호실 수. 동이 나뉘어 있으면 동별로 따로 (예: {"fl":"1층","dong":"A동","n":36}). 동 구분이 없으면 dong 은 ""\n'
        + 'JSON 하나만 답하세요 (설명 없이):\n{"addr":null,"scale":null,"plA":null,"archA":null,"tot":null,"zone":null,"far":null,"bcr":null,"pkg":null,"pkgLegal":null,"shopHo":null,"shopFloors":null,"shopRate":null,"floors":[],"developer":null,"builder":null,"done":null,"concept":null,"note":"자료에서 확인이 필요해 보이는 점 한 줄 (없으면 null)"}';
      return fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key':k, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body:JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:2000, messages:[{ role:'user', content:parts.concat([{ type:'text', text:prompt }]) }] })
      });
    }).then(function(r){ return r.json(); }).then(function(d){
      if(d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      var t = (d.content || []).filter(function(x){ return x.type === 'text'; }).map(function(x){ return x.text; }).join('\n');
      var m = /\{[\s\S]*\}/.exec(t); if(!m) throw new Error('AI 답에서 자료를 찾지 못했습니다');
      var o = JSON.parse(m[0]), out = {};
      FIELDS.forEach(function(f){ var v = o[f[0]]; if(v == null || v === '') return; out[f[0]] = f[2] === 'num' ? num(v) : String(v).trim(); });
      out.floors = (Array.isArray(o.floors) ? o.floors : []).map(function(x){ return { fl:String(x.fl || '').trim(), dong:String(x.dong || '').trim(), n:num(x.n) }; }).filter(function(x){ return x.fl && x.n; });
      if(o.note) out.note = String(o.note);
      return out;
    });
  }

  W.sdBldFull = { load:load, side:side, full:full, merge:merge, facts:facts, suggest:suggest, link:link, autoLink:autoLink, names:names,
    saveBun:saveBun, extract:extract, FIELDS:FIELDS, nk:nk, sgStat:sgStat,
    setStore:function(fn){ storeFn = fn; SIDE = null; }, reset:function(){ SIDE = null; } };
})();
