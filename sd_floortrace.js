/* ═════════════════════════════════════════════════════════════════
   🗺 평면도 트레이서 (sd_floortrace.js · window.sdTrace)  2026-10-08
   · 아파트 모델하우스·완공 세대 내부를 현관부터 걸으며 찍은 영상 + 평면도 그림 →
     평면도 위로 이동 경로(지나온 길)·현재 위치 마커·바라보는 방향(360° 회전하는 부채)을 그린 「평면도 TRACE」 영상
   · 위치: 영상을 보며 방에 들어설 때 평면도를 눌러 「지금 여기」를 찍는다 (그 사이는 부드럽게 이어 줌)
   · 방향: 영상 화면이 좌우로 움직인 만큼 몸을 돌린 각도를 브라우저에서 계산(AI·토큰 없음) — 찍은 곳의 방향으로 오차를 바로잡음.
           또는 「이동 방향 따라」
   · 내보내기: 투명 MOV (QuickTime Animation · ARGB) — 프리미어 프로에 바로 얹어 합성. 원본 영상과 길이가 같다
   · 저장: 이 PC 크롬 IndexedDB sd_trace/tr (영상 파일은 저장하지 않음 — 내보내기에는 영상이 필요 없다)
   · 쓰는 곳: sd_tool.html?tab=trace (도구 → 🗺 평면도 트레이서) · 2단계에 영상에서 영상 만들기에서도 같은 엔진을 쓴다
   ═════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window.sdTrace) return;
var VER = '2026.10.08-2';
var FONT = "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
function $(s, r){ return (r || document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function fmtT(s){ s = Math.max(0, s || 0); var m = Math.floor(s / 60), x = s - m * 60; return m + ':' + (x < 10 ? '0' : '') + x.toFixed(1); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function angN(a){ a = a % 360; return a < 0 ? a + 360 : a; }
function angD(a, b){ var d = (b - a) % 360; if(d > 180) d -= 360; if(d < -180) d += 360; return d; }
function toast(t, bad){
  var e = document.createElement('div'); e.className = 'ft-toast' + (bad ? ' bad' : ''); e.textContent = t; document.body.appendChild(e);
  setTimeout(function(){ e.classList.add('on'); }, 10); setTimeout(function(){ e.classList.remove('on'); setTimeout(function(){ e.remove(); }, 300); }, bad ? 4200 : 2400);
}
function ymd8(){ var d = new Date(); return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }

/* ── 저장 (IndexedDB sd_trace/tr) ── */
function idb(mode, fn){
  return new Promise(function(res){
    try{
      var q = indexedDB.open('sd_trace', 1);
      q.onupgradeneeded = function(){ if(!q.result.objectStoreNames.contains('tr')) q.result.createObjectStore('tr', { keyPath:'id' }); };
      q.onsuccess = function(){ try{ var tx = q.result.transaction('tr', mode), out = fn(tx.objectStore('tr')); tx.oncomplete = function(){ res(out && out.result !== undefined ? out.result : null); }; tx.onerror = function(){ res(null); }; }catch(e){ res(null); } };
      q.onerror = function(){ res(null); };
    }catch(e){ res(null); }
  });
}
function listAll(){ return idb('readonly', function(st){ return st.getAll(); }).then(function(a){ return (a || []).sort(function(x, y){ return (y.at || 0) - (x.at || 0); }); }); }
function getOne(id){ return idb('readonly', function(st){ return st.get(id); }); }
function putOne(T){ T.at = Date.now(); return idb('readwrite', function(st){ st.put(JSON.parse(JSON.stringify(T))); }); }
function delOne(id){ return idb('readwrite', function(st){ st.delete(id); }); }

/* ── 작업 하나 ── */
var SIZES = { plan:['평면도 비율 (긴 쪽 1080)', 0, 0], sq:['정사각 720×720 · 롱폼 구석·쇼츠 상단', 720, 720], h43:['가로 4:3 960×720 · 롱폼 구석', 960, 720], h32:['가로 3:2 1080×720 · 쇼츠 상단', 1080, 720], h169:['가로 16:9 1280×720', 1280, 720], v34:['세로 3:4 720×960', 720, 960] };
var MARKS = { dot:'● 점', pin:'📍 핀', arrow:'➤ 화살표', char:'🐻 캐릭터' };
var DEF = { size:'plan', view:'fit', zoom:2.2, bg:'card', cardA:92, planA:100, planCut:false, frame:true,
  marker:'dot', mColor:'#e8590c', mSize:100, fan:true, fanStyle:'flat', fov:70, fanLen:22, fanColor:'#ffa94d', trail:true, tColor:'#d6336c', future:false,
  label:true, title:'', curve:'smooth', head:'auto', lens:'main', hfov:0, fps:30, char:'', charSz:100 };
function newTrace(){ return { id:uid(), name:'', plan:null, video:null, wp:[], yaw:null, set:Object.assign({}, DEF), at:Date.now() }; }
function S(T){ return Object.assign({}, DEF, T.set || {}); }
function dur(T){ return (T.video && T.video.dur) || (T.wp.length ? T.wp[T.wp.length - 1].t : 0); }
function sortWp(T){ T.wp.sort(function(a, b){ return a.t - b.t; }); }

/* ── 경로 (평면도 픽셀 좌표) ── */
function dist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
function crPt(p0, p1, p2, p3, u){
  /* 가운데 두 점 사이 — 휘어짐이 덜한 centripetal Catmull-Rom */
  var al = 0.5, t0 = 0, t1 = t0 + Math.pow(Math.max(dist(p0, p1), 1e-3), al), t2 = t1 + Math.pow(Math.max(dist(p1, p2), 1e-3), al), t3 = t2 + Math.pow(Math.max(dist(p2, p3), 1e-3), al);
  var t = t1 + (t2 - t1) * u, L = function(a, b, ta, tb){ var k = (t - ta) / (tb - ta || 1); return { x:a.x + (b.x - a.x) * k, y:a.y + (b.y - a.y) * k }; };
  var A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}
var PATHC = {};
function pathKey(T){ var s = S(T); return T.id + '|' + JSON.stringify(T.wp) + '|' + (T.plan ? T.plan.w + 'x' + T.plan.h : '') + '|' + dur(T) + '|' + s.curve + '|' + s.head + '|' + s.lens + '|' + s.hfov + '|' + (T.yaw ? T.yaw.a.length + ':' + T.yaw.k : '-'); }
function pathOf(T){
  if(!T.plan || !T.wp.length) return null;
  var key = pathKey(T); if(PATHC.key === key) return PATHC.p;
  sortWp(T);
  var s = S(T), W = T.plan.w, H = T.plan.h, P = T.wp.map(function(w){ return { x:w.x * W, y:w.y * H, t:w.t }; }), D = Math.max(dur(T), P[P.length - 1].t), step = 0.05, n = Math.max(2, Math.ceil(D / step) + 1);
  var xs = new Float32Array(n), ys = new Float32Array(n), hs = new Float32Array(n);
  for(var i = 0; i < n; i++){
    var t = i * step, q;
    if(t <= P[0].t || P.length === 1) q = P[0];
    else if(t >= P[P.length - 1].t) q = P[P.length - 1];
    else {
      var j = 0; while(j < P.length - 2 && t >= P[j + 1].t) j++;
      var u = (t - P[j].t) / ((P[j + 1].t - P[j].t) || 1), sm = u * u * (3 - 2 * u); u = u + (sm - u) * 0.6;   // 찍은 곳 가까이에서 천천히
      q = s.curve === 'line' ? { x:P[j].x + (P[j + 1].x - P[j].x) * u, y:P[j].y + (P[j + 1].y - P[j].y) * u } : crPt(P[Math.max(0, j - 1)], P[j], P[j + 1], P[Math.min(P.length - 1, j + 2)], u);
    }
    xs[i] = q.x; ys[i] = q.y;
  }
  /* 이동 방향 — 앞뒤 0.6초 사이에 움직인 쪽. 서 있으면 앞의 방향을 그대로 */
  var mv = new Float32Array(n), last = null, eps = Math.hypot(W, H) * 0.004, k = Math.round(0.6 / step);
  for(i = 0; i < n; i++){
    var a = Math.max(0, i - k), b = Math.min(n - 1, i + k), dx = xs[b] - xs[a], dy = ys[b] - ys[a];
    if(Math.hypot(dx, dy) > eps) last = Math.atan2(dy, dx) * 180 / Math.PI;
    mv[i] = last == null ? NaN : last;
  }
  var first = NaN; for(i = 0; i < n; i++){ if(!isNaN(mv[i])){ first = mv[i]; break; } }
  if(isNaN(first)) first = T.wp[0].dir != null ? T.wp[0].dir : -90;
  for(i = 0; i < n; i++){ if(isNaN(mv[i])) mv[i] = first; else break; }
  /* 부드럽게 (앞뒤로 한 번씩) */
  var sm2 = function(arr, f){ var o = Float32Array.from(arr); for(var r = 1; r < n; r++) o[r] = o[r - 1] + angD(o[r - 1], o[r]) * f; for(r = n - 2; r >= 0; r--) o[r] = o[r + 1] + angD(o[r + 1], o[r]) * f; return o; };
  var pathHead = sm2(mv, 0.12);
  var useYaw = s.head === 'auto' && T.yaw && T.yaw.a && T.yaw.a.length > 1;
  if(useYaw){
    var Y = T.yaw, yawAt = function(t){ var x = t / Y.step, i0 = Math.floor(x); if(i0 < 0) return Y.a[0]; if(i0 >= Y.a.length - 1) return Y.a[Y.a.length - 1]; return Y.a[i0] + (Y.a[i0 + 1] - Y.a[i0]) * (x - i0); };
    var hf = hfovOf(T) / (Y.hfov || hfovOf(T));   // 렌즈 화각을 바꾸면 다시 계산하지 않고 비례로
    var anc = T.wp.filter(function(w){ return w.dir != null; }).map(function(w){ return { t:w.t, d:w.dir }; });
    if(!anc.length || anc[0].t > T.wp[0].t + 0.01) anc.unshift({ t:T.wp[0].t, d:T.wp[0].dir != null ? T.wp[0].dir : first });
    var offs = anc.map(function(a){ return a.d - yawAt(a.t) * hf; });
    for(var z = 1; z < offs.length; z++) offs[z] = offs[z - 1] + angD(offs[z - 1], offs[z]);
    for(i = 0; i < n; i++){
      var t2 = i * step, o;
      if(t2 <= anc[0].t) o = offs[0]; else if(t2 >= anc[anc.length - 1].t) o = offs[offs.length - 1];
      else { var m = 0; while(m < anc.length - 2 && t2 >= anc[m + 1].t) m++; o = offs[m] + (offs[m + 1] - offs[m]) * ((t2 - anc[m].t) / ((anc[m + 1].t - anc[m].t) || 1)); }
      hs[i] = yawAt(t2) * hf + o;
    }
  } else {
    hs = pathHead;
  }
  var p = { n:n, step:step, xs:xs, ys:ys, hs:hs, D:D };
  PATHC = { key:key, p:p }; return p;
}
function at(p, t){
  var x = clamp(t / p.step, 0, p.n - 1), i = Math.floor(x), f = x - i, j = Math.min(p.n - 1, i + 1);
  return { x:p.xs[i] + (p.xs[j] - p.xs[i]) * f, y:p.ys[i] + (p.ys[j] - p.ys[i]) * f, h:p.hs[i] + angD(p.hs[i], p.hs[j]) * f };
}
function roomAt(T, t){ var r = ''; for(var i = 0; i < T.wp.length; i++){ if(T.wp[i].t <= t + 1e-3){ if(T.wp[i].name) r = T.wp[i].name; } else break; } return r; }
function hfovOf(T){ var s = S(T); if(s.hfov) return +s.hfov; var port = T.video && T.video.h > T.video.w; return s.lens === 'wide' ? (port ? 66 : 104) : (port ? 41 : 66); }
function outDims(T){
  var s = S(T), z = SIZES[s.size] || SIZES.plan;
  if(z[1]) return { W:z[1], H:z[2] };
  if(!T.plan) return { W:960, H:720 };
  var r = T.plan.w / T.plan.h, W = r >= 1 ? 1080 : Math.round(1080 * r), H = r >= 1 ? Math.round(1080 / r) : 1080;
  return { W:Math.max(240, W + (W % 2)), H:Math.max(240, H + (H % 2)) };
}

/* ── 그림 (평면도·캐릭터) ── */
var IMG = {};
function img(src, cut){
  if(!src) return null; var k = src.length + ':' + src.slice(-40) + (cut ? ':c' : ''), x = IMG[k];
  if(!x){ x = IMG[k] = { el:new Image(), c:null }; x.p = new Promise(function(r){ x.el.onload = function(){ try{ x.c = cut ? cutWhite(x.el) : x.el; }catch(e){ x.c = x.el; } r(); }; x.el.onerror = r; }); x.el.src = src; }
  return x.c;
}
function imgReady(src, cut){ img(src, cut); var k = src.length + ':' + src.slice(-40) + (cut ? ':c' : ''); return IMG[k].p; }
/* 흰 바탕 지우기 — 가장자리에서 이어진 흰색만 (평면도는 「흰색 모두」로) */
function cutWhite(im, all){
  var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  var x = c.getContext('2d'); x.drawImage(im, 0, 0); var d = x.getImageData(0, 0, w, h), px = d.data, i;
  var wh = function(j){ var r = px[j * 4], g = px[j * 4 + 1], b = px[j * 4 + 2], mn = Math.min(r, g, b); return mn > 222 && Math.max(r, g, b) - mn < 28; };
  if(all){ for(i = 0; i < w * h; i++){ var mn = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); if(mn > 200) px[i * 4 + 3] = Math.round(255 * clamp((255 - mn) / 55, 0, 1)); } x.putImageData(d, 0, 0); return c; }
  var seen = new Uint8Array(w * h), st = [];
  for(i = 0; i < w; i++){ st.push(i, (h - 1) * w + i); } for(i = 0; i < h; i++){ st.push(i * w, i * w + w - 1); }
  while(st.length){ var j = st.pop(); if(seen[j] || !wh(j)) continue; seen[j] = 1; px[j * 4 + 3] = 0; var xx = j % w, yy = (j / w) | 0; if(xx > 0) st.push(j - 1); if(xx < w - 1) st.push(j + 1); if(yy > 0) st.push(j - w); if(yy < h - 1) st.push(j + w); }
  x.putImageData(d, 0, 0); return c;
}
function rr(x, X, Y, w, h, r){ r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function pill(x, t, X, Y, fs, bg, fg, align){
  x.font = '800 ' + fs + 'px ' + FONT; var w = x.measureText(t).width + fs * 1.1, h = fs * 1.6, L = align === 'right' ? X - w : align === 'center' ? X - w / 2 : X;
  x.fillStyle = bg; rr(x, L, Y, w, h, h / 2); x.fill(); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, L + w / 2, Y + h / 2 + fs * 0.04);
}
/* 결과 한 장 — ctx 는 투명에서 시작 (o.checker: 미리보기용 바둑판) */
function render(ctx, W, H, T, t, o){
  o = o || {}; var s = S(T), u = Math.min(W, H);
  ctx.save(); ctx.clearRect(0, 0, W, H);
  if(o.checker){ var cs = Math.max(8, Math.round(u / 40)); for(var cy = 0; cy < H; cy += cs) for(var cx = 0; cx < W; cx += cs){ ctx.fillStyle = ((cx / cs + cy / cs) & 1) ? '#d0d4da' : '#eef0f3'; ctx.fillRect(cx, cy, cs, cs); } }
  if(!T.plan){ ctx.restore(); return; }
  var pad = Math.round(u * 0.02), card = s.bg === 'card', head = s.label || s.title, hb = head ? Math.round(u * 0.105) : 0, m = Math.round(u * 0.03);
  var R = { x:pad, y:pad, w:W - pad * 2, h:H - pad * 2 }, rad = u * 0.045;
  if(card){ ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = u * 0.02; ctx.fillStyle = 'rgba(255,255,255,' + clamp(s.cardA, 0, 100) / 100 + ')'; rr(ctx, R.x, R.y, R.w, R.h, rad); ctx.fill(); ctx.restore(); if(s.frame){ ctx.lineWidth = Math.max(2, u * 0.005); ctx.strokeStyle = 'rgba(26,32,44,.55)'; rr(ctx, R.x, R.y, R.w, R.h, rad); ctx.stroke(); } }
  var A = { x:R.x + m, y:R.y + hb + m * (head ? 0.4 : 1), w:R.w - m * 2, h:R.h - hb - m * (head ? 1.4 : 2) };
  var pl = img(T.plan.src, false), plc = s.planCut ? planCut(T) : pl; if(!plc){ ctx.restore(); return; }
  var pw = T.plan.w, ph = T.plan.h, s0 = Math.min(A.w / pw, A.h / ph), p = pathOf(T), q = p ? at(p, t) : null, sc = s0, cx2, cy2;
  if(s.view === 'follow' && q){
    sc = s0 * clamp(s.zoom, 1, 5); var vw = A.w / sc, vh = A.h / sc;
    cx2 = vw >= pw ? pw / 2 : clamp(q.x, vw / 2, pw - vw / 2); cy2 = vh >= ph ? ph / 2 : clamp(q.y, vh / 2, ph - vh / 2);
  } else { cx2 = pw / 2; cy2 = ph / 2; }
  var ox = A.x + A.w / 2 - cx2 * sc, oy = A.y + A.h / 2 - cy2 * sc, P = function(x, y){ return [ox + x * sc, oy + y * sc]; };
  ctx.save(); rr(ctx, A.x, A.y, A.w, A.h, rad * 0.5); ctx.clip();
  ctx.globalAlpha = clamp(s.planA, 10, 100) / 100; ctx.drawImage(plc, ox, oy, pw * sc, ph * sc); ctx.globalAlpha = 1;
  if(p && q){
    var lw = Math.max(2, u * 0.011), n = Math.min(p.n - 1, Math.floor(t / p.step));
    if(s.future && n < p.n - 1){ ctx.save(); ctx.setLineDash([lw * 1.6, lw * 1.6]); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = 'rgba(73,80,87,.45)'; ctx.lineCap = 'round'; ctx.beginPath(); var a0 = P(q.x, q.y); ctx.moveTo(a0[0], a0[1]); for(var i = n + 1; i < p.n; i += 2){ var b0 = P(p.xs[i], p.ys[i]); ctx.lineTo(b0[0], b0[1]); } ctx.stroke(); ctx.restore(); }
    if(s.trail && n > 0){ ctx.lineWidth = lw; ctx.strokeStyle = s.tColor; ctx.globalAlpha = 0.85; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); var c0 = P(p.xs[0], p.ys[0]); ctx.moveTo(c0[0], c0[1]); for(i = 1; i <= n; i++){ var c1 = P(p.xs[i], p.ys[i]); ctx.lineTo(c1[0], c1[1]); } var c2 = P(q.x, q.y); ctx.lineTo(c2[0], c2[1]); ctx.stroke(); ctx.globalAlpha = 1; }
    var mp = P(q.x, q.y), hr = q.h * Math.PI / 180, ms = clamp(s.mSize, 40, 300) / 100;
    if(s.fan){
      var FR = u * clamp(s.fanLen, 5, 60) / 100, hf = clamp(s.fov, 20, 160) * Math.PI / 360;
      if(s.fanStyle === 'soft'){
        var g = ctx.createRadialGradient(mp[0], mp[1], 0, mp[0], mp[1], FR);
        g.addColorStop(0, hexA(s.fanColor, 0.75)); g.addColorStop(0.7, hexA(s.fanColor, 0.32)); g.addColorStop(1, hexA(s.fanColor, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(mp[0], mp[1]); ctx.arc(mp[0], mp[1], FR, hr - hf, hr + hf); ctx.closePath(); ctx.fill();
      } else {
        /* 단색 두 겹 — 같은 색이 이어져 MOV 가 훨씬 작다 */
        ctx.fillStyle = hexA(s.fanColor, 0.3); ctx.beginPath(); ctx.moveTo(mp[0], mp[1]); ctx.arc(mp[0], mp[1], FR, hr - hf, hr + hf); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hexA(s.fanColor, 0.38); ctx.beginPath(); ctx.moveTo(mp[0], mp[1]); ctx.arc(mp[0], mp[1], FR * 0.55, hr - hf, hr + hf); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = hexA(s.fanColor, 0.9); ctx.lineWidth = Math.max(1.5, u * 0.004); ctx.beginPath(); ctx.arc(mp[0], mp[1], FR, hr - hf, hr + hf); ctx.stroke();
      }
    }
    drawMarker(ctx, s, mp, hr, u * 0.026 * ms, t);
  }
  ctx.restore();
  if(head){
    var fs = Math.round(hb * 0.42), room = s.label ? roomAt(T, t) : '';
    if(room) pill(ctx, '📍 ' + room, R.x + m, R.y + (hb - fs * 1.6) / 2 + m * 0.3, fs, s.tColor, '#fff', 'left');
    if(s.title) pill(ctx, s.title, R.x + R.w - m, R.y + (hb - fs * 1.6) / 2 + m * 0.3, fs, 'rgba(26,32,44,.86)', '#fff', 'right');
  }
  ctx.restore();
  return { ox:ox, oy:oy, sc:sc, A:A };
}
function hexA(h, a){ var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(h || '') || [0, 'ff', 'a9', '4d']; return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')'; }
var PLANCUT = {};
function planCut(T){ var k = T.plan.src.length + ':' + T.plan.src.slice(-40); if(PLANCUT[k]) return PLANCUT[k]; var im = img(T.plan.src, false); if(!im || !(im.complete && im.naturalWidth)) return null; PLANCUT[k] = cutWhite(im, true); return PLANCUT[k]; }
function drawMarker(x, s, mp, hr, r, t){
  var col = s.mColor;
  x.save(); x.translate(mp[0], mp[1]);
  if(s.marker === 'char' && s.char){
    var c = img(s.char, true);
    if(c){ var ch = r * 4.2 * clamp(s.charSz, 40, 300) / 100, cw = ch * (c.width || c.naturalWidth) / (c.height || c.naturalHeight); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = r * 0.6; x.drawImage(c, -cw / 2, -ch + r * 0.4, cw, ch); x.shadowBlur = 0;
      x.fillStyle = col; x.strokeStyle = '#fff'; x.lineWidth = r * 0.25; x.beginPath(); x.arc(0, 0, r * 0.45, 0, Math.PI * 2); x.fill(); x.stroke(); x.restore(); return; }
  }
  if(s.marker === 'arrow'){
    x.rotate(hr); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = r * 0.5; x.fillStyle = col; x.strokeStyle = '#fff'; x.lineWidth = r * 0.22;
    x.beginPath(); x.moveTo(r * 1.35, 0); x.lineTo(-r * 0.9, r * 0.95); x.lineTo(-r * 0.45, 0); x.lineTo(-r * 0.9, -r * 0.95); x.closePath(); x.fill(); x.shadowBlur = 0; x.stroke(); x.restore(); return;
  }
  if(s.marker === 'pin'){
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = r * 0.5; x.fillStyle = col; x.strokeStyle = '#fff'; x.lineWidth = r * 0.2;
    x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-r * 0.4, -r * 0.9, -r * 1.05, -r * 1.3, -r * 1.05, -r * 2.05); x.arc(0, -r * 2.05, r * 1.05, Math.PI, 0); x.bezierCurveTo(r * 1.05, -r * 1.3, r * 0.4, -r * 0.9, 0, 0); x.closePath(); x.fill(); x.shadowBlur = 0; x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -r * 2.05, r * 0.42, 0, Math.PI * 2); x.fill(); x.restore(); return;
  }
  var pu = (t * 1.1) % 1; x.globalAlpha = (1 - pu) * 0.55; x.fillStyle = col; x.beginPath(); x.arc(0, 0, r * (1 + pu * 1.4), 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
  x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = r * 0.5; x.fillStyle = col; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.shadowBlur = 0; x.lineWidth = r * 0.3; x.strokeStyle = '#fff'; x.stroke();
  x.restore();
}

/* ── 🧭 영상에서 몸 돌린 각도 계산 — 연속한 두 장면이 좌우로 얼마나 밀렸는지(작게 줄인 흑백 그림을 맞대어 찾음) ──
   화면이 왼쪽으로 밀리면 오른쪽으로 돈 것. 각도 = 밀린 비율 × 렌즈 화각. 앞으로 걷는 것은 좌우가 서로 상쇄돼 거의 0 */
function grayOf(ctx, w, h){ var d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h); for(var i = 0; i < w * h; i++) g[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11; return g; }
function shiftX(a, b, w, h){
  var mx = Math.round(w * 0.24), my = 3, best = 1e18, bx = 0, by = 0, sum = 0, cnt = 0, row = [];
  var sd = 0, mean = 0, n0 = 0; for(var i = 0; i < b.length; i += 7){ mean += b[i]; n0++; } mean /= n0; for(i = 0; i < b.length; i += 7) sd += (b[i] - mean) * (b[i] - mean); sd = Math.sqrt(sd / n0);
  if(sd < 7) return { dx:0, ok:false };   // 흰 벽처럼 무늬가 없으면 0 으로
  for(var dy = -my; dy <= my; dy++){
    for(var dx = -mx; dx <= mx; dx++){
      var s = 0, c = 0;
      for(var y = my; y < h - my; y += 2){ var r1 = y * w, r0 = (y - dy) * w; for(var x = mx; x < w - mx; x += 2){ s += Math.abs(b[r1 + x] - a[r0 + x - dx]); c++; } }
      s /= c; sum += s; cnt++; if(dy === 0) row[dx + mx] = s;
      if(s < best){ best = s; bx = dx; by = dy; }
    }
  }
  var avg = sum / cnt; if(avg - best < avg * 0.12) return { dx:0, ok:false };   // 뚜렷한 답이 없으면 0
  var f = bx;
  if(by === 0 && bx > -mx && bx < mx){ var l = row[bx + mx - 1], c2 = row[bx + mx], r = row[bx + mx + 1], den = l - 2 * c2 + r; if(den > 1e-6) f = bx + clamp(0.5 * (l - r) / den, -0.5, 0.5); }
  return { dx:f, ok:true };
}
async function analyzeYaw(video, T, prog, stop){
  var vw = video.videoWidth, vh = video.videoHeight, D = video.duration; if(!vw || !D) throw new Error('영상을 먼저 넣어 주세요');
  var SW = vh > vw ? 72 : 128, SH = Math.max(24, Math.round(SW * vh / vw)), cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
  var ctx = cv.getContext('2d', { willReadFrequently:true }), hf = hfovOf(T), pts = [[0, 0]], prev = null, acc = 0, lastT = -1;
  var take = function(mt){ ctx.drawImage(video, 0, 0, SW, SH); var g = grayOf(ctx, SW, SH); if(prev && mt > lastT){ var r = shiftX(prev, g, SW, SH); acc += -(r.dx / SW) * hf; pts.push([mt, acc]); } prev = g; lastT = mt; };
  var keep = { t:video.currentTime, rate:video.playbackRate, muted:video.muted, paused:video.paused };
  video.pause(); video.muted = true;
  await new Promise(function(r){ video.onseeked = function(){ video.onseeked = null; r(); }; video.currentTime = 0; });
  if('requestVideoFrameCallback' in HTMLVideoElement.prototype){
    /* 3배 빠르기로 틀면서 화면이 바뀔 때마다 */
    await new Promise(function(res, rej){
      var done = false, fin = function(){ if(done) return; done = true; video.pause(); video.onended = null; res(); };
      var cb = function(now, meta){ if(done) return; if(stop && stop()){ fin(); return; } try{ take(meta.mediaTime); }catch(e){} if(prog) prog(meta.mediaTime / D); if(meta.mediaTime >= D - 0.05) return fin(); video.requestVideoFrameCallback(cb); };
      video.onended = fin; video.playbackRate = 3; video.requestVideoFrameCallback(cb);
      video.play().catch(function(e){ done = true; rej(e); });
      var guard = setInterval(function(){ if(done){ clearInterval(guard); return; } if(video.ended || video.currentTime >= D - 0.05){ clearInterval(guard); setTimeout(fin, 300); } }, 500);
    });
  } else {
    for(var t = 0; t < D; t += 1 / 8){ if(stop && stop()) break; await new Promise(function(r){ video.onseeked = function(){ video.onseeked = null; r(); }; video.currentTime = t; }); take(t); if(prog) prog(t / D); }
  }
  video.playbackRate = keep.rate; video.muted = keep.muted; video.currentTime = keep.t;
  /* 0.1초 간격으로 다시 고르기 */
  var step = 0.1, n = Math.ceil(D / step) + 1, a = new Array(n), j = 0;
  for(var i = 0; i < n; i++){ var tt = i * step; while(j < pts.length - 2 && pts[j + 1][0] < tt) j++; var p0 = pts[j], p1 = pts[Math.min(pts.length - 1, j + 1)]; a[i] = p1[0] > p0[0] ? p0[1] + (p1[1] - p0[1]) * clamp((tt - p0[0]) / (p1[0] - p0[0]), 0, 1) : p0[1]; a[i] = Math.round(a[i] * 100) / 100; }
  return { step:step, a:a, hfov:hf, k:Date.now(), n:pts.length };
}

/* ── 투명 MOV (QuickTime Animation · 'rle ' 32비트 ARGB) — 프리미어 프로에서 투명 그대로 ──
   프레임마다 앞 프레임과 달라진 줄·픽셀만 적는다(평면도는 거의 그대로라 작다). 5초마다 전체 프레임(키프레임) */
function MovWriter(W, H, fps){
  this.W = W; this.H = H; this.fps = fps; this.parts = []; this.sizes = []; this.keys = []; this.prev = null; this.n = 0; this.bytes = 0;
  this.buf = new Uint8Array(H * (W * 4 + Math.ceil(W / 127) * 2 + Math.ceil(W / 254) * 2 + 8) + 64);
}
MovWriter.prototype.add = function(rgba){
  var W = this.W, H = this.H, cur = new Uint32Array(rgba.buffer, rgba.byteOffset, W * H), prev = this.prev, key = !prev || this.n % (this.fps * 5) === 0, b = this.buf, p = 4, x, y, r;
  var px = function(i){ var o = i * 4; b[p++] = rgba[o + 3]; b[p++] = rgba[o]; b[p++] = rgba[o + 1]; b[p++] = rgba[o + 2]; };
  var y0 = 0, y1 = H;
  if(!key){
    y0 = -1; for(y = 0; y < H && y0 < 0; y++){ r = y * W; for(x = 0; x < W; x++){ if(cur[r + x] !== prev[r + x]){ y0 = y; break; } } }
    if(y0 < 0){ y0 = 0; y1 = 1; }
    else { y1 = y0 + 1; for(y = H - 1; y > y0; y--){ r = y * W; var ch = false; for(x = 0; x < W; x++){ if(cur[r + x] !== prev[r + x]){ ch = true; break; } } if(ch){ y1 = y + 1; break; } } }
  }
  if(y0 === 0 && y1 === H){ b[p++] = 0; b[p++] = 0; }
  else { b[p++] = 0; b[p++] = 8; b[p++] = y0 >> 8; b[p++] = y0 & 255; b[p++] = 0; b[p++] = 0; b[p++] = (y1 - y0) >> 8; b[p++] = (y1 - y0) & 255; b[p++] = 0; b[p++] = 0; }
  for(y = y0; y < y1; y++){
    r = y * W; x = 0;
    if(!key){
      while(x < W && cur[r + x] === prev[r + x]) x++;
      if(x === W){ b[p++] = 1; b[p++] = 255; continue; }
      var sk = x, f = Math.min(sk, 254); b[p++] = f + 1; sk -= f; while(sk > 0){ f = Math.min(sk, 254); b[p++] = 0; b[p++] = f + 1; sk -= f; }
    } else b[p++] = 1;
    while(x < W){
      if(!key && cur[r + x] === prev[r + x]){
        var e = x; while(e < W && cur[r + e] === prev[r + e]) e++;
        if(e === W) break;
        sk = e - x; while(sk > 0){ f = Math.min(sk, 254); b[p++] = 0; b[p++] = f + 1; sk -= f; } x = e; continue;
      }
      var v = cur[r + x], k = 1; while(x + k < W && k < 128 && cur[r + x + k] === v) k++;
      if(k >= 2){ b[p++] = (256 - k) & 255; px(r + x); x += k; continue; }
      var s0 = x, n = 0;
      while(x < W && n < 127){
        if(n > 0 && !key && cur[r + x] === prev[r + x]) break;
        if(n > 0 && x + 1 < W && cur[r + x + 1] === cur[r + x]) break;
        x++; n++;
      }
      b[p++] = n; for(var q = 0; q < n; q++) px(r + s0 + q);
    }
    b[p++] = 255;
  }
  b[p++] = 0;
  b[0] = (p >>> 24) & 255; b[1] = (p >>> 16) & 255; b[2] = (p >>> 8) & 255; b[3] = p & 255;
  this.parts.push(b.slice(0, p)); this.sizes.push(p); if(key) this.keys.push(this.n + 1); this.bytes += p; this.n++;
  this.prev = new Uint32Array(cur);
};
MovWriter.prototype.blob = function(){
  var W = this.W, H = this.H, fps = this.fps, N = this.n, TS = fps * 512, DL = 512, durM = Math.round(N * 1000 / fps);
  var A = function(type, parts){ var len = 8; parts.forEach(function(x){ len += x.length; }); var o = new Uint8Array(len), dv = new DataView(o.buffer); dv.setUint32(0, len); for(var i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i); var p = 8; parts.forEach(function(x){ o.set(x, p); p += x.length; }); return o; };
  var B = function(arr){ var o = []; arr.forEach(function(v){ if(typeof v === 'string'){ for(var i = 0; i < v.length; i++) o.push(v.charCodeAt(i) & 255); } else if(v[0] === 'u32'){ o.push((v[1] >>> 24) & 255, (v[1] >>> 16) & 255, (v[1] >>> 8) & 255, v[1] & 255); } else if(v[0] === 'u16'){ o.push((v[1] >>> 8) & 255, v[1] & 255); } else if(v[0] === 'u8'){ o.push(v[1] & 255); } else if(v[0] === 'z'){ for(var j = 0; j < v[1]; j++) o.push(0); } }); return new Uint8Array(o); };
  var u32 = function(v){ return ['u32', v]; }, u16 = function(v){ return ['u16', v]; }, z = function(n){ return ['z', n]; };
  var MAT = [u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)];
  var ftyp = A('ftyp', [B(['qt  ', u32(0x200), 'qt  '])]);
  var big = this.bytes + 16 > 0xFFFFFFFF, mdatH;
  if(big){ mdatH = new Uint8Array(16); var dv = new DataView(mdatH.buffer); dv.setUint32(0, 1); mdatH.set([109, 100, 97, 116], 4); dv.setUint32(8, Math.floor((this.bytes + 16) / 4294967296)); dv.setUint32(12, (this.bytes + 16) >>> 0); }
  else { mdatH = new Uint8Array(8); new DataView(mdatH.buffer).setUint32(0, this.bytes + 8); mdatH.set([109, 100, 97, 116], 4); }
  var wide = big ? new Uint8Array(0) : A('wide', []);
  var off = ftyp.length + wide.length + mdatH.length, offs = [], useCo64 = big;
  for(var i = 0; i < N; i++){ offs.push(off); off += this.sizes[i]; }
  var cname = 'Animation', cn = [u8(cname.length), cname, z(31 - cname.length)];
  function u8(v){ return ['u8', v]; }
  var stsd = A('stsd', [B([u32(0), u32(1)]), A('rle ', [B([z(6), u16(1), u16(0), u16(0), 'FFMP', u32(512), u32(512), u16(W), u16(H), u32(0x480000), u32(0x480000), u32(0), u16(1)].concat(cn).concat([u16(32), u16(0xFFFF)])), A('fiel', [B([u8(1), u8(0)])])])]);
  var stts = A('stts', [B([u32(0), u32(1), u32(N), u32(DL)])]);
  var stss = A('stss', [B([u32(0), u32(this.keys.length)].concat(this.keys.map(u32)))]);
  var stsc = A('stsc', [B([u32(0), u32(1), u32(1), u32(1), u32(1)])]);
  var szb = new Uint8Array(12 + N * 4), sdv = new DataView(szb.buffer); sdv.setUint32(4, 0); sdv.setUint32(8, N); for(i = 0; i < N; i++) sdv.setUint32(12 + i * 4, this.sizes[i]);
  var stsz = A('stsz', [szb]), stco;
  if(useCo64){ var cb = new Uint8Array(8 + N * 8), cdv = new DataView(cb.buffer); cdv.setUint32(4, N); for(i = 0; i < N; i++){ cdv.setUint32(8 + i * 8, Math.floor(offs[i] / 4294967296)); cdv.setUint32(12 + i * 8, offs[i] >>> 0); } stco = A('co64', [cb]); }
  else { var ob = new Uint8Array(8 + N * 4), odv = new DataView(ob.buffer); odv.setUint32(4, N); for(i = 0; i < N; i++) odv.setUint32(8 + i * 4, offs[i]); stco = A('stco', [ob]); }
  var stbl = A('stbl', [stsd, stts, stss, stsc, stsz, stco]);
  var dinf = A('dinf', [A('dref', [B([u32(0), u32(1)]), A('url ', [B([u32(1)])])])]);
  var minf = A('minf', [A('vmhd', [B([u32(1), u16(0), u16(0), u16(0), u16(0)])]), A('hdlr', [B([u32(0), 'dhlr', 'url ', u32(0), u32(0), u32(0), u8(11), 'DataHandler'])]), dinf, stbl]);
  var mdia = A('mdia', [A('mdhd', [B([u32(0), u32(0), u32(0), u32(TS), u32(N * DL), u16(0x7FFF), u16(0)])]), A('hdlr', [B([u32(0), 'mhlr', 'vide', u32(0), u32(0), u32(0), u8(12), 'VideoHandler'])]), minf]);
  var tkhd = A('tkhd', [B([u32(3), u32(0), u32(0), u32(1), u32(0), u32(durM), z(8), u16(0), u16(0), u16(0), u16(0)].concat(MAT).concat([u32(W * 65536), u32(H * 65536)]))]);
  var edts = A('edts', [A('elst', [B([u32(0), u32(1), u32(durM), u32(0), u32(0x10000)])])]);
  var mvhd = A('mvhd', [B([u32(0), u32(0), u32(0), u32(1000), u32(durM), u32(0x10000), u16(0x100), z(10)].concat(MAT).concat([z(24), u32(2)]))]);
  var moov = A('moov', [mvhd, A('trak', [tkhd, edts, mdia])]);
  return new Blob([ftyp, wide, mdatH].concat(this.parts).concat([moov]), { type:'video/quicktime' });
};
/* 내보내기 — 영상 없이 평면도 그림만으로 (프레임마다 그려서 적는다) */
async function exportMov(T, prog, stop){
  if(!T.plan) throw new Error('평면도를 넣어 주세요'); if(!T.wp.length) throw new Error('평면도에서 시작점을 찍어 주세요');
  var s = S(T), D = dur(T); if(!(D > 0)) throw new Error('영상 길이를 알 수 없습니다 — 영상을 넣어 주세요');
  var dm = outDims(T), W = dm.W, H = dm.H, fps = clamp(+s.fps || 30, 10, 60), N = Math.max(1, Math.round(D * fps));
  await imgReady(T.plan.src, false); if(s.marker === 'char' && s.char) await imgReady(s.char, true);
  if(s.planCut) planCut(T);
  var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var ctx = cv.getContext('2d', { willReadFrequently:true });
  var mw = new MovWriter(W, H, fps), t0 = performance.now();
  for(var i = 0; i < N; i++){
    if(stop && stop()) throw new Error('멈췄습니다');
    render(ctx, W, H, T, i / fps);
    mw.add(ctx.getImageData(0, 0, W, H).data);
    if(i % 15 === 0){ if(prog) prog(i / N, mw.bytes, (performance.now() - t0) / 1000); await sleep(0); }
  }
  if(prog) prog(1, mw.bytes, (performance.now() - t0) / 1000);
  return { blob:mw.blob(), W:W, H:H, fps:fps, N:N, dur:N / fps };
}

/* ── 화면 ── */
var CSS = '.ft{max-width:1320px;margin:0 auto;color:#212529;font-size:13px}.ft *{box-sizing:border-box}'
 + '.ft-hero h2{margin:0 0 6px;font-size:26px;font-weight:900;letter-spacing:-.5px}.ft-hero p{margin:0 0 14px;color:#6c757d;line-height:1.65;font-size:13px}'
 + '.ft-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;background:#fff;border:1px solid #e3e7ee;border-radius:12px;padding:8px 10px}.ft-bar input{flex:1;min-width:180px}'
 + '.ft-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:12px}@media(max-width:1100px){.ft-grid{grid-template-columns:minmax(0,1fr)}}'
 + '.ft-card{background:#fff;border:1px solid #e3e7ee;border-radius:14px;padding:12px 14px;margin-bottom:12px}.ft-card h4{margin:0 0 8px;font-size:14.5px;display:flex;align-items:center;gap:8px}.ft-card h4 small{font-weight:400;color:#868e96;font-size:11.5px}'
 + '.ft-btn{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:6px 11px;font:inherit;font-size:12.5px;cursor:pointer;color:#1a202c;white-space:nowrap}.ft-btn:hover{border-color:#4c6ef5}.ft-btn.pri{background:#4c6ef5;border-color:#4c6ef5;color:#fff;font-weight:700}.ft-btn.sm{padding:3px 8px;font-size:11.5px}.ft-btn:disabled{opacity:.45;cursor:default}.ft-btn.big{padding:11px 16px;font-size:14px;width:100%}'
 + '.ft-in,.ft-sel{border:1px solid #d0d5dd;border-radius:8px;padding:6px 8px;font:inherit;font-size:12.5px;background:#fff}'
 + '.ft-vwrap{position:relative;background:#111;border-radius:10px;overflow:hidden;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center}.ft-vwrap video{max-width:100%;max-height:100%;display:block}.ft-vwrap.v{aspect-ratio:9/12}'
 + '.ft-vempty{position:absolute;inset:0;display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;color:#ced4da;text-align:center;padding:16px;line-height:1.6}'
 + '.ft-ctl{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:8px}.ft-ctl .tm{font-variant-numeric:tabular-nums;font-weight:700;min-width:110px;text-align:center}'
 + '.ft-tl{margin-top:8px;cursor:pointer;width:100%;height:38px;display:block;border-radius:8px;background:#f1f3f5}'
 + '.ft-plan{position:relative;background:#f8f9fa;border:1px dashed #ced4da;border-radius:10px;min-height:260px;display:flex;align-items:center;justify-content:center}.ft-plan canvas{display:block;max-width:100%;cursor:crosshair;touch-action:none}'
 + '.ft-hint{font-size:12px;color:#495057;background:#edf2ff;border-radius:8px;padding:7px 10px;margin:8px 0;line-height:1.6}.ft-hint b{color:#364fc7}'
 + '.ft-wl{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}.ft-wl td,.ft-wl th{border-bottom:1px solid #f1f3f5;padding:4px 4px;text-align:left;white-space:nowrap}.ft-wl th{color:#868e96;font-weight:600}.ft-wl tr.on{background:#fff4e6}.ft-wl input{width:100%;min-width:80px}'
 + '.ft-wl .n{display:inline-flex;width:20px;height:20px;border-radius:50%;background:#4c6ef5;color:#fff;font-weight:800;align-items:center;justify-content:center;font-size:11px}'
 + '.ft-f{display:flex;align-items:center;gap:8px;margin:6px 0;flex-wrap:wrap}.ft-f>label:first-child{min-width:84px;color:#495057;font-weight:600}.ft-f input[type=range]{flex:1;min-width:90px;accent-color:#4c6ef5}.ft-f b{min-width:44px;text-align:right;font-variant-numeric:tabular-nums}'
 + '.ft-seg{display:inline-flex;border:1px solid #d0d5dd;border-radius:8px;overflow:hidden;flex-wrap:wrap}.ft-seg button{border:0;background:#fff;font:inherit;font-size:12px;padding:5px 10px;cursor:pointer}.ft-seg button.on{background:#4c6ef5;color:#fff;font-weight:700}'
 + '.ft-out{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:14px}@media(max-width:1000px){.ft-out{grid-template-columns:minmax(0,1fr)}}'
 + '.ft-pv{border-radius:10px;overflow:hidden;border:1px solid #e3e7ee;background:#eef0f3;display:flex;justify-content:center}.ft-pv canvas{max-width:100%;max-height:520px;display:block}'
 + '.ft-prog{height:10px;background:#e9ecef;border-radius:6px;overflow:hidden;margin:8px 0 4px}.ft-prog i{display:block;height:100%;background:#4c6ef5;width:0}'
 + '.ft-ok{background:#ebfbee;color:#2b8a3e;border-radius:8px;padding:8px 10px;margin-top:8px;line-height:1.6}.ft-err{background:#fff5f5;color:#c92a2a;border-radius:8px;padding:8px 10px;margin-top:8px}'
 + '.ft-note{font-size:11.5px;color:#868e96;line-height:1.6}'
 + '.ft-toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);background:#1a202c;color:#fff;border-radius:10px;padding:10px 16px;font-size:13px;opacity:0;transition:.25s;z-index:100000;pointer-events:none}.ft-toast.on{opacity:1;transform:translate(-50%,0)}.ft-toast.bad{background:#c92a2a}';
var ROOMS = ['현관', '거실', '주방', '식당', '안방', '침실1', '침실2', '침실3', '드레스룸', '안방욕실', '공용욕실', '욕실', '발코니', '다용도실', '팬트리', '알파룸', '서재', '복도'];
/* opts (영상에서 영상 만들기에서 열 때): { traceId, video:File, name, embed:true, onSave(T) } */
function mount(root, opts){
  opts = opts || {};
  if(!document.getElementById('ft-css')){ var st = document.createElement('style'); st.id = 'ft-css'; st.textContent = CSS; document.head.appendChild(st); }
  var T = null, V = null, SEL = -1, saveT = 0, busy = false, STOP = false, raf = 0, drag = null, LAST = null;
  root.innerHTML = '<div class="ft"><div class="ft-hero"><h2>🗺 평면도 트레이서</h2><p>현관부터 걸으며 찍은 모델하우스·세대 내부 영상을 보면서 평면도에 「지금 여기」를 찍으면, 평면도 위로 <b>이동 경로 · 현재 위치 · 바라보는 방향(부채)</b>이 움직이는 <b>투명 MOV</b>를 만듭니다. 원본 영상과 길이가 같아 프리미어 프로에서 시작만 맞춰 얹으면 됩니다. 방향은 영상에서 브라우저가 계산합니다 (AI·토큰 없음).</p></div>'
    + '<div class="ft-bar"><b>작업</b><select class="ft-sel" id="ftList"></select><button class="ft-btn" id="ftNew">＋ 새 작업</button><input class="ft-in" id="ftName" placeholder="작업 이름 (예: 더샵 퍼스트파크 84A 모델하우스)"><button class="ft-btn" id="ftDel">지우기</button><span class="ft-note" id="ftSaved"></span></div>'
    + '<div class="ft-grid"><div>'
    + '<div class="ft-card"><h4>① 영상 <small>현관부터 걸으며 찍은 영상 · 16:9 / 9:16 모두</small></h4><div class="ft-vwrap" id="ftVw"><video id="ftV" playsinline preload="auto"></video><div class="ft-vempty" id="ftVe"><div id="ftVmsg">영상 파일을 넣어 주세요</div><label class="ft-btn pri" style="cursor:pointer">📁 영상 고르기<input type="file" id="ftVf" accept="video/*" hidden></label><div class="ft-note" style="color:#adb5bd">영상은 이 PC 안에서만 씁니다 (올리지 않음)</div></div></div>'
    + '<div class="ft-ctl"><button class="ft-btn" id="ftPlay">▶ 재생</button><button class="ft-btn sm" data-sk="-5">−5초</button><button class="ft-btn sm" data-sk="-1">−1초</button><button class="ft-btn sm" data-sk="-0.0333">◀ 한 장</button><span class="tm" id="ftTm">0:00.0 / 0:00.0</span><button class="ft-btn sm" data-sk="0.0333">한 장 ▶</button><button class="ft-btn sm" data-sk="1">+1초</button><button class="ft-btn sm" data-sk="5">+5초</button>'
    + '<select class="ft-sel" id="ftRate"><option value="0.5">0.5배</option><option value="1" selected>1배</option><option value="1.5">1.5배</option><option value="2">2배</option></select><label class="ft-btn sm" style="cursor:pointer">바꾸기<input type="file" id="ftVf2" accept="video/*" hidden></label></div>'
    + '<canvas class="ft-tl" id="ftTl" height="38"></canvas><div class="ft-note">단축키: <b>Space</b> 재생/멈춤 · <b>← →</b> 1초 · <b>Shift+← →</b> 5초 · <b>, .</b> 한 장 · <b>Delete</b> 고른 점 지우기</div></div>'
    + '<div class="ft-card"><h4>③ 바라보는 방향 <small>부채가 가리키는 쪽</small></h4>'
    + '<div class="ft-f"><label>방향 정하기</label><span class="ft-seg" data-seg="head"><button data-v="auto">🧭 영상 분석 (몸 돌린 각도)</button><button data-v="path">➡️ 이동 방향 따라</button></span></div>'
    + '<div class="ft-f"><label>렌즈</label><select class="ft-sel" data-s="lens"><option value="main">기본 렌즈 (1×)</option><option value="wide">광각 렌즈 (0.5×)</option></select><span class="ft-note">화각</span><input class="ft-in" type="number" data-s="hfov" min="0" max="170" step="1" style="width:70px" placeholder="자동"><span class="ft-note" id="ftHf"></span></div>'
    + '<button class="ft-btn pri" id="ftYaw">🧭 영상에서 방향 계산</button> <button class="ft-btn" id="ftYawStop" style="display:none">멈추기</button><div id="ftYawOut"></div>'
    + '<div class="ft-note" style="margin-top:6px">영상을 3배 빠르기로 한 번 훑으며 화면이 좌우로 밀린 만큼 몸을 돌린 각도로 바꿉니다 (5분 영상 약 1분 40초). 평면도에서 점을 골라 <b>화살표 끝을 끌면</b> 그때 바라본 방향을 정할 수 있고, 계산한 각도는 그 방향들에 맞춰 바로잡힙니다. 흰 벽만 보이는 곳은 각도를 0 으로 둡니다.</div></div>'
    + '</div><div>'
    + '<div class="ft-card"><h4>② 평면도에 경로 찍기</h4><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><label class="ft-btn pri" style="cursor:pointer">📁 평면도 그림<input type="file" id="ftPf" accept="image/*" hidden></label><button class="ft-btn" id="ftRotL" title="왼쪽으로 90° 돌리기">⟲ 90°</button><button class="ft-btn" id="ftRotR" title="오른쪽으로 90° 돌리기">⟳ 90°</button><span class="ft-note" style="align-self:center">그림을 붙여 넣어도 됩니다 (Ctrl+V)</span></div>'
    + '<div class="ft-plan" id="ftPw"><canvas id="ftPc"></canvas><div class="ft-vempty" id="ftPe" style="color:#868e96">평면도 그림(JPG·PNG)을 넣어 주세요<br><span class="ft-note">분양 홈페이지·네이버 부동산 평면도 캡처도 됩니다</span></div></div>'
    + '<div class="ft-hint" id="ftHint"></div>'
    + '<table class="ft-wl" id="ftWl"></table><datalist id="ftRooms">' + ROOMS.map(function(r){ return '<option value="' + r + '">'; }).join('') + '</datalist></div>'
    + '</div></div>'
    + '<div class="ft-card"><h4>④ 모양 · 투명 MOV 내보내기</h4><div class="ft-out"><div id="ftSet"></div><div><div class="ft-pv"><canvas id="ftPv"></canvas></div><div class="ft-note" style="margin-top:4px" id="ftPvInfo"></div>'
    + '<div style="margin-top:10px"><button class="ft-btn pri big" id="ftExp">🎬 투명 MOV 만들기</button><div style="display:flex;gap:6px;margin-top:6px"><button class="ft-btn" id="ftPng">🖼 지금 화면 PNG</button><button class="ft-btn" id="ftExpStop" style="display:none">멈추기</button></div><div id="ftExpOut"></div></div></div></div></div></div>';
  V = $('#ftV', root);
  if(opts.embed){ ['#ftList', '#ftNew', '#ftDel'].forEach(function(q){ var e = $(q, root); if(e) e.style.display = 'none'; }); var hp = $('.ft-hero p', root); if(hp) hp.innerHTML = '이 클립 영상을 보며 평면도에 「지금 여기」를 찍으세요. 여기서 만든 트레이스는 영상에 바로 합성되고, 도구 → 🗺 평면도 트레이서에도 같이 저장됩니다.'; }
  var pc = $('#ftPc', root), pctx = pc.getContext('2d'), tl = $('#ftTl', root), pv = $('#ftPv', root);

  /* 설정 칸 */
  function setHtml(){
    var s = S(T), seg = function(k, list){ return '<span class="ft-seg" data-seg="' + k + '">' + list.map(function(x){ return '<button data-v="' + x[0] + '"' + (String(s[k]) === String(x[0]) ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</span>'; };
    var rng = function(k, a, b, st, unit){ return '<input type="range" data-s="' + k + '" min="' + a + '" max="' + b + '" step="' + st + '" value="' + s[k] + '"><b>' + s[k] + (unit || '') + '</b>'; };
    return '<div class="ft-f"><label>크기</label><select class="ft-sel" data-s="size">' + Object.keys(SIZES).map(function(k){ return '<option value="' + k + '"' + (s.size === k ? ' selected' : '') + '>' + SIZES[k][0] + '</option>'; }).join('') + '</select></div>'
      + '<div class="ft-f"><label>보기</label>' + seg('view', [['fit', '평면도 전체'], ['follow', '마커 따라 확대 (파일 큼)']]) + (s.view === 'follow' ? rng('zoom', 1.2, 4, 0.1, '배') : '') + '</div>'
      + '<div class="ft-f"><label>배경</label>' + seg('bg', [['card', '흰 카드'], ['none', '카드 없이']]) + (s.bg === 'card' ? rng('cardA', 40, 100, 2, '%') : '') + '</div>'
      + '<div class="ft-f"><label>평면도</label><span class="ft-note">진하기</span>' + rng('planA', 30, 100, 5, '%') + '<label class="ft-note"><input type="checkbox" data-s="planCut"' + (s.planCut ? ' checked' : '') + '> 흰 바탕 투명하게</label>' + (s.bg === 'card' ? '<label class="ft-note"><input type="checkbox" data-s="frame"' + (s.frame ? ' checked' : '') + '> 테두리</label>' : '') + '</div>'
      + '<div class="ft-f"><label>마커</label>' + seg('marker', Object.keys(MARKS).map(function(k){ return [k, MARKS[k]]; })) + '<input type="color" data-s="mColor" value="' + s.mColor + '"></div>'
      + '<div class="ft-f"><label></label><span class="ft-note">크기</span>' + rng('mSize', 50, 250, 10, '%') + '</div>'
      + (s.marker === 'char' ? '<div class="ft-f"><label>캐릭터</label><span id="ftChars" class="ft-note">불러오는 중…</span><label class="ft-btn sm" style="cursor:pointer">📁 그림<input type="file" id="ftCf" accept="image/*" hidden></label>' + rng('charSz', 50, 250, 10, '%') + '</div>' : '')
      + '<div class="ft-f"><label>부채 (시야)</label><label class="ft-note"><input type="checkbox" data-s="fan"' + (s.fan ? ' checked' : '') + '> 보이기</label><input type="color" data-s="fanColor" value="' + s.fanColor + '"><span class="ft-note">각도</span>' + rng('fov', 30, 140, 5, '°') + '</div>'
      + '<div class="ft-f"><label></label><span class="ft-note">길이</span>' + rng('fanLen', 8, 45, 1, '%') + seg('fanStyle', [['flat', '단색 (파일 작음)'], ['soft', '부드럽게 번짐 (파일 큼)']]) + '</div>'
      + '<div class="ft-f"><label>지나온 길</label><label class="ft-note"><input type="checkbox" data-s="trail"' + (s.trail ? ' checked' : '') + '> 보이기</label><input type="color" data-s="tColor" value="' + s.tColor + '"><label class="ft-note"><input type="checkbox" data-s="future"' + (s.future ? ' checked' : '') + '> 갈 길 점선</label></div>'
      + '<div class="ft-f"><label>경로 모양</label>' + seg('curve', [['smooth', '부드러운 곡선'], ['line', '직선']]) + '</div>'
      + '<div class="ft-f"><label>글</label><label class="ft-note"><input type="checkbox" data-s="label"' + (s.label ? ' checked' : '') + '> 📍 지금 방 이름</label><input class="ft-in" data-s="title" value="' + esc(s.title) + '" placeholder="오른쪽 위 제목 (예: 84A 타입)" style="flex:1;min-width:140px"></div>'
      + '<div class="ft-f"><label>초당 장면</label>' + seg('fps', [[24, '24'], [30, '30'], [60, '60']]) + '<span class="ft-note">편집할 원본 영상과 같게</span></div>';
  }
  function bindSet(box){
    $$('[data-s]', box).forEach(function(el){
      var k = el.dataset.s, ev = el.type === 'range' || el.type === 'color' || el.type === 'text' || el.tagName === 'INPUT' && el.type !== 'checkbox' ? 'input' : 'change';
      el.addEventListener(ev, function(){
        var v = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? (el.value === '' ? 0 : +el.value) : el.value;
        T.set[k] = v; if(el.type === 'range' && el.nextElementSibling) el.nextElementSibling.textContent = v + (/fov/.test(k) ? '°' : k === 'zoom' ? '배' : '%');
        if(k === 'size' || k === 'lens' || k === 'hfov') paintAll(); else { drawPv(); drawPlan(); }
        if(k === 'lens' || k === 'hfov') hfInfo();
        save();
      });
    });
    $$('[data-seg]', box).forEach(function(sg){ $$('button', sg).forEach(function(b){ b.onclick = function(){ var k = sg.dataset.seg, v = b.dataset.v; T.set[k] = k === 'fps' ? +v : v; save(); if(sg.closest('#ftSet')) paintSet(); else paintSeg(); drawPv(); drawPlan(); }; }); });
  }
  function paintSet(){ var box = $('#ftSet', root); box.innerHTML = setHtml(); bindSet(box); if(S(T).marker === 'char') charList(); }
  function paintSeg(){ $$('[data-seg="head"] button', root).forEach(function(b){ b.classList.toggle('on', S(T).head === b.dataset.v); }); }
  function hfInfo(){ var e = $('#ftHf', root); if(e) e.textContent = '지금 ' + hfovOf(T) + '° ' + (S(T).hfov ? '(직접)' : '(자동 · ' + (T.video ? (T.video.h > T.video.w ? '세로 영상' : '가로 영상') : '영상 없음') + ')'); }
  function charList(){
    var el = $('#ftChars', root); if(!el) return;
    castChars().then(function(L){
      var s = S(T); el.innerHTML = L.length ? L.map(function(c, i){ return '<img data-ci="' + i + '" src="' + c.src + '" title="' + esc(c.label) + '" style="width:34px;height:42px;object-fit:contain;border:2px solid ' + (s.char === c.src ? '#4c6ef5' : '#e3e7ee') + ';border-radius:6px;background:#fff;cursor:pointer;margin-right:3px">'; }).join('') : '영상 → 🎭 출연진의 캐릭터가 여기 나옵니다';
      $$('[data-ci]', el).forEach(function(im){ im.onclick = function(){ T.set.char = L[+im.dataset.ci].src; save(); paintSet(); imgReady(T.set.char, true).then(drawPv); }; });
    });
    var cf = $('#ftCf', root); if(cf) cf.onchange = function(){ var f = this.files[0]; if(!f) return; shrink(f, 700).then(function(u){ T.set.char = u; save(); paintSet(); imgReady(u, true).then(drawPv); }); };
  }

  /* 작업 목록 · 저장 */
  function save(){ if(!T) return; clearTimeout(saveT); saveT = setTimeout(function(){ putOne(T).then(function(){ var e = $('#ftSaved', root); if(e) e.textContent = '✓ 저장됨'; listPaint(); if(opts.onSave) try{ opts.onSave(T); }catch(er){} }); }, 400); var e = $('#ftSaved', root); if(e) e.textContent = '저장 중…'; }
  function listPaint(){
    listAll().then(function(L){
      if(T && !L.some(function(x){ return x.id === T.id; })) L.unshift(T);
      $('#ftList', root).innerHTML = L.map(function(x){ return '<option value="' + x.id + '"' + (T && x.id === T.id ? ' selected' : '') + '>' + esc(x.name || (x.video && x.video.name) || '이름 없는 작업') + ' · ' + new Date(x.at || Date.now()).toLocaleDateString('ko-KR') + '</option>'; }).join('');
    });
  }
  function open(t){
    T = t; T.set = Object.assign({}, DEF, T.set || {}); SEL = -1; LAST = null;
    $('#ftName', root).value = T.name || '';
    if(T.plan) imgReady(T.plan.src, false).then(paintAll);
    if(V.src && !(T.video && T.video.name === V.dataset.name && Math.abs(T.video.dur - V.duration) < 0.6)){ V.removeAttribute('src'); V.load(); }
    paintAll(); listPaint();
  }
  $('#ftList', root).onchange = function(){ var id = this.value; getOne(id).then(function(t){ if(t) open(t); }); };
  $('#ftNew', root).onclick = function(){ open(newTrace()); save(); };
  $('#ftDel', root).onclick = function(){ if(!confirm('이 작업을 지울까요?')) return; var id = T.id; delOne(id).then(function(){ listAll().then(function(L){ open(L[0] || newTrace()); }); }); };
  $('#ftName', root).oninput = function(){ T.name = this.value; save(); };

  /* 영상 */
  function onVideoFile(f){
    if(!f) return; var u = URL.createObjectURL(f); V.src = u; V.dataset.name = f.name;
    V.onloadedmetadata = function(){
      var d = { name:f.name, size:f.size, dur:V.duration, w:V.videoWidth, h:V.videoHeight };
      if(T.video && Math.abs(T.video.dur - d.dur) > 0.6 && T.wp.length) toast('찍어 둔 영상과 길이가 다릅니다 (' + fmtT(T.video.dur) + ' → ' + fmtT(d.dur) + ') — 같은 영상인지 확인해 주세요', true);
      if(T.yaw && T.video && Math.abs(T.video.dur - d.dur) > 0.6) T.yaw = null;
      T.video = d; if(!T.name){ T.name = f.name.replace(/\.[^.]+$/, ''); $('#ftName', root).value = T.name; }
      save(); paintAll(); V.currentTime = 0;
    };
  }
  $('#ftVf', root).onchange = function(){ onVideoFile(this.files[0]); }; $('#ftVf2', root).onchange = function(){ onVideoFile(this.files[0]); };
  $('#ftPlay', root).onclick = function(){ if(!V.src) return; if(V.paused) V.play(); else V.pause(); };
  V.onplay = function(){ $('#ftPlay', root).textContent = '⏸ 멈춤'; loop(); }; V.onpause = function(){ $('#ftPlay', root).textContent = '▶ 재생'; tick(); };
  V.onseeked = tick; V.ontimeupdate = function(){ if(V.paused) tick(); };
  $$('[data-sk]', root).forEach(function(b){ b.onclick = function(){ seek(V.currentTime + (+b.dataset.sk)); }; });
  $('#ftRate', root).onchange = function(){ V.playbackRate = +this.value; };
  function seek(t){ if(!V.src || !V.duration) return; V.currentTime = clamp(t, 0, V.duration - 0.01); }
  function now(){ return V.src && V.duration ? V.currentTime : 0; }
  function loop(){ cancelAnimationFrame(raf); var f = function(){ tick(); if(!V.paused) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); }
  function tick(){ var D = dur(T); $('#ftTm', root).textContent = fmtT(now()) + ' / ' + fmtT(D); drawTl(); drawPlan(); drawPv(); }
  document.addEventListener('keydown', function(e){
    if(!root.offsetParent || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
    if(e.code === 'Space'){ e.preventDefault(); $('#ftPlay', root).click(); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); seek(now() - (e.shiftKey ? 5 : 1)); }
    else if(e.key === 'ArrowRight'){ e.preventDefault(); seek(now() + (e.shiftKey ? 5 : 1)); }
    else if(e.key === ','){ seek(now() - 1 / 30); } else if(e.key === '.'){ seek(now() + 1 / 30); }
    else if((e.key === 'Delete' || e.key === 'Backspace') && SEL >= 0){ e.preventDefault(); delWp(SEL); }
  });

  /* 시간 줄 */
  function drawTl(){
    var w = tl.clientWidth || 600, h = 38, dpr = window.devicePixelRatio || 1; if(tl.width !== Math.round(w * dpr)){ tl.width = Math.round(w * dpr); tl.height = Math.round(h * dpr); }
    var x = tl.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    var D = dur(T) || 1, X = function(t){ return 8 + (w - 16) * clamp(t / D, 0, 1); };
    x.fillStyle = '#dee2e6'; rr(x, 8, 16, w - 16, 6, 3); x.fill();
    for(var i = 0; i < T.wp.length - 1; i++){ x.fillStyle = i % 2 ? '#bac8ff' : '#91a7ff'; x.fillRect(X(T.wp[i].t), 16, X(T.wp[i + 1].t) - X(T.wp[i].t), 6); }
    T.wp.forEach(function(p, j){ var px = X(p.t); x.fillStyle = j === SEL ? '#e8590c' : '#4c6ef5'; x.beginPath(); x.arc(px, 19, 6.5, 0, Math.PI * 2); x.fill(); x.fillStyle = '#fff'; x.font = '700 8px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(j + 1), px, 19.5); });
    var nx = X(now()); x.fillStyle = '#e03131'; x.fillRect(nx - 1, 3, 2, 32);
  }
  var tlDown = false; tl.onpointerdown = function(e){ tlDown = true; tl.setPointerCapture(e.pointerId); tlSeek(e); }; tl.onpointermove = function(e){ if(tlDown) tlSeek(e); }; tl.onpointerup = function(){ tlDown = false; };
  function tlSeek(e){ var r = tl.getBoundingClientRect(), D = dur(T); if(!D) return; seek(clamp(((e.clientX - r.left) / r.width * (tl.clientWidth || r.width) - 8) / ((tl.clientWidth || r.width) - 16), 0, 1) * D); }

  /* 평면도 편집 */
  function planFit(){ var box = $('#ftPw', root), maxW = Math.max(240, box.clientWidth - 2), maxH = Math.max(260, Math.min(window.innerHeight * 0.62, 640)), k = Math.min(maxW / T.plan.w, maxH / T.plan.h); return { w:Math.round(T.plan.w * k), h:Math.round(T.plan.h * k), k:k }; }
  function drawPlan(){
    var has = !!T.plan; $('#ftPe', root).style.display = has ? 'none' : 'flex'; pc.style.display = has ? 'block' : 'none';
    hint(); if(!has) return;
    var f = planFit(), dpr = window.devicePixelRatio || 1;
    if(pc.width !== Math.round(f.w * dpr) || pc.height !== Math.round(f.h * dpr)){ pc.width = Math.round(f.w * dpr); pc.height = Math.round(f.h * dpr); pc.style.width = f.w + 'px'; pc.style.height = f.h + 'px'; }
    var x = pctx; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, f.w, f.h);
    var im = img(T.plan.src, false); if(im && im.complete !== false) x.drawImage(im, 0, 0, f.w, f.h);
    var p = pathOf(T), k = f.k;
    if(p){ x.strokeStyle = 'rgba(76,110,245,.55)'; x.lineWidth = 2.5; x.setLineDash([5, 4]); x.beginPath(); for(var i = 0; i < p.n; i += 2){ var px = p.xs[i] * k, py = p.ys[i] * k; if(i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); x.setLineDash([]);
      var q = at(p, now()), hr = q.h * Math.PI / 180, s = S(T), R = Math.min(f.w, f.h) * 0.16, g = x.createRadialGradient(q.x * k, q.y * k, 0, q.x * k, q.y * k, R);
      g.addColorStop(0, hexA(s.fanColor, 0.7)); g.addColorStop(1, hexA(s.fanColor, 0)); x.fillStyle = g; x.beginPath(); x.moveTo(q.x * k, q.y * k); x.arc(q.x * k, q.y * k, R, hr - s.fov * Math.PI / 360, hr + s.fov * Math.PI / 360); x.closePath(); x.fill();
      x.fillStyle = '#e03131'; x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.beginPath(); x.arc(q.x * k, q.y * k, 7, 0, Math.PI * 2); x.fill(); x.stroke(); }
    T.wp.forEach(function(w, j){
      var px = w.x * T.plan.w * k, py = w.y * T.plan.h * k, on = j === SEL;
      if(w.dir != null || on){ var d = (w.dir != null ? w.dir : (p ? at(p, w.t).h : 0)) * Math.PI / 180, L = 34, ex = px + Math.cos(d) * L, ey = py + Math.sin(d) * L;
        x.strokeStyle = w.dir != null ? '#e8590c' : 'rgba(232,89,12,.45)'; x.lineWidth = 3; x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke();
        if(on){ x.fillStyle = '#fff'; x.strokeStyle = '#e8590c'; x.lineWidth = 3; x.beginPath(); x.arc(ex, ey, 7, 0, Math.PI * 2); x.fill(); x.stroke(); } }
      x.fillStyle = on ? '#e8590c' : '#4c6ef5'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, on ? 11 : 9, 0, Math.PI * 2); x.fill(); x.stroke();
      x.fillStyle = '#fff'; x.font = '800 10px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(j + 1), px, py + 0.5);
      if(w.name){ x.font = '700 11px ' + FONT; var tw = x.measureText(w.name).width + 8; x.fillStyle = 'rgba(26,32,44,.78)'; rr(x, px + 12, py - 9, tw, 18, 6); x.fill(); x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(w.name, px + 16, py + 0.5); }
    });
  }
  function hint(){
    var h = $('#ftHint', root), t = '';
    if(!T.plan) t = '<b>1.</b> 평면도 그림을 넣고 <b>2.</b> 영상을 넣으세요.';
    else if(!V.src) t = T.video ? '경로를 고치려면 같은 영상(<b>' + esc(T.video.name) + '</b> · ' + fmtT(T.video.dur) + ')을 다시 넣어 주세요. <b>투명 MOV 내보내기는 영상 없이도 됩니다.</b>' : '영상을 넣어 주세요.';
    else if(!T.wp.length) t = '영상을 <b>0초</b>에 두고 평면도에서 <b>현관(시작점)</b>을 누르세요. 그다음 점의 <b>화살표 끝을 끌어</b> 처음 바라보는 방향을 정합니다.';
    else t = '영상을 틀다가 <b>방에 들어설 때</b> 멈추고 평면도에서 그 자리를 누르세요 → <b>지금 시각</b>의 점이 생깁니다 (같은 시각 근처의 점은 옮겨짐). 점을 <b>끌면</b> 자리 이동, 점을 누르면 그 시각으로 갑니다. 마지막 점은 영상 끝(<b>' + fmtT(dur(T)) + '</b>) 쯤에 찍으세요. 지금 <b>' + T.wp.length + '개</b>';
    h.innerHTML = t;
  }
  function toPlan(e){ var r = pc.getBoundingClientRect(); return { x:clamp((e.clientX - r.left) / r.width, 0, 1), y:clamp((e.clientY - r.top) / r.height, 0, 1), px:(e.clientX - r.left) / r.width * pc.clientWidth, py:(e.clientY - r.top) / r.height * pc.clientHeight }; }
  pc.onpointerdown = function(e){
    if(!T.plan) return; var m = toPlan(e), f = planFit(), k = f.k, hit = -1, p = pathOf(T);
    if(SEL >= 0 && T.wp[SEL]){ var w = T.wp[SEL], d = (w.dir != null ? w.dir : (p ? at(p, w.t).h : 0)) * Math.PI / 180, ex = w.x * T.plan.w * k + Math.cos(d) * 34, ey = w.y * T.plan.h * k + Math.sin(d) * 34;
      if(Math.hypot(m.px - ex, m.py - ey) < 12){ drag = { kind:'dir', i:SEL }; pc.setPointerCapture(e.pointerId); return; } }
    T.wp.forEach(function(w, j){ if(Math.hypot(m.px - w.x * T.plan.w * k, m.py - w.y * T.plan.h * k) < 12) hit = j; });
    if(hit >= 0){ SEL = hit; drag = { kind:'move', i:hit, x0:m.px, y0:m.py, moved:false }; pc.setPointerCapture(e.pointerId); paintWl(); drawPlan(); drawTl(); return; }
    if(!V.src){ toast('영상을 넣은 뒤에 찍을 수 있습니다 — 영상의 지금 시각으로 점이 생깁니다', true); return; }
    var t = now(), near = -1; T.wp.forEach(function(w, j){ if(Math.abs(w.t - t) < 0.35) near = j; });
    if(near >= 0){ T.wp[near].x = m.x; T.wp[near].y = m.y; SEL = near; }
    else { var nw = { id:uid(), t:Math.round(t * 100) / 100, x:m.x, y:m.y, dir:null, name:T.wp.length ? '' : '현관' }; T.wp.push(nw); sortWp(T); SEL = T.wp.indexOf(nw); }
    drag = { kind:'move', i:SEL, x0:m.px, y0:m.py, moved:true }; pc.setPointerCapture(e.pointerId);
    save(); paintWl(); tick();
  };
  pc.onpointermove = function(e){
    if(!drag) return; var m = toPlan(e), w = T.wp[drag.i]; if(!w) return;
    if(drag.kind === 'dir'){ var f = planFit(); w.dir = Math.round(angN(Math.atan2(m.py - w.y * T.plan.h * f.k, m.px - w.x * T.plan.w * f.k) * 180 / Math.PI)); }
    else { if(!drag.moved && Math.hypot(m.px - drag.x0, m.py - drag.y0) < 4) return; drag.moved = true; w.x = m.x; w.y = m.y; }
    drawPlan(); drawPv();
  };
  pc.onpointerup = function(){ if(!drag) return; var d = drag; drag = null; if(d.kind === 'move' && !d.moved && T.wp[d.i]) seek(T.wp[d.i].t); save(); paintWl(); tick(); };
  function delWp(i){ T.wp.splice(i, 1); SEL = -1; save(); paintWl(); tick(); }
  function paintWl(){
    var tb = $('#ftWl', root);
    if(!T.wp.length){ tb.innerHTML = ''; return; }
    tb.innerHTML = '<tr><th>#</th><th>시각</th><th>방 이름</th><th>방향</th><th></th></tr>' + T.wp.map(function(w, j){
      return '<tr data-i="' + j + '"' + (j === SEL ? ' class="on"' : '') + '><td><span class="n">' + (j + 1) + '</span></td><td><button class="ft-btn sm" data-go title="이 시각으로">' + fmtT(w.t) + '</button> <button class="ft-btn sm" data-now title="영상의 지금 시각으로 바꾸기">⏱</button></td>'
        + '<td><input class="ft-in" list="ftRooms" data-nm value="' + esc(w.name || '') + '" placeholder="방 이름"></td>'
        + '<td>' + (w.dir != null ? '<b>' + w.dir + '°</b> <button class="ft-btn sm" data-nd title="방향 지우기">✕</button>' : '<span class="ft-note">자동</span>') + '</td><td><button class="ft-btn sm" data-del>🗑</button></td></tr>';
    }).join('');
    $$('tr[data-i]', tb).forEach(function(tr){
      var i = +tr.dataset.i, w = T.wp[i];
      tr.onclick = function(e){ if(e.target.closest('input,button')) return; SEL = i; paintWl(); drawPlan(); drawTl(); };
      $('[data-go]', tr).onclick = function(){ SEL = i; seek(w.t); paintWl(); };
      $('[data-now]', tr).onclick = function(){ if(!V.src) return; w.t = Math.round(now() * 100) / 100; sortWp(T); SEL = T.wp.indexOf(w); save(); paintWl(); tick(); };
      $('[data-nm]', tr).oninput = function(){ w.name = this.value; save(); drawPlan(); drawPv(); };
      var nd = $('[data-nd]', tr); if(nd) nd.onclick = function(){ w.dir = null; save(); paintWl(); tick(); };
      $('[data-del]', tr).onclick = function(){ delWp(i); };
    });
  }
  /* 평면도 넣기 · 돌리기 */
  function setPlan(src){ return loadImg(src).then(function(im){ var k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    var u = c.toDataURL(/^data:image\/png/.test(src) ? 'image/png' : 'image/jpeg', 0.92); if(T.plan && T.wp.length && !confirm('평면도를 바꿀까요? 찍어 둔 점은 그대로 두지만 자리가 맞지 않을 수 있습니다.')) return;
    T.plan = { src:u, w:c.width, h:c.height }; return imgReady(u, false).then(function(){ save(); paintAll(); }); }); }
  $('#ftPf', root).onchange = function(){ var f = this.files[0]; if(!f) return; var fr = new FileReader(); fr.onload = function(){ setPlan(fr.result); }; fr.readAsDataURL(f); };
  document.addEventListener('paste', function(e){ if(!root.offsetParent || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return; var it = Array.prototype.slice.call((e.clipboardData || {}).items || []).find(function(x){ return /^image\//.test(x.type); }); if(!it) return; var f = it.getAsFile(), fr = new FileReader(); fr.onload = function(){ setPlan(fr.result); }; fr.readAsDataURL(f); });
  function rot(dir){
    if(!T.plan) return; loadImg(T.plan.src).then(function(im){
      var c = document.createElement('canvas'); c.width = im.height; c.height = im.width; var x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(dir * Math.PI / 2); x.drawImage(im, -im.width / 2, -im.height / 2);
      T.plan = { src:c.toDataURL(/^data:image\/png/.test(T.plan.src) ? 'image/png' : 'image/jpeg', 0.92), w:c.width, h:c.height };
      T.wp.forEach(function(w){ var x0 = w.x, y0 = w.y; if(dir > 0){ w.x = 1 - y0; w.y = x0; } else { w.x = y0; w.y = 1 - x0; } if(w.dir != null) w.dir = angN(w.dir + dir * 90); });
      imgReady(T.plan.src, false).then(function(){ save(); paintAll(); });
    });
  }
  $('#ftRotL', root).onclick = function(){ rot(-1); }; $('#ftRotR', root).onclick = function(){ rot(1); };

  /* 방향 계산 */
  $('#ftYaw', root).onclick = function(){
    if(!V.src || !V.duration) return toast('영상을 먼저 넣어 주세요', true);
    if(busy) return; busy = true; STOP = false; var b = this, out = $('#ftYawOut', root), st = $('#ftYawStop', root); b.disabled = true; st.style.display = '';
    var t0 = performance.now();
    analyzeYaw(V, T, function(f){ out.innerHTML = '<div class="ft-prog"><i style="width:' + Math.round(f * 100) + '%"></i></div><div class="ft-note">' + Math.round(f * 100) + '% · ' + Math.round((performance.now() - t0) / 1000) + '초</div>'; }, function(){ return STOP; })
      .then(function(y){ T.yaw = y; T.set.head = 'auto'; save(); paintSeg(); var tot = y.a[y.a.length - 1]; out.innerHTML = '<div class="ft-ok">✓ 방향을 계산했습니다 — 장면 ' + y.n + '장 · 전체 ' + Math.round(Math.abs(tot)) + '° ' + (tot >= 0 ? '오른쪽' : '왼쪽') + '으로 돌았습니다. 부채 방향이 어긋난 곳은 평면도에서 점을 골라 화살표 끝을 끌어 바로잡으세요.</div>'; tick(); },
        function(e){ out.innerHTML = '<div class="ft-err">' + esc(e.message || String(e)) + '</div>'; })
      .then(function(){ busy = false; b.disabled = false; st.style.display = 'none'; });
  };
  $('#ftYawStop', root).onclick = function(){ STOP = true; };
  $$('[data-seg="head"] button', root).forEach(function(b){ b.onclick = function(){ T.set.head = b.dataset.v; save(); paintSeg(); tick(); if(b.dataset.v === 'auto' && !T.yaw) toast('「🧭 영상에서 방향 계산」을 눌러 주세요 — 그 전에는 이동 방향을 따릅니다'); }; });
  bindSet($('.ft-grid', root));

  /* 미리보기 · 내보내기 */
  function drawPv(){
    var d = outDims(T), mw = Math.min(560, ($('.ft-pv', root).clientWidth || 560)), k = Math.min(1, mw / d.W, 520 / d.H), dpr = window.devicePixelRatio || 1;
    var w = Math.round(d.W * k), h = Math.round(d.H * k); if(pv.width !== Math.round(w * dpr)){ pv.width = Math.round(w * dpr); pv.height = Math.round(h * dpr); pv.style.width = w + 'px'; pv.style.height = h + 'px'; }
    var x = pv.getContext('2d'); x.setTransform(pv.width / d.W, 0, 0, pv.height / d.H, 0, 0); render(x, d.W, d.H, T, now(), { checker:true });
    $('#ftPvInfo', root).textContent = '결과 ' + d.W + '×' + d.H + ' · 바둑판 무늬 = 투명 · ' + fmtT(now());
  }
  $('#ftPng', root).onclick = function(){ var d = outDims(T), c = document.createElement('canvas'); c.width = d.W; c.height = d.H; render(c.getContext('2d'), d.W, d.H, T, now()); c.toBlob(function(b){ dl(b, ymd8() + '_평면도TRACE_' + fname() + '_' + fmtT(now()).replace(/[:.]/g, '') + '.png'); }, 'image/png'); };
  function fname(){ return String(T.name || '작업').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40); }
  function dl(b, n){ var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = n; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  $('#ftExp', root).onclick = function(){
    if(busy) return; busy = true; STOP = false; var b = this, out = $('#ftExpOut', root), st = $('#ftExpStop', root); b.disabled = true; st.style.display = '';
    exportMov(T, function(f, by, sec){ var eta = f > 0.02 ? Math.round(sec / f - sec) : 0; out.innerHTML = '<div class="ft-prog"><i style="width:' + Math.round(f * 100) + '%"></i></div><div class="ft-note">' + Math.round(f * 100) + '% · ' + (by / 1048576).toFixed(1) + 'MB · ' + Math.round(sec) + '초' + (eta ? ' · 남은 시간 약 ' + eta + '초' : '') + '</div>'; }, function(){ return STOP; })
      .then(function(r){
        var n = ymd8() + '_평면도TRACE_' + fname() + '_' + r.W + 'x' + r.H + '.mov'; LAST = { blob:r.blob, name:n };
        out.innerHTML = '<div class="ft-ok">✅ 투명 MOV — ' + r.W + '×' + r.H + ' · ' + r.fps + 'fps · ' + fmtT(r.dur) + ' · ' + (r.blob.size / 1048576).toFixed(1) + 'MB<br><button class="ft-btn pri" id="ftDl">⬇ ' + esc(n) + '</button><div class="ft-note" style="margin-top:6px">프리미어 프로: 원본 영상을 V1 에, 이 MOV 를 <b>V2 에 같은 시작점</b>으로 놓고 「효과 컨트롤 → 모션」에서 크기·위치를 맞추세요. 끝까지 원본과 같이 흐릅니다.</div></div>';
        $('#ftDl', out).onclick = function(){ dl(LAST.blob, LAST.name); }; dl(r.blob, n);
      }, function(e){ out.innerHTML = '<div class="ft-err">' + esc(e.message || String(e)) + '</div>'; })
      .then(function(){ busy = false; b.disabled = false; st.style.display = 'none'; });
  };
  $('#ftExpStop', root).onclick = function(){ STOP = true; };

  function paintAll(){
    var vw = $('#ftVw', root), has = !!(V.src && V.duration);
    $('#ftVe', root).style.display = has ? 'none' : 'flex'; vw.classList.toggle('v', !!(T.video && T.video.h > T.video.w));
    $('#ftVmsg', root).innerHTML = T.video && !has ? '찍어 둔 영상: <b>' + esc(T.video.name) + '</b> · ' + fmtT(T.video.dur) + '<br>같은 영상을 다시 넣어 주세요' : '영상 파일을 넣어 주세요';
    var ls = $('[data-s="lens"]', root); if(ls) ls.value = S(T).lens; var hv = $('[data-s="hfov"]', root); if(hv) hv.value = S(T).hfov || '';
    hfInfo(); paintSeg(); paintSet(); paintWl(); tick();
    var yo = $('#ftYawOut', root); if(yo && !busy) yo.innerHTML = T.yaw ? '<div class="ft-note" style="margin-top:6px">✓ 방향 계산해 둠 (장면 ' + (T.yaw.n || '') + '장)</div>' : '';
  }
  window.addEventListener('resize', function(){ if(root.offsetParent && T) tick(); });
  if(opts.embed){
    (opts.traceId ? getOne(opts.traceId) : Promise.resolve(null)).then(function(t){
      if(!t){ t = newTrace(); t.name = opts.name || ''; }
      open(t); if(opts.video) onVideoFile(opts.video);
      if(!opts.traceId) save();
    });
  } else listAll().then(function(L){ open(L[0] || newTrace()); });
  return { get:function(){ return T; }, video:V, open:open, flush:function(){ clearTimeout(saveT); return T ? putOne(T) : Promise.resolve(); } };
}
function loadImg(src){ return new Promise(function(res, rej){ var im = new Image(); im.onload = function(){ res(im); }; im.onerror = function(){ rej(new Error('그림을 읽지 못했습니다')); }; im.src = src; }); }
function shrink(f, max){ return new Promise(function(res){ var fr = new FileReader(); fr.onload = function(){ loadImg(fr.result).then(function(im){ var k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }, function(){ res(fr.result); }); }; fr.readAsDataURL(f); }); }
/* 🎭 출연진(영상 → 내 출연진) 캐릭터 — 이 PC 저장분 */
function castChars(){
  return new Promise(function(res){
    try{ var q = indexedDB.open('sd_video_cast', 1); q.onupgradeneeded = function(){ if(!q.result.objectStoreNames.contains('cast')) q.result.createObjectStore('cast', { keyPath:'id' }); };
      q.onsuccess = function(){ try{ var r = q.result.transaction('cast', 'readonly').objectStore('cast').getAll(); r.onsuccess = function(){ res((r.result || []).filter(function(x){ return x.kind === 'char' && x.src; })); }; r.onerror = function(){ res([]); }; }catch(e){ res([]); } };
      q.onerror = function(){ res([]); }; }catch(e){ res([]); }
  });
}
window.sdTrace = { VER:VER, mount:mount, render:render, pathOf:pathOf, at:at, outDims:outDims, list:listAll, get:getOne, put:putOne, exportMov:exportMov, MovWriter:MovWriter, analyzeYaw:analyzeYaw, shiftX:shiftX, imgReady:imgReady, dur:dur, newTrace:newTrace };
})();
