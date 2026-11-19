# MOA Hive 🐝

**로컬 우선(Local-First) 멀티 AI 봇 팀 메신저 — macOS·Windows 데스크톱 앱으로 내 PC에서만 실행됩니다.**

> 🔒 **100% 내 PC 로컬 실행** · 대화·문서·API 키 **외부 서버 유출 없음** · 모든 실행 전 **Allow / Deny 직접 승인**

🌐 **웹 데모 · 설치 안내(PWA):** https://cm-jccho.github.io/moa-hive/ — 설치 없이 팀 컨설팅 · MOA Chief · STG/PROD를 체험할 수 있습니다.


`OpenMausBot`의 구조(메신저형 봇 로스터 · 실제 로컬 CLI 하네스 · 권한 브로커)를 그대로 가져오고,
여기에 **업종·역할별 팀 컨설팅**, **STG→PROD 승격 구조**, **Pickle 초대 카드**, **팀 마켓(BotMRR형)** 을 얹었습니다.

- 의존성 **0** — npm install 없이 `node server.js` 한 줄
- 기본 주소 `http://127.0.0.1:3847` (루프백 전용, 외부에서 접근 불가)
- 대화·설정·봇·승인 이력은 `./data/` 안에만 저장

---

## 0. 타겟 사용자 & 로컬 프라이버시 안전성

### 누구를 위한 앱인가

| 타겟 | 이런 사람 | MOA Hive가 하는 일 |
|---|---|---|
| **기획 / PM** | 요구사항이 흩어지고 일정이 밀리는 사람 | PRD·일정·회의 액션을 봇 4개가 나눠 정리 |
| **B2B 영업·제안** | 제안서·팔로업에 하루가 사라지는 사람 | 타깃 발굴 → 제안서 → 가격 3안 → 팔로업 메일 |
| **콘텐츠·SNS 운영** | 매일 올릴 것이 떨어지는 사람 | 주간 캘린더·훅·캡션·카드뉴스·성과 리뷰 |
| **1인 사업자·창업** | 기획·개발·그로스·CS를 혼자 도는 사람 | 2주 MVP 범위 → 구현 순서 → 첫 100명 실험 |

**AI를 어디서부터 써야 할지 모르는 사용자**를 위해 앱 안에 **팀 컨설팅(Setup Wizard)** 이 있습니다.
업종·역할과 고민을 고르면 *왜 이 봇 조합이 필요한지*, *어떻게 쓰는지* 컨설팅 카드가 나오고,
클릭 한 번으로 그 역할의 **봇 팀·채널·첫 프롬프트**가 STG에 생성됩니다. (사이드바 → 🧭 팀 컨설팅)

### 왜 안전한가 (제품 설계)

| 약속 | 구현 |
|---|---|
| **내 PC 안에서만 실행** | 서버는 `127.0.0.1`에만 바인딩. 외부에서 포트가 열려 있지 않습니다. |
| **대화·문서 유출 없음** | 모든 스레드·봇 설정·승인 이력은 `./data/stg-store.json` / `prod-store.json` 에만 저장. 클라우드 동기화 없음. |
| **API 키 보호** | 키는 저장 후 조회 API에서 **원문을 절대 반환하지 않습니다**(`configured: true` 플래그만). 화면·로그에도 원문이 나오지 않습니다. |
| **실행 전 직접 승인** | 봇이 셸 명령·파일 쓰기를 제안하면 **[허용] / [거절]** 카드가 뜨고, 눌러야만 실행됩니다. 승인 후에도 경로·명령을 재검증합니다. |
| **경로 샌드박스** | 봇의 작업 폴더(`cwd`)는 허용 루트 안으로 제한. `..`, 절대경로, 심볼릭 링크 이탈을 차단합니다. |
| **운영 보호** | PROD는 읽기 전용. 모든 변경은 STG에서 검토 후 승격으로만 반영됩니다. |

> 인터넷이 필요한 순간은 두 가지뿐입니다 — ① Claude/Codex **CLI를 직접 쓸 때**(해당 도구가 자기 API로 통신), ② API 키를 넣고 **Anthropic/OpenAI를 직접 호출할 때**. 둘 다 꺼 두면 시뮬레이터로 완전 오프라인 동작합니다.

---

## 1. 실행 (macOS · Windows)

```bash
cd moa-hive
node server.js            # 또는 npm start
```

**macOS 원클릭:** `start.command` 더블클릭 → 서버 실행 + 브라우저 자동 열기.
처음 한 번 `chmod +x start.command` 가 필요할 수 있습니다(우클릭 → 열기로도 실행).

**Windows 원클릭:** `start.bat` 더블클릭 → `node server.js` 실행 + 브라우저 자동 열기.
포트가 사용 중이면 `start.bat 3900` 처럼 인자로 바꿀 수 있습니다.

- 포트 변경: `PORT=3900 node server.js` (Windows cmd: `set PORT=3900 && node server.js`)
- Node.js v18 이상. 별도 패키지 설치 없음.
- **독·작업표시줄에 고정:** Safari `파일 → 독에 추가` / Chrome 주소창의 설치 아이콘 / Edge `앱으로 설치`.

### 데스크톱 앱 (.dmg / .exe) 빌드 — Electron

`electron/main.js`가 로컬 `server.js`를 백그라운드로 띄우고 `BrowserWindow`로 접속합니다.
창을 닫으면 서버도 종료되고, 외부 링크는 기본 브라우저로 열립니다.
패키지 앱의 데이터는 설치 폴더가 아니라 사용자 홈에 저장됩니다
(macOS `~/Library/Application Support/MOA Hive/home/`, Windows `%APPDATA%\MOA Hive\home\`).

```bash
npm install          # electron · electron-builder (devDependencies)
npm run electron     # 개발 모드로 앱 실행

npm run dist:mac     # dist/MOA-Hive-0.3.0-<arch>.dmg
npm run dist:universal  # Apple Silicon + Intel 공용 dmg
npm run dist:win     # dist/MOA-Hive-Setup-0.3.0.exe
```

GitHub Actions(`.github/workflows/release-and-pages.yml`)가 태그 `v*` 푸시 또는 수동 실행 시
`macos-latest`에서 universal·arm64 `.dmg`, `windows-latest`에서 x64 `.exe`를 빌드해 GitHub Release에 올립니다.
서명·공증 없이도 본인 PC에서는 macOS **우클릭 → 열기**, Windows **추가 정보 → 실행**으로 실행됩니다.
지인에게 나눌 때는 Apple Developer ID 서명 + 공증을 권장합니다.
Electron 샌드박스에서는 봇 `cwd`를 사용자가 고른 폴더로 지정하세요(첫 접근 시 OS가 권한을 묻습니다).

---

## 2. 화면 구성

| 영역 | 내용 |
|---|---|
| 왼쪽 사이드바 | `#채널` · 봇 팀 로스터 · Pickle 초대 카드 · 🧭 팀 컨설팅 · Teams/Market · 설정 |
| 가운데 | 채팅. 신뢰 배지(로컬 실행·유출 없음·승인) · 봇 응답 · **Allow/Deny 승인 카드** · 실행 결과 |
| 오른쪽 | **봇 컨텍스트**(이름·모델·페르소나·작업폴더·키워드·고정) / **Release**(STG→PROD 승격·버전 히스토리) |

- 봇 **우클릭** → 고정 / 프로필 편집 / 1:1 대화 / 삭제
- 채널 모드 배지 클릭 → `Auto 라우팅` ↔ `@멘션 호출`
- 모바일(≤980px)에서는 사이드바가 드로어로 열립니다.

---

## 3. 백엔드 3단 (엔진)

| 순서 | 조건 | 동작 |
|---|---|---|
| 1 | `claude` 또는 `codex` CLI 설치됨 | `claude -p "…" --output-format text` / `codex exec "…"` 를 봇의 `cwd`에서 실행 |
| 2 | 설정에 Anthropic / OpenAI API 키 | `api.anthropic.com` / `api.openai.com` 직접 호출 |
| 3 | 둘 다 없음 | **로컬 시뮬레이터** — 봇 역할에 맞춘 응답 |

`/api/engines` 가 자동 감지합니다. 시뮬레이터 응답에는 항상 `시뮬레이터` 배지가 붙습니다.

```bash
npm i -g @anthropic-ai/claude-code   # Claude CLI
npm i -g @openai/codex               # Codex CLI
```

설정 → API 키에 입력 후 저장. **저장 뒤에는 원문이 다시 조회되지 않습니다.** 키를 지우려면 빈 값으로 저장.

---

## 4. 권한 브로커 (Allow / Deny)

- 봇이 셸·파일 작업을 제안 → 채팅 안 승인 카드 → **허용** 클릭 후에만 실행.
- 승인 후에도 재검증: 허용 실행 파일 목록, `..`·절대경로 금지, 파이프/리다이렉트 금지, `cwd` 내부 여부.
- 결과(exit code·출력)는 같은 스레드에 기록되고 `data/`에 남습니다.
- `/shell ls -la` 처럼 직접 제안시킬 수 있습니다.
- 차단 예: `rm -rf`, `sudo`, `curl | sh`, `find -exec`, `git push`, 인터프리터 `-e/-c`.

---

## 5. STG → PROD 승격 (Release Manager)

- 편집은 **STG** → `data/stg-store.json` (기본 환경)
- **PROD** → `data/prod-store.json` (읽기 전용, 쓰기 API 403)
- 오른쪽 **Release** 탭: 변경 diff(봇 추가/변경/제거, 채널, 설정) + CHANGELOG 확인 →
  **`최종 확인 후 PROD 반영`** → 체크박스 확인 → 반영. 버전이 올라가고 `version.json`·`CHANGELOG.md`에 기록됩니다.
- API: `GET /api/env` · `POST /api/env {active}` · `GET /api/promote` · `POST /api/promote {confirm:true, note}` · `GET /api/changelog`

초기 상태: PROD `v0.1.0`, STG `v0.3.0-rc` — 승격하면 PROD가 `v0.3.0`이 됩니다.

---

## 6. 총괄 오케스트레이터 (MOA Chief)

**한 명에게만 말하면, 팀이 일합니다.**

1. 사이드바 **🧭 팀 컨설팅** → 하단에 하고 싶은 일을 그대로 입력 (예: *"중소기업 대표인데 거래처 제안서랑 매출 정산 자동화하고 싶어요"*)
2. 🎤 버튼으로 **한국어 음성 입력** (Chrome·Edge·Safari 최신. 미지원 브라우저는 안내 문구로 대체)
3. `AI 팀 설계 받기` → 로컬 규칙 기반 분석이 **총괄(MOA Chief) + 에이전트 2~3명 + 전용 채널**을 설계
4. `이 팀을 STG에 만들기` → 바로 대화 시작

총괄 채널에서 메시지를 보내면:

- 하위 에이전트에게 일이 나뉘고 **위임 로그**(칩 + 단계 + 산출물 요약)가 응답에 붙습니다.
- **취합 결과**와 다음 액션이 한 번에 정리됩니다.
- 대화 중 **인라인 제안 카드**가 뜹니다 — 예: "주간 리포트 봇을 팀에 붙일까요?", "읽기 전용 명령 자동 승인 규칙을 추가할까요?"
  `OK · 자동 붙이기`를 누르면 STG 팀에 실제로 반영되고, `패스`는 기록만 남깁니다.

### 봇 역할 인스펙터

사이드바의 봇이나 응답 안의 위임 칩을 클릭하면 오른쪽 패널에:

- 역할 한 줄 요약 · **지금 할 수 있는 일 3가지**(클릭하면 바로 요청 전송)
- 최근 처리 내역 · 연결 엔진 · 작업 폴더

봇 아바타는 평소 `idle`(숨쉬기·글로우), 작업 중에는 `working`(바운스·발광)으로 바뀌고 `⚡ 작업 중 / ✨ 대기 중` 배지가 함께 표시됩니다.

## 7. Pickle 초대 카드

사이드바 상단 카드가 PC 밖의 일(전화·예약·브라우저 자동화)을 Pickle로 넘깁니다.
링크 교체: `config.js` → `pickle.url` (기본 `https://pickle.com/i/X2XQHRSC3K55`) 또는 앱 설정.

---

## 8. 팀 마켓 (BotMRR형)

| 팩 | 가격 | 구성 |
|---|---|---|
| 🎁 스타터 팀 팩 | 무료 | 기획·개발·리서치 3봇 + 2채널, 바로 설치 |
| 🚀 1인 SaaS 런칭 팀 | 29,000원 | PM·개발·그로스·CS 4봇 |
| 📸 인스타·스레드 바이럴 팀 | 29,000원 | 전략·카피·비주얼·분석 4봇 |
| 🤝 B2B 영업·제안 팀 | 29,000원 | 타겟·제안서·가격·팔로업 4봇 |

- 카드 → **미리보기**(팩 `.md`) → **구매** 링크 (`config.js` `market.storeUrl` 또는 설정에서 교체)
- Pro 설치 API는 라이선스 키(6자 이상)를 요구합니다: `POST /api/market/:id/install {license}`
- `market/*.md` frontmatter(`tier`, `price`, `features`)가 곧 상품 정보입니다.

---

## 9. 팀 임포트 (.md)

`Teams · Import` 에 YAML frontmatter 팀 정의를 붙여넣으면 봇·채널이 생성됩니다.
`샘플 템플릿 불러오기`로 시작할 수 있습니다. `cwd`가 허용 루트를 벗어나면 기본 workspace로 대체되고 이유가 표시됩니다.

```markdown
---
team: 폰기프트 성장팀
bots:
  - name: 기획PM 봇
    emoji: 🧭
    role: pm
    persona: |
      요구사항을 PRD·일정으로 쪼갠다.
    keywords: [기획, 일정, PRD]
channels:
  - name: 전체-팀
    mode: auto
    members: [기획PM 봇]
---
```

---

## 10. 모바일 원격 접속 (부가 기능 · 컴패니언)

기본은 **Mac 안에서만**. 휴대폰에서 조작하려면 아래 중 하나를 고릅니다.
앱 안에도 같은 가이드가 있습니다: 사이드바 → **📱 실행 · 모바일 가이드 → ③ 모바일 원격 접속**.
웹에 올려 둔 **모바일 체험판**은 https://cm-jccho.github.io/moa-hive/#demo 에서 바로 열 수 있습니다(데이터는 서버로 가지 않습니다).

### A. 같은 Wi-Fi (가장 간단)

1. 설정 → **모바일 원격 접속 → 같은 Wi-Fi에서 접속 허용** 체크 → 저장
2. 서버 재시작 (`node server.js`) — 이때만 `0.0.0.0` 바인딩 + **접속 토큰 자동 발급**
3. 설정/가이드에 표시된 **Wi-Fi 주소(토큰 포함)** 를 아이폰 사파리에서 열기
4. 공유 → **홈 화면에 추가** → 앱처럼 실행

> 토큰이 없으면 열리지 않습니다. 공용 Wi-Fi(카페·호텔)에서는 끄세요.

### B. Tailscale (밖에서도, 가장 안전)

1. Mac·아이폰에 Tailscale 설치 후 같은 계정 로그인
2. Mac 터미널: `tailscale serve --bg 3847`
3. 아이폰에서 `https://<기기>.<tailnet>.ts.net` 열기 — 127.0.0.1 그대로라 서버 설정 변경 불필요

### C. Cloudflare Tunnel (무료, 링크 공유)

1. `brew install cloudflared`
2. **토큰 강제 모드**로 서버 실행: `MOA_REQUIRE_TOKEN=1 node server.js`
3. 다른 터미널: `cloudflared tunnel --url http://127.0.0.1:3847`
4. 발급된 `https://….trycloudflare.com` 주소를 휴대폰에서 열고 토큰 입력

> 터널 주소를 아는 사람은 접근할 수 있습니다. `MOA_REQUIRE_TOKEN=1`을 반드시 켜고, 장기 사용 시 Cloudflare Access 정책을 거세요.

---

## 11. 보안 정리

- **루프백 기본**: `127.0.0.1` 바인딩. 원격은 명시적으로 켠 경우에만, 그때도 토큰 필수.
- **경로 샌드박스**: `cwd`·파일 경로의 `..`, 절대경로, 허용 루트(기본 홈) 밖 차단, realpath로 심볼릭 링크 확인.
- **API 키**: 조회 API는 `configured` 플래그만 반환.
- **승인 없는 실행 금지**: 제안 → 사용자 클릭 → 재검증 → 실행.
- **PROD 보호**: PROD 쓰기 API 403.
- 요청 본문 512KB · 메시지 8,000자 제한, `X-Frame-Options: DENY`.

## 12. 파일 구조

```
moa-hive/
├─ server.js          # 의존성 0 서버 (http/fs/path/child_process/crypto/https)
├─ config.js          # Pickle 초대 링크·마켓 판매 링크·포트 (1줄 교체)
├─ consult.js         # 업종·역할별 팀 컨설팅 템플릿 (Setup Wizard)
├─ electron/main.js   # Electron 메인 — 로컬 서버 기동·정리, 창·메뉴·외부 링크
├─ tests/             # API·UI·웹 테스트 (api_test.py · ui_test.py · web_test.py · reset_state.js)
├─ package.json       # npm start · npm run dist:mac|dist:win
├─ start.command      # macOS 원클릭 실행
├─ start.bat          # Windows 원클릭 실행
├─ version.json       # STG/PROD 버전 + 릴리스 이력
├─ CHANGELOG.md       # 버전별 변경 내역
├─ public/            # index.html · styles.css · app.js
├─ market/            # 팀 팩 상품 정의 (.md)
├─ docs/              # GitHub Pages 랜딩 + PWA 라이브 체험 (index.html · styles.css · app.js · sw.js · manifest.json)
├─ .github/workflows/ # release-and-pages.yml — Pages 배포 · dmg/exe 빌드 · Release 업로드
├─ data/              # stg-store.json · prod-store.json (자동 생성)
└─ workspace/         # 봇 기본 작업 폴더
```

## 13. API 요약

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/health` | 상태·버전·환경 |
| GET | `/api/state` | 봇·채널·메시지·설정·엔진·env |
| GET | `/api/engines` | CLI 감지·모드 |
| GET/POST | `/api/bots` | 목록 / 생성 (cwd 검증) |
| PATCH/DELETE | `/api/bots/:id` | 수정 / 삭제 |
| GET/POST | `/api/channels` | 목록 / 생성 |
| PATCH/DELETE | `/api/channels/:id` | 모드·멤버·고정 / 삭제 |
| GET/POST | `/api/messages?channelId=` | 조회(typing) / 전송(라우팅) |
| POST | `/api/approve` | `{id, decision:'allow'|'deny'}` |
| GET | `/api/consult` · `POST /api/consult/apply` | 컨설팅 프로필 / 팀 생성 |
| POST | `/api/consult/analyze` | 자유 목적 → 오케스트레이터 설계(`{text, create?}`) |
| POST | `/api/orchestrator/apply` | 설계안을 STG에 생성 |
| GET/POST | `/api/proposals` · `/api/proposal` | 제안 목록 / `OK·패스` 처리 |
| GET | `/api/bots/:id/activity` | 역할 요약·최근 처리 내역·엔진·cwd |
| POST | `/api/import-team` | `{markdown}` |
| GET | `/api/market` · `/:id/preview` | 팩 목록 / 미리보기 |
| POST | `/api/market/:id/install` | 설치(무료) · `{license}`(Pro) |
| GET/PATCH | `/api/settings` | 설정(키 마스킹) |
| GET/POST | `/api/remote` | 모바일 접속 상태 / 켜기 |
| GET/POST | `/api/env` | 환경 조회/전환 |
| GET/POST | `/api/promote` | diff 조회 / 승격 |
| GET | `/api/changelog` | 버전·이력 |

---

## 14. 웹(PWA) · GitHub Pages 배포

`docs/`는 서버 없이 돌아가는 **랜딩 + 라이브 체험판**입니다. 같은 화면을 GitHub Pages에 자동 배포합니다.

- **주소:** https://cm-jccho.github.io/moa-hive/
- **구성:** `docs/index.html` · `docs/styles.css` · `docs/app.js` · `docs/manifest.json` · `docs/sw.js` · `docs/icons/`
- **체험 범위:** 업종 카드 4종 및 자유 목적(음성 입력 포함) 팀 컨설팅 → MOA Chief 오케스트레이터 위임·취합 → 인라인 제안 카드 → 봇 역할 인스펙터 → STG/PROD 읽기 전용·승격
- **PWA:** 홈 화면 추가(standalone) · 오프라인 셸 캐시. 모바일 390px까지 반응형
- **다운로드 링크:** `docs/app.js` 상단 `RELEASE`(repo · version · tag) 한 곳에서 관리합니다.

`main` 브랜치에 푸시하면 `.github/workflows/release-and-pages.yml`의 **pages** 작업이 `docs/`를 배포하고,
태그(`v*`)를 푸시하거나 Actions에서 **Run workflow**를 실행하면 **build → release** 작업이 앱 설치 파일을 만들어 Release에 올립니다.

```bash
# 웹 테스트 (정적 서버 + Playwright)
cd docs && python3 -m http.server 8080 &
cd .. && python3 tests/web_test.py
```

---

개인 사용 라이선스(UNLICENSED). 문의: 조재철.
