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
