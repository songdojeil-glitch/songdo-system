/**
 * firebase-storage.js
 * ============================================================
 * 송도제일 통합업무시스템 — Firebase Realtime Database 어댑터
 * window.storage (Claude 전용) → Firebase RTDB 완전 호환 대체
 *
 * 설정 방법:
 *   아래 FIREBASE_CONFIG 값을 Firebase 콘솔에서 복사한 설정으로
 *   교체하세요 (firebase-storage.js 파일 하나만 수정하면 됩니다).
 * ============================================================
 */

// ──────────────────────────────────────────────────────────────
// ① Firebase 프로젝트 설정 (여기만 변경하세요)
// ──────────────────────────────────────────────────────────────
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCMYoUBhRv_NkKeHmPqgXoqqXUjVsjEJPs",
  authDomain:        "songdojeil-202604.firebaseapp.com",
  databaseURL:       "https://songdojeil-202604-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "songdojeil-202604",
  storageBucket:     "songdojeil-202604.firebasestorage.app",
  messagingSenderId: "567683904975",
  appId:             "1:567683904975:web:65a652a8e7b9a81e034eba"
};

// ──────────────────────────────────────────────────────────────
// ② Firebase 초기화
// ──────────────────────────────────────────────────────────────
(function() {
  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
  } catch (e) {
    console.error('[SD] Firebase 초기화 실패:', e);
  }
})();

// ──────────────────────────────────────────────────────────────
// ③ window.storage 호환 API
//    - 저장 경로: Firebase RTDB의 /sd/{key}
//    - Claude window.storage와 완전 동일한 인터페이스
// ──────────────────────────────────────────────────────────────
window.storage = (function() {
  var ROOT = 'sd';  // RTDB 루트 경로

  function getDb() {
    return firebase.database();
  }

  function ref(key) {
    return getDb().ref(ROOT + '/' + key);
  }

  return {
    /**
     * 값 읽기
     * @returns {Promise<{key, value, shared}|null>}
     */
    get: async function(key, shared) {
      try {
        var snap = await ref(key).once('value');
        var val = snap.val();
        if (val === null || val === undefined) return null;
        return { key: key, value: val, shared: !!shared };
      } catch (e) {
        console.error('[SD] storage.get 오류 (' + key + '):', e);
        return null;
      }
    },

    /**
     * 값 저장
     * @returns {Promise<{key, value, shared}|null>}
     */
    set: async function(key, value, shared) {
      try {
        await ref(key).set(value);
        return { key: key, value: value, shared: !!shared };
      } catch (e) {
        console.error('[SD] storage.set 오류 (' + key + '):', e);
        return null;
      }
    },

    /**
     * 값 삭제
     * @returns {Promise<{key, deleted, shared}|null>}
     */
    delete: async function(key, shared) {
      try {
        await ref(key).remove();
        return { key: key, deleted: true, shared: !!shared };
      } catch (e) {
        console.error('[SD] storage.delete 오류 (' + key + '):', e);
        return null;
      }
    },

    /**
     * 키 목록 조회
     * @returns {Promise<{keys, prefix, shared}>}
     */
    list: async function(prefix, shared) {
      try {
        var snap = await getDb().ref(ROOT).once('value');
        var all = snap.val() || {};
        var keys = Object.keys(all).filter(function(k) {
          return !prefix || k.startsWith(prefix);
        });
        return { keys: keys, prefix: prefix, shared: !!shared };
      } catch (e) {
        console.error('[SD] storage.list 오류:', e);
        return { keys: [] };
      }
    },

    /**
     * 실시간 리스너 (보너스 기능 — Claude에는 없는 기능)
     * 홈PC · 직장PC 실시간 동기화에 활용 가능
     * 사용 예: window.storage.onChange('sd_props', function(data) { ... })
     */
    onChange: function(key, callback) {
      ref(key).on('value', function(snap) {
        var val = snap.val();
        callback(val);
      });
    },

    /**
     * 실시간 리스너 해제
     */
    offChange: function(key) {
      ref(key).off();
    }
  };
})();

// ──────────────────────────────────────────────────────────────
// ④ 연결 상태 표시 (선택)
// ──────────────────────────────────────────────────────────────
(function() {
  var connRef = firebase.database().ref('.info/connected');
  connRef.on('value', function(snap) {
    var el = document.getElementById('fb-status');
    if (!el) return;
    if (snap.val() === true) {
      el.textContent = '🟢 실시간 연결됨';
      el.style.color = '#4caf7d';
    } else {
      el.textContent = '🔴 연결 끊김 (오프라인)';
      el.style.color = '#e85c5c';
    }
  });
})();

// ──────────────────────────────────────────────────────────────
// ⑤ Firebase Storage (파일 저장소) — 이미지 업로드용
//    사용 전 Firebase Console → Storage → Get Started 필요
//    추가 로드: firebase-storage-compat.js (HTML에서)
// ──────────────────────────────────────────────────────────────
window.sdImage = (function() {
  function getStorage() {
    if (!firebase.storage) {
      throw new Error('firebase-storage-compat.js가 로드되지 않았습니다. HTML <head>에 SDK를 추가하세요.');
    }
    return firebase.storage();
  }

  /**
   * 이미지 자동 압축 (용량 절약)
   * - 최대 폭/높이 1600px (긴 쪽 기준)
   * - JPEG 품질 0.85
   * - WebP 사용하지 않음 (네이버 블로그 호환성)
   * @param {File} file 원본 이미지 파일
   * @returns {Promise<Blob>} 압축된 이미지 Blob
   */
  function compressImage(file) {
    return new Promise(function(resolve, reject) {
      var maxSide = 1600;
      var quality = 0.85;
      if (!file.type.match(/^image\//)) {
        reject(new Error('이미지 파일이 아닙니다: ' + file.name));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function() { reject(new Error('파일 읽기 실패')); };
      reader.onload = function(e) {
        var img = new Image();
        img.onerror = function() { reject(new Error('이미지 디코딩 실패')); };
        img.onload = function() {
          var w = img.width, h = img.height;
          if (w > maxSide || h > maxSide) {
            if (w >= h) { h = Math.round(h * maxSide / w); w = maxSide; }
            else       { w = Math.round(w * maxSide / h); h = maxSide; }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function(blob) {
            if (!blob) { reject(new Error('압축 실패')); return; }
            resolve(blob);
          }, 'image/jpeg', quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * 썸네일 생성 (리스트용 소형 이미지)
   * - 400x400 맞춤 (cover)
   * - JPEG 품질 0.7
   * @param {Blob|File} blob 원본 또는 압축된 이미지
   * @returns {Promise<Blob>}
   */
  function makeThumbnail(blob) {
    return new Promise(function(resolve, reject) {
      var size = 400, quality = 0.7;
      var reader = new FileReader();
      reader.onerror = function() { reject(new Error('썸네일 읽기 실패')); };
      reader.onload = function(e) {
        var img = new Image();
        img.onerror = function() { reject(new Error('썸네일 디코딩 실패')); };
        img.onload = function() {
          var canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          var ctx = canvas.getContext('2d');
          // cover 방식: 짧은 변 맞춤 크롭
          var r = Math.max(size / img.width, size / img.height);
          var nw = img.width * r, nh = img.height * r;
          var dx = (size - nw) / 2, dy = (size - nh) / 2;
          ctx.drawImage(img, dx, dy, nw, nh);
          canvas.toBlob(function(out) {
            if (!out) { reject(new Error('썸네일 생성 실패')); return; }
            resolve(out);
          }, 'image/jpeg', quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 이미지 업로드 (원본 + 썸네일)
   * Storage 경로: /images/{folder}/{propId}/{fileName}
   *              /images/{folder}/{propId}/thumbs/{fileName}
   * @param {File} file 업로드할 이미지 파일
   * @param {string} folder 분류 폴더 (예: 'props', 'custs', 'blog')
   * @param {string} propId 매물/고객 ID (사진 그룹 식별자)
   * @param {function} [onProgress] 진행률 콜백 (0~100)
   * @returns {Promise<{url, thumbUrl, path, thumbPath, name, size, uploadedAt}>}
   */
  async function upload(file, folder, propId, onProgress) {
    if (!file) throw new Error('파일이 없습니다.');
    if (!folder) folder = 'misc';
    if (!propId) propId = 'general';

    try {
      // 1) 원본 압축
      var compressed = await compressImage(file);
      // 2) 썸네일 생성
      var thumb = await makeThumbnail(compressed);

      // 3) 파일명 생성 (타임스탬프 + 랜덤)
      var ts = Date.now();
      var rnd = Math.random().toString(36).slice(2, 8);
      var safeName = (file.name || 'image').replace(/[^\w.가-힣-]/g, '_').replace(/\.[^.]+$/, '');
      var fileName = ts + '_' + rnd + '_' + safeName + '.jpg';

      // 4) Storage 경로
      var basePath = 'images/' + folder + '/' + propId;
      var mainPath = basePath + '/' + fileName;
      var thumbPath = basePath + '/thumbs/' + fileName;

      var storage = getStorage();
      var mainRef = storage.ref(mainPath);
      var thumbRef = storage.ref(thumbPath);

      // 5) 업로드 (원본)
      var mainTask = mainRef.put(compressed, { contentType: 'image/jpeg' });
      if (typeof onProgress === 'function') {
        mainTask.on('state_changed', function(snap) {
          var pct = (snap.bytesTransferred / snap.totalBytes) * 100;
          onProgress(Math.round(pct * 0.7)); // 0~70%
        });
      }
      await mainTask;

      // 6) 업로드 (썸네일)
      var thumbTask = thumbRef.put(thumb, { contentType: 'image/jpeg' });
      if (typeof onProgress === 'function') {
        thumbTask.on('state_changed', function(snap) {
          var pct = (snap.bytesTransferred / snap.totalBytes) * 100;
          onProgress(70 + Math.round(pct * 0.3)); // 70~100%
        });
      }
      await thumbTask;

      // 7) 다운로드 URL 획득
      var url = await mainRef.getDownloadURL();
      var thumbUrl = await thumbRef.getDownloadURL();

      return {
        url: url,
        thumbUrl: thumbUrl,
        path: mainPath,
        thumbPath: thumbPath,
        name: safeName,
        size: compressed.size,
        uploadedAt: new Date().toISOString()
      };
    } catch (e) {
      console.error('[SD] 이미지 업로드 실패:', e);
      throw e;
    }
  }

  /**
   * 이미지 삭제 (원본 + 썸네일)
   * @param {string} path 원본 경로 (images/.../file.jpg)
   * @param {string} [thumbPath] 썸네일 경로 (없으면 path에서 유추)
   */
  async function remove(path, thumbPath) {
    if (!path) return;
    try {
      var storage = getStorage();
      await storage.ref(path).delete().catch(function(e) {
        // 이미 없는 경우는 무시
        if (e.code !== 'storage/object-not-found') throw e;
      });
      if (!thumbPath) {
        // 경로 유추: images/folder/id/file.jpg → images/folder/id/thumbs/file.jpg
        var parts = path.split('/');
        var fname = parts.pop();
        thumbPath = parts.join('/') + '/thumbs/' + fname;
      }
      await storage.ref(thumbPath).delete().catch(function(e) {
        if (e.code !== 'storage/object-not-found') throw e;
      });
    } catch (e) {
      console.error('[SD] 이미지 삭제 실패:', e);
      throw e;
    }
  }

  /**
   * 특정 매물의 모든 이미지 삭제 (매물 삭제 시 호출)
   * @param {string} folder 분류 폴더
   * @param {string} propId 매물/고객 ID
   */
  async function removeAll(folder, propId) {
    if (!folder || !propId) return;
    try {
      var storage = getStorage();
      var baseRef = storage.ref('images/' + folder + '/' + propId);
      var list = await baseRef.listAll();
      var deletes = [];
      list.items.forEach(function(item) { deletes.push(item.delete()); });
      // 썸네일 폴더도 삭제
      list.prefixes.forEach(function(pref) {
        pref.listAll().then(function(sub) {
          sub.items.forEach(function(item) { deletes.push(item.delete()); });
        });
      });
      await Promise.all(deletes);
    } catch (e) {
      console.error('[SD] 이미지 일괄 삭제 실패:', e);
    }
  }

  return {
    upload: upload,
    remove: remove,
    removeAll: removeAll,
    _compress: compressImage,  // 디버깅용
    _thumb: makeThumbnail       // 디버깅용
  };
})();
