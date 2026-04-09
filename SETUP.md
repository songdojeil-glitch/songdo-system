# 송도제일 통합업무시스템 — Firebase + GitHub Pages 설정 가이드

> 북마크 클릭 한 번으로 즉시 열리는, 홈PC·직장PC 실시간 동기화 시스템

---

## 📦 파일 구성

```
/
├── sd_hub.html          ← 메인 허브 (북마크 권장)
├── sd_props.html        ← 매물관리
├── sd_contracts.html    ← 계약관리
├── sd_custs.html        ← 고객관리
├── sd_schedule.html     ← 일정관리
├── sd_marketing.html    ← 마케팅
├── firebase-storage.js  ← Firebase 어댑터 (⚠️ 설정 필수)
├── database.rules.json  ← Firebase 보안 규칙
└── .github/
    └── workflows/
        └── deploy.yml   ← GitHub Pages 자동 배포
```

---

## ① Firebase 프로젝트 설정 (10분)

### 1-1. Firebase 콘솔에서 프로젝트 생성

1. https://console.firebase.google.com 접속
2. **프로젝트 추가** 클릭
3. 프로젝트 이름 입력 (예: `songdo-realestate`)
4. Google Analytics — 선택 해제 후 **프로젝트 만들기**

### 1-2. Realtime Database 활성화

1. 왼쪽 메뉴 → **빌드** → **Realtime Database**
2. **데이터베이스 만들기** 클릭
3. 위치: **asia-southeast1 (Singapore)** 선택 ← 한국에서 가장 가까움
4. 보안 규칙 → **테스트 모드로 시작** 선택 후 **사용 설정**

### 1-3. 보안 규칙 업데이트

1. Realtime Database → **규칙** 탭
2. 아래 내용으로 교체 후 **게시** 클릭:

```json
{
  "rules": {
    "sd": {
      ".read":  true,
      ".write": true
    }
  }
}
```

> 💡 나중에 비밀번호 보호가 필요하면 Firebase Authentication을 추가할 수 있습니다.

### 1-4. Firebase 설정값 복사

1. 프로젝트 설정(⚙️) → **일반** 탭
2. **내 앱** 섹션 → **</> 웹** 아이콘 클릭
3. 앱 닉네임 입력 (예: `songdo-web`) → **앱 등록**
4. **firebaseConfig** 값 복사

```javascript
// 이런 형태입니다
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "songdo-realestate.firebaseapp.com",
  databaseURL: "https://songdo-realestate-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "songdo-realestate",
  storageBucket: "songdo-realestate.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 1-5. firebase-storage.js 수정

`firebase-storage.js` 파일 상단의 `FIREBASE_CONFIG` 값을 교체합니다:

```javascript
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",          // ← 복사한 값으로 교체
  authDomain:        "your-project.firebaseapp.com",
  databaseURL:       "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

> ⚠️ **이 파일 하나만 수정하면** 6개 HTML 파일 모두 자동 적용됩니다.

---

## ② GitHub 저장소 생성 + Pages 배포 (10분)

### 2-1. GitHub 저장소 생성

1. https://github.com/new 접속
2. **Repository name**: `songdo-system` (또는 원하는 이름)
3. **Private** 선택 ← 중요: 외부 노출 방지
4. **Create repository** 클릭

### 2-2. 파일 업로드

**방법 A — GitHub 웹 인터페이스 (쉬움)**

1. 저장소 페이지 → **Add file** → **Upload files**
2. 아래 파일들을 모두 드래그 업로드:
   - 6개 HTML 파일
   - `firebase-storage.js`
3. `.github/workflows/deploy.yml` 은 **경로 그대로** 업로드:
   - **Add file** → **Create new file**
   - 파일명: `.github/workflows/deploy.yml`
   - 내용 붙여넣기 → **Commit changes**

**방법 B — Git 명령어 (빠름)**

```bash
git init
git add .
git commit -m "초기 배포"
git branch -M main
git remote add origin https://github.com/사용자명/songdo-system.git
git push -u origin main
```

### 2-3. GitHub Pages 활성화

1. 저장소 → **Settings** → **Pages**
2. **Source**: `GitHub Actions` 선택
3. `.github/workflows/deploy.yml` 이 있으면 자동으로 배포 시작

### 2-4. 배포 URL 확인

1. **Settings** → **Pages** → URL 확인
2. 형식: `https://사용자명.github.io/songdo-system/`

> 💡 Private 저장소도 GitHub Pages 배포는 무료입니다 (GitHub Free 플랜).

---

## ③ 북마크 등록 (2분)

배포 완료 후 각 페이지를 북마크에 추가합니다:

| 페이지 | URL | 북마크 이름 |
|--------|-----|------------|
| 메인 허브 | `.../sd_hub.html` | 🏢 송도제일 허브 |
| 매물관리 | `.../sd_props.html` | 🏠 매물관리 |
| 계약관리 | `.../sd_contracts.html` | 📑 계약관리 |
| 고객관리 | `.../sd_custs.html` | 👥 고객관리 |
| 일정관리 | `.../sd_schedule.html` | 📅 일정관리 |
| 마케팅 | `.../sd_marketing.html` | 📢 마케팅 |

---

## ④ 기존 데이터 마이그레이션 (선택)

Claude에 저장된 기존 데이터를 Firebase로 옮길 수 있습니다.

### 방법: Claude에서 데이터 내보내기

각 시스템 내에서 **CSV 내보내기** 기능을 사용하거나,
새 시스템에 데이터를 새로 입력하시면 됩니다.

> Claude의 `window.storage`와 Firebase는 동일한 키(`sd_props`, `sd_contracts` 등)를
> 사용하므로, Firebase 콘솔에서 직접 JSON을 붙여넣는 것도 가능합니다.

---

## ⑤ 실시간 동기화 작동 방식

```
홈PC              Firebase RTDB           직장PC
  │  저장(set)  →       │                    │
  │             ── 데이터 즉시 동기화 →      │
  │                      │   ← 읽기(get)    │
```

- 데이터 변경 시 **즉시** Firebase에 저장
- 다른 PC에서 열면 항상 **최신 데이터** 표시
- 오프라인 시 자동 재연결 (상단 바 🟢/🔴 표시)

---

## 🛠 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 상단 바에 🔴 표시 | Firebase 연결 실패 | `firebase-storage.js` Config 확인 |
| 데이터가 안 보임 | RTDB 규칙 문제 | database.rules.json 재적용 |
| 페이지가 안 열림 | GitHub Pages 미활성화 | Settings → Pages 확인 |
| 404 오류 | 파일명 대소문자 오류 | 파일명을 정확히 소문자로 |

---

## 📞 시스템 정보

- **사무소**: 송도제일공인중개사사무소
- **주소**: 인천 연수구 해돋이로 168
- **전화**: 010-6401-9345
- **대표**: 문영은

---

*Firebase + GitHub Pages 버전 — Claude 아티팩트 독립 완전 버전*
