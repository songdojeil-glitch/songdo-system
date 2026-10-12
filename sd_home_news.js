/* ════════════════════════════════════════════════════════════════════
   🏠 SJRWS → 송도제일 홈페이지 뉴스 등록 (2026-10-12)
   송도제일 홈페이지 관리자 「부동산뉴스관리」 화면에서 즐겨찾기 「SJRWS 뉴스등록」을 누르면 실행된다.
   (「매물관리」 화면에서 누르면 sd_home_props.js — SJRWS 매물 올리기 · 거래완료 — 로 넘긴다)
   · 이 창은 SJRWS 허브의 「🏠 홈페이지 등록」 버튼이 연 창이어야 한다 (허브가 기사 목록을 넘겨 준다)
   · 허브 → 기사 목록(제목·언론사·URL·구분) 받기 → 이미 목록에 있는 제목은 건너뜀 → 확인 → 한 건씩 등록
   · 등록은 화면의 등록 양식과 똑같은 요청(관리자 「뉴스 등록」)을 쓴다 — 양식이 바뀌어도 그 양식에서 요청 모양을 읽어 온다
   · 끝나면 등록한 기사를 허브에 알려 준다 → 허브가 Firebase(sd_news_home)에 「올림」으로 적어 다음엔 빼 준다
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var HUB_ORIGIN = 'https://songdojeil-glitch.github.io';
  //  2026-10-12: 같은 즐겨찾기로 「매물관리」 화면에서 누르면 매물 등록(sd_home_props.js)을 부른다
  if(/[?&]mid=adminMm\b/.test(location.search)){
    var s = document.createElement('script'); s.charset = 'utf-8';
    s.src = HUB_ORIGIN + '/songdo-system/sd_home_props.js?v=' + Date.now();
    document.body.appendChild(s); return;
  }
  if(window.__sjHomeNews){ alert('SJRWS 뉴스등록이 이미 실행 중입니다.'); return; }
  var f = document.forms && document.forms.writeForm;
  if(!f || !window.jQuery || !f.w_subject){ alert('송도제일 홈페이지 관리자 → 「부동산뉴스관리」 화면에서 눌러 주세요.'); return; }
  if(!window.opener){ alert('SJRWS 허브의 「🏠 홈페이지 등록」 버튼으로 연 관리자 창에서 눌러 주세요.\n(허브가 이 창으로 기사 목록을 넘겨 줍니다)'); return; }
  window.__sjHomeNews = true;

  // ── 진행 상황 상자 ──
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483647;width:340px;background:#14213d;color:#fff;font:13px/1.6 "Malgun Gothic",sans-serif;'
    + 'border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:14px 16px';
  box.innerHTML = '<div style="font-weight:800;font-size:14px;margin-bottom:6px">🏠 SJRWS 뉴스등록</div><div id="sjhn-msg">허브에서 기사 목록을 받는 중…</div>'
    + '<div style="height:6px;background:#2c3e66;border-radius:4px;margin-top:8px;overflow:hidden"><div id="sjhn-bar" style="height:100%;width:0;background:#4fd1c5"></div></div>'
    + '<div style="text-align:right;margin-top:8px"><button id="sjhn-x" style="border:0;border-radius:7px;padding:4px 10px;cursor:pointer">닫기</button></div>';
  document.body.appendChild(box);
  function msg(t){ document.getElementById('sjhn-msg').innerHTML = t; }
  function bar(p){ document.getElementById('sjhn-bar').style.width = Math.round(p * 100) + '%'; }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  document.getElementById('sjhn-x').onclick = function(){ box.remove(); window.__sjHomeNews = false; };

  // ── 등록 요청 모양 읽기: 화면의 등록 양식을 시험으로 한 번 돌려 요청만 붙잡고 보내지는 않는다 ──
  function capture(){
    var v = jQuery(f).data('validator'); if(!v || !v.settings || !v.settings.submitHandler) return null;
    var oc = window.confirm, op = jQuery.post, cap = null;
    window.confirm = function(){ return true; };
    jQuery.post = function(u, d){ cap = { u:u, d:d }; var o = { done:function(){ return o; }, fail:function(){ return o; }, always:function(){ return o; } }; return o; };
    var keep = [f.w_kind.value, f.w_subject.value, f.w_corporation.value, f.w_link.value];
    f.w_kind.value = 'news_songdo'; f.w_subject.value = 'x'; f.w_corporation.value = 'x'; f.w_link.value = 'https://x.kr/';
    try{ v.settings.submitHandler(f); }catch(e){}
    window.confirm = oc; jQuery.post = op;
    f.w_kind.value = keep[0]; f.w_subject.value = keep[1]; f.w_corporation.value = keep[2]; f.w_link.value = keep[3];
    return cap && typeof cap.d === 'string' ? cap : null;
  }
  //  언론사가 도메인으로 온 경우 한글 이름으로 (허브에서도 바꾸지만 여기서 한 번 더)
  var PRESS = { 'asiatime.co.kr':'아시아타임즈', 'ngetnews.com':'뉴스저널리즘', 'theguru.co.kr':'더구루', 'mygoyang.com':'고양신문', 'dnews.co.kr':'대한경제',
    'viva100.com':'브릿지경제', 'dailymedi.com':'데일리메디', 'kado.net':'강원도민일보', 'ppss.kr':'ㅍㅍㅅㅅ', 'wikitree.co.kr':'위키트리', 'voakorea.com':'VOA',
    'hitnews.co.kr':'히트뉴스', 'cstimes.com':'컨슈머타임스', 'hapt.co.kr':'한국아파트신문', 'kwnews.co.kr':'강원일보', 'sisajournal-e.com':'시사저널e', 'm-i.kr':'매일일보' };
  function send(cap, it){
    var val = { kind:it.kind, subject:it.subject, corporation:PRESS[it.corp] || it.corp, link:it.link };
    var body = cap.d.split('&').map(function(s){ var k = s.split('=')[0]; return val[k] === undefined ? s : k + '=' + encodeURIComponent(val[k]); }).join('&');
    return new Promise(function(res){
      jQuery.post(cap.u, body, function(r){ res(r && r.status === true); }, 'json').fail(function(){ res(false); });
    });
  }
  //  이미 목록(첫 화면)에 있는 제목 — 목록 제목은 뒤가 「...」로 잘려 있어 앞 14자로 견준다
  function head(t){ return String(t || '').replace(/\.{2,}|…/g, '').replace(/\s+/g, '').slice(0, 14); }
  var have = {};
  [].forEach.call(document.querySelectorAll('tr'), function(tr){
    var td = tr.querySelectorAll('td'); if(td.length < 4) return;
    [].forEach.call(td, function(c){ var h = head(c.textContent); if(h.length >= 8) have[h] = 1; });
  });

  async function run(items, src){
    var todo = items.filter(function(it){ return it && it.subject && it.link && !have[head(it.subject)]; });
    var skip = items.length - todo.length;
    if(!todo.length){ msg('등록할 새 기사가 없습니다.' + (skip ? '<br>(이미 목록에 있는 ' + skip + '건은 건너뜀)' : '')); src.postMessage({ sjrws:'news-done', keys:items.map(function(x){ return x.key; }), fail:0, skip:skip }, HUB_ORIGIN); return; }
    var cap = capture();
    if(!cap){ msg('⚠️ 등록 양식을 읽지 못했습니다. 홈페이지 화면이 바뀌었을 수 있습니다 — Claude 에게 알려 주세요.'); return; }
    var nS = todo.filter(function(x){ return x.kind === 'news_songdo'; }).length, nH = todo.length - nS;
    msg('송도국제도시뉴스 <b>' + nS + '</b>건 · 부동산핫뉴스 <b>' + nH + '</b>건' + (skip ? '<br><small>(이미 목록에 있는 ' + skip + '건 제외)</small>' : ''));
    if(!confirm('SJRWS 뉴스를 홈페이지에 등록할까요?\n\n· 송도국제도시뉴스 ' + nS + '건\n· 부동산핫뉴스 ' + nH + '건' + (skip ? '\n(이미 목록에 있는 ' + skip + '건 제외)' : ''))){ msg('취소했습니다.'); return; }
    var ok = [], fail = 0;
    for(var i = 0; i < todo.length; i++){
      msg('등록 중… ' + (i + 1) + ' / ' + todo.length + '<br><small>' + esc(todo[i].subject).slice(0, 40) + '</small>'); bar(i / todo.length);
      if(await send(cap, todo[i])) ok.push(todo[i].key); else fail++;
      await new Promise(function(z){ setTimeout(z, 250); });
    }
    bar(1);
    //  목록에 이미 있던 것도 「올림」으로 알려 다음엔 빼게 한다
    var keys = ok.concat(items.filter(function(it){ return have[head(it.subject)]; }).map(function(x){ return x.key; }));
    src.postMessage({ sjrws:'news-done', keys:keys, ok:ok.length, fail:fail, skip:skip }, HUB_ORIGIN);
    msg('✅ ' + ok.length + '건 등록' + (fail ? ' · ⚠️ 실패 ' + fail + '건' : '') + (skip ? ' · 건너뜀 ' + skip + '건' : '')
      + '<div style="margin-top:8px"><button onclick="location.reload()" style="border:0;border-radius:7px;padding:4px 10px;cursor:pointer">목록 새로고침</button></div>');
  }

  var got = false;
  window.addEventListener('message', function(e){
    if(e.origin !== HUB_ORIGIN) return;
    var m = e.data || {}; if(m.sjrws !== 'news-list' || got) return;
    got = true; run(m.items || [], e.source);
  });
  window.opener.postMessage({ sjrws:'news-req' }, HUB_ORIGIN);
  setTimeout(function(){ if(!got) msg('⚠️ 허브에서 답이 없습니다. 허브 창이 열려 있는지 확인하고, 허브의 「🏠 홈페이지 등록」으로 이 창을 다시 열어 주세요.'); }, 8000);
})();
