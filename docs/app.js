/* MOA Hive — GitHub Pages 랜딩 + 서버 없는 라이브 체험판
   실제 앱(public/app.js)의 핵심 흐름(팀 컨설팅 → MOA Chief 위임 → STG/PROD)을
   정적 호스팅에서 그대로 재현합니다. 외부 라이브러리·CDN을 쓰지 않습니다. */
'use strict';

/* ───────────────────────── 릴리스 설정 (여기 한 곳만 고치면 됩니다) ───────────────────────── */
const RELEASE = {
  repo: 'CM-jccho/moa-hive',
  version: '0.3.4',
  tag: 'v0.3.4',
};

/* 세팅 팩 판매 링크 (래피드 스페이스) — 여기 한 곳만 고치면 됩니다 */
const PACK_URL = 'https://www.latpeed.com/products/VTtxq';

/* ───────────────────────── 다국어: 한국어 · English · 中文 · 日本語 ───────────────────────── */
const LANGS = ['ko', 'en', 'zh', 'ja'];
const LANG_KEY = 'moa_lang';
function detectLang() {
  let q = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (q && LANGS.indexOf(q) >= 0) return q;
  let s = null;
  try { s = localStorage.getItem(LANG_KEY); } catch (e) {}
  return LANGS.indexOf(s) >= 0 ? s : 'ko';
}
let LANG = detectLang();
const DICT = () => (LANG !== 'ko' && window.MOA_I18N ? window.MOA_I18N[LANG] : null);
function LN(path, fallback) {
  const d = DICT();
  if (!d) return fallback;
  const v = String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), d);
  return v == null || v === '' ? fallback : v;
}
function fmt(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
}
/* 화면에 바로 그려지는 짧은 문구 — 사전(i18n.js)에 넣기 애매한 함수형 라벨 */
const U = {
  en: {
    designTitle: (n) => '🧠 MOA Chief + ' + n + ' agents — proposed team',
    purpose: 'Goal', apply: 'Create this team in STG', redo: 'Design again',
    openRole: 'Open role card', packCta: 'Get the setup pack on Latpeed →',
    applyCase: 'Apply this case', packBtn: '🎁 Setup pack', reportBot: 'Weekly report bot',
    adminOn: 'Admin mode', adminOff: 'Admin off',
    briefSteps: ['Take the goal, lock the scope', 'Delegate to three agents', 'Combine outputs and report'],
    roleSummary: { pm: 'Keeps requirements, schedule and reports in writing.', dev: 'Builds, checks and tidies the actual work.', content: 'Writes and plans the things you publish.', research: 'Checks the facts and marks what still needs checking.', chief: 'Splits the work and reports only the result.' },
  },
  zh: {
    designTitle: (n) => '🧠 MOA Chief + ' + n + ' 个机器人 — 团队方案',
    purpose: '目标', apply: '在 STG 里建这个团队', redo: '重新设计',
    openRole: '打开角色卡', packCta: '在 Latpeed 购买配置包 →',
    applyCase: '应用这个场景', packBtn: '🎁 配置包', reportBot: '周报机器人',
    adminOn: '管理员模式', adminOff: '关闭管理员',
    briefSteps: ['接收目标、确定范围', '分派给三个机器人', '汇总产出并汇报'],
    roleSummary: { pm: '把需求、日程和汇报都整理成文档。', dev: '实际动手做、验证和整理。', content: '写和策划要发布的内容。', research: '核对依据，并标出待确认项。', chief: '分工并把结果汇总报告。' },
  },
  ja: {
    designTitle: (n) => '🧠 MOA Chief + エージェント' + n + '名 — チーム案',
    purpose: '目標', apply: 'このチームをSTGに作る', redo: 'もう一度設計',
    openRole: '役割カードを開く', packCta: 'Latpeedでセットアップパックを購入 →',
    applyCase: 'この事例を使う', packBtn: '🎁 セットアップパック', reportBot: '週次レポート',
    adminOn: '管理者モード', adminOff: '管理者オフ',
    briefSteps: ['目的を受け取り範囲を確定', '3つのエージェントに委任', '成果をまとめて報告'],
    roleSummary: { pm: '要件・日程・レポートを文書に残します。', dev: '実際に作り、検証し、整理します。', content: '公開するものを書いて企画します。', research: '根拠を確認し、未確認の項目を明示します。', chief: '仕事を分けて結果だけを報告します。' },
  },
};
function u(key, arg) {
  const d = U[LANG];
  if (!d || d[key] == null) return null;
  return typeof d[key] === 'function' ? d[key](arg) : d[key];
}

/* ───────────────────────── 공통 유틸 ───────────────────────── */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9);
const nowLabel = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

/** 아주 작은 마크다운 렌더러 — 먼저 escape 한 뒤 태그를 만듭니다. */
function md(src) {
  const lines = esc(src).split('\n');
  const out = [];
  let list = null;
  const closeList = () => {
    if (list) {
      out.push('</' + list + '>');
      list = null;
    }
  };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      closeList();
      continue;
    }
    let m;
    if ((m = t.match(/^[-*]\s+(.*)$/))) {
      if (list !== 'ul') {
        closeList();
        out.push('<ul>');
        list = 'ul';
      }
      out.push('<li>' + inline(m[1]) + '</li>');
      continue;
    }
    if ((m = t.match(/^\d+\.\s+(.*)$/))) {
      if (list !== 'ol') {
        closeList();
        out.push('<ol>');
        list = 'ol';
      }
      out.push('<li>' + inline(m[1]) + '</li>');
      continue;
    }
    if (t.startsWith('&gt;')) {
      closeList();
      out.push('<blockquote>' + inline(t.replace(/^&gt;\s?/, '')) + '</blockquote>');
      continue;
    }
    closeList();
    out.push('<p>' + inline(t) + '</p>');
  }
  closeList();
  return out.join('');
}

let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ───────────────────────── 언어 전환 (URL ?lang= · localStorage) ───────────────────────── */
function captureKoText() {
  $$('[data-en]').forEach((el) => { if (!el.hasAttribute('data-ko')) el.setAttribute('data-ko', el.textContent); });
  $$('[data-en-html]').forEach((el) => { if (!el.hasAttribute('data-ko-html')) el.setAttribute('data-ko-html', el.innerHTML); });
  $$('[data-en-placeholder]').forEach((el) => { if (!el.hasAttribute('data-ko-placeholder')) el.setAttribute('data-ko-placeholder', el.getAttribute('placeholder') || ''); });
}

function applyDomLang() {
  $$('[data-en]').forEach((el) => {
    const ko = el.getAttribute('data-ko');
    const v = LANG === 'ko' ? ko : (el.getAttribute('data-' + LANG) || ko);
    if (v != null) el.textContent = v;
  });
  $$('[data-en-html]').forEach((el) => {
    const ko = el.getAttribute('data-ko-html');
    const v = LANG === 'ko' ? ko : (el.getAttribute('data-' + LANG + '-html') || ko);
    if (v != null) el.innerHTML = v;
  });
  $$('[data-en-placeholder]').forEach((el) => {
    const ko = el.getAttribute('data-ko-placeholder');
    const v = LANG === 'ko' ? ko : (el.getAttribute('data-' + LANG + '-placeholder') || ko);
    if (v != null) el.setAttribute('placeholder', v);
  });
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : LANG;
}

function syncLangButtons() {
  $$('.lang-switch [data-lang]').forEach((b) => {
    const on = b.getAttribute('data-lang') === LANG;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function setLang(lang) {
  if (LANGS.indexOf(lang) < 0) lang = 'ko';
  if (lang === LANG) return;
  LANG = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  try {
    const url = new URL(location.href);
    if (lang === 'ko') url.searchParams.delete('lang'); else url.searchParams.set('lang', lang);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (e) {}
  applyDomLang();
  syncLangButtons();
  if (!state.dirty) state = seedState();
  renderCaseGallery();
  renderAll(false);
  renderPack();
  updatePackLinks();
}

/* ───────────────────────── 세팅 팩 모달 (퍼널 CTA) ───────────────────────── */
let packContext = null;

function updatePackLinks() {
  $$('[data-pack-link]').forEach((a) => { a.href = PACK_URL; });
}

function openPack(ctx) {
  packContext = ctx || { title: '', bots: [] };
  const sheet = $('#packSheet');
  if (!sheet) return;
  sheet.hidden = false;
  document.body.classList.add('no-scroll');
  renderPack();
  const close = $('#closePack');
  if (close) close.focus();
}

function closePack() {
  const sheet = $('#packSheet');
  if (sheet) sheet.hidden = true;
  document.body.classList.remove('no-scroll');
}

function packCta() {
  const d = DICT();
  return (d && d.pack && d.pack.cta) || u('packCta') || '래피드에서 세팅 팩 받기 →';
}

function renderPack() {
  const sheet = $('#packSheet');
  if (!sheet || sheet.hidden) return;
  const d = DICT();
  const p = (d && d.pack) || null;
  const ctx = packContext || { bots: [] };
  const set = (id, text) => { const el = $('#' + id); if (el) el.textContent = text; };
  set('packTitle', (p && p.title) || '🎁 이 팀을 내 ChatGPT · Claude에 그대로 쓰기');
  set('packSub', (p && p.sub) || '세팅 팩 — 한 번 붙여넣으면 3분 만에 준비됩니다.');
  set('packBuy', packCta());
  set('packPrice', (p && p.price) || '얼리버드 14,900원 · 번들 24,900원');
  set('packNote', (p && p.note) || '웹 체험은 계속 무료입니다. 세팅 팩은 이미 쓰는 도구에 같은 팀을 옮기고 싶은 분을 위한 선택 상품입니다.');
  const label = $('.pack-team-label');
  if (label) label.textContent = (p && p.teamLabel) || '이 팀 구성';
  const team = $('#packTeam');
  if (team) {
    const bots = ctx.bots || [];
    team.innerHTML = (ctx.name ? '<div class="pack-team-name">' + esc(ctx.name) + '</div>' : '') +
      bots.map((b) => '<span class="pack-chip">' + esc(b.emoji || '🤖') + ' ' + esc(b.name) + '</span>').join('');
  }
  const steps = $('#packSteps');
  if (steps) {
    const rows = (p && p.steps) || [
      ['업종 팩 파일 열기', '세팅 팩에는 같은 역할·업무 설명·바로 쓰는 프롬프트 5개가 들어 있습니다.'],
      ['ChatGPT(Custom GPT·Projects) 또는 Claude(Projects)에 붙여넣기', '팀당 지침 블록 하나입니다. 한·영 지침이 함께 들어 있습니다.'],
      ['프롬프트 5개로 바로 시작', '각 프롬프트는 오늘 바로 보낼 수 있는 초안을 만듭니다.'],
    ];
    steps.innerHTML = rows.map((r) => '<li><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></li>').join('');
  }
  updatePackLinks();
}

/* ───────────────────────── 다운로드 링크 · 설치 탭 · PWA ───────────────────────── */
function assetUrl(name) {
  return 'https://github.com/' + RELEASE.repo + '/releases/download/' + RELEASE.tag + '/' + encodeURIComponent(name);
}

function applyReleaseLinks() {
  const map = {
    'mac-universal': assetUrl('MOA-Hive-' + RELEASE.version + '-universal.dmg'),
    'mac-arm64': assetUrl('MOA-Hive-' + RELEASE.version + '-arm64.dmg'),
    'mac-x64': assetUrl('MOA-Hive-' + RELEASE.version + '-x64.dmg'),
    'win-setup': assetUrl('MOA-Hive-Setup-' + RELEASE.version + '.exe'),
    'mac-script': 'https://github.com/' + RELEASE.repo + '/blob/main/start.command',
    'win-script': 'https://github.com/' + RELEASE.repo + '/blob/main/start.bat',
    'win-zip': 'https://github.com/' + RELEASE.repo + '/archive/refs/heads/main.zip',
    releases: 'https://github.com/' + RELEASE.repo + '/releases',
  };
  $$('[data-dl]').forEach((a) => {
    const key = a.getAttribute('data-dl');
    if (!map[key]) return;
    a.href = map[key];
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    if (key !== 'releases' && key !== 'win-zip' && !key.endsWith('-script')) {
      a.setAttribute('download', '');
    }
  });
}

function setupGuideTabs() {
  const tabs = $$('[data-guide]');
  const panes = $$('.guide-pane');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.getAttribute('data-guide');
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panes.forEach((p) => {
        p.hidden = p.getAttribute('data-pane') !== key;
      });
    });
  });
}

function setupInstall() {
  let deferred = null;
  const btn = $('#installBtn');
  const fab = $('#installFab');
  const show = () => {
    if (btn) btn.hidden = false;
    if (fab) fab.classList.add('show');
  };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    show();
  });
  const ask = async () => {
    if (!deferred) {
      toast(LN('toasts.installHint', '브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해 주세요.'));
      return;
    }
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch (_) {}
    deferred = null;
    if (btn) btn.hidden = true;
    if (fab) fab.classList.remove('show');
  };
  if (btn) btn.addEventListener('click', ask);
  if (fab) fab.addEventListener('click', ask);
  window.addEventListener('appinstalled', () => {
    if (btn) btn.hidden = true;
    if (fab) fab.classList.remove('show');
    toast(LN('toasts.installed', '홈 화면에 추가되었습니다.'));
  });
  if (window.matchMedia('(display-mode: standalone)').matches) {
    if (btn) btn.hidden = true;
    if (fab) fab.classList.remove('show');
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ───────────────────────── 체험판 데이터 ───────────────────────── */
const CONSULT = [
  {
    id: 'pm',
    label: '기획 / PM',
    emoji: '🧭',
    tagline: '요구사항·일정·리포트를 문서로 남기는 기획팀',
    pains: ['요구사항이 문서로 안 남는다', '일정과 우선순위가 계속 밀린다', '회의 후 액션이 흩어진다'],
    why: '기획자는 “정리하는 일”에 시간을 다 씁니다. 이 조합은 정리를 봇이 맡고, 사람은 결정만 하도록 역할을 나눕니다.',
    usage: ['이번 주 목표를 던지면 PRD 초안과 3일 일정으로 쪼갭니다.', '회의록을 붙이면 액션 아이템을 티켓 형태로 정리합니다.', '릴리즈 전 QA 체크리스트를 요청하고 승인 카드로 실행을 확인합니다.'],
    channel: '기획-본진',
    agents: [
      { name: '기획PM 봇', emoji: '🧭', role: 'pm', task: '요구사항·범위 분해', summary: '요청을 3개 유저스토리와 3일 일정으로 쪼갰습니다.', persona: '요구사항을 PRD·유저스토리·일정으로 쪼개고 리스크를 먼저 짚는다.' },
      { name: '리포트 봇', emoji: '📊', role: 'research', task: '지표·진행률 리포트', summary: '주간 지표와 진행률을 한 장으로 정리했습니다.', persona: '주간 지표와 진행률을 한 장 리포트로 정리한다. 숫자에는 기준일과 출처를 붙인다.' },
      { name: '리서치 봇', emoji: '🔎', role: 'research', task: '근거·경쟁사 확인', summary: '경쟁 3곳의 가격대와 확인 필요 항목을 정리했습니다.', persona: '시장·경쟁사 조사. 사실과 추정을 구분하고 “확인 필요” 항목을 남긴다.' },
      { name: 'QA·릴리즈 봇', emoji: '🧪', role: 'dev', task: '검증 시나리오', summary: '회귀 체크리스트 6항목을 만들었습니다.', persona: '릴리즈 전 체크리스트와 회귀 시나리오를 만든다.' },
    ],
  },
  {
    id: 'b2b',
    label: 'B2B 영업 · 제안',
    emoji: '🤝',
    tagline: '타깃 발굴부터 제안서·팔로업까지 붙는 영업팀',
    pains: ['제안서 쓰는 데 하루가 사라진다', '팔로업 타이밍을 놓친다', '가격·조건 협상 근거가 없다'],
    why: '영업은 “한 건을 끝까지 끌고 가는 힘”이 승부입니다. 발굴·제안·가격·팔로업을 네 봇이 나눠 들고, 담당자는 미팅에만 집중합니다.',
    usage: ['고객사 한 곳을 던지면 타깃 근거·제안 목차·가격 3안이 한 흐름으로 나옵니다.', '미팅 메모를 붙이면 24시간 안에 보낼 메일 초안이 나옵니다.', '가격 봇에게 “양보 범위”를 물어 협상선을 먼저 정해 둡니다.'],
    channel: '영업-파이프라인',
    agents: [
      { name: '제안서 설계 봇', emoji: '📄', role: 'pm', task: '제안서 목차·논리 구성', summary: '고객 문제 → 해결 → 도입 효과 순서의 목차 5장을 잡았습니다.', persona: '고객의 문제 → 해결 → 도입 효과 → 일정·비용 순서로 과장 없이 제안서를 쓴다.' },
      { name: '정산·매출 봇', emoji: '💰', role: 'research', task: '매출·정산 흐름 정리', summary: '입금·세금계산서·미수금 기준을 한 표로 정리했습니다.', persona: '매출·정산 데이터를 정리해 미수금과 마감일을 표시한다.' },
      { name: '팔로업 봇', emoji: '✉️', role: 'content', task: '팔로업 문구 작성', summary: '미팅 후 24시간 안에 보낼 메일 초안 1건을 작성했습니다.', persona: '미팅 후 팔로업 메일을 짧고 결론 중심으로 쓴다.' },
    ],
  },
  {
    id: 'content',
    label: '콘텐츠 · SNS 운영',
    emoji: '📸',
    tagline: '매일 올릴 것이 떨어지지 않는 콘텐츠팀',
    pains: ['무엇을 올릴지 매번 고민한다', '캡션이 항상 비슷하다', '성과를 봐도 다음 행동이 없다'],
    why: '콘텐츠는 기획·카피·비주얼·분석이 돌아가야 유지됩니다. 혼자 다 하면 발행이 끊기니, 봇들이 주간 리듬을 대신 만듭니다.',
    usage: ['“다음 주 7편”을 요청하면 주제·훅·발행 요일이 한 번에 나옵니다.', '같은 메시지의 인스타·스레드 버전을 동시에 요청합니다.', '일요일에 지표를 붙이면 다음 주 실험 1개를 제안합니다.'],
    channel: '콘텐츠-기획',
    agents: [
      { name: '콘텐츠 전략 봇', emoji: '🎯', role: 'content', task: '주제·발행 캘린더 설계', summary: '이번 주 7편 주제와 발행 요일을 잡았습니다.', persona: '계정 포지셔닝과 주간 발행 캘린더를 설계한다.' },
      { name: '카피 봇', emoji: '✍️', role: 'content', task: '훅·캡션 작성', summary: '첫 3초 훅 2안과 해시태그 세트를 만들었습니다.', persona: '첫 3초 훅과 마지막 CTA를 쓴다. 인스타·스레드용을 따로 쓴다.' },
      { name: '성과 분석 봇', emoji: '📊', role: 'research', task: '지표·실험 설계', summary: '도달·저장·전환 지표와 다음 실험 1개를 정리했습니다.', persona: '도달·저장·팔로우 전환을 비교하고 다음 실험을 제안한다.' },
    ],
  },
  {
    id: 'founder',
    label: '1인 사업자 · 창업',
    emoji: '🚀',
    tagline: '혼자서 기획·개발·그로스·CS를 돌리는 사업팀',
    pains: ['아이디어는 많은데 출시를 못 한다', '운영할 사람이 나뿐이다', '가격·채널 결정을 매번 혼자 고민한다'],
    why: '1인 사업의 병목은 “결정과 반복 작업”입니다. 결정은 근거를 붙여 빠르게, 반복은 봇이 처리하도록 나눕니다.',
    usage: ['“2주 안에 낼 MVP 범위”를 물으면 기능을 잘라 줍니다.', '개발 봇에게 구현·배포 순서를, 그로스 봇에게 첫 100명 실험을 요청합니다.', 'CS 문의를 붙이면 응대 문장과 제품 개선 항목으로 바꿔 줍니다.'],
    channel: '런칭',
    agents: [
      { name: '사업 기획 봇', emoji: '🧭', role: 'pm', task: 'MVP 범위·가격 정의', summary: '2주 MVP 범위와 가격 2안을 정리했습니다.', persona: '아이디어를 2주 MVP로 자르고 가격·타깃·해지 사유를 먼저 정의한다.' },
      { name: '구현 봇', emoji: '🛠️', role: 'dev', task: '구현·배포 순서', summary: '수정 파일 2개와 실행 명령, 검증 순서를 정리했습니다.', persona: '혼자 운영 가능한 스택을 고르고 배포·결제·인증 순서를 제시한다.' },
      { name: '그로스 봇', emoji: '📈', role: 'content', task: '초기 유입 실험', summary: '첫 100명 채널 실험 2개와 중단 기준을 붙였습니다.', persona: '초기 100명을 모으는 채널 실험을 설계하고 중단 기준을 붙인다.' },
    ],
  },
];

const AGENT_LIB = {
  proposal: { name: '제안서 설계 봇', emoji: '📄', role: 'pm', task: '제안서 목차·논리 구성', summary: '고객 문제 → 해결 → 도입 효과 순서의 목차 5장을 잡았습니다.', keywords: ['제안서', '도입', '제안', '발표'] },
  billing: { name: '정산·매출 봇', emoji: '💰', role: 'research', task: '매출·정산 흐름 정리', summary: '입금·세금계산서·미수금 기준을 한 표로 정리했습니다.', keywords: ['정산', '매출', '세금계산서', '입금', '미수금'] },
  followup: { name: '팔로업 봇', emoji: '✉️', role: 'content', task: '팔로업 문구 작성', summary: '미팅 후 24시간 안에 보낼 메일 초안 1건을 작성했습니다.', keywords: ['팔로업', '메일', '회신', '리마인드'] },
  content: { name: '콘텐츠 전략 봇', emoji: '🎯', role: 'content', task: '주제·발행 캘린더 설계', summary: '이번 주 7편 주제와 발행 요일을 잡았습니다.', keywords: ['콘텐츠', '캘린더', '주제', '릴스'] },
  copy: { name: '카피 봇', emoji: '✍️', role: 'content', task: '훅·캡션 작성', summary: '첫 3초 훅 2안과 해시태그 세트를 만들었습니다.', keywords: ['캡션', '훅', '카피', '해시태그'] },
  analysis: { name: '성과 분석 봇', emoji: '📊', role: 'research', task: '지표·실험 설계', summary: '도달·저장·전환 지표와 다음 실험 1개를 정리했습니다.', keywords: ['분석', '지표', '성과', '전환'] },
  planning: { name: '기획 정리 봇', emoji: '🧭', role: 'pm', task: '요구사항·범위 분해', summary: '요청을 3개 유저스토리와 3일 일정으로 쪼갰습니다.', keywords: ['기획', '요구사항', '일정', 'PRD'] },
  build: { name: '구현 봇', emoji: '🛠️', role: 'dev', task: '구현·배포 순서', summary: '수정 파일 2개와 실행 명령, 검증 순서를 정리했습니다.', keywords: ['구현', '개발', '배포', '코드'] },
  qa: { name: 'QA·검증 봇', emoji: '🧪', role: 'dev', task: '검증 시나리오', summary: '회귀 체크리스트 6항목을 만들었습니다.', keywords: ['QA', '테스트', '검증', '릴리즈'] },
  research: { name: '리서치 봇', emoji: '🔎', role: 'research', task: '근거·경쟁사 확인', summary: '경쟁 3곳의 가격대와 확인 필요 항목을 정리했습니다.', keywords: ['리서치', '시장', '경쟁사', '조사'] },
  ops: { name: '운영 자동화 봇', emoji: '⚙️', role: 'dev', task: '반복 업무 자동화 설계', summary: '반복 업무 3개를 스크립트·규칙 후보로 바꿨습니다.', keywords: ['자동화', '반복', '운영', '스크립트'] },
};

const CHIEF = {
  name: 'MOA Chief',
  emoji: '🧠',
  role: 'chief',
  isChief: true,
  summary: '목적을 3단계로 쪼개 하위 에이전트에게 위임하고, 산출물을 취합해 결론과 다음 액션만 보고합니다.',
  keywords: ['총괄', '오케스트라', '전체', '요약', '진행'],
};

const CASES = [
  {
    id: 'store', emoji: '🏪', label: '자영업·동네 매장', channel: '매장-마케팅',
    tagline: '홍보글·리뷰 답글·단골 이벤트·매출 정리',
    starter: '이번 주 매장 홍보글 3편과 단골 이벤트 문구, 리뷰 답글 초안을 준비해 주세요.',
    bots: [
      { name: '이벤트 기획 봇', emoji: '🎪', role: 'pm', summary: '단골 이벤트와 프로모션을 비용·준비 시간과 함께 기획합니다.', tasks: ['이번 주 단골 이벤트 기획', '비용·준비 시간 계산', '재방문 확인 방법 정리'] },
      { name: '홍보글 봇', emoji: '📣', role: 'content', summary: '동네 말투로 짧고 담백한 홍보글을 씁니다.', tasks: ['이번 주 홍보글 3편', '인스타 스토리 문구', '네이버 플레이스 소개글'] },
      { name: '리뷰 케어 봇', emoji: '⭐', role: 'research', summary: '리뷰 답글 초안을 만들고 민감한 리뷰는 표시합니다.', tasks: ['새 리뷰 답글 초안', '별점 3점 이하 표시', '반복 불만 정리'] },
      { name: '매출 정리 봇', emoji: '🧾', role: 'research', summary: '주간 매출을 표로 정리하고 다음 프로모션을 제안합니다.', tasks: ['주간 매출 표 정리', '다음 주 프로모션 후보', '목표 대비 차이 계산'] },
    ],
    example: [
      { from: 'user', text: '이번 주 단골 이벤트 문구 만들어줘. 커피집이고 20~30대 손님이 많아.' },
      { from: '이벤트 기획 봇', text: '**결론** — “오후 3시, 단골만 아는 1+1”로 갑니다. 월~목 15~17시 아메리카노 1+1, 문자·스토리용 2안을 준비했습니다.' },
      { from: '리뷰 케어 봇', text: '이번 주 새 리뷰 4건 답글 초안을 준비했습니다. 별점 3점 이하는 사장님 확인 후 올리게 따로 표시했습니다.' },
    ],
  },
  {
    id: 'office', emoji: '💼', label: '직장인·팀 업무', channel: '팀-업무',
    tagline: '회의록 3줄 요약·주간 보고·메일 초안·일정',
    starter: '오늘 회의 메모를 3줄로 요약하고, 이번 주 보고서 초안과 답장할 메일 2건을 정리해 주세요.',
    bots: [
      { name: '회의록 봇', emoji: '📝', role: 'pm', summary: '회의 메모를 결정·할 일·담당자로 짧게 요약합니다.', tasks: ['회의 메모 3줄 요약', '할 일·담당자 정리', '결정 사항만 뽑기'] },
      { name: '리포트 봇', emoji: '📊', role: 'research', summary: '주간 보고서를 지표·이슈·다음 계획으로 씁니다.', tasks: ['주간 보고 초안', '지표 3개 정리', '다음 주 계획 제안'] },
      { name: '메일 봇', emoji: '✉️', role: 'content', summary: '답장이 밀린 메일을 결론 중심으로 초안화합니다.', tasks: ['답장 메일 2건 초안', '제안 메일 첫 문장', '일정 조율 답장'] },
      { name: '일정 봇', emoji: '🗓️', role: 'pm', summary: '일정 충돌을 찾아 대안 시간과 마감을 정리합니다.', tasks: ['이번 주 일정 충돌 확인', '마감 역산', '대안 시간 제안'] },
    ],
    example: [
      { from: 'user', text: '이 회의 메모 3줄로 요약하고 할 일만 뽑아줘.' },
      { from: '회의록 봇', text: '**3줄 요약**\\n1. 이번 달 목표는 재구매율 5%p 상승\\n2. 결제 실패 문의를 우선 수정\\n3. 다음 주 화요일까지 담당자별 초안 공유' },
      { from: '리포트 봇', text: '주간 보고 초안도 붙여 뒀습니다 — 지표 3개, 이슈 2개, 다음 주 계획 2개 구성입니다.' },
    ],
  },
  {
    id: 'seller', emoji: '🛍️', label: '스마트스토어·온라인 셀러', channel: '스토어-운영',
    tagline: '상세페이지 카피·CS 답변·프로모션·리뷰 분석',
    starter: '이번 주 프로모션을 기획하고, 자주 오는 CS 문의 5개 답변 템플릿과 상세페이지 카피 3안을 만들어 주세요.',
    bots: [
      { name: '상세페이지 봇', emoji: '🖼️', role: 'content', summary: '상품 장점을 장면과 숫자로 보여주는 카피를 씁니다.', tasks: ['상세페이지 카피 3안', '첫 문장 후킹', '구매 이유 정리'] },
      { name: 'CS 답변 봇', emoji: '💬', role: 'research', summary: '자주 오는 문의를 답변 템플릿으로 만듭니다.', tasks: ['CS 답변 5종 템플릿', '교환·환불 안내', '예외 상황 표시'] },
      { name: '프로모션 봇', emoji: '🎁', role: 'pm', summary: '재고·마진을 고려한 프로모션을 기획합니다.', tasks: ['이번 주 프로모션 기획', '할인·마진 계산', '중단 기준 정하기'] },
      { name: '리뷰 분석 봇', emoji: '🔍', role: 'research', summary: '리뷰를 장점·불만·개선 요청으로 나눕니다.', tasks: ['리뷰 50건 분류', '반복 불만 찾기', '상품 개선 항목 정리'] },
    ],
    example: [
      { from: 'user', text: '신상품 상세페이지 카피 3안 써줘. 30대 여성, 가벼운 가방.' },
      { from: '상세페이지 봇', text: '**카피 3안** — “가볍게, 그러나 든든하게” / “출근부터 주말까지” / “가방 안이 정리되는 이유”로 잡았습니다.' },
      { from: 'CS 답변 봇', text: '배송·교환·사이즈 문의 답변 템플릿 5종을 준비했습니다. 교환 안내는 정책 문구 그대로 넣었습니다.' },
    ],
  },
  {
    id: 'creator', emoji: '🎬', label: '1인 크리에이터·콘텐츠', channel: '콘텐츠-기획',
    tagline: '소재 발굴·쇼츠 대본·댓글 소통·디지털 상품',
    starter: '다음 주 콘텐츠 소재 10개와 쇼츠 대본 3편, 댓글 답글 초안과 디지털 상품 아이디어 3개를 준비해 주세요.',
    bots: [
      { name: '소재 발굴 봇', emoji: '🔭', role: 'content', summary: '저장·공유를 부르는 소재를 찾아 캘린더로 묶습니다.', tasks: ['다음 주 소재 10개', '주간 발행 캘린더', '저장 부르는 주제 고르기'] },
      { name: '대본 봇', emoji: '🎞️', role: 'content', summary: '쇼츠 대본을 첫 3초 훅과 컷 지시로 씁니다.', tasks: ['쇼츠 대본 3편', '첫 3초 훅 2안', '촬영 컷 지시'] },
      { name: '댓글 소통 봇', emoji: '💌', role: 'research', summary: '댓글을 읽고 답글 초안과 다음 영상 아이디어를 뽑습니다.', tasks: ['댓글 답글 초안', '다음 영상 아이디어', '반응 좋은 주제 표시'] },
      { name: '디지털 상품 봇', emoji: '📦', role: 'pm', summary: '콘텐츠를 템플릿·전자책으로 기획합니다.', tasks: ['디지털 상품 3안', '가격·구성 정리', '출시 순서 제안'] },
    ],
    example: [
      { from: 'user', text: '다음 주 쇼츠 소재 10개 뽑고, 그중 3개 대본 써줘.' },
      { from: '소재 발굴 봇', text: '**소재 10개** — “3분 아침 루틴”, “안 쓰는 물건 5개”, “구독 대신 이거”처럼 저장을 부르는 주제로 골랐습니다.' },
      { from: '대본 봇', text: '3편 대본을 첫 3초 훅 → 문제 → 해결 → CTA 구조로 준비했습니다. 촬영 컷도 함께 적었습니다.' },
    ],
  },
  {
    id: 'freelancer', emoji: '🧑‍💻', label: '프리랜서·1인 대표', channel: '일-파이프라인',
    tagline: '제안서·견적서·마감 리마인드·포트폴리오',
    starter: '이번 주 신규 고객 제안서 초안과 견적 3안, 진행 중 프로젝트 마감 리마인드 메일을 준비해 주세요.',
    bots: [
      { name: '제안서 봇', emoji: '📄', role: 'pm', summary: '고객 문제 → 해결 → 범위 → 일정 → 비용 순서로 씁니다.', tasks: ['제안서 5장 초안', '작업 범위 정리', '일정·비용 표'] },
      { name: '견적 봇', emoji: '🧮', role: 'pm', summary: '견적 3안과 양보 범위를 만듭니다.', tasks: ['견적 3안', '양보 범위 정리', '빠진 비용 점검'] },
      { name: '리마인드 봇', emoji: '⏰', role: 'content', summary: '마감·회신 기한을 놓치지 않게 짧게 씁니다.', tasks: ['마감 리마인드 메일', '회신 재촉 문구', '이번 주 마감 정리'] },
      { name: '포트폴리오 봇', emoji: '🗂️', role: 'content', summary: '완료한 일을 문제·해결·성과 문장으로 정리합니다.', tasks: ['포트폴리오 문장 정리', '성과 숫자 뽑기', '사례 3건 구성'] },
    ],
    example: [
      { from: 'user', text: '이번 주 신규 고객 제안서랑 견적 3안 준비해줘. 웹사이트 리뉴얼 건이야.' },
      { from: '제안서 봇', text: '**제안 목차** — 현황 문제 → 리뉴얼 방향 → 작업 범위 → 일정 → 비용. 5장으로 잡았습니다.' },
      { from: '견적 봇', text: '견적 3안(기본·표준·확장)과 양보 범위를 정리했습니다. 표준안을 기본 추천으로 두었습니다.' },
    ],
  },
  {
    id: 'product', emoji: '🚀', label: '프로덕트·스타트업 팀', channel: '프로덕트-스쿼드',
    tagline: '프로토타입 → 빌드 → 스위프 → 그로스 → 메인테인',
    starter: '2주 안에 낼 MVP 범위를 정하고, 프로토타입 → 구현 → 정리 → 첫 100명 실험 → 운영 점검 순서로 움직여 주세요.',
    bots: [
      { name: 'MOA Chief', emoji: '🧠', role: 'chief', isChief: true, summary: '차분하고 명쾌한 팀장 — 다섯 명에게 일을 나눠 맡기고 산출물만 취합합니다.', tasks: ['이번 주 팀 우선순위 정리', '다섯 명 산출물 취합', '결정할 것만 골라주기'] },
      { name: 'Prototyper', emoji: '💡', role: 'content', summary: '아이디어를 끊임없이 쏟아내는 발산형입니다.', tasks: ['새 아이디어 10개', '가능성 시나리오', '컨셉 3안 제안'] },
      { name: 'Builder', emoji: '🔨', role: 'dev', summary: '아이디어를 제품과 화면으로 바꾸는 실행형입니다.', tasks: ['화면 실제로 만들기', '구현 순서 정리', '프로토타입 붙이기'] },
      { name: 'Sweeper', emoji: '🧹', role: 'dev', summary: '화면과 코드를 깔끔하게 정리하는 정돈형입니다.', tasks: ['중복 정리', '군더더기 빼기', '정리 체크리스트'] },
      { name: 'Grower', emoji: '🌱', role: 'content', summary: '제품을 사람들이 찾게 키우는 성장형입니다.', tasks: ['첫 100명 실험', '채널 실험 설계', '지표 보고 다음 실험'] },
      { name: 'Maintainer', emoji: '🛡️', role: 'dev', summary: '커진 서비스를 안전하고 빠르게 지키는 수호형입니다.', tasks: ['장애 위험 점검', '모니터링·백업', '보안·속도 점검'] },
    ],
    example: [
      { from: 'user', text: '2주 안에 낼 MVP 범위 정하고 바로 프로토타입 만들어줘.' },
      { from: 'Prototyper', text: '**컨셉 3안** — 예약형, 기록형, 공유형으로 넓혀 봤습니다. 2주 안에는 기록형이 가장 가볍습니다.' },
      { from: 'Builder', text: '기록형 기준으로 화면 3개와 저장 흐름을 만들었습니다. 오늘 안에 눌러볼 수 있게 붙였습니다.' },
    ],
  },
];

const ROLE_TASKS = {
  pm: ['이번 주 목표를 PRD 초안으로 쪼개기', '회의록을 액션 아이템으로 정리', '릴리즈 전 QA 체크리스트 만들기'],
  dev: ['구현 순서와 파일 구조 정리', '버그 재현 → 수정 계획 세우기', '배포 스크립트 점검'],
  content: ['다음 주 7편 발행 캘린더', '릴스 첫 3초 훅 2안', '인스타·스레드 캡션 동시 작성'],
  research: ['경쟁사 3곳 가격 비교', '시장 규모 근거 정리', '확인 필요 항목 표시'],
  chief: ['이번 주 팀 우선순위 정리', '에이전트 산출물 취합 보고', '다음 액션 1건 고르기'],
};

const ROLE_LABEL = { pm: '기획·PM', dev: '개발·검증', content: '콘텐츠', research: '리서치', chief: '총괄' };

const CHARACTER_TASKS = {
  'MOA Chief': ['이번 주 팀 우선순위 정리', '다섯 명의 산출물 취합 보고', '내가 결정할 것만 골라주기'],
  Prototyper: ['새 아이디어 10개 발산해줘', '이 기능의 가능성 시나리오 그려줘', '새로운 컨셉 3안 제안해줘'],
  Builder: ['이 화면 실제로 만들어줘', '구현 순서와 실행 명령 정리해줘', '프로토타입을 제품 형태로 붙여줘'],
  Sweeper: ['중복 코드·화면 정리해줘', '이 흐름에서 군더더기 빼줘', '릴리즈 전 정리 체크리스트 만들어줘'],
  Grower: ['첫 100명 유입 실험 설계해줘', '사람들이 찾게 만드는 채널 정리해줘', '지표 보고 다음 실험 골라줘'],
  Maintainer: ['장애 나기 쉬운 지점 점검해줘', '모니터링·백업 계획 세워줘', '느린 부분과 보안 위험 정리해줘'],
};

function makeBot(spec, extra) {
  const role = spec.role || 'pm';
  const tasks = (spec.tasks || CHARACTER_TASKS[spec.name] || ROLE_TASKS[role] || ROLE_TASKS.pm).slice();
  return Object.assign(
    {
      id: spec.id || uid('bot'),
      name: spec.name,
      emoji: spec.emoji,
      role,
      isChief: !!spec.isChief,
      summary: spec.summary || spec.task || (ROLE_LABEL[role] + ' 업무를 맡습니다.'),
      tasks,
      activity: spec.activity || [],
      engine: '로컬 시뮬레이터',
      cwd: './workspace',
      keywords: spec.keywords || [],
    },
    extra || {}
  );
}

function seedState() {
  const chief = makeBot({
    id: 'bot_chief', name: 'MOA Chief', emoji: '🧠', role: 'chief', isChief: true,
    summary: LN('roles.chief', '차분하고 명쾌한 팀장 — 사용자와 단독으로 소통하고, 다섯 명에게 일을 나눠 맡긴 뒤 산출물만 취합해 보고합니다.'),
    keywords: ['총괄', '팀', '전체', '요약', '진행', '보고'],
    activity: ['오늘의 팀 우선순위 정리', '다섯 명의 산출물 취합', '다음 액션 1건 보고'],
  });
  const proto = makeBot({
    id: 'bot_prototyper', name: 'Prototyper', emoji: '💡', role: 'content',
    summary: LN('roles.prototyper', '아이디어를 끊임없이 쏟아내는 발산형 — 가능성을 먼저 열고 빠르게 여러 안을 만듭니다.'),
    keywords: ['아이디어', '발산', '컨셉', '가능성', '실험', '기획'],
    activity: ['새 컨셉 10안 발산', '가능성 시나리오 3개', '실험 후보 5개 정리'],
  });
  const builder = makeBot({
    id: 'bot_builder', name: 'Builder', emoji: '🔨', role: 'dev',
    summary: LN('roles.builder', '아이디어를 진짜 제품과 화면으로 바꾸는 실행형 — 오늘 바로 만들고 붙입니다.'),
    keywords: ['만들', '구현', '화면', '프로토타입', '제품', '기능', '배포'],
    activity: ['프로토타입 화면 2개 구현', '실행 순서·명령 정리', '제품 형태로 연결'],
  });
  const sweeper = makeBot({
    id: 'bot_sweeper', name: 'Sweeper', emoji: '🧹', role: 'dev',
    summary: LN('roles.sweeper', '화면과 코드를 깔끔하게 정리하는 정돈형 — 군더더기를 과감히 빼고 흐름을 단순하게 만듭니다.'),
    keywords: ['정리', '리팩터', '중복', '군더더기', '단순화', '버그'],
    activity: ['중복 화면 3곳 정리', '불필요한 단계 4개 제거', '정리 체크리스트 작성'],
  });
  const grower = makeBot({
    id: 'bot_grower', name: 'Grower', emoji: '🌱', role: 'content',
    summary: LN('roles.grower', '제품을 계속 다듬어 사람들이 실제로 찾게 키우는 성장형 — 지표와 채널 실험으로 다음 성장을 만듭니다.'),
    keywords: ['성장', '유입', '지표', '채널', '마케팅', '리텐션', '수익'],
    activity: ['첫 100명 유입 실험 2안', '주간 지표 리포트 작성', '수익화 후보 3건 비교'],
  });
  const maintainer = makeBot({
    id: 'bot_maintainer', name: 'Maintainer', emoji: '🛡️', role: 'dev',
    summary: LN('roles.maintainer', '커진 서비스를 안전하고 빠르게 지키는 수호형 — 장애·보안·속도를 먼저 살핍니다.'),
    keywords: ['안정', '모니터링', '보안', '백업', '장애', '속도', '운영'],
    activity: ['장애 위험 지점 3곳 점검', '모니터링·백업 계획 정리', '느린 구간 2곳 표시'],
  });

  const bots = [chief, proto, builder, sweeper, grower, maintainer];
  if (LANG !== 'ko') bots.forEach((b) => { b.activity = []; });
  const channels = [
    { id: 'ch_all', name: '전체-팀', mode: 'auto', topic: LN('seed.channelTopics.ch_all', '여섯 캐릭터가 모이는 기본 채널 — 말하면 알아서 나눠 일합니다'), members: bots.map((b) => b.id) },
    { id: 'ch_b2b', name: 'B2B-업무', mode: 'auto', topic: LN('seed.channelTopics.ch_b2b', 'B2B 사업 기획·구현·성장'), members: ['bot_prototyper', 'bot_builder', 'bot_grower'] },
    { id: 'ch_side', name: '사이드-수익화', mode: 'mention', botId: 'bot_grower', topic: LN('seed.channelTopics.ch_side', '성장·수익 실험 — @이름으로 지정 호출'), members: ['bot_grower', 'bot_prototyper', 'bot_maintainer'] },
  ];

  return {
    dirty: false,
    env: 'stg',
    runId: 0,
    stgVersion: '0.3.0-rc',
    prodVersion: '0.1.0',
    promoted: false,
    bots,
    channels,
    messages: {
      ch_all: [
        { id: uid('msg'), kind: 'system', name: 'MOA Hive', text: LN('seed.system', '로컬 하네스 준비 완료. 이 대화는 이 PC의 ./data/에만 저장됩니다.') },
        {
          id: uid('msg'),
          kind: 'bot',
          botId: 'bot_chief',
          name: 'MOA Chief',
          emoji: '🧠',
          role: 'chief',
          text: LN('seed.greeting', '**MOA Chief**입니다. 하고 싶은 일을 말해 주세요 — 💡 Prototyper(발산) · 🔨 Builder(구현) · 🧹 Sweeper(정돈) · 🌱 Grower(성장) · 🛡️ Maintainer(운영)에게 나눠 맡기고 결과만 정리해 드립니다.\n\n- 그냥 말하면 팀이 알아서 나눠 일합니다\n- 한 사람에게만 시키려면 `@Builder`처럼 불러 주세요'),
        },
      ],
      ch_b2b: [],
      ch_side: [],
    },
    activeChannelId: 'ch_all',
    activeBotId: 'bot_chief',
    typingBotId: null,
    officeBusy: null,
    proposal: null,
    history: [
      { version: '0.3.0-rc', env: 'stg', title: 'STG 후보 — 오케스트레이터 · 팀 컨설팅 · 웹 데모', at: '2026-11-19' },
      { version: '0.1.0', env: 'prod', title: '최초 운영 버전', at: '2026-11-19' },
    ],
  };
}

let state = seedState();
let wizardPlan = null;
let wizardRole = null;
let adminMode = false;

/* ───────────────────────── 관리자 모드 · 가상 오피스 ───────────────────────── */
function adminFromEnv() {
  let q = null;
  try { q = new URLSearchParams(location.search).get('admin'); } catch (e) {}
  if (q === '1') return true;
  if (q === '0') return false;
  try { return localStorage.getItem('moa_admin') === '1'; } catch (e) { return false; }
}

function applyAdminMode() {
  document.body.classList.toggle('demo-admin', adminMode);
  $$('.admin-only').forEach((el) => { el.hidden = !adminMode; });
  if (!adminMode && state.env === 'prod') {
    state.env = 'stg';
    state.activeChannelId = state.channels[0] ? state.channels[0].id : state.activeChannelId;
  }
  if (!adminMode) {
    const ctx = $('#tabContext');
    if (ctx && !ctx.classList.contains('is-active')) ctx.click();
  }
  const btn = $('#adminToggle');
  if (btn) btn.textContent = adminMode ? '🔒 ' + (u('adminOff') || '관리자 모드 끄기') : '🔧 ' + (u('adminOn') || '관리자 모드');
}

function setAdmin(on) {
  adminMode = !!on;
  try { localStorage.setItem('moa_admin', adminMode ? '1' : '0'); } catch (e) {}
  applyAdminMode();
  renderAll(false);
  toast(adminMode ? LN('toasts.adminOn', '관리자 모드 — STG/PROD·Release 패널이 표시됩니다.') : LN('toasts.adminOff', '일반 모드 — 관리자 도구를 숨겼습니다.'));
}

function characterClass(name) {
  if (/Chief/i.test(name)) return 'char-chief';
  if (/Prototyper/i.test(name)) return 'char-proto';
  if (/Builder/i.test(name)) return 'char-builder';
  if (/Sweeper/i.test(name)) return 'char-sweeper';
  if (/Grower/i.test(name)) return 'char-grower';
  if (/Maintainer/i.test(name)) return 'char-maint';
  return '';
}

function officeChar(b, working, bubble) {
  return '<button type="button" class="d-office-char ' + characterClass(b.name) + ' ' + (working ? 'working' : 'idle') + '" data-office-bot="' + esc(b.id) + '" data-testid="office-char" title="' + esc(u('openRole') || '역할 카드 열기') + '">' +
    '<span class="d-char-bubble">' + esc(bubble || '') + '</span>' +
    '<span class="d-char-avatar">' + esc(b.emoji || '🤖') + '</span>' +
    '<span class="d-char-desk"></span>' +
    '<span class="d-char-name">' + esc(b.name) + '</span>' +
    '</button>';
}

function renderOffice() {
  const floor = $('#officeFloor');
  if (!floor) return;
  const chief = state.bots.find((b) => b.isChief);
  const rest = state.bots.filter((b) => b !== chief);
  const busy = state.officeBusy || {};
  const working = (b) => b.id === state.typingBotId || (busy.chief && b === chief) || busy.agent === b.id;
  const delegating = LN('demo.bubbleDelegating', '위임 중…');
  const workingLabel = LN('demo.bubbleWorking', '작업 중…');
  const bubble = (b) => (busy.chief && b === chief ? delegating : working(b) ? workingLabel : '');
  const groups = [];
  if (chief) groups.push(officeChar(chief, working(chief), bubble(chief)));
  rest.slice(0, 3).forEach((b) => groups.push(officeChar(b, working(b), bubble(b))));
  const lounge = rest.slice(3, 5).map((b) => officeChar(b, working(b), bubble(b)));
  floor.innerHTML = groups.join('') + (lounge.length ? '<span class="d-office-lounge">' + esc(LN('demo.officeLounge', '그로스 · 운영')) + '</span>' + lounge.join('') : '');
  const hint = $('#officeHint');
  if (hint) hint.textContent = chief ? fmt(LN('demo.officeHint', '{chief} + 에이전트 {n}명'), { chief: chief.name, n: rest.length }) : '';
}

/* ───────────────────────── 환경 · 패널 렌더 ───────────────────────── */
const envBadge = () => $('#envBadge');
const isProd = () => state.env === 'prod';

function currentChannel() {
  return state.channels.find((c) => c.id === state.activeChannelId) || state.channels[0];
}

function channelLabel(ch) {
  if (!ch) return '';
  const d = DICT();
  return (d && d.channels && d.channels[ch.name]) || ch.name;
}

function botTasks(bot) {
  const d = DICT();
  if (d) {
    const byName = d.characterTasks && d.characterTasks[bot.name];
    const byRole = d.roleTasks && d.roleTasks[bot.role];
    if (byName) return byName.slice(0, 3);
    if (byRole) return byRole.slice(0, 3);
  }
  return (bot.tasks || []).slice(0, 3);
}

function currentBot() {
  return state.bots.find((b) => b.id === state.activeBotId) || state.bots[0];
}

function channelMembers(channel) {
  return (channel.members || []).map((id) => state.bots.find((b) => b.id === id)).filter(Boolean);
}

function renderEnv() {
  const stg = $('#envStg');
  const prod = $('#envProd');
  if (stg) stg.classList.toggle('is-active', !isProd());
  if (prod) prod.classList.toggle('is-active', isProd());
  const badge = envBadge();
  if (badge) badge.textContent = (isProd() ? 'PROD v' : 'STG v') + (isProd() ? state.prodVersion : state.stgVersion);
  const input = $('#demoInput');
  const banner = $('#demoReadonly');
  if (input) {
    input.disabled = isProd();
    const ph = isProd()
      ? LN('demo.inputProd', 'PROD는 읽기 전용입니다')
      : (LANG === 'ko' ? '메시지 입력 — @봇이름 호출, “이번 주 할 일 정리해줘”' : input.getAttribute('data-' + LANG + '-placeholder') || LN('demo.inputProd', ''));
    input.placeholder = ph;
  }
  if (banner) banner.hidden = !isProd();
  const send = $('#demoSend');
  if (send) send.disabled = isProd();
  const mic = $('#demoMic');
  if (mic) mic.disabled = isProd();
}

function renderChannels() {
  const list = $('#channelList');
  if (!list) return;
  list.innerHTML = state.channels
    .map(
      (c) =>
        '<button type="button" class="d-item' +
        (c.id === state.activeChannelId ? ' is-active' : '') +
        '" data-channel="' +
        esc(c.id) +
        '"><span class="hash">#</span><span class="nm">' +
        esc(channelLabel(c)) +
        '</span>' +
        (c.orchestrator ? '<span class="d-bot-state">🧠</span>' : '') +
        '</button>'
    )
    .join('');
}

function renderBots() {
  const list = $('#botList');
  if (!list) return;
  list.innerHTML = state.bots
    .map(
      (b) =>
        '<button type="button" class="d-item' +
        (b.id === state.activeBotId ? ' is-active' : '') +
        '" data-bot="' +
        esc(b.id) +
        '"><span class="em">' +
        esc(b.emoji) +
        '</span><span class="nm">' +
        esc(b.name) +
        '</span>' +
        (b.id === state.typingBotId
          ? '<span class="d-bot-state working">' + esc(LN('demo.workingBadge', '⚡ 작업 중')) + '</span>'
          : b.isChief
          ? '<span class="d-bot-state">' + esc(LN('demo.chiefBadge', '총괄')) + '</span>'
          : '') +
        '</button>'
    )
    .join('');
}

function renderInspector() {
  const bot = currentBot();
  if (!bot) return;
  const av = $('#inspAvatar');
  if (av) {
    av.textContent = bot.emoji;
    av.classList.toggle('working', bot.id === state.typingBotId);
    av.classList.toggle('idle', bot.id !== state.typingBotId);
  }
  const set = (id, text) => {
    const el = $('#' + id);
    if (el) el.textContent = text;
  };
  set('inspName', bot.name);
  set('inspSummary', bot.summary || '');
  const st = $('#inspState');
  if (st) {
    const working = bot.id === state.typingBotId;
    st.textContent = working ? LN('demo.stateWorking', '⚡ 작업 중') : LN('demo.stateIdle', '✨ 대기 중');
    st.classList.toggle('working', working);
  }
  const tasks = $('#taskList');
  if (tasks) {
    tasks.innerHTML = botTasks(bot)
      .map((t) => '<button type="button" class="d-task" data-task="' + esc(t) + '">' + esc(t) + '</button>')
      .join('');
  }
  const acts = $('#activityList');
  if (acts) {
    const rows = (bot.activity || []).slice(0, 3);
    acts.innerHTML = rows.length
      ? rows.map((a) => '<div class="d-act">· ' + esc(a) + '</div>').join('')
      : '<div class="d-act muted">' + esc(LN('demo.noActivity', '· 아직 처리 내역이 없습니다. 업무를 요청해 보세요.')) + '</div>';
  }
  set('inspEngine', DICT() ? LN('demo.engine', '로컬 시뮬레이터') : (bot.engine || '로컬 시뮬레이터'));
  set('inspCwd', bot.cwd || './workspace');
}

function renderRelease() {
  const stg = $('#relStg');
  const prod = $('#relProd');
  if (stg) stg.textContent = 'v' + state.stgVersion;
  if (prod) prod.textContent = 'v' + state.prodVersion;

  const diff = $('#relDiff');
  if (diff) {
    const rows = state.promoted
      ? [
          ['버전', '반영 완료', true],
          ['봇', '변경 없음', true],
          ['채널', '변경 없음', true],
        ]
      : [
          ['버전', 'v' + state.prodVersion + ' → v0.3.0', false],
          ['봇', '+' + Math.max(0, state.bots.length - 2) + '명 · 총 ' + state.bots.length + '명', false],
          ['채널', '+' + Math.max(0, state.channels.length - 1) + '개 · 총 ' + state.channels.length + '개', false],
          ['오케스트레이터', state.bots.some((b) => b.isChief) ? 'MOA Chief + 에이전트' : '없음', !state.bots.some((b) => b.isChief)],
        ];
    diff.innerHTML = rows
      .map(
        (r) =>
          '<div class="row' +
          (r[2] ? ' zero' : '') +
          '"><span>' +
          esc(r[0]) +
          '</span><b>' +
          esc(r[1]) +
          '</b></div>'
      )
      .join('');
  }
  const btn = $('#promoteBtn');
  const ack = $('#promoteAck');
  if (btn) btn.disabled = state.promoted || !(ack && ack.checked);
  const hist = $('#historyList');
  if (hist) {
    hist.innerHTML = state.history
      .slice(0, 4)
      .map(
        (h) =>
          '<div class="d-hist"><b>v' +
          esc(h.version) +
          ' · ' +
          esc(h.env.toUpperCase()) +
          '</b><span>' +
          esc(h.title) +
          ' · ' +
          esc(h.at) +
          '</span></div>'
      )
      .join('');
  }
}

function renderHeader() {
  const ch = currentChannel();
  const name = $('#demoChannelName');
  const topic = $('#demoTopic');
  const mode = $('#demoMode');
  if (name) name.textContent = '#' + (ch ? channelLabel(ch) : '전체-팀');
  if (topic) topic.textContent = (isProd() ? LN('demo.prodTopic', 'PROD · 읽기 전용 — ') : '') + (ch ? ch.topic || '' : '');
  if (mode) mode.textContent = ch && ch.mode === 'mention' ? LN('demo.mentionRoute', '@멘션 호출') : LN('demo.autoRoute', 'Auto');
}

function messageHtml(msg) {
  const kind = msg.kind || 'bot';
  if (kind === 'system') {
    return '<div class="d-msg system"><div class="av">🐝</div><div class="d-body"><div class="d-bubble">' + md(msg.text) + '</div></div></div>';
  }
  if (kind === 'user') {
    return (
      '<div class="d-msg user"><div class="av">🙋</div><div class="d-body"><div class="d-author"><b>나</b><span class="d-time">' +
      nowLabel() +
      '</span></div><div class="d-bubble">' +
      md(msg.text) +
      '</div></div></div>'
    );
  }
  const isChief = msg.role === 'chief';
  let inner = '<div class="d-bubble">';
  inner += md(msg.text);
  if (msg.steps && msg.steps.length) {
    inner += '<div class="d-deleg">';
    msg.steps.forEach((s) => {
      inner +=
        '<div class="d-step ' +
        (s.status || '') +
        '"><span class="em">' +
        esc(s.emoji) +
        '</span><span class="nm">' +
        esc(s.name) +
        '</span><span class="task">' +
        esc(s.task) +
        '</span><span class="st">' +
        (s.status === 'done' ? LN('demo.stepDone', '완료') : s.status === 'working' ? LN('demo.stepWorking', '작업 중') : LN('demo.stepWaiting', '대기')) +
        '</span></div>';
    });
    inner += '</div>';
  }
  if (msg.summary && msg.summary.length) {
    inner += '<div class="d-summary">' + md(msg.summary) + '</div>';
  }
  if (msg.proposal) {
    const p = msg.proposal;
    inner +=
      '<div class="d-proposal"><h4>' +
      esc(p.title) +
      '</h4><p>' +
      esc(p.body) +
      '</p>' +
      (p.status === 'pending'
        ? '<div class="row"><button class="btn btn-sm btn-primary" type="button" data-prop="ok">OK · 자동 붙이기</button><button class="btn btn-sm btn-ghost" type="button" data-prop="pass">패스</button></div>'
        : '<div class="done">' + (p.status === 'ok' ? '✓ 팀에 반영되었습니다.' : '· 기록되었습니다.') + '</div>') +
      '</div>';
  }
  inner += '</div>';
  return (
    '<div class="d-msg' +
    (isChief ? ' chief' : '') +
    '"><div class="av">' +
    esc(msg.emoji || (isChief ? '🧠' : '🤖')) +
    '</div><div class="d-body"><div class="d-author"><b>' +
    esc(msg.name || '봇') +
    '</b>' +
    (isChief ? '<span class="pill blue" style="font-size:9.5px;padding:1px 7px">' + esc(LN('demo.chiefBadge', '총괄')) + '</span>' : '') +
    '<span class="d-time">' +
    (msg.time || nowLabel()) +
    '</span></div>' +
    inner +
    '</div></div>'
  );
}

function renderMessages(forceScroll) {
  renderOffice();
  const box = $('#demoMessages');
  if (!box) return;
  const list = state.messages[state.activeChannelId] || [];
  let html = list.map(messageHtml).join('');
  if (state.typingBotId) {
    const bot = state.bots.find((b) => b.id === state.typingBotId);
    html +=
      '<div class="d-msg" data-testid="demo-typing"><div class="av">' +
      esc((bot && bot.emoji) || '🤖') +
      '</div><div class="d-body"><div class="d-author"><b>' +
      esc((bot && bot.name) || '봇') +
      '</b></div><div class="d-bubble"><span class="d-typing"><i></i><i></i><i></i></span></div></div></div>';
  }
  box.innerHTML = html;
  box.setAttribute('data-busy', state.typingBotId ? '1' : '0');
  if (forceScroll || state.typingBotId) box.scrollTop = box.scrollHeight;
}

function renderAll(forceScroll) {
  applyAdminMode();
  renderOffice();
  renderEnv();
  renderChannels();
  renderBots();
  renderInspector();
  renderRelease();
  renderHeader();
  renderMessages(forceScroll !== false);
}

/* ───────────────────────── 목적 분석 · 컨설팅 ───────────────────────── */
function analyzePurpose(text) {
  const t = String(text || '');
  const rules = [
    { id: 'b2b', re: /(제안서|영업|거래처|고객사|계약|견적|미팅|정산|매출|proposal|sales|client|quote|invoice|settlement|提案|営業|見積|請求|精算|提案书|销售|客户|报价|结算)/i, agents: ['proposal', 'billing', 'followup'], channel: '영업-오케스트라', why: '영업은 한 건을 끝까지 끌고 가는 일입니다. 제안·정산·팔로업을 나눠 들면 대표는 미팅과 결정에만 집중할 수 있습니다.' },
    { id: 'content', re: /(인스타|스레드|릴스|콘텐츠|SNS|팔로워|카드뉴스|블로그|instagram|threads|reels|content|followers|blog|内容|粉丝|帖|インスタ|コンテンツ|フォロワー|投稿|ブログ)/i, agents: ['content', 'copy', 'analysis'], channel: '콘텐츠-오케스트라', why: '콘텐츠는 기획·카피·분석이 돌아가야 끊기지 않습니다. 세 에이전트가 주간 리듬을 만들고 총괄이 결과만 보고합니다.' },
    { id: 'build', re: /(앱|서비스|개발|자동화|스크립트|코드|MVP|출시|app|service|develop|automation|script|code|launch|アプリ|開発|自動化|スクリプト|コード|应用|开发|自动化|上线|小程序)/i, agents: ['planning', 'build', 'qa', 'ops'], channel: '빌드-오케스트라', why: '만드는 일은 범위·구현·검증이 붙어야 끝납니다. 총괄이 순서를 잡고 각 에이전트가 자기 산출물만 냅니다.' },
    { id: 'plan', re: /(기획|일정|회의|보고|리포트|정리|plan|schedule|meeting|report|会議|議事録|スケジュール|企画|計画|レポート|会议|计划|报告|整理)/i, agents: ['planning', 'research', 'analysis'], channel: '기획-오케스트라', why: '기획은 흩어진 요청을 문서와 일정으로 바꾸는 일입니다. 정리·근거·리포트를 나눠 맡깁니다.' },
  ];
  let hit = rules.find((r) => r.re.test(t));
  if (!hit) {
    hit = { id: 'general', agents: ['planning', 'research', 'ops'], channel: '총괄-오케스트라', why: '목적이 아직 넓습니다. 먼저 범위를 정리하고, 근거를 확인한 뒤, 반복 업무를 자동화 후보로 바꾸는 3단 구성이 안전합니다.' };
  }
  const agents = hit.agents
    .slice(0, 3)
    .map((k) => {
      const a = AGENT_LIB[k];
      if (!a) return null;
      const d = DICT();
      const loc = d && d.agents && d.agents[k];
      return Object.assign({ key: k }, a, loc || {});
    })
    .filter(Boolean);
  const chMap = (DICT() && DICT().channels) || {};
  return {
    id: hit.id,
    goal: t.trim().slice(0, 300),
    why: (RULE_WHY[LANG] && RULE_WHY[LANG][hit.id]) || hit.why,
    channel: chMap[hit.channel] || hit.channel,
    agents,
    steps: ['목적 접수·범위 확정', '하위 에이전트 3종에 위임', '산출물 취합·최종 보고'],
    chief: CHIEF,
  };
}

const RULE_WHY = {
  en: {
    b2b: 'Sales is won by carrying one deal to the end. Proposal, settlement and follow-up sit with separate agents, so the owner can focus on meetings and decisions.',
    content: 'Content only keeps going when planning, copy and analysis all turn. Three agents build the weekly rhythm and the chief reports the result.',
    build: 'Building needs scope, implementation and checks together. The chief sets the order and each agent delivers only its own piece.',
    plan: 'Planning turns scattered requests into documents and schedules. Tidying, evidence and reporting are split across agents.',
    general: 'The goal is still broad. Scope it, check the evidence, then turn repetition into automation candidates — in that order.'
  },
  zh: {
    b2b: '销售拼的是把一个单子跟到底。提案、结算、跟进分别交给不同机器人，负责人只管见客户和拍板。',
    content: '内容要策划、文案、分析一起转才不断更。三个机器人搭每周节奏，总管只汇报结果。',
    build: '做产品要范围、实现、验证三件事一起。总管排顺序，每个机器人只交自己的产出。',
    plan: '策划是把零散的请求变成文档和日程。整理、依据、汇报分开交给机器人。',
    general: '目标还比较宽。先定范围，再核对依据，最后把重复工作变成自动化候选，这个顺序最稳。'
  },
  ja: {
    b2b: '営業は1件を最後まで運ぶ力が勝負です。提案・精算・フォローを別々のエージェントに任せ、担当者は商談と判断に集中できます。',
    content: 'コンテンツは企画・コピー・分析が回って初めて続きます。3体が週次のリズムを作り、統括が結果だけを報告します。',
    build: '作る仕事は範囲・実装・検証が揃って初めて終わります。統括が順番を決め、各エージェントは自分の成果だけを出します。',
    plan: '企画は散らばった依頼を文書と日程に変える仕事です。整理・根拠・レポートを分けて任せます。',
    general: '目的がまだ広い状態です。まず範囲を決め、根拠を確認し、繰り返し業務を自動化候補に変える順が安全です。'
  }
};

function planFromRole(role) {
  const c = CONSULT.find((r) => r.id === role);
  if (!c) return null;
  const d = DICT();
  const loc = d && d.consult && d.consult[role];
  const src = (loc && loc.agents) || c.agents;
  const agents = c.agents.map((a, i) => Object.assign({}, a, src[i] || {}));
  return {
    id: c.id,
    goal: (loc && loc.tagline) || c.tagline,
    why: (loc && loc.why) || c.why,
    channel: ((d && d.channels) || {})[c.channel] || c.channel,
    agents: agents.slice(0, 3),
    allAgents: agents,
    steps: ['목적 접수·범위 확정', '역할별 에이전트에 위임', '산출물 취합·최종 보고'],
    chief: CHIEF,
  };
}

function renderRoles() {
  const box = $('#roleCards');
  if (!box) return;
  const d = DICT();
  box.innerHTML = CONSULT.map(
    (r) =>
      '<button type="button" class="d-role' +
      (wizardRole === r.id ? ' is-active' : '') +
      '" data-role="' +
      esc(r.id) +
      '"><span class="em">' +
      esc(r.emoji) +
      '</span><b>' +
      esc((d && d.consult && d.consult[r.id] && d.consult[r.id].label) || r.label) +
      '</b><span>' +
      esc((d && d.consult && d.consult[r.id] && d.consult[r.id].tagline) || r.tagline) +
      '</span></button>'
  ).join('');
}

function renderDesign() {
  const box = $('#designCard');
  if (!box) return;
  if (!wizardPlan) {
    box.innerHTML = '';
    return;
  }
  const p = wizardPlan;
  const agents = p.agents || [];
  box.innerHTML =
    '<div class="d-design"><h4>' +
    esc(u('designTitle', agents.length) || ('🧠 MOA Chief + 에이전트 ' + agents.length + '명 설계안')) +
    '</h4>' +
    '<p><b>' + esc(u('purpose') || '목적') + '</b> · ' +
    esc(p.goal || '—') +
    '</p>' +
    '<div class="agents">' +
    agents
      .map(
        (a) =>
          '<div class="agent"><span>' +
          esc(a.emoji) +
          '</span><span class="nm">' +
          esc(a.name) +
          '</span><span class="tk">' +
          esc(a.task || '') +
          '</span></div>'
      )
      .join('') +
    '</div>' +
    '<div class="flow">' +
    ((LANG !== 'ko' && u('briefSteps')) || p.steps || [])
      .map((s) => '<span>' + esc(s) + '</span>')
      .join('<span>→</span>') +
    '<span>#' +
    esc(p.channel) +
    '</span></div>' +
    '<div class="why">💡 ' +
    esc(p.why || '') +
    '</div>' +
    '<div class="d-sheet-actions"><button class="btn btn-primary btn-sm" id="applyDesignBtn" type="button">' +
    esc(u('apply') || '이 팀을 STG에 만들기') +
    '</button><button class="btn btn-ghost btn-sm" id="redoDesign" type="button">' +
    esc(u('redo') || '다시 설계') +
    '</button></div></div>';
}

function openWizard() {
  wizardRole = null;
  wizardPlan = null;
  renderRoles();
  renderDesign();
  const sheet = $('#wizardSheet');
  if (sheet) sheet.hidden = false;
  const p = $('#purposeInput');
  if (p) {
    p.value = '';
    setTimeout(() => p.focus(), 80);
  }
}

function closeWizard() {
  const sheet = $('#wizardSheet');
  if (sheet) sheet.hidden = true;
}

function designTeam() {
  const text = ($('#purposeInput') && $('#purposeInput').value.trim()) || '';
  if (text) {
    wizardPlan = analyzePurpose(text);
  } else if (wizardRole) {
    wizardPlan = planFromRole(wizardRole);
  } else {
    toast(LN('toasts.needDesign', '업종을 고르거나, 하고 싶은 일을 한 줄 적어 주세요.'));
    return;
  }
  renderDesign();
  const card = $('#designCard');
  if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function applyPlan() {
  if (!wizardPlan) return;
  const plan = wizardPlan;
  let chief = state.bots.find((b) => b.isChief);
  if (!chief) {
    chief = makeBot(Object.assign({ id: uid('bot') }, CHIEF));
    chief.isChief = true;
    chief.tasks = ROLE_TASKS.chief;
    state.bots.push(chief);
  }
  const agents = [];
  (plan.agents || []).forEach((a) => {
    let bot = state.bots.find((b) => b.name === a.name);
    if (!bot) {
      bot = makeBot({
        id: uid('bot'),
        name: a.name,
        emoji: a.emoji,
        role: a.role,
        summary: a.summary || a.persona || a.task || '',
        keywords: a.keywords,
      });
      bot.activity = LANG === 'ko' ? [a.summary || '초기 산출물 준비 완료'] : [];
      state.bots.push(bot);
    }
    agents.push(bot);
  });
  const channel = {
    id: uid('ch'),
    name: plan.channel || '총괄-오케스트라',
    mode: 'mention',
    botId: chief.id,
    topic: (LANG === 'ko' ? '총괄 오케스트레이터 1:1 — ' : '') + (plan.goal || '팀 목표'),
    members: [chief.id].concat(agents.map((a) => a.id)),
    orchestrator: true,
  };
  state.channels.push(channel);
  const goal = plan.goal || LN('orch.goalFallback', '팀 목표');
  state.messages[channel.id] = [
    {
      id: uid('msg'),
      kind: 'system',
      name: 'MOA Hive',
      text: fmt(LN('orch.designCreated', '**총괄 오케스트레이터 팀을 만들었습니다** — 🧠 MOA Chief + 에이전트 {n}명\n\n목적: {goal}\n\n{why}'), { n: agents.length, goal, why: plan.why || '' }),
    },
    {
      id: uid('msg'),
      kind: 'bot',
      botId: chief.id,
      name: chief.name,
      emoji: chief.emoji,
      role: 'chief',
      text: fmt(LN('orch.designReady', '준비됐습니다. 아래 에이전트에게 일을 나눠 맡기고, 제가 결과만 취합해 보고합니다.\n\n- {agents}\n\n하고 싶은 일을 그대로 말해 주세요. 예: “{goal}”'), {
        agents: agents.map((a) => a.emoji + ' ' + a.name).join('\n- '),
        goal,
      }),
    },
  ];
  state.activeChannelId = channel.id;
  state.activeBotId = chief.id;
  state.dirty = true;
  wizardPlan = null;
  closeWizard();
  renderAll(true);
  toast(fmt(LN('toasts.teamCreated', 'STG에 팀을 만들었습니다 — #{channel}'), { channel: channelLabel(channel) }));
}

/* ───────────────────────── 활용 케이스 갤러리 ───────────────────────── */
function caseInfo(c) {
  const d = DICT();
  const l = d && d.cases && d.cases[c.id];
  return {
    label: (l && l.label) || c.label,
    tagline: (l && l.tagline) || c.tagline,
    channel: (l && l.channel) || c.channel,
    names: (l && l.names) || c.bots.map((b) => b.name),
    starter: (l && l.starter) || c.starter,
    examples: (l && l.examples) || null,
  };
}

function renderCaseGallery() {
  const box = $('#caseGallery');
  if (!box) return;
  box.innerHTML = CASES.map((c) => {
    const info = caseInfo(c);
    const names = c.bots.map((b, i) => b.emoji + ' ' + (info.names[i] || b.name)).join(' · ');
    const pool = info.examples
      ? info.examples.map((e) => e.text)
      : [((c.example || []).find((e) => e.from !== 'user') || {}).text];
    const sample = pool.find((t) => t && !String(t).trim().startsWith('**')) || pool[0];
    let q = sample ? String(sample).replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim() : '';
    if (q.length > 72) {
      q = q.slice(0, 72);
      const cut = q.lastIndexOf(' ');
      if (cut > 40) q = q.slice(0, cut);
      q += '…';
    }
    return '<article class="case-tile" data-case-id="' + esc(c.id) + '" data-testid="case-tile">' +
      '<div class="ct-top"><span class="ct-emoji">' + esc(c.emoji) + '</span><div><b>' + esc(info.label) + '</b><span>' + esc(info.tagline) + '</span></div></div>' +
      '<div class="ct-bots">' + esc(names) + '</div>' +
      (q ? '<div class="ct-quote">“' + esc(q) + '”</div>' : '') +
      '<div class="ct-actions">' +
      '<button class="btn btn-sm btn-primary" type="button" data-apply-case="' + esc(c.id) + '">' + esc(u('applyCase') || '이 케이스 바로 적용') + '</button>' +
      '<button class="btn btn-sm btn-ghost" type="button" data-pack-case="' + esc(c.id) + '">' + esc(u('packBtn') || '🎁 세팅 팩') + '</button>' +
      '</div>' +
      '</article>';
  }).join('');
}

function applyCase(id) {
  const c = CASES.find((x) => x.id === id);
  if (!c) return;
  const info = caseInfo(c);
  const localized = LANG !== 'ko';
  const bots = c.bots.map((spec, i) => {
    const name = info.names[i] || spec.name;
    let bot = state.bots.find((b) => b.name === name);
    if (bot) return bot;
    bot = makeBot({
      id: uid('bot'),
      name,
      emoji: spec.emoji,
      role: spec.role,
      isChief: spec.isChief,
      summary: localized ? ((u('roleSummary') || {})[spec.role] || spec.summary) : spec.summary,
      tasks: localized ? undefined : spec.tasks,
    });
    state.bots.push(bot);
    return bot;
  });
  let ch = state.channels.find((x) => x.name === c.channel);
  if (!ch) {
    ch = { id: uid('ch'), name: c.channel, mode: 'auto', topic: info.tagline, members: [], orchestrator: bots.some((b) => b.isChief) };
    state.channels.push(ch);
    state.messages[ch.id] = [];
  }
  ch.members = Array.from(new Set([].concat(ch.members || [], bots.map((b) => b.id))));
  pushMessage(ch.id, {
    kind: 'system',
    name: 'MOA Hive',
    text: fmt(LN('orch.caseCreated', '**{label}** 케이스를 세팅했습니다 — 봇 {n}명 · #{channel}. 아래 예시 대화를 그대로 이어서 써 보세요.'), { label: info.label, n: bots.length, channel: info.channel }),
  });
  pushMessage(ch.id, {
    kind: 'bot',
    botId: bots[0].id,
    name: bots[0].name,
    emoji: bots[0].emoji,
    role: bots[0].role,
    text: info.starter + LN('orch.caseStarterNote', '\n\n_추천 업무는 오른쪽 역할 카드에서 바로 누를 수 있습니다._'),
  });
  if (info.examples) {
    info.examples.forEach((ex) => {
      const b = bots[ex.bot] || bots[0];
      pushMessage(ch.id, { kind: 'bot', botId: b.id, name: b.name, emoji: b.emoji, role: b.role, text: ex.text });
    });
  } else {
    (c.example || []).forEach((ex) => {
      if (ex.from === 'user') {
        pushMessage(ch.id, { kind: 'user', name: '나', text: ex.text });
      } else {
        const b = bots.find((x) => x.name === ex.from);
        if (b) pushMessage(ch.id, { kind: 'bot', botId: b.id, name: b.name, emoji: b.emoji, role: b.role, text: ex.text });
      }
    });
  }
  state.env = 'stg';
  state.dirty = true;
  state.activeChannelId = ch.id;
  state.activeBotId = (bots.find((b) => b.isChief) || bots[0]).id;
  state.officeBusy = null;
  state.typingBotId = null;
  closeWizard();
  renderAll(true);
  const demo = $('#demo');
  if (demo) demo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast(fmt(LN('toasts.caseApplied', '{label} 팀을 세팅했습니다 — #{channel}'), { label: info.label, channel: info.channel }));
}

/* ───────────────────────── 채팅 · 오케스트레이션 ───────────────────────── */
function pushMessage(channelId, msg) {
  if (!state.messages[channelId]) state.messages[channelId] = [];
  const m = Object.assign({ id: uid('msg'), time: nowLabel() }, msg);
  state.messages[channelId].push(m);
  return m;
}

function pickReply(bot, text) {
  const role = bot.role || 'pm';
  const topic = text.length > 60 ? text.slice(0, 60) + '…' : text;
  if (LANG !== 'ko') {
    const key = ['dev', 'content', 'research', 'chief', 'pm'].indexOf(role) >= 0 ? role : 'pm';
    return fmt(LN('replies.' + key, ''), { topic, name: bot.name });
  }
  const head = '**결론** — ' + topic + ' 요청을 ' + bot.name + ' 기준으로 정리했습니다.';
  if (role === 'dev') {
    return (
      head +
      '\n\n1. 재현·범위 확인 — 영향 파일 2개, 실패 지점 1곳\n2. 수정 — `server.js` 라우팅, `public/app.js` 렌더\n3. 검증 — API 테스트 → UI 테스트 → 수동 확인\n\n**실행 명령**\n\n```\nnode tests/reset_state.js && node server.js\npython3 tests/api_test.py\n```\n\n**확인 필요** — 운영 데이터에 닿는 변경인지 먼저 알려주세요. 위험한 명령은 승인 카드를 거칩니다.\n\n_로컬 시뮬레이터 응답입니다 · 데스크톱 앱에서 CLI/API를 연결하면 실제 모델이 답합니다._'
    );
  }
  if (role === 'content') {
    return (
      head +
      '\n\n**다음 주 7편 (요일 · 주제)**\n- 월 · 매일 쓰는 물건 하나를 바꾼 이야기\n- 화 · 5분 루틴이 만든 차이\n- 수 · 실패한 자동화 3가지\n- 목 · 돈 안 드는 생산성 도구\n- 금 · 이번 주 배운 것\n- 토 · 독자 질문 답변\n- 일 · 다음 주 예고\n\n**첫 3초 훅 2안**\n> “이거 하나 바꿨더니 아침이 30분 남았습니다.”\n> “매일 하던 이 일, 사실 안 해도 됩니다.”\n\n**해시태그** `#생활자동화 #1인사업 #AI툴 #루틴`\n\n_로컬 시뮬레이터 응답입니다 · 데스크톱 앱에서 CLI/API를 연결하면 실제 모델이 답합니다._'
    );
  }
  if (role === 'research') {
    return (
      head +
      '\n\n**확인된 것**\n- 공개 페이지 기준 경쟁 3곳의 가격대\n- 최근 공지 2건의 변경점\n\n**추정**\n- 전환율 차이는 채널 구성 때문일 가능성이 큼 (근거 약함)\n\n**확인 필요**\n- 최신 공시·공개 자료 원문 1건 — 링크 필요\n\n_로컬 시뮬레이터 응답입니다 · 데스크톱 앱에서 CLI/API를 연결하면 실제 모델이 답합니다._'
    );
  }
  if (role === 'chief') {
    return head + '\n\n하위 에이전트 산출물을 취합해 다음 액션 1건을 제안합니다.';
  }
  return (
    head +
    '\n\n**범위**\n- 문제: ' + topic + '\n- 목표: 이번 주 안에 검토 가능한 초안\n- 제외: 운영 데이터 변경\n\n**3일 일정**\n1. 오늘 — 요구사항·리스크 정리\n2. 내일 — 초안 작성, 이해관계자 리뷰\n3. 모레 — 반영·체크리스트 확인\n\n**다음 액션** — 결정이 필요한 1건만 골라 주세요. 나머지는 제가 초안으로 붙여 둡니다.\n\n_로컬 시뮬레이터 응답입니다 · 데스크톱 앱에서 CLI/API를 연결하면 실제 모델이 답합니다._'
  );
}

function routeBot(channel, text) {
  const members = channelMembers(channel);
  if (!members.length) return null;
  const mention = members.find((b) => text.includes('@' + b.name));
  if (mention) return mention;
  if (channel.mode === 'mention' && channel.botId) {
    const fixed = members.find((b) => b.id === channel.botId);
    if (fixed) return fixed;
  }
  const chief = members.find((b) => b.isChief);
  if (chief) return chief;
  const candidates = members.filter((b) => !b.isChief);
  let best = candidates[0] || members[0];
  let bestScore = 0;
  candidates.forEach((b) => {
    const score = (b.keywords || []).reduce((acc, k) => (text.toLowerCase().includes(String(k).toLowerCase()) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  });
  return best;
}

function shouldOrchestrate(channel) {
  return !!(channel && channel.orchestrator && state.bots.some((b) => b.isChief));
}

async function respond(channel, text) {
  const run = state.runId;
  const chief = state.bots.find((b) => b.isChief);
  if (shouldOrchestrate(channel)) {
    await chiefRespond(channel, chief, text, run);
    return;
  }
  const bot = routeBot(channel, text);
  if (!bot) return;
  if (bot.isChief) {
    await chiefRespond(channel, bot, text, run);
    return;
  }
  state.activeBotId = bot.id;
  state.typingBotId = bot.id;
  renderBots();
  renderInspector();
  renderMessages(true);
  await sleep(620);
  if (run !== state.runId) return;
  state.typingBotId = null;
  pushMessage(channel.id, {
    kind: 'bot',
    botId: bot.id,
    name: bot.name,
    emoji: bot.emoji,
    role: bot.role,
    text: pickReply(bot, text),
  });
  bot.activity = [text.length > 34 ? text.slice(0, 34) + '…' : text].concat(bot.activity || []).slice(0, 4);
  renderBots();
  renderInspector();
  renderMessages(true);
}

async function chiefRespond(channel, chief, text, run) {
  const agents = channelMembers(channel).filter((b) => !b.isChief).slice(0, 3);
  const steps = agents.map((a, i) => {
    const meta = Object.values(AGENT_LIB).find((x) => x.name === a.name) || CONSULT.flatMap((c) => c.agents).find((x) => x.name === a.name);
    return {
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      task: (meta && meta.task) || (botTasks(a)[0] || a.name),
      summary: (meta && meta.summary) || '',
      status: i === 0 ? 'working' : '',
    };
  });
  state.activeBotId = chief.id;
  state.officeBusy = { chief: true, agent: steps[0] ? steps[0].id : null };
  const msg = pushMessage(channel.id, {
    kind: 'bot',
    botId: chief.id,
    name: chief.name,
    emoji: chief.emoji,
    role: 'chief',
    text: fmt(LN('orch.report', '**총괄 보고** · 🧠 {chief}\n\n목표: {goal}\n\n위임 {n}건을 진행합니다.'), {
      chief: chief.name,
      goal: text.length > 80 ? text.slice(0, 80) + '…' : text,
      n: steps.length,
    }),
    steps,
    busy: true,
  });
  renderMessages(true);

  for (let i = 0; i < steps.length; i++) {
    if (i > 0) {
      steps[i].status = 'working';
      state.officeBusy = { chief: true, agent: steps[i].id };
      renderMessages(false);
    }
    await sleep(460);
    if (run !== state.runId) return;
    steps[i].status = 'done';
    if (i + 1 < steps.length) steps[i + 1].status = 'working';
    renderMessages(false);
  }
  await sleep(320);
  if (run !== state.runId) return;

  state.officeBusy = null;
  msg.busy = false;
  const topic40 = text.length > 40 ? text.slice(0, 40) + '…' : text;
  msg.summary =
    LN('orch.summaryHeader', '**취합 결과**') + '\n' +
    '- ' + fmt(LN('orch.summaryScope', '범위: “{topic}” 요청을 {n}개 산출물로 분해'), { topic: topic40, n: steps.length }) + '\n' +
    '- ' + (steps[0]
      ? fmt(LN('orch.summaryNext', '다음 액션: {agent}의 초안을 확인하고, 결정이 필요한 1건만 골라 주세요'), { agent: steps[0].name })
      : LN('orch.summaryNextEmpty', '할 일을 하나 정해 주세요')) + '\n' +
    '- ' + LN('orch.summaryCheck', '확인 필요: 실제 수치·고객사 정보는 아직 검증 전입니다(로컬 규칙 기반 취합)') + '\n\n' +
    LN('orch.summaryFoot', '_하위 에이전트 산출물을 취합한 요약입니다 · 총괄 모드_');

  if (!state.proposal && channel.id === state.activeChannelId) {
    const reportName = LANG === 'ko' ? '주간 리포트 봇' : (u('reportBot') || 'Weekly report bot');
    const hasReport = state.bots.some((b) => b.name === reportName || /리포트|report|报表|レポート/i.test(b.name));
    const proposal = hasReport
      ? {
          kind: 'rule',
          title: LN('orch.proposalRuleTitle', '읽기 전용 명령 자동 승인 규칙을 추가할까요?'),
          body: LN('orch.proposalRuleBody', 'ls · cat · wc · pwd 같은 읽기 전용 명령은 승인 카드 없이 바로 실행됩니다. 쓰기·위험 명령은 그대로 승인 카드를 거칩니다.'),
        }
      : {
          kind: 'bot',
          bot: reportName,
          title: LN('orch.proposalBotTitle', '주간 리포트 요약 봇을 팀에 붙일까요?'),
          body: LN('orch.proposalBotBody', '매주 금요일 지표·진행률을 한 장으로 정리해 총괄에게 보고하는 에이전트입니다.'),
        };
    msg.proposal = Object.assign({ status: 'pending' }, proposal);
    state.proposal = msg.proposal;
  }
  renderMessages(true);
}

function sendMessage(text) {
  if (isProd()) {
    toast(LN('orch.readOnly', 'PROD는 읽기 전용입니다 — STG에서 변경하고 Release Manager로 승격하세요.'));
    return;
  }
  const t = String(text || '').trim();
  if (!t) return;
  const channel = currentChannel();
  if (!channel) return;
  pushMessage(channel.id, { kind: 'user', name: LANG === 'ko' ? '나' : 'You', text: t });
  state.dirty = true;
  renderMessages(true);
  respond(channel, t);
}

function handleProposal(action, btn) {
  if (!state.proposal) return;
  const reportName = LANG === 'ko' ? '주간 리포트 봇' : (u('reportBot') || 'Weekly report bot');
  state.proposal.status = action === 'ok' ? 'ok' : 'pass';
  if (action === 'ok' && state.proposal.kind === 'rule') {
    pushMessage(state.activeChannelId, {
      kind: 'system',
      name: 'MOA Hive',
      text: LN('orch.ruleApplied', '✓ **읽기 전용 명령 자동 승인 규칙**을 추가했습니다 — `ls` · `cat` · `wc` · `pwd`. 쓰기·위험 명령은 그대로 승인 카드를 거칩니다.'),
    });
    toast(LN('toasts.ruleAdded', '읽기 전용 명령 자동 승인 규칙을 추가했습니다.'));
  } else if (action === 'ok') {
    const name = state.proposal.bot || reportName;
    if (!state.bots.some((b) => b.name === name)) {
      const bot = makeBot({
        id: uid('bot'),
        name,
        emoji: '📊',
        role: 'research',
        summary: LANG === 'ko' ? '주간 지표와 진행률을 한 장 리포트로 정리합니다. 숫자에는 기준일과 출처를 붙입니다.' : ((u('roleSummary') || {}).research || ''),
        activity: LANG === 'ko' ? ['주간 리포트 초안 생성'] : [],
      });
      state.bots.push(bot);
      const ch = currentChannel();
      if (ch && !ch.members.includes(bot.id)) ch.members.push(bot.id);
    }
    pushMessage(state.activeChannelId, {
      kind: 'system',
      name: 'MOA Hive',
      text: fmt(LN('orch.botApplied', '✓ **{name}**을(를) STG 팀에 반영했습니다. 이제 #{channel}에서 호출할 수 있습니다.'), {
        name,
        channel: channelLabel(currentChannel()),
      }),
    });
    toast(fmt(LN('toasts.botAdded', '{name}을(를) 팀에 붙였습니다.'), { name }));
  } else {
    pushMessage(state.activeChannelId, { kind: 'system', name: 'MOA Hive', text: LN('orch.proposalPassed', '· 제안을 패스했습니다. 기록만 남습니다.') });
  }
  if (btn && btn.closest) {
    const wrap = btn.closest('.d-proposal');
    if (wrap) wrap.innerHTML = '<div class="done">' + (action === 'ok' ? LN('orch.proposalDone', '✓ 팀에 반영되었습니다.') : LN('orch.proposalPassed', '· 기록되었습니다.')) + '</div>';
  }
  state.dirty = true;
  renderAll(true);
}

/* ───────────────────────── 이벤트 연결 ───────────────────────── */
function bindDemo() {
  const app = $('#demoApp');
  if (!app) return;

  $$('#envStg, #envProd').forEach((b) => {
    b.addEventListener('click', () => {
      const env = b.getAttribute('data-env');
      if (state.env === env) return;
      state.env = env;
      state.typingBotId = null;
      state.runId += 1;
      if (env === 'prod') {
        state.activeChannelId = state.channels[0].id;
        state.activeBotId = state.bots[0].id;
      }
      renderAll(true);
    });
  });

  app.addEventListener('click', (e) => {
    const chBtn = e.target.closest('[data-channel]');
    if (chBtn) {
      state.activeChannelId = chBtn.getAttribute('data-channel');
      state.runId += 1;
      state.typingBotId = null;
      renderAll(true);
      return;
    }
    const botBtn = e.target.closest('[data-bot]');
    if (botBtn) {
      state.activeBotId = botBtn.getAttribute('data-bot');
      const tab = $('#tabContext');
      if (tab) tab.click();
      renderAll(false);
      return;
    }
    const taskBtn = e.target.closest('[data-task]');
    if (taskBtn) {
      const bot = currentBot();
      if (!bot) return;
      if (isProd()) {
        toast(LN('orch.readOnly', 'PROD는 읽기 전용입니다.'));
        return;
      }
      const task = taskBtn.getAttribute('data-task');
      sendMessage('@' + bot.name + ' ' + task);
      return;
    }
    const officeBtn = e.target.closest('[data-office-bot]');
    if (officeBtn) {
      state.activeBotId = officeBtn.getAttribute('data-office-bot');
      const ctx = $('#tabContext');
      if (ctx) ctx.click();
      renderAll(false);
      return;
    }
    const propBtn = e.target.closest('[data-prop]');
    if (propBtn) {
      handleProposal(propBtn.getAttribute('data-prop'), propBtn);
      return;
    }
  });

  $$('#tabContext, #tabRelease').forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.getAttribute('data-pane');
      $$('#tabContext, #tabRelease').forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const ctx = $('#contextPane');
      const rel = $('#releasePane');
      if (ctx) ctx.hidden = key !== 'context';
      if (rel) rel.hidden = key !== 'release';
    });
  });

  const jump = $('#releaseJump');
  if (jump) {
    jump.addEventListener('click', () => {
      const tab = $('#tabRelease');
      if (tab) tab.click();
      const right = $('.d-right');
      if (right && right.scrollIntoView) right.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  const input = $('#demoInput');
  const send = () => {
    if (!input) return;
    const v = input.value;
    input.value = '';
    input.style.height = 'auto';
    sendMessage(v);
  };
  if (input) {
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(110, input.scrollHeight) + 'px';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }
  const sendBtn = $('#demoSend');
  if (sendBtn) sendBtn.addEventListener('click', send);

  const ack = $('#promoteAck');
  if (ack) {
    ack.addEventListener('change', () => {
      const btn = $('#promoteBtn');
      if (btn) btn.disabled = state.promoted || !ack.checked;
    });
  }
  const promote = $('#promoteBtn');
  if (promote) {
    promote.addEventListener('click', () => {
      if (state.promoted) return;
      if (!($('#promoteAck') && $('#promoteAck').checked)) return;
      state.promoted = true;
      state.prodVersion = '0.3.0';
      state.stgVersion = '0.3.0';
      state.history.unshift({
        version: '0.3.0',
        env: 'prod',
        title: ($('#relNote') && $('#relNote').value.trim()) || '오케스트레이터 · 웹 데모 반영',
        at: '2026-11-19',
      });
      const note = $('#relNote');
      if (note) note.value = '';
      pushMessage(state.activeChannelId, {
        kind: 'system',
        name: 'MOA Hive',
        text: '🚀 **PROD v0.3.0 반영 완료** — STG의 봇·채널·설정이 운영 버전으로 승격되었습니다. PROD는 다시 읽기 전용입니다.',
      });
      renderAll(true);
      toast(LN('toasts.promoted', 'PROD v0.3.0 반영 완료 — 버전 히스토리에 기록했습니다.'));
    });
  }

  const wizardBtn = $('#wizardBtn');
  if (wizardBtn) wizardBtn.addEventListener('click', openWizard);
  const close = $('#closeWizard');
  if (close) close.addEventListener('click', closeWizard);
  const sheet = $('#wizardSheet');
  if (sheet) {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) closeWizard();
    });
  }
  const roles = $('#roleCards');
  if (roles) {
    roles.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-role]');
      if (!btn) return;
      wizardRole = btn.getAttribute('data-role');
      wizardPlan = null;
      renderRoles();
      renderDesign();
    });
  }
  const design = $('#designBtn');
  if (design) design.addEventListener('click', designTeam);
  const clear = $('#clearDesign');
  if (clear) {
    clear.addEventListener('click', () => {
      wizardRole = null;
      wizardPlan = null;
      const p = $('#purposeInput');
      if (p) p.value = '';
      renderRoles();
      renderDesign();
    });
  }
  const designCard = $('#designCard');
  if (designCard) {
    designCard.addEventListener('click', (e) => {
      if (e.target.closest('#applyDesignBtn')) applyPlan();
      if (e.target.closest('#redoDesign')) {
        wizardPlan = null;
        renderDesign();
      }
    });
  }

  const gallery = $('#caseGallery');
  if (gallery) {
    gallery.addEventListener('click', (e) => {
      const packBtn = e.target.closest('[data-pack-case]');
      if (packBtn) {
        const c = CASES.find((x) => x.id === packBtn.getAttribute('data-pack-case'));
        if (c) {
          const info = caseInfo(c);
          openPack({ name: info.label, bots: c.bots.map((b, i) => ({ emoji: b.emoji, name: info.names[i] || b.name })) });
        }
        return;
      }
      const btn = e.target.closest('[data-apply-case]');
      const tile = e.target.closest('[data-case-id]');
      if (btn) applyCase(btn.getAttribute('data-apply-case'));
      else if (tile) applyCase(tile.getAttribute('data-case-id'));
    });
  }

  /* 세팅 팩 퍼널 — 업종 카드 · 가상 오피스 · 봇 인스펙터 */
  const packTriggers = ['#inspPackBtn', '#officePackBtn', '#demoPackLink'];
  packTriggers.forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('click', (e) => {
      if (sel === '#demoPackLink') return; /* 앵커는 #pack 섹로 이동 */
      e.preventDefault();
      const ch = currentChannel();
      const members = channelMembers(ch);
      const bots = (members.length ? members : state.bots).map((b) => ({ emoji: b.emoji, name: b.name }));
      openPack({ name: ch ? '#' + channelLabel(ch) : '', bots });
    });
  });
  const closePackBtn = $('#closePack');
  if (closePackBtn) closePackBtn.addEventListener('click', closePack);
  const packSheet = $('#packSheet');
  if (packSheet) {
    packSheet.addEventListener('click', (e) => { if (e.target === packSheet) closePack(); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && packSheet && !packSheet.hidden) closePack();
  });

  /* 언어 선택기 */
  $$('.lang-switch [data-lang]').forEach((b) => {
    b.addEventListener('click', () => setLang(b.getAttribute('data-lang')));
  });
  const adminBtn = $('#adminToggle');
  if (adminBtn) adminBtn.addEventListener('click', () => setAdmin(!adminMode));
  const reset = $('#resetDemo');
  if (reset) {
    reset.addEventListener('click', () => {
      state = seedState();
      wizardPlan = null;
      wizardRole = null;
      closeWizard();
      renderAll(true);
      toast(LN('toasts.reset', '데모를 초기 상태로 되돌렸습니다.'));
    });
  }

  setupVoice($('#demoMic'), $('#demoInput'));
  setupVoice($('#purposeMic'), $('#purposeInput'));

  $$('[data-open-demo]').forEach((b) =>
    b.addEventListener('click', () => {
      const target = $('#demo');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    })
  );
}

function setupVoice(btn, target) {
  if (!btn || !target) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    btn.addEventListener('click', () => toast(LN('toasts.voiceUnsupported', '이 브라우저는 음성 입력을 지원하지 않습니다 — Chrome·Edge·Safari 최신을 쓰거나 아래에 입력해 주세요.')));
    return;
  }
  let rec = null;
  btn.addEventListener('click', () => {
    if (btn.classList.contains('listening') && rec) {
      try {
        rec.stop();
      } catch (_) {}
      return;
    }
    rec = new SR();
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    let base = target.value;
    rec.onresult = (ev) => {
      let text = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i][0].transcript;
      target.value = (base ? base + ' ' : '') + text;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = () => {
      btn.classList.remove('listening');
      toast(LN('toasts.voiceFailed', '음성 입력을 시작하지 못했습니다. 마이크 권한을 확인해 주세요.'));
    };
    rec.onend = () => btn.classList.remove('listening');
    try {
      rec.start();
      btn.classList.add('listening');
      toast(LN('toasts.listening', '듣고 있습니다 — 한국어로 말씀하세요.'));
    } catch (_) {
      btn.classList.remove('listening');
    }
  });
}

/* ───────────────────────── 시작 ───────────────────────── */
function boot() {
  adminMode = adminFromEnv();
  captureKoText();
  applyDomLang();
  syncLangButtons();
  updatePackLinks();
  applyReleaseLinks();
  setupGuideTabs();
  setupInstall();
  registerServiceWorker();
  renderCaseGallery();
  bindDemo();
  applyAdminMode();
  renderAll(false);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
