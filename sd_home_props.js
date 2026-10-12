/* ════════════════════════════════════════════════════════════════════
   🏠 SJRWS 매물 → 송도제일 홈페이지 매물 등록 · 거래완료 (2026-10-12)
   송도제일 홈페이지 관리자 「매물관리」 화면에서 즐겨찾기 「SJRWS 뉴스등록」을 누르면 sd_home_news.js 가 이 파일을 불러온다.
   · 이 창은 SJRWS 매물관리 → 「🏠 홈페이지 매물」의 「관리자 창 열기」로 연 창이어야 한다 (매물관리가 목록을 넘겨 준다)
   · 새 매물: 홈페이지 등록 양식과 같은 요청(관리자 매물 쓰기)으로 올리고, 목록에서 새 매물 번호를 찾아 SJRWS 에 알려 준다
   · 거래완료: 숨은 창으로 그 매물 「수정」 화면을 열어, 화면이 보내는 저장 요청 모양을 그대로 읽고 거래상태만 「거래완료」로 바꿔 보낸다
   · 소유주 이름·연락처는 「관리메모(보안)」 칸으로만 간다 (홈페이지 밖으로는 안 보이는 칸 — 대표님 확인)
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var HUB_ORIGIN = 'https://songdojeil-glitch.github.io';
  var BASE = location.pathname;                 // /new/
  if(window.__sjHomeProps){ alert('SJRWS 매물 등록이 이미 실행 중입니다.'); return; }
  if(!window.jQuery){ alert('송도제일 홈페이지 관리자 → 「매물관리」 화면에서 눌러 주세요.'); return; }
  if(!window.opener){ alert('SJRWS 매물관리의 「🏠 홈페이지 매물」 → 「관리자 창 열기」로 연 창에서 눌러 주세요.\n(SJRWS 가 이 창으로 매물 목록을 넘겨 줍니다)'); return; }
  window.__sjHomeProps = true;

  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483647;width:360px;background:#14213d;color:#fff;font:13px/1.6 "Malgun Gothic",sans-serif;'
    + 'border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:14px 16px';
  box.innerHTML = '<div style="font-weight:800;font-size:14px;margin-bottom:6px">🏠 SJRWS 매물 등록</div><div id="sjhp-msg">SJRWS 에서 매물 목록을 받는 중…</div>'
    + '<div style="height:6px;background:#2c3e66;border-radius:4px;margin-top:8px;overflow:hidden"><div id="sjhp-bar" style="height:100%;width:0;background:#4fd1c5"></div></div>'
    + '<div id="sjhp-log" style="max-height:180px;overflow:auto;font-size:11.5px;margin-top:8px;color:#cfd8ea"></div>'
    + '<div style="text-align:right;margin-top:8px"><button id="sjhp-x" style="border:0;border-radius:7px;padding:4px 10px;cursor:pointer">닫기</button></div>';
  document.body.appendChild(box);
  function msg(t){ document.getElementById('sjhp-msg').innerHTML = t; }
  function bar(p){ document.getElementById('sjhp-bar').style.width = Math.round(p * 100) + '%'; }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function log(t){ var l = document.getElementById('sjhp-log'); l.innerHTML += '<div>' + t + '</div>'; l.scrollTop = 1e6; }
  document.getElementById('sjhp-x').onclick = function(){ box.remove(); window.__sjHomeProps = false; };
  function wait(ms){ return new Promise(function(z){ setTimeout(z, ms); }); }
  function enc(o){ return o.map(function(p){ return p[0] + '=' + encodeURIComponent(p[1] == null ? '' : p[1]); }).join('&'); }
  function post(act, body){
    return new Promise(function(res){
      jQuery.post(BASE + '?mo=admin&mid=adminMm&act=' + act, body, function(r){ res(r || {}); }, 'json')
        .fail(function(x){ res({ status:false, message:'HTTP ' + x.status }); });
    });
  }

  //  목록 분류(mc) → 저장 분류값(mm_class) — 관리자 쓰기 화면에서 읽음 (아파트 11 · 주상복합 13 · 상가점포 31 · 사무실 34)
  var MMC = { 1:11, 3:13, 10:31, 13:34 };
  //  ── 새 매물 ── 화면 등록 양식과 같은 칸 순서·이름으로 보낸다
  function addBody(it){
    if(it.cls === 10 || it.cls === 13) return shopBody(it);
    var ru = BASE + '?mo=admin&mid=adminMm&act=viewAdminMmWrite';
    var o = [['request_uri', ru], ['mm_class', MMC[it.cls]], ['mm_kind', it.kind], ['dong_id', it.dongId || '4435'], ['redevelopment', ''], ['mm_use', '1']];
    if(it.hurry) o.push(['mm_hurry', 'Y']);   // 홈페이지 급매 칸 값은 Y
    o.push(['bname_select', it.danji], ['danji_dong', it.dong], ['ho', it.ho], ['area1', it.area1], ['area2', it.area2], ['hyung', it.hyung]);
    if(it.kind === 1) o.push(['price', it.price], ['price_f', it.loan], ['price_tb', it.tb], ['price_tm', it.tm]);
    else if(it.kind === 2) o.push(['price', it.price], ['price_f', it.loan]);
    else o.push(['price', it.price], ['price_m', it.monthly], ['price_f', it.loan]);
    o.push(['total_story', it.total], ['story', it.story], ['room', it.room], ['bathroom', it.bath], ['heating', it.heat], ['parking', it.parking],
      ['date_transfer', it.moveIn], ['direction', it.dir], ['fee', it.fee], ['subject', it.subject], ['myImageSkey', ''], ['content_main', it.content],
      ['swfSequence', '1'], ['upload', ''], ['memo', it.memo], ['request_uri', ru], ['fileIds', ''], ['error_style', 'proc']);
    return enc(o);
  }
  //  상가점포(31) · 사무실(34) — 상가명은 직접 입력, 상가 종류(아파트/일반/전문/지하상가)는 상가만, 사무실은 「점포」 칸이 더 있다
  function shopBody(it){
    var ru = BASE + '?mo=admin&mid=adminMm&act=viewAdminMmWrite', shop = it.cls === 10;
    var o = [['request_uri', ru], ['mm_class', MMC[it.cls]], ['mm_kind', it.kind], ['dong_id', it.dongId || '4435'], ['redevelopment', ''], ['mm_use', '1']];
    if(it.hurry) o.push(['mm_hurry', 'Y']);
    o.push(['dong_detail', '송도동'], ['addr_others', it.addr || '']);
    if(shop) o.push(['mm_class_sub_select', it.sub || '일반상가']);
    o.push(['bname', it.bname], ['area1', it.area1], ['area1_p', it.area1p], ['area2', it.area2], ['area2_p', it.area2p]);
    if(it.kind === 1) o.push(['price', it.price], ['price_f', it.loan], ['price_g', it.g], ['price_tb', it.tb], ['price_tm', it.tm]);
    else o.push(['price', it.price], ['price_m', it.monthly], ['price_f', it.loan], ['price_g', it.g]);
    o.push(['total_story', it.total], ['story', it.story]);
    if(!shop) o.push(['jumpo', '']);
    o.push(['use_h', it.useH], ['use_g', it.useG], ['heating', it.heat], ['parking', it.parking], ['date_build_select1', ''], ['date_build_select2', ''],
      ['date_transfer', it.moveIn], ['direction', it.dir], ['date_approved', it.approved], ['fee', it.fee], ['subject', it.subject], ['myImageSkey', ''],
      ['content_main', it.content], ['swfSequence', '1'], ['upload', ''], ['memo', it.memo], ['request_uri', ru], ['fileIds', ''], ['error_style', 'proc']);
    return enc(o);
  }
  //  새로 올린 매물 번호 찾기 — 그 분류 목록에서 같은 동(아파트) 또는 같은 상가명(상가·사무실) 줄 중 가장 큰 내부번호
  async function findNew(it){
    var h = await fetch(BASE + '?mo=admin&mid=adminMm&act=viewAdminMmList&mc=' + it.cls, { credentials:'include' }).then(function(r){ return r.text(); });
    var d = new DOMParser().parseFromString(h, 'text/html'), best = null;
    [].forEach.call(d.querySelectorAll('input[name=chkid]'), function(c){
      var tr = c.closest('tr'); if(!tr) return;
      var t = tr.textContent.replace(/\s+/g, ' ');
      var needle = it.find || it.dong;
      if(needle && t.indexOf(needle) < 0) return;
      var n = parseInt(c.value, 10); if(!(n > 0)) return;
      if(!best || n > best.num){ var m = t.match(/\b(\d{5})\b/); best = { num:n, no:m ? m[1] : '' }; }
    });
    return best;
  }

  //  ── 거래완료 ── 숨은 창에서 수정 화면을 열고, 화면이 만드는 저장 요청을 읽어 거래상태만 바꿔 보낸다
  function modifyCapture(cls, num){
    return new Promise(function(res){
      var fr = document.createElement('iframe'); fr.style.cssText = 'position:absolute;width:10px;height:10px;left:-99px;top:-99px;opacity:0';
      var done = false;
      function fin(v){ if(done) return; done = true; setTimeout(function(){ fr.remove(); }, 50); res(v); }
      fr.onload = function(){
        setTimeout(function(){
          try{
            var w = fr.contentWindow, f = w.document.forms.mmWriteForm;
            if(!f || !w.jQuery){ fin(null); return; }
            var v = w.jQuery(f).data('validator'); if(!v){ fin(null); return; }
            var cap = null, oc = w.confirm, op = w.jQuery.post;
            w.confirm = function(){ return true; }; w.alert = function(){};
            w.jQuery.post = function(u, d){ cap = { u:u, d:d }; var o = { done:function(){ return o; }, fail:function(){ return o; }, always:function(){ return o; } }; return o; };
            try{ v.settings.submitHandler(f); }catch(e){}
            w.confirm = oc; w.jQuery.post = op;
            fin(cap && typeof cap.d === 'string' ? cap : null);
          }catch(e){ fin(null); }
        }, 900);
      };
      setTimeout(function(){ fin(null); }, 15000);
      fr.src = BASE + '?mo=admin&mid=adminMm&act=viewAdminMmModify&mc=' + cls + '&num=' + num;
      document.body.appendChild(fr);
    });
  }
  async function setUse(it, use){
    var cap = await modifyCapture(it.cls, it.num);
    if(!cap) return false;
    var body = cap.d.split('&').map(function(s){ var k = s.split('=')[0]; return k === 'mm_use' ? 'mm_use=' + use : s; }).join('&');
    var url = String(cap.u); if(!/^\//.test(url)) url = BASE + url.replace(/^\.\//, '');
    return new Promise(function(res){
      jQuery.post(url, body, function(r){ res(!!(r && r.status === true)); }, 'json').fail(function(){ res(false); });
    });
  }

  async function run(m, src){
    var adds = m.adds || [], dones = m.dones || [];
    if(!adds.length && !dones.length){ msg('할 일이 없습니다 (새로 올릴 매물 · 거래완료로 바꿀 매물 0건).'); return; }
    msg('새로 올리기 <b>' + adds.length + '</b>건 · 거래완료로 바꾸기 <b>' + dones.length + '</b>건');
    if(!confirm('SJRWS 매물을 홈페이지에 반영할까요?\n\n· 새로 올리기 ' + adds.length + '건\n· 거래완료로 바꾸기 ' + dones.length + '건')){ msg('취소했습니다.'); return; }
    var added = [], doned = [], fail = [], tot = adds.length + dones.length, k = 0;
    for(var i = 0; i < adds.length; i++, k++){
      var it = adds[i]; bar(k / tot); msg('올리는 중… ' + (k + 1) + ' / ' + tot);
      var r = await post('procAdminMmWrite', addBody(it));
      if(r.status === true){
        await wait(400);
        var nw = await findNew(it);
        added.push({ pid:it.pid, num:nw ? nw.num : 0, no:nw ? nw.no : '', cls:it.cls });
        log('✅ ' + esc(it.label) + (nw && nw.no ? ' → 매물번호 ' + nw.no : ''));
      } else { fail.push({ pid:it.pid, why:r.message || '등록 실패' }); log('⚠️ ' + esc(it.label) + ' — ' + esc(r.message || '등록 실패')); }
      await wait(300);
    }
    for(var j = 0; j < dones.length; j++, k++){
      var dn = dones[j]; bar(k / tot); msg('거래완료로 바꾸는 중… ' + (k + 1) + ' / ' + tot);
      if(await setUse(dn, 2)){ doned.push(dn.pid); log('☑️ 거래완료 ' + esc(dn.label)); }
      else { fail.push({ pid:dn.pid, why:'거래완료 실패' }); log('⚠️ 거래완료 실패 ' + esc(dn.label)); }
      await wait(300);
    }
    bar(1);
    src.postMessage({ sjrws:'props-done', added:added, doned:doned, fail:fail }, HUB_ORIGIN);
    msg('✅ 새로 올림 ' + added.length + '건 · 거래완료 ' + doned.length + '건' + (fail.length ? ' · ⚠️ 실패 ' + fail.length + '건' : '')
      + '<div style="margin-top:8px"><button onclick="location.reload()" style="border:0;border-radius:7px;padding:4px 10px;cursor:pointer">목록 새로고침</button></div>');
  }

  var got = false;
  window.addEventListener('message', function(e){
    if(e.origin !== HUB_ORIGIN) return;
    var m = e.data || {}; if(m.sjrws !== 'props-list' || got) return;
    got = true; run(m, e.source);
  });
  window.opener.postMessage({ sjrws:'props-req' }, HUB_ORIGIN);
  setTimeout(function(){ if(!got) msg('⚠️ SJRWS 에서 답이 없습니다. 매물관리 창이 열려 있는지 확인하고, 「🏠 홈페이지 매물」 → 「관리자 창 열기」로 이 창을 다시 열어 주세요.'); }, 8000);
})();
