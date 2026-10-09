/* ═════════════════════════════════════════════════════════════════
   🏷 SJRWS 로고 관리 — 모든 화면이 같이 쓰는 로고 보관함 (sd_logo.js · window.sdLogo)  2026-10-09
   · 로고 보관함: Firebase  sd_media/logo_idx/{id} = { name, cat, kind, w, h, alpha, at, by }
                           sd_media/logo_img/{id} = { src }   (PNG 데이터, 긴 변 1000px 이하 · 여백 잘라 냄)
   · 쓰임새 연결: Firebase  sd_media/logo_map = { 쓰임새 id : 로고 id }   — 도구 → 🏷 로고 관리 에서 정한다
   · 이 브라우저 캐시: localStorage sd_logo_cache (목록·연결) · sd_logo_img_{id} (그림) — 인쇄·보고서 함수가 바로(동기) 꺼내 쓴다
   · 쓰는 법: <script src="sd_logo.js"></script> 를 넣으면 열 때 Firebase 것과 맞춰 둔다.
              sdLogo.src('brief_head') → 'data:image/png…' 또는 ''   (지금 캐시에 있는 그림)
              sdLogo.ready().then(…)   → Firebase 와 맞춘 뒤
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.sdLogo && window.sdLogo._v) return;
  var CFG = {
    apiKey:'AIzaSyCMYoUBhRv_NkKeHmPqgXoqqXUjVsjEJPs', authDomain:'songdojeil-202604.firebaseapp.com',
    databaseURL:'https://songdojeil-202604-default-rtdb.asia-southeast1.firebasedatabase.app', projectId:'songdojeil-202604',
    storageBucket:'songdojeil-202604.firebasestorage.app', messagingSenderId:'567683904975', appId:'1:567683904975:web:65a652a8e7b9a81e034eba'
  };
  var FB = 'https://www.gstatic.com/firebasejs/9.23.0/';
  /* 로고 묶음 (보관함 분류) */
  var CATS = [
    ['office', '🏢 송도제일공인중개사사무소'],
    ['agency', '🏗 분양대행 (주식회사 송도제일 등)'],
    ['youtube', '▶ 유튜브 채널'],
    ['assoc', '🤝 협회·단체'],
    ['etc', '📁 기타']
  ];
  var KINDS = [['square', '사각 아이콘 (2D)'], ['square3d', '사각 아이콘 (3D)'], ['wide', '로고+글자 (가로형)'], ['tall', '로고+글자 (세로형)'], ['mark', '심볼만'], ['white', '흰색 (어두운 바탕용)']];
  /* 쓰임새 — 화면(섹터)별로 SJRWS 가 만드는 문서·그림에 어떤 로고를 넣을지 */
  var SLOTS = [
    { id:'brief_head', sec:'🏢 매물 · 📡 데이터', n:'매물 브리핑 보고서 · 현장방문 일정표 — 머리 로고', hint:'가로형(로고+글자) 추천', def:['office', 'wide'] },
    { id:'report_head', sec:'📡 데이터', n:'송도 주택시장 리포트 · 단지 리포트 · 인쇄 화면 — 머리 로고', hint:'가로형 추천', def:['office', 'wide'] },
    { id:'est_office', sec:'🏪 상가', n:'상가 견적서 (중개사무소 명의) — 머리 로고', hint:'흰색 또는 사각 아이콘 (남색 띠 위)', def:['office', 'white'] },
    { id:'est_agency', sec:'🏪 상가', n:'상가 견적서 (분양대행사 명의) — 머리 로고', hint:'분양대행 로고', def:['agency', ''] },
    { id:'doc_foot', sec:'📄 모든 문서', n:'문서 아래쪽 보조 로고 (협회 등)', hint:'한국공인중개사협회 연수구지회 등 — 비우면 넣지 않음', def:['assoc', ''] },
    { id:'wm_photo', sec:'🏢 매물 · 🏪 상가', n:'매물·상가 사진 워터마크 (오른쪽 아래)', hint:'투명 PNG 가로형 추천', def:['office', 'wide'] },
    { id:'blog_card', sec:'✍️ 블로그', n:'블로그 이미지 카드 · 쇼츠 — 오른쪽 아래 로고', hint:'블로그에서 따로 올린 로고가 없을 때 이것을 씀', def:['office', 'wide'] },
    { id:'yt_main', sec:'🎬 영상', n:'유튜브 송도제일부동산TV 채널 로고', hint:'영상 썸네일·화면 모서리 (영상 쪽 연결은 다음 단계)', def:['youtube', ''] },
    { id:'yt_sangga', sec:'🎬 영상', n:'유튜브 상가닷컴TV 채널 로고', hint:'상가 영상용 (다음 단계)', def:['youtube', ''] },
    { id:'ecard', sec:'🧰 도구', n:'전자명함 · QR 코드 기본 로고', hint:'「🏷 로고 관리에서」 단추로 고를 때 맨 앞에 보임', def:['office', 'square'] }
  ];
  var LK = 'sd_logo_cache', IK = 'sd_logo_img_';
  var C = (function(){ try{ return JSON.parse(localStorage.getItem(LK) || 'null') || { idx:{}, map:{}, at:0 }; }catch(e){ return { idx:{}, map:{}, at:0 }; } })();
  C.idx = C.idx || {}; C.map = C.map || {};
  var MEM = {}, P = null, SUBS = [];
  function saveC(){ try{ localStorage.setItem(LK, JSON.stringify(C)); }catch(e){} }
  function imgGet(id){ if(MEM[id]) return MEM[id]; try{ var s = localStorage.getItem(IK + id) || ''; if(s) MEM[id] = s; return s; }catch(e){ return ''; } }
  function imgPut(id, s){ MEM[id] = s; try{ localStorage.setItem(IK + id, s); }catch(e){ /* 꽉 차면 메모리에만 */ } }
  function imgDel(id){ delete MEM[id]; try{ localStorage.removeItem(IK + id); }catch(e){} }
  function loadJs(u){ return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = function(){ rej(new Error('불러오지 못했습니다: ' + u)); }; document.head.appendChild(s); }); }
  var DBP = null;
  function db(){
    if(DBP) return DBP;
    DBP = (async function(){
      if(!window.firebase || !window.firebase.initializeApp) await loadJs(FB + 'firebase-app-compat.js');
      if(!window.firebase.database) await loadJs(FB + 'firebase-database-compat.js');
      if(!window.firebase.apps.length) window.firebase.initializeApp(CFG);
      if(!window.firebase.auth) await loadJs(FB + 'firebase-auth-compat.js');
      /* 허브에서 한 구글 로그인이 살아 있으면 그대로, 없으면 익명 */
      await new Promise(function(res){ var done = false, fin = function(){ if(!done){ done = true; res(); } };
        try{ var au = window.firebase.auth(); if(au.currentUser) return fin(); var un = au.onAuthStateChanged(function(u){ if(done) return; try{ un(); }catch(e){} if(u) return fin(); au.signInAnonymously().then(fin, fin); }); }catch(e){ fin(); }
        setTimeout(fin, 8000); });
      return window.firebase.database();
    })();
    DBP.catch(function(){ DBP = null; });
    return DBP;
  }
  /* Firebase 와 맞추기 — 목록·연결은 매번, 그림은 바뀐 것(at)만 받는다 */
  function refresh(){
    P = (async function(){
      var d = await db();
      var v = await Promise.all([d.ref('sd_media/logo_idx').once('value'), d.ref('sd_media/logo_map').once('value')]);
      var idx = v[0].val() || {}, map = v[1].val() || {};
      var need = Object.keys(idx).filter(function(id){ return !imgGet(id) || !C.idx[id] || (C.idx[id].at || 0) < (idx[id].at || 0); });
      for(var i = 0; i < need.length; i++){ var s = (await d.ref('sd_media/logo_img/' + need[i]).once('value')).val(); if(s && s.src) imgPut(need[i], s.src); }
      Object.keys(C.idx).forEach(function(id){ if(!idx[id]) imgDel(id); });
      C.idx = idx; C.map = map; C.at = Date.now(); saveC();
      SUBS.forEach(function(f){ try{ f(); }catch(e){} });
      return C;
    })();
    P.catch(function(e){ console.warn('[로고] Firebase 에서 받지 못했습니다 — 이 브라우저에 저장된 것으로 씁니다', e); });
    return P;
  }
  function ready(){ return (P || refresh()).catch(function(){ return C; }); }
  function idOf(slot){ var id = C.map[slot]; return id && C.idx[id] ? id : ''; }
  function src(slot){ var id = idOf(slot); return id ? imgGet(id) : ''; }
  function list(){ return Object.keys(C.idx).map(function(id){ return Object.assign({ id:id }, C.idx[id]); }).sort(function(a, b){ var ca = CATS.findIndex(function(c){ return c[0] === a.cat; }), cb = CATS.findIndex(function(c){ return c[0] === b.cat; }); return ca - cb || (a.at || 0) - (b.at || 0); }); }
  function me(){ try{ var s = JSON.parse(localStorage.getItem('sd_auth_session') || '{}') || {}; return s.name || s.email || ''; }catch(e){ return ''; } }
  function uid(){ return 'lg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  /* 그림 다듬기 — 투명·흰 여백을 잘라 내고 긴 변 1000px 이하 PNG 로 */
  function prep(blobOrUrl, max){
    max = max || 1000;
    return new Promise(function(res, rej){
      var u = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl), im = new Image();
      im.onload = function(){
        try{
          var w = im.naturalWidth, h = im.naturalHeight, c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.drawImage(im, 0, 0);
          var d = x.getImageData(0, 0, w, h).data, at = function(i){ return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }, cs = [at(0), at((w - 1) * 4), at((h - 1) * w * 4), at(((h - 1) * w + w - 1) * 4)];
          var clear = cs.every(function(p){ return p[3] < 16; }), white = !clear && cs.every(function(p){ return p[3] > 240 && p[0] > 242 && p[1] > 242 && p[2] > 242; }), alpha = false;
          for(var k = 3; k < d.length; k += 16){ if(d[k] < 250){ alpha = true; break; } }
          var x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
          if(clear || white){
            x0 = w; y0 = h; x1 = -1; y1 = -1;
            for(var yy = 0; yy < h; yy++) for(var xx = 0; xx < w; xx++){ var i = (yy * w + xx) * 4, ink = clear ? d[i + 3] > 16 : (d[i] < 236 || d[i + 1] < 236 || d[i + 2] < 236); if(ink){ if(xx < x0) x0 = xx; if(xx > x1) x1 = xx; if(yy < y0) y0 = yy; if(yy > y1) y1 = yy; } }
            if(x1 < x0){ x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
          }
          var p = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02), cw = x1 - x0 + 1 + p * 2, ch = y1 - y0 + 1 + p * 2, k2 = Math.min(1, max / Math.max(cw, ch));
          var o = document.createElement('canvas'); o.width = Math.round(cw * k2); o.height = Math.round(ch * k2); var ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high';
          ox.drawImage(c, x0 - p, y0 - p, cw, ch, 0, 0, o.width, o.height);
          if(typeof blobOrUrl !== 'string') URL.revokeObjectURL(u);
          res({ src:o.toDataURL('image/png'), w:o.width, h:o.height, alpha:alpha || clear });
        }catch(e){ rej(e); }
      };
      im.onerror = function(){ rej(new Error('그림을 읽지 못했습니다')); };
      im.src = u;
    });
  }
  async function add(file, meta){
    var o = await prep(file), d = await db(), id = uid(), at = Date.now();
    var m = Object.assign({ name:'', cat:'office', kind:'' }, meta || {}, { w:o.w, h:o.h, alpha:!!o.alpha, at:at, by:me() });
    await d.ref('sd_media/logo_img/' + id).set({ src:o.src });
    await d.ref('sd_media/logo_idx/' + id).set(m);
    C.idx[id] = m; imgPut(id, o.src); saveC(); return id;
  }
  async function update(id, meta){ var d = await db(), m = Object.assign({}, C.idx[id] || {}, meta || {}, { at:(C.idx[id] || {}).at || Date.now() }); await d.ref('sd_media/logo_idx/' + id).set(m); C.idx[id] = m; saveC(); }
  async function remove(id){
    var d = await db(); await Promise.all([d.ref('sd_media/logo_idx/' + id).remove(), d.ref('sd_media/logo_img/' + id).remove()]);
    var ch = {}; Object.keys(C.map).forEach(function(s){ if(C.map[s] === id) ch[s] = null; });
    if(Object.keys(ch).length) await d.ref('sd_media/logo_map').update(ch);
    delete C.idx[id]; Object.keys(ch).forEach(function(s){ delete C.map[s]; }); imgDel(id); saveC();
  }
  async function link(slot, id){ var d = await db(); await d.ref('sd_media/logo_map/' + slot).set(id || null); if(id) C.map[slot] = id; else delete C.map[slot]; saveC(); }
  /* 보관함 그림을 작게 (전자명함·QR 등에 넣을 때) */
  function small(id, max){ var u = imgGet(id); if(!u) return Promise.resolve(''); return new Promise(function(res){ var im = new Image(); im.onload = function(){ var k = Math.min(1, (max || 600) / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; im.onerror = function(){ res(u); }; im.src = u; }); }
  window.sdLogo = {
    small:small,
    _v:1, CATS:CATS, KINDS:KINDS, SLOTS:SLOTS,
    src:src, idOf:idOf, img:imgGet, list:list, meta:function(id){ return C.idx[id] || null; }, map:function(){ return Object.assign({}, C.map); },
    ready:ready, refresh:refresh, onChange:function(f){ SUBS.push(f); },
    add:add, update:update, remove:remove, link:link, prep:prep,
    RULE:'"sd_media": { ".read": "auth != null", ".write": "auth != null" }',
    /* HTML 문서에 넣을 <img> — 없으면 '' */
    tag:function(slot, style, alt){ var s = src(slot); return s ? '<img src="' + s + '" alt="' + (alt || '로고') + '" style="' + (style || 'height:40px;width:auto') + '">' : ''; }
  };
  /* 열 때 한 번 맞춰 둔다 (화면을 늦추지 않게 조금 뒤에) */
  setTimeout(function(){ refresh(); }, 1200);
})();
