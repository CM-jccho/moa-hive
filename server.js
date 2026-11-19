#!/usr/bin/env node
/*
 * MOA Hive — 로컬 우선(Local-First) 멀티 AI 봇 팀 메신저
 * ------------------------------------------------------------------
 * 의존성 0: Node.js 내장 모듈만 사용 (http, fs, path, child_process, crypto, https, os)
 * 실행: node server.js  →  http://127.0.0.1:3847
 *
 * 백엔드 3단:
 *   1) 로컬 CLI 하네스 (claude -p / codex exec)  — 자동 감지
 *   2) API 모드 (Anthropic / OpenAI 키가 설정된 경우)
 *   3) 시뮬레이터 (키도 CLI도 없을 때 — 봇 역할에 맞는 로컬 응답)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');
const https = require('https');

const ROOT = __dirname;
// 쓰기 가능한 홈 — Electron 앱은 설치 폴더가 읽기 전용이므로 MOA_HOME을 userData로 넘깁니다.
const HOME = process.env.MOA_HOME ? path.resolve(process.env.MOA_HOME) : ROOT;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(HOME, 'data');
const MARKET_DIR = path.join(ROOT, 'market');
const WORKSPACE_DIR = path.join(HOME, 'workspace');
const ENV_FILES = { stg: path.join(DATA_DIR, 'stg-store.json'), prod: path.join(DATA_DIR, 'prod-store.json') };
const VERSION_FILE = path.join(HOME, 'version.json');
const CHANGELOG_FILE = path.join(ROOT, 'CHANGELOG.md');
let ACTIVE_ENV = process.env.MOA_ENV === 'prod' ? 'prod' : 'stg'; // 기본은 안전한 STG
const ENV_LABEL = { stg: 'STG (스테이징)', prod: 'PROD (운영)' };

let CONFIG = {};
try {
  CONFIG = require('./config.js');
} catch (e) {
  CONFIG = {};
}
let CONSULT = [];
try {
  CONSULT = require('./consult.js');
} catch (e) {
  CONSULT = [];
}

const HOST = CONFIG.host || '127.0.0.1'; // 기본: 보안상 루프백 고정
const PORT = Number(process.env.PORT || CONFIG.port || 3847);
const MAX_BODY = 512 * 1024;
const MAX_MSG = 8000;

/* ------------------------------------------------------------------ */
/* 유틸                                                                */
/* ------------------------------------------------------------------ */
const nowISO = () => new Date().toISOString();
const uid = (p = 'id') => p + '_' + crypto.randomBytes(6).toString('hex');

function jsonRes(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('요청 본문이 너무 큽니다'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(Object.assign(new Error('JSON 파싱 실패'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function clampStr(v, max, fallback = '') {
  if (typeof v !== 'string') return fallback;
  return v.length > max ? v.slice(0, max) : v;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function num(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/* ------------------------------------------------------------------ */
/* 보안: 경로 검증                                                      */
/* ------------------------------------------------------------------ */
function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function realish(p) {
  // 존재하면 realpath, 아니면 상위에서 가장 가까운 존재 경로로 정규화
  let cur = p;
  const tail = [];
  for (let i = 0; i < 40; i++) {
    try {
      const rp = fs.realpathSync(cur);
      return tail.length ? path.join(rp, ...tail.reverse()) : rp;
    } catch (e) {
      const parent = path.dirname(cur);
      if (parent === cur) return p;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
  return p;
}

function allowedRoot() {
  const raw = (store.settings && store.settings.allowedRoot) || CONFIG.allowedRoot || '';
  return realish(path.resolve(expandHome(raw || os.homedir())));
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** 워크스페이스(cwd) 검증 — 허용 루트 밖이면 거부 */
function validateCwd(input) {
  const raw = (input || '').toString().trim();
  if (!raw) return { ok: false, error: 'cwd가 비어 있습니다.' };
  if (raw.includes('\0')) return { ok: false, error: '허용되지 않는 문자가 있습니다.' };
  if (raw.split(/[\\/]/).includes('..')) return { ok: false, error: "경로에 '..'를 쓸 수 없습니다." };
  const abs = realish(path.resolve(expandHome(raw)));
  const root = allowedRoot();
  if (!isInside(root, abs)) {
    return { ok: false, error: `허용된 작업 루트(${root}) 밖의 경로입니다.` };
  }
  return { ok: true, path: abs };
}

/** 파일 경로 검증 — 반드시 cwd 내부, 상대경로만 */
function validateFilePath(cwd, relPath) {
  const rel = (relPath || '').toString().trim();
  if (!rel) return { ok: false, error: '파일 경로가 비어 있습니다.' };
  if (rel.includes('\0') || path.isAbsolute(rel) || rel.startsWith('~')) {
    return { ok: false, error: '상대 경로만 사용할 수 있습니다.' };
  }
  if (rel.split(/[\\/]/).includes('..')) return { ok: false, error: "경로에 '..'를 쓸 수 없습니다." };
  const base = realish(cwd);
  const target = realish(path.resolve(base, rel));
  if (!isInside(base, target)) return { ok: false, error: '작업 폴더 밖으로 나가는 경로입니다.' };
  if (!isInside(allowedRoot(), target)) return { ok: false, error: '허용된 작업 루트 밖입니다.' };
  return { ok: true, path: target, rel: path.relative(base, target) };
}

/* ------------------------------------------------------------------ */
/* 보안: 셸 명령                                                       */
/* ------------------------------------------------------------------ */
const SHELL_ALLOW = new Set([
  'ls', 'pwd', 'cat', 'echo', 'wc', 'head', 'tail', 'grep', 'find', 'sort', 'uniq',
  'mkdir', 'touch', 'cp', 'mv', 'date', 'du', 'file', 'git', 'node', 'python3', 'sed', 'awk',
]);
const TOKEN_DENY = ['-exec', '-execdir', '-delete', '-ok', '--exec', '-e', '--eval', ';', '&&', '||', '|', '>', '<', '>>'];
const GIT_OK = new Set(['status', 'log', 'diff', 'show', 'branch', 'rev-parse', 'ls-files', 'remote', 'add', 'commit']);

function splitArgs(s) {
  const out = [];
  let cur = '';
  let q = null;
  for (const ch of s) {
    if (q) {
      if (ch === q) q = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      q = ch;
    } else if (/\s/.test(ch)) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** 승인된 명령이라도 위험하면 차단 */
function validateCommand(cwd, command) {
  const cmd = (command || '').toString().trim();
  if (!cmd) return { ok: false, error: '명령이 비어 있습니다.' };
  if (cmd.length > 400) return { ok: false, error: '명령이 너무 깁니다(최대 400자).' };
  if (/[\n\r`$]/.test(cmd)) return { ok: false, error: '줄바꿈·명령 치환 문자는 허용되지 않습니다.' };
  if (/[;&|<>]/.test(cmd)) return { ok: false, error: '파이프·리다이렉트·연쇄 명령은 허용되지 않습니다.' };
  const argv = splitArgs(cmd);
  if (!argv.length) return { ok: false, error: '명령이 비어 있습니다.' };
  const bin = path.basename(argv[0]);
  if (!SHELL_ALLOW.has(bin)) {
    return { ok: false, error: `허용되지 않은 실행 파일입니다: ${bin} (허용: ${[...SHELL_ALLOW].join(', ')})` };
  }
  for (const arg of argv.slice(1)) {
    if (TOKEN_DENY.includes(arg)) return { ok: false, error: `위험 옵션 차단: ${arg}` };
    if (arg.startsWith('/') && arg !== '/dev/null') return { ok: false, error: `절대 경로 인자는 허용되지 않습니다: ${arg}` };
    if (arg.split(/[\\/]/).includes('..')) return { ok: false, error: "인자에 '..'가 있습니다." };
  }
  if (bin === 'git' && argv[1] && !GIT_OK.has(argv[1])) {
    return { ok: false, error: `git ${argv[1]}은 허용되지 않습니다.` };
  }
  const cwdCheck = validateCwd(cwd);
  if (!cwdCheck.ok) return cwdCheck;
  return { ok: true, argv, bin, cwd: cwdCheck.path };
}

/* ------------------------------------------------------------------ */
/* 저장소                                                              */
/* ------------------------------------------------------------------ */
function defaultSettings() {
  return {
    allowedRoot: '',
    enginePreferred: 'auto', // auto | cli-claude | cli-codex | api-anthropic | api-openai | simulator
    apiKeys: { anthropic: { key: '', updatedAt: null }, openai: { key: '', updatedAt: null } },
    pickle: Object.assign({}, CONFIG.pickle || {}),
    market: Object.assign({}, CONFIG.market || {}),
    ui: { density: 'comfortable', reducedMotion: false },
    remote: { allowLan: false, token: '' },
    autoRules: [],
  };
}

function seedStg() {
  const ws = WORKSPACE_DIR;
  const bots = [
    {
      id: 'bot_pm', name: '기획PM 봇', emoji: '🧭', role: 'pm', model: 'claude-sonnet-4-5',
      persona: '플랫포스 폰기프트 사업을 총괄하는 기획·PM. 요구사항을 PRD·유저스토리·일정으로 쪼개고, 리스크와 의사결정 지점을 먼저 짚는다. 답은 결론 → 근거 → 다음 액션 순서로 짧게.',
      cwd: ws, pinned: true, color: '#7c9cff',
      keywords: ['기획', '요구사항', 'PRD', '일정', '로드맵', '스프린트', '우선순위', 'PM', '정책', 'QA'],
    },
    {
      id: 'bot_dev', name: '풀스택 개발 봇', emoji: '🛠️', role: 'dev', model: 'claude-sonnet-4-5',
      persona: 'Node.js·TypeScript 풀스택 엔지니어. 구현 가능성, 파일 구조, 실행 명령을 구체적으로 제시하고 위험한 변경은 먼저 승인 카드로 물어본다.',
      cwd: ws, pinned: true, color: '#5ee0b0',
      keywords: ['코드', '개발', 'API', '버그', '배포', 'Node', 'Jira', '스크립트', '리팩터', '테스트', 'GitHub'],
    },
    {
      id: 'bot_content', name: '인스타·콘텐츠 봇', emoji: '📸', role: 'content', model: 'claude-haiku-4-5',
      persona: '인스타그램 @moa_daily80 운영을 맡은 콘텐츠 에디터. 훅 → 본문 → CTA 구조의 캡션, 해시태그 세트, 7일 발행 캘린더를 제안한다. 말투는 담백하고 실용적.',
      cwd: ws, pinned: false, color: '#ff8fb1',
      keywords: ['인스타', '릴스', '캡션', '해시태그', '스레드', '콘텐츠', '바이럴', '팔로워', '카드뉴스'],
    },
    {
      id: 'bot_research', name: '리서치 봇', emoji: '🔎', role: 'research', model: 'claude-sonnet-4-5',
      persona: '시장·경쟁사 리서처. 출처와 확인 날짜를 붙이고, 추정과 사실을 구분한다. 결론에는 항상 "확인 필요" 항목을 남긴다.',
      cwd: ws, pinned: false, color: '#ffc46b',
      keywords: ['리서치', '시장', '경쟁사', '조사', '데이터', '트렌드', '벤치마크', '출처'],
    },
  ];

  const channels = [
    {
      id: 'ch_all', name: '전체-팀', mode: 'auto', topic: '모든 봇이 참여하는 기본 채널 — Auto 라우팅',
      pinned: true, members: bots.map((b) => b.id), createdAt: nowISO(),
    },
    {
      id: 'ch_pongift', name: '폰기프트-업무', mode: 'auto', topic: '상품권 사업 기획·QA·일정',
      pinned: true, members: ['bot_pm', 'bot_dev', 'bot_research'], createdAt: nowISO(),
    },
    {
      id: 'ch_side', name: '사이드-수익화', mode: 'mention', botId: 'bot_content', topic: '@봇이름 멘션으로 지정 호출',
      pinned: false, members: ['bot_content', 'bot_pm', 'bot_research'], createdAt: nowISO(),
    },
  ];

  const messages = {
    ch_all: [
      {
        id: uid('msg'), channelId: 'ch_all', ts: nowISO(), kind: 'system',
        author: { type: 'system', name: 'MOA Hive' },
        text: '로컬 하네스 준비 완료. 이 대화는 이 Mac 안의 ./data/store.json에만 저장됩니다.',
      },
      {
        id: uid('msg'), channelId: 'ch_all', ts: nowISO(), kind: 'text',
        author: { type: 'bot', botId: 'bot_pm', name: '기획PM 봇' },
        text: '**기획PM 봇** 준비됐습니다. 이번 주 목표를 알려주시면 PRD 초안과 3일 일정으로 쪼개 드릴게요.\n\n- 채널 모드가 `Auto`라서, 키워드에 따라 다른 봇이 자동으로 답합니다\n- 특정 봇만 부르려면 `@풀스택 개발 봇` 처럼 멘션하세요',
        meta: { engine: 'seed' },
      },
    ],
    ch_pongift: [],
    ch_side: [],
  };

  const s = defaultSettings();
  return {
    version: '0.2.0-rc',
    env: 'stg',
    createdAt: nowISO(),
    settings: s,
    bots,
    channels,
    messages,
    approvals: [],
    teams: [],
    proposals: [],
  };
}

/** v0.1.0 운영 기준선 — Pickle 카드·마켓·콘텐츠 봇이 아직 없는 상태 */
function seedProd() {
  const ws = WORKSPACE_DIR;
  const bots = [
    {
      id: 'bot_pm', name: '기획PM 봇', emoji: '🧭', role: 'pm', model: 'claude-sonnet-4-5',
      persona: '폰기프트 사업을 총괄하는 기획·PM. 요구사항을 PRD·유저스토리·일정으로 쪼개고 리스크를 먼저 짚는다.',
      cwd: ws, pinned: true, color: '#7c9cff', keywords: ['기획', '요구사항', 'PRD', '일정', '우선순위'],
    },
    {
      id: 'bot_dev', name: '풀스택 개발 봇', emoji: '🛠️', role: 'dev', model: 'claude-sonnet-4-5',
      persona: 'Node.js 풀스택 엔지니어. 구현 방법과 실행 명령을 구체적으로 제시한다.',
      cwd: ws, pinned: true, color: '#5ee0b0', keywords: ['코드', '개발', 'API', '버그', '배포'],
    },
  ];
  const channels = [
    { id: 'ch_all', name: '전체-팀', mode: 'auto', topic: '기본 채널', pinned: true, members: ['bot_pm', 'bot_dev'], createdAt: nowISO() },
  ];
  const s = defaultSettings();
  s.pickle = Object.assign({}, s.pickle, { enabled: false });
  s.market = Object.assign({}, s.market, { storeUrl: '', bundleUrl: '' });
  return {
    version: '0.1.0',
    env: 'prod',
    createdAt: nowISO(),
    settings: s,
    bots,
    channels,
    messages: {
      ch_all: [
        {
          id: uid('msg'), channelId: 'ch_all', ts: nowISO(), kind: 'system',
          author: { type: 'system', name: 'MOA Hive' },
          text: 'PROD v0.1.0 — 운영 환경입니다. 변경은 STG에서 하고 Release Manager로 승격하세요.',
        },
      ],
    },
    approvals: [],
    teams: [],
  };
}

let store = null;
const envStores = { stg: null, prod: null };
let versions = { app: 'MOA Hive', stg: { version: '0.2.0-rc' }, prod: { version: '0.1.0' }, releases: [] };

function normalizeStore(s, env) {
  s.env = env;
  s.settings = Object.assign(defaultSettings(), s.settings || {});
  s.settings.apiKeys = Object.assign(defaultSettings().apiKeys, s.settings.apiKeys || {});
  s.settings.pickle = Object.assign({}, CONFIG.pickle || {}, s.settings.pickle || {});
  s.settings.market = Object.assign({}, CONFIG.market || {}, s.settings.market || {});
  s.bots = Array.isArray(s.bots) ? s.bots : [];
  s.channels = Array.isArray(s.channels) ? s.channels : [];
  s.messages = s.messages && typeof s.messages === 'object' ? s.messages : {};
  s.approvals = Array.isArray(s.approvals) ? s.approvals : [];
  s.teams = Array.isArray(s.teams) ? s.teams : [];
  s.proposals = Array.isArray(s.proposals) ? s.proposals : [];
  return s;
}

function readStoreFile(file, seedFn, env) {
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      try { fs.copyFileSync(file, file + '.broken-' + Date.now()); } catch (_) {}
    }
  }
  return seedFn();
}

function loadVersions() {
  try {
    versions = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  } catch (e) {
    // 패키지 앱 첫 실행: 번들에 들어 있는 version.json을 홈으로 복사해 기준점을 만듭니다.
    try {
      versions = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
      if (VERSION_FILE !== path.join(ROOT, 'version.json')) saveVersions();
    } catch (_) {
      /* 기본값 유지 */
    }
  }
  versions.app = 'MOA Hive';
  versions.stg = versions.stg || { version: '0.2.0-rc' };
  versions.prod = versions.prod || { version: '0.1.0' };
  versions.releases = Array.isArray(versions.releases) ? versions.releases : [];
}

function saveVersions() {
  try {
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versions, null, 2), 'utf8');
  } catch (e) {
    console.error('[version] 저장 실패:', e.message);
  }
}

function loadStores() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  } catch (e) {
    /* 무시 */
  }
  loadVersions();
  envStores.stg = normalizeStore(readStoreFile(ENV_FILES.stg, seedStg, 'stg'), 'stg');
  envStores.prod = normalizeStore(readStoreFile(ENV_FILES.prod, seedProd, 'prod'), 'prod');
  envStores.stg.version = versions.stg.version;
  envStores.prod.version = versions.prod.version;
  store = envStores[ACTIVE_ENV];
  saveAll();
}

function saveAll() {
  for (const env of ['stg', 'prod']) {
    try {
      const tmp = ENV_FILES[env] + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(envStores[env], null, 2), 'utf8');
      fs.renameSync(tmp, ENV_FILES[env]);
    } catch (e) {
      console.error(`[store:${env}] 저장 실패:`, e.message);
    }
  }
}

let saveTimer = null;
function saveStore() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const env = ACTIVE_ENV;
    const tmp = ENV_FILES[env] + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, ENV_FILES[env]);
    if (versions[env]) versions[env].updatedAt = nowISO();
    saveVersions();
  } catch (e) {
    console.error('[store] 저장 실패:', e.message);
  }
}
function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveStore();
  }, 120);
}

/* ------------------------------------------------------------------ */
/* STG ↔ PROD 승격                                                        */
/* ------------------------------------------------------------------ */
function storeDiff() {
  const a = envStores.prod;
  const b = envStores.stg;
  const byId = (arr, id) => arr.find((x) => x.id === id);
  const FIELDS = ['name', 'emoji', 'role', 'model', 'persona', 'cwd', 'pinned', 'keywords', 'color'];
  const botAdded = b.bots.filter((x) => !byId(a.bots, x.id)).map((x) => `${x.emoji || ''} ${x.name}`.trim());
  const botRemoved = a.bots.filter((x) => !byId(b.bots, x.id)).map((x) => x.name);
  const botChanged = b.bots
    .filter((x) => {
      const y = byId(a.bots, x.id);
      return y && FIELDS.some((f) => JSON.stringify(x[f] ?? null) !== JSON.stringify(y[f] ?? null));
    })
    .map((x) => x.name);
  const chAdded = b.channels.filter((x) => !byId(a.channels, x.id)).map((x) => '#' + x.name);
  const chRemoved = a.channels.filter((x) => !byId(b.channels, x.id)).map((x) => '#' + x.name);
  const chChanged = b.channels
    .filter((x) => {
      const y = byId(a.channels, x.id);
      return y && ['name', 'mode', 'topic', 'members', 'pinned', 'botId'].some((f) => JSON.stringify(x[f] ?? null) !== JSON.stringify(y[f] ?? null));
    })
    .map((x) => '#' + x.name);

  const pa = a.settings;
  const pb = b.settings;
  const settingsChanged = [];
  if (JSON.stringify(pa.pickle) !== JSON.stringify(pb.pickle)) settingsChanged.push('Pickle 연동·초대 카드');
  if (JSON.stringify(pa.market) !== JSON.stringify(pb.market)) settingsChanged.push('팀 마켓 판매 링크');
  if ((pa.allowedRoot || '') !== (pb.allowedRoot || '')) settingsChanged.push('허용 작업 루트');
  if ((pa.enginePreferred || 'auto') !== (pb.enginePreferred || 'auto')) settingsChanged.push('엔진 설정');
  const keySig = (s) => ['anthropic', 'openai'].map((k) => (s.apiKeys[k] && s.apiKeys[k].key ? '1' : '0')).join('');
  if (keySig(pa) !== keySig(pb)) settingsChanged.push('API 키 구성 변경(값은 비교·노출하지 않음)');

  const pending =
    !!(botAdded.length || botRemoved.length || botChanged.length || chAdded.length || chRemoved.length || chChanged.length || settingsChanged.length) ||
    versions.stg.version !== versions.prod.version;

  return {
    bots: { added: botAdded, removed: botRemoved, changed: botChanged },
    channels: { added: chAdded, removed: chRemoved, changed: chChanged },
    settings: settingsChanged,
    teams: b.teams.length - a.teams.length,
    stgVersion: versions.stg.version,
    prodVersion: versions.prod.version,
    pending,
    comparedAt: nowISO(),
  };
}

function appendChangelog(entry) {
  try {
    let md = fs.readFileSync(CHANGELOG_FILE, 'utf8');
    const date = new Date(entry.at).toISOString().slice(0, 10);
    const lines = [
      `## [${entry.version}] — PROD · ${date}`,
      '',
      `STG에서 승격 · ${entry.note || '릴리스 노트 없음'}`,
      '',
      ...(entry.changes || []).map((c) => `- ${c}`),
      '',
    ].join('\n');
    const idx = md.indexOf('\n## [');
    md = idx >= 0 ? md.slice(0, idx) + '\n' + lines + md.slice(idx + 1) : md + '\n' + lines;
    fs.writeFileSync(CHANGELOG_FILE, md, 'utf8');
  } catch (e) {
    console.error('[changelog]', e.message);
  }
}

function promoteToProd(note) {
  const from = envStores.stg;
  const to = envStores.prod;
  const diff = storeDiff();
  const targetVersion = String(versions.stg.version || '0.2.0').replace(/-rc\.?\d*$/, '');
  const clone = JSON.parse(
    JSON.stringify({ bots: from.bots, channels: from.channels, settings: from.settings, teams: from.teams })
  );
  to.bots = clone.bots;
  to.channels = clone.channels;
  to.settings = clone.settings;
  to.teams = clone.teams;
  to.version = targetVersion;
  to.channels.forEach((c) => {
    if (!Array.isArray(to.messages[c.id])) to.messages[c.id] = [];
    to.messages[c.id].push({
      id: uid('msg'),
      channelId: c.id,
      ts: nowISO(),
      kind: 'system',
      author: { type: 'system', name: 'MOA Hive' },
      text: `✅ v${targetVersion} PROD 반영 완료 — STG ${versions.stg.version}에서 승격됨${note ? ' · ' + note : ''}`,
    });
  });
  const changes = [
    ...diff.bots.added.map((x) => `봇 추가: ${x}`),
    ...diff.bots.changed.map((x) => `봇 설정 변경: ${x}`),
    ...diff.bots.removed.map((x) => `봇 제거: ${x}`),
    ...diff.channels.added.map((x) => `채널 추가: ${x}`),
    ...diff.channels.changed.map((x) => `채널 변경: ${x}`),
    ...diff.channels.removed.map((x) => `채널 제거: ${x}`),
    ...diff.settings.map((x) => `설정: ${x}`),
  ];
  const prevStg = versions.stg.version;
  versions.prod = { version: targetVersion, updatedAt: nowISO(), promotedAt: nowISO(), promotedFrom: prevStg };
  versions.stg = { version: targetVersion, updatedAt: nowISO() };
  const entry = {
    version: targetVersion,
    env: 'prod',
    at: nowISO(),
    title: `STG ${prevStg} 승격`,
    note: note || '',
    changes: changes.length ? changes : ['설정·콘텐츠 변경 없이 버전만 승격'],
  };
  versions.releases.unshift(entry);
  saveVersions();
  appendChangelog(entry);
  saveAll();
  return { version: targetVersion, diff, entry };
}

function parseChangelog() {
  try {
    const md = fs.readFileSync(CHANGELOG_FILE, 'utf8');
    return md
      .split(/\n## \[/)
      .slice(1)
      .map((part) => {
        const head = part.split('\n')[0];
        const m = head.match(/^([^\]]+)\]\s*—\s*(\w+)\s*·\s*([\d-]+)/);
        return {
          version: m ? m[1] : head.slice(0, 40),
          env: m ? m[2].toLowerCase() : null,
          date: m ? m[3] : null,
          body: '## [' + part.trim(),
        };
      });
  } catch (e) {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* 설정 살균(키 원문 절대 노출 금지)                                     */
/* ------------------------------------------------------------------ */
function publicSettings() {
  const s = store.settings;
  return {
    allowedRoot: s.allowedRoot || '',
    effectiveRoot: allowedRoot(),
    enginePreferred: s.enginePreferred || 'auto',
    apiKeys: {
      anthropic: { configured: !!(s.apiKeys.anthropic && s.apiKeys.anthropic.key), updatedAt: s.apiKeys.anthropic?.updatedAt || null },
      openai: { configured: !!(s.apiKeys.openai && s.apiKeys.openai.key), updatedAt: s.apiKeys.openai?.updatedAt || null },
    },
    pickle: s.pickle,
    market: { storeUrl: s.market.storeUrl, bundleUrl: s.market.bundleUrl, currency: s.market.currency, demoUnlock: !!s.market.demoUnlock },
    remote: { allowLan: !!(s.remote && s.remote.allowLan) },
    ui: s.ui,
  };
}

/* ------------------------------------------------------------------ */
/* 엔진 감지                                                            */
/* ------------------------------------------------------------------ */
let engineCache = { at: 0, data: null };

function which(bin) {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'sh';
    const args = process.platform === 'win32' ? [bin] : ['-c', `command -v ${bin}`];
    const r = cp.spawnSync(cmd, args, { encoding: 'utf8', timeout: 4000, env: process.env });
    if (r.status === 0 && r.stdout) {
      const p = r.stdout.split('\n').map((x) => x.trim()).filter(Boolean)[0];
      if (p) return p;
    }
  } catch (e) {}
  return null;
}

function binVersion(binPath) {
  try {
    const r = cp.spawnSync(binPath, ['--version'], { encoding: 'utf8', timeout: 4000, env: process.env });
    const out = ((r.stdout || '') + ' ' + (r.stderr || '')).trim();
    return out.split('\n')[0].slice(0, 120) || null;
  } catch (e) {
    return null;
  }
}

function detectEngines(force) {
  if (!force && engineCache.data && Date.now() - engineCache.at < 30000) return engineCache.data;
  const claudePath = which('claude');
  const codexPath = which('codex');
  const s = store.settings;
  const anth = !!(s.apiKeys.anthropic && s.apiKeys.anthropic.key);
  const oai = !!(s.apiKeys.openai && s.apiKeys.openai.key);
  const data = {
    claude: { installed: !!claudePath, path: claudePath, version: claudePath ? binVersion(claudePath) : null },
    codex: { installed: !!codexPath, path: codexPath, version: codexPath ? binVersion(codexPath) : null },
    apiKeys: {
      anthropic: { configured: anth },
      openai: { configured: oai },
    },
    preferred: s.enginePreferred || 'auto',
    mode: resolveMode(s.enginePreferred, !!claudePath, !!codexPath, anth, oai),
    checkedAt: nowISO(),
  };
  engineCache = { at: Date.now(), data };
  return data;
}

function resolveMode(pref, hasClaude, hasCodex, hasAnth, hasOai) {
  if (pref === 'simulator') return 'simulator';
  if (pref === 'cli-claude') return hasClaude ? 'cli-claude' : 'simulator';
  if (pref === 'cli-codex') return hasCodex ? 'cli-codex' : 'simulator';
  if (pref === 'api-anthropic') return hasAnth ? 'api-anthropic' : 'simulator';
  if (pref === 'api-openai') return hasOai ? 'api-openai' : 'simulator';
  if (hasClaude) return 'cli-claude';
  if (hasCodex) return 'cli-codex';
  if (hasAnth) return 'api-anthropic';
  if (hasOai) return 'api-openai';
  return 'simulator';
}

const ENGINE_LABEL = {
  'cli-claude': 'Claude CLI (로컬)',
  'cli-codex': 'Codex CLI (로컬)',
  'api-anthropic': 'Anthropic API',
  'api-openai': 'OpenAI API',
  simulator: '로컬 시뮬레이터',
};

/* ------------------------------------------------------------------ */
/* 엔진 실행                                                            */
/* ------------------------------------------------------------------ */
function buildPrompt(bot, channel, userText, history) {
  const recent = history
    .slice(-10)
    .map((m) => `${m.author.type === 'user' ? '사용자' : m.author.name}: ${m.text}`)
    .join('\n');
  return [
    `당신은 'MOA Hive'의 팀 멤버 봇입니다.`,
    `이름: ${bot.name} / 역할: ${bot.role} / 모델 슬롯: ${bot.model}`,
    `페르소나: ${bot.persona}`,
    `현재 채널: #${channel.name} (${channel.topic || '설명 없음'})`,
    `작업 폴더: ${bot.cwd}`,
    recent ? `\n최근 대화:\n${recent}` : '',
    `\n사용자 메시지:\n${userText}`,
    `\n한국어로, 결론 → 근거 → 다음 액션 순서로 간결하게 답하세요. 셸 명령이나 파일 수정이 필요하면 명령/경로를 명시하고, 실행은 사용자 승인 후에만 이뤄진다고 안내하세요.`,
  ].filter(Boolean).join('\n');
}

function runCLI(mode, prompt, cwd) {
  return new Promise((resolve, reject) => {
    const binName = mode === 'cli-claude' ? 'claude' : 'codex';
    const binPath = which(binName);
    if (!binPath) return reject(new Error(`${binName} CLI를 찾을 수 없습니다.`));
    const args = mode === 'cli-claude' ? ['-p', prompt, '--output-format', 'text'] : ['exec', prompt];
    const child = cp.spawn(binPath, args, {
      cwd: fs.existsSync(cwd) ? cwd : process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) {}
      reject(new Error('CLI 응답 시간 초과(120초)'));
    }, 120000);
    child.stdout.on('data', (d) => { out += d.toString(); if (out.length > 200000) out = out.slice(0, 200000); });
    child.stderr.on('data', (d) => { err += d.toString(); if (err.length > 20000) err = err.slice(0, 20000); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && out.trim()) resolve(out.trim());
      else reject(new Error(`CLI 종료 코드 ${code}: ${(err || out).slice(0, 500)}`));
    });
  });
}

function httpsJson(urlStr, headers, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, headers),
        timeout: 90000,
      },
      (res) => {
        let data = '';
        res.on('data', (d) => { data += d.toString(); });
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch (e) {}
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed || {});
          else {
            const msg = parsed && parsed.error ? JSON.stringify(parsed.error).slice(0, 300) : data.slice(0, 300);
            reject(new Error(`API ${res.statusCode}: ${msg}`));
          }
        });
      }
    );
    req.on('timeout', () => { req.destroy(new Error('API 시간 초과')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function callAnthropic(bot, prompt) {
  const key = store.settings.apiKeys.anthropic.key;
  const data = await httpsJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    { model: bot.model && bot.model.startsWith('claude') ? bot.model : 'claude-sonnet-4-5', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }
  );
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  if (!text) throw new Error('Anthropic 응답에 텍스트가 없습니다.');
  return text;
}

async function callOpenAI(bot, prompt) {
  const key = store.settings.apiKeys.openai.key;
  const data = await httpsJson(
    'https://api.openai.com/v1/chat/completions',
    { authorization: `Bearer ${key}` },
    {
      model: /^gpt|^o\d/.test(bot.model || '') ? bot.model : 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    }
  );
  const text = ((data.choices || [])[0] || {}).message?.content;
  if (!text) throw new Error('OpenAI 응답에 텍스트가 없습니다.');
  return text.trim();
}

/* ------------------------------------------------------------------ */
/* 시뮬레이터                                                           */
/* ------------------------------------------------------------------ */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const ROLE_LINE = {
  pm: ['목표를 3개 유저스토리로 쪼개면 이번 주 안에 검증 가능합니다.', '일정보다 먼저 결정해야 할 게 하나 있습니다 — 범위 승인입니다.'],
  dev: ['구현은 2개 파일 수정으로 끝납니다. 먼저 승인 카드로 확인받겠습니다.', '재현 조건부터 고정하면 원인은 금방 좁혀집니다.'],
  content: ['첫 3초 훅이 승부입니다. 도입 문장을 두 가지로 나눠 테스트하죠.', '저장보다 공유를 부르는 마지막 한 줄이 필요합니다.'],
  research: ['숫자는 2차 자료라 오늘 확인한 값으로 표시했습니다. 원문 확인이 남았습니다.', '경쟁 3곳 중 2곳은 같은 가격대, 1곳만 번들 전략입니다.'],
};

function simReply(bot, channel, text, history) {
  const h = hash(text + bot.id);
  const role = bot.role || 'general';
  const pick = (arr, salt = 0) => arr[(h + salt) % arr.length];
  const quoted = text.length > 70 ? text.slice(0, 70) + '…' : text;
  const lines = [`**${bot.name}** · \`#${channel.name}\``, ''];

  if (/안녕|반가|hello|hi/i.test(text) && text.length < 24) {
    lines.push(`안녕하세요, ${bot.name}입니다. 지금 채널은 \`${channel.mode === 'auto' ? 'Auto 라우팅' : '@멘션 호출'}\` 모드예요.`);
    lines.push('', '무엇부터 볼까요? 예: "이번 주 폰기프트 QA 범위 정리", "릴스 3편 캡션", "경쟁사 가격 조사"');
    return lines.join('\n');
  }

  lines.push(`요청 이해: “${quoted}”`);
  lines.push('');

  if (role === 'pm') {
    lines.push('**결론**', pick(ROLE_LINE.pm, 0), '');
    lines.push('**쪼개기**');
    lines.push('1. 문제 정의 — 지금 막히는 지점 1문장');
    lines.push('2. 성공 지표 — 이번 주 확인 가능한 숫자 1개');
    lines.push('3. 다음 액션 — 담당·기한이 붙은 티켓 2장');
    lines.push('', '**리스크**', '- 범위가 커지면 QA 일정이 밀립니다. 1차는 읽기 전용으로 좁히는 걸 권합니다.');
    lines.push('', `필요하면 \`PRD 초안.md\`를 작업 폴더에 만들어 둘까요? (승인 카드로 확인받습니다)`);
  } else if (role === 'dev') {
    lines.push('**결론**', pick(ROLE_LINE.dev, 0), '');
    lines.push('**접근**');
    lines.push('- 입력 검증을 라우터 진입점 한 곳에 모읍니다 (`server.js` 미들웨어)');
    lines.push('- 실패 케이스는 400 + 이유 코드로 통일');
    lines.push('- 회귀 확인: `npm test` 대신 `node --test`');
    lines.push('', '**다음 액션**', '- 재현 스크립트 1개 → 승인 후 실행');
    lines.push('', `원하시면 \`notes/fix-plan.md\`를 만들고 \`ls -la\`로 현재 폴더를 확인하는 제안을 올리겠습니다.`);
  } else if (role === 'content') {
    lines.push('**결론**', pick(ROLE_LINE.content, 0), '');
    lines.push('**캡션 초안**');
    lines.push('> 매일 쓰는 물건 하나를, 매일 조금 더 똑똑하게.');
    lines.push('> 오늘은 그 한 가지를 바꿔봤습니다.');
    lines.push('', '**해시태그**', '`#생활자동화 #1인사업 #AI툴 #루틴 #moa_daily80`');
    lines.push('', '**발행 메모**', '- 릴스는 9:16, 첫 프레임에 텍스트 3단어 이내');
    lines.push('- 스레드에는 같은 문장을 조금 다르게(질문형)로');
  } else if (role === 'research') {
    lines.push('**결론**', pick(ROLE_LINE.research, 0), '');
    lines.push('**확인된 것**');
    lines.push('- 시장 규모·가격대는 2차 자료 기준(오늘 확인)');
    lines.push('- 경쟁사 3곳의 프로모션 구조는 공개 페이지 기준');
    lines.push('', '**추정**', '- 전환율 차이는 채널 구성 때문일 가능성이 큼 (근거 약함)');
    lines.push('', '**확인 필요**', '- 최신 공시/공개 자료 원문 1건 — 링크 필요');
  } else {
    lines.push('**결론**', '요청을 3단계로 나눠 처리하는 게 좋겠습니다.', '');
    lines.push('- 1단계: 범위 확정', '- 2단계: 초안 작성', '- 3단계: 검토·반영');
  }

  lines.push('', `_로컬 시뮬레이터 응답입니다 · 실제 모델을 쓰려면 설정에서 CLI 또는 API 키를 연결하세요._`);
  return lines.join('\n');
}

/** 메시지에서 실행/파일 작업 제안이 필요한지 판단 */
function planAction(bot, text, channel) {
  const t = text.trim();
  const shellMatch = t.match(/^\/(?:shell|run)\s+(.+)$/i);
  if (shellMatch) {
    return { kind: 'shell', command: shellMatch[1].trim(), reason: '사용자가 /shell 명령으로 실행을 요청했습니다.' };
  }
  const wantsFile = /(파일|문서|PRD|초안|메모|보고서).*(만들|작성|저장|생성)|(만들|작성|저장|생성).*(파일|문서|PRD|초안|메모)/.test(t);
  const wantsCmd = /(명령|실행|터미널|셸|shell|ls|조회).*(해|보|확인|실행)|(실행|조회).*(해줘|해 주|보여)/.test(t);

  if (wantsFile) {
    const slug =
      bot.role === 'pm' ? 'prd-draft.md' : bot.role === 'dev' ? 'notes/fix-plan.md' : bot.role === 'content' ? 'notes/content-plan.md' : 'notes/research-brief.md';
    const content = [
      `# ${bot.name} 초안`,
      '',
      `- 요청: ${t}`,
      `- 채널: #${channel.name}`,
      `- 작성: ${new Date().toISOString()}`,
      '',
      '## 요약',
      '요청을 바탕으로 정리한 1차 초안입니다. 승인 후 이 폴더에 저장됩니다.',
      '',
      '## 다음 액션',
      '1. 범위 확인',
      '2. 담당·기한 지정',
      '3. 리뷰 반영',
      '',
    ].join('\n');
    return { kind: 'write', path: slug, content, reason: `${bot.name}이(가) 작업 폴더에 초안 파일을 만들려고 합니다.` };
  }
  if (wantsCmd) {
    return { kind: 'shell', command: 'ls -la', reason: '작업 폴더 상태를 확인하려고 합니다.' };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 오케스트레이터 · 자유 목적 분석                                       */
/* ------------------------------------------------------------------ */
const READONLY_CMDS = new Set(['ls', 'pwd', 'cat', 'wc', 'head', 'tail', 'grep', 'sort', 'date', 'file', 'git']);

const AGENT_LIB = {
  proposal: { name: '제안서 설계 봇', emoji: '📄', role: 'pm', task: '제안서 목차·논리 구성', summary: '고객 문제 → 해결 → 도입 효과 순서의 목차 5장을 잡았습니다.', persona: '고객의 문제 → 우리 해결 → 도입 효과 → 일정·비용 순서로 과장 없이 제안서를 쓴다.', keywords: ['제안서', '도입', '제안', '발표'] },
  billing: { name: '정산·매출 봇', emoji: '💰', role: 'research', task: '매출·정산 흐름 정리', summary: '입금·세금계산서·미수금 기준을 한 표로 정리했습니다.', persona: '매출·정산 데이터를 정리해 미수금과 마감일을 표시한다. 숫자는 기준일을 붙인다.', keywords: ['정산', '매출', '세금계산서', '입금', '미수금'] },
  followup: { name: '팔로업 봇', emoji: '✉️', role: 'content', task: '팔로업 문구 작성', summary: '미팅 후 24시간 안에 보낼 메일 초안 1건을 작성했습니다.', persona: '미팅 후 팔로업 메일을 짧고 결론 중심으로 쓴다.', keywords: ['팔로업', '메일', '회신', '리마인드'] },
  content: { name: '콘텐츠 전략 봇', emoji: '🎯', role: 'content', task: '주제·발행 캘린더 설계', summary: '이번 주 7편 주제와 발행 요일을 잡았습니다.', persona: '계정 포지셔닝과 주간 발행 캘린더를 설계한다.', keywords: ['콘텐츠', '캘린더', '주제', '릴스'] },
  copy: { name: '카피 봇', emoji: '✍️', role: 'content', task: '훅·캡션 작성', summary: '첫 3초 훅 2안과 해시태그 세트를 만들었습니다.', persona: '첫 3초 훅과 마지막 CTA를 쓴다. 인스타·스레드용을 따로 쓴다.', keywords: ['캡션', '훅', '카피', '해시태그'] },
  analysis: { name: '성과 분석 봇', emoji: '📊', role: 'research', task: '지표·실험 설계', summary: '도달·저장·전환 지표와 다음 실험 1개를 정리했습니다.', persona: '도달·저장·팔로우 전환을 비교하고 다음 실험을 제안한다.', keywords: ['분석', '지표', '성과', '전환'] },
  planning: { name: '기획 정리 봇', emoji: '🧭', role: 'pm', task: '요구사항·범위 분해', summary: '요청을 3개 유저스토리와 3일 일정으로 쪼갰습니다.', persona: '요구사항을 PRD·유저스토리·일정으로 쪼개고 리스크를 짚는다.', keywords: ['기획', '요구사항', '일정', 'PRD'] },
  build: { name: '구현 봇', emoji: '🛠️', role: 'dev', task: '구현·배포 순서', summary: '수정 파일 2개와 실행 명령, 검증 순서를 정리했습니다.', persona: '구현 가능한 범위로 쪼개고 파일·명령·검증 순서를 제시한다.', keywords: ['구현', '개발', '배포', '코드'] },
  qa: { name: 'QA·검증 봇', emoji: '🧪', role: 'dev', task: '검증 시나리오', summary: '회귀 체크리스트 6항목을 만들었습니다.', persona: '릴리즈 전 체크리스트와 회귀 시나리오를 만든다.', keywords: ['QA', '테스트', '검증', '릴리즈'] },
  research: { name: '리서치 봇', emoji: '🔎', role: 'research', task: '근거·경쟁사 확인', summary: '경쟁 3곳의 가격대와 확인 필요 항목을 정리했습니다.', persona: '시장·경쟁사 조사. 사실과 추정을 구분한다.', keywords: ['리서치', '시장', '경쟁사', '조사'] },
  ops: { name: '운영 자동화 봇', emoji: '⚙️', role: 'dev', task: '반복 업무 자동화 설계', summary: '반복 업무 3개를 스크립트·규칙 후보로 바꿨습니다.', persona: '반복 업무를 찾아 안전한 자동화 후보로 정리한다.', keywords: ['자동화', '반복', '운영', '스크립트'] },
};

function analyzePurpose(text) {
  const t = String(text || '');
  const rules = [
    { id: 'b2b', re: /(제안서|영업|거래처|고객사|계약|견적|미팅|정산|매출)/, agents: ['proposal', 'billing', 'followup'], channel: '영업-오케스트라', why: '영업은 한 건을 끝까지 끌고 가는 일입니다. 제안·정산·팔로업을 나눠 들면 대표는 미팅과 결정에만 집중할 수 있습니다.' },
    { id: 'content', re: /(인스타|스레드|릴스|콘텐츠|SNS|팔로워|카드뉴스|블로그)/, agents: ['content', 'copy', 'analysis'], channel: '콘텐츠-오케스트라', why: '콘텐츠는 기획·카피·분석이 돌아가야 끊기지 않습니다. 세 에이전트가 주간 리듬을 만들고 총괄이 결과만 보고합니다.' },
    { id: 'build', re: /(앱|서비스|개발|자동화|스크립트|코드|MVP|출시)/, agents: ['planning', 'build', 'qa', 'ops'], channel: '빌드-오케스트라', why: '만드는 일은 범위·구현·검증이 붙어야 끝납니다. 총괄이 순서를 잡고 각 에이전트가 자기 산출물만 냅니다.' },
    { id: 'plan', re: /(기획|일정|회의|보고|리포트|정리)/, agents: ['planning', 'research', 'analysis'], channel: '기획-오케스트라', why: '기획은 흩어진 요청을 문서와 일정으로 바꾸는 일입니다. 정리·근거·리포트를 나눠 맡깁니다.' },
  ];
  let hit = rules.find((r) => r.re.test(t));
  if (!hit) hit = { id: 'general', agents: ['planning', 'research', 'ops'], channel: '총괄-오케스트라', why: '목적이 아직 넓습니다. 먼저 범위를 정리하고, 근거를 확인한 뒤, 반복 업무를 자동화 후보로 바꾸는 3단 구성이 안전합니다.' };

  const agents = hit.agents.slice(0, 3).map((k) => AGENT_LIB[k]).filter(Boolean);
  const chief = {
    name: 'MOA Chief',
    emoji: '🧠',
    role: 'chief',
    isChief: true,
    persona: '총괄 오케스트레이터. 사용자의 목적을 3단계로 쪼개 하위 에이전트에게 위임하고, 각자의 산출물을 취합해 결론과 다음 액션만 보고한다. 추측과 확인된 사실을 구분한다.',
    keywords: ['총괄', '오케스트라', '전체', '요약', '진행'],
  };
  return {
    goal: t.trim().slice(0, 300),
    domain: hit.id,
    analysisMode: 'rule-based',
    chief,
    agents,
    channel: { name: hit.channel, mode: 'mention' },
    why: hit.why,
    steps: ['목적 접수·범위 확정', '하위 에이전트 3종에 위임', '산출물 취합·최종 보고'],
    pattern: hit.id,
  };
}

function applyOrchestrator(plan) {
  const ws = WORKSPACE_DIR;
  const created = [];
  let chief = store.bots.find((b) => b.isChief);
  if (!chief) {
    chief = Object.assign(
      { id: uid('bot'), model: 'claude-sonnet-4-5', cwd: ws, pinned: true, color: '#a78bfa', createdAt: nowISO() },
      plan.chief
    );
    store.bots.push(chief);
  }
  created.push(chief);
  const agents = [];
  for (const a of plan.agents) {
    const bot = {
      id: uid('bot'),
      name: a.name,
      emoji: a.emoji,
      role: a.role,
      model: 'claude-sonnet-4-5',
      persona: a.persona,
      cwd: ws,
      pinned: false,
      color: '#7c9cff',
      keywords: a.keywords || [],
      createdAt: nowISO(),
    };
    store.bots.push(bot);
    agents.push(bot);
  }
  const channel = {
    id: uid('ch'),
    name: plan.channel.name,
    mode: 'mention',
    botId: chief.id,
    topic: `총괄 오케스트레이터 1:1 — ${plan.goal || '팀 목표'}`,
    pinned: true,
    members: [chief.id, ...agents.map((a) => a.id)],
    createdAt: nowISO(),
    orchestrator: true,
  };
  store.channels.push(channel);
  store.messages[channel.id] = [];
  pushMessage(channel.id, {
    kind: 'system',
    author: { type: 'system', name: 'MOA Hive 컨설턴트' },
    text: `**총괄 오케스트레이터 팀을 만들었습니다** — ${chief.emoji} ${chief.name} + 에이전트 ${agents.length}명.\n\n목적: ${plan.goal || '—'}\n\n${plan.why || ''}`,
  });
  pushMessage(channel.id, {
    kind: 'text',
    author: { type: 'bot', botId: chief.id, name: chief.name },
    text: `준비됐습니다. 아래 에이전트에게 일을 나눠 맡기고, 제가 결과만 취합해 보고합니다.\n\n- ${agents.map((a) => `${a.emoji} ${a.name}`).join('\n- ')}\n\n하고 싶은 일을 그대로 말해 주세요. 예: "${plan.goal || '이번 주 할 일 정리해줘'}"`,
    meta: { engine: 'orchestrator' },
  });
  store.teams.push({ id: uid('team'), name: `오케스트레이터 (${plan.domain})`, consultId: 'orchestrator', pains: [], importedAt: nowISO(), bots: agents.length + 1, channels: 1 });
  saveStore();
  return { chief: botSafe(chief), agents: agents.map(botSafe), channel, mainChannelId: channel.id };
}

function subAgents(channel, chief) {
  return (channel.members || [])
    .map((id) => store.bots.find((b) => b.id === id))
    .filter((b) => b && b.id !== chief.id && !b.isChief)
    .slice(0, 3);
}

function orchestrateReply(channel, chief, text) {
  const agents = subAgents(channel, chief);
  const lib = (name) => Object.values(AGENT_LIB).find((a) => a.name === name) || null;
  const lines = [`**총괄 보고** · ${chief.emoji} ${chief.name}`, ''];
  lines.push(`목표: ${text.length > 80 ? text.slice(0, 80) + '…' : text}`);
  if (!agents.length) {
    lines.push('', '이 채널에 하위 에이전트가 없습니다. Teams에서 팀을 붙이거나 팀 컨설팅을 다시 실행하세요.');
    return { text: lines.join('\n'), orchestration: [] };
  }
  const steps = agents.map((a, i) => {
    const meta = lib(a.name);
    return {
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      task: meta ? meta.task : `${text.slice(0, 20)} 처리`,
      status: 'done',
      summary: meta ? meta.summary : '초안 정리 완료',
      order: i + 1,
    };
  });
  lines.push(`위임 ${steps.length}건 완료`, '');
  steps.forEach((s, i) => lines.push(`${i + 1}. ${s.emoji} **${s.name}** — ${s.task} → ${s.summary}`));
  lines.push('', '**취합 결과**');
  lines.push(`- 범위: ${text.slice(0, 40)}${text.length > 40 ? '…' : ''} 를 ${steps.length}개 산출물로 분해`);
  lines.push(`- 다음 액션: ${steps[0].name}의 초안을 확인하고, 결정이 필요한 1건만 골라 주세요`);
  lines.push('- 확인 필요: 실제 수치·고객사 정보는 아직 검증 전입니다(로컬 규칙 기반 취합)');
  lines.push('', '_하위 에이전트 산출물을 취합한 요약입니다 · 총괄 모드_');
  return { text: lines.join('\n'), orchestration: steps };
}

function maybeProposal(channel, chief) {
  if (store.proposals.some((p) => p.channelId === channel.id && p.status === 'pending')) return null;
  if (store.proposals.some((p) => p.channelId === channel.id)) return null; // 채널당 1회
  const hasReport = store.bots.some((b) => /리포트/.test(b.name));
  const proposal = hasReport
    ? {
        id: uid('prop'),
        channelId: channel.id,
        title: '읽기 전용 명령 자동 승인 규칙을 추가할까요?',
        body: 'ls · cat · wc · pwd 같은 읽기 전용 명령은 승인 카드 없이 바로 실행됩니다. 쓰기·위험 명령은 그대로 승인 카드를 거칩니다.',
        action: { type: 'rule', rule: { label: '읽기 전용 명령 자동 승인', commands: ['ls', 'cat', 'wc', 'pwd'] } },
        status: 'pending',
        createdAt: nowISO(),
      }
    : {
        id: uid('prop'),
        channelId: channel.id,
        title: '주간 리포트 요약 봇을 팀에 붙일까요?',
        body: '매주 금요일 지표·진행률을 한 장으로 정리해 총괄에게 보고하는 에이전트입니다.',
        action: {
          type: 'add-bot',
          bot: {
            name: '주간 리포트 봇',
            emoji: '📊',
            role: 'research',
            persona: '주간 지표와 진행률을 한 장 리포트로 정리한다. 숫자에는 기준일과 출처를 붙인다.',
            keywords: ['리포트', '주간', '지표', '요약'],
          },
        },
        status: 'pending',
        createdAt: nowISO(),
      };
  store.proposals.unshift(proposal);
  pushMessage(channel.id, {
    kind: 'proposal',
    author: { type: 'bot', botId: chief.id, name: chief.name },
    text: proposal.title,
    proposalId: proposal.id,
    proposal: { title: proposal.title, body: proposal.body, actionType: proposal.action.type, status: 'pending' },
    meta: { engine: 'proposal' },
  });
  return proposal;
}

/* ------------------------------------------------------------------ */
/* 팀 임포트 (Markdown + YAML frontmatter)                              */
/* ------------------------------------------------------------------ */
function stripQuotes(s) {
  const t = String(s).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function parseYaml(text) {
  const raw = String(text).replace(/\r/g, '').split('\n');
  let i = 0;
  const indentOf = (l) => (l.match(/^ */) || [''])[0].length;
  const skip = () => {
    while (i < raw.length && (raw[i].trim() === '' || raw[i].trim().startsWith('#'))) i++;
  };
  const scalar = (v) => {
    v = v.trim();
    if (!v) return '';
    if (v.startsWith('[') && v.endsWith(']')) {
      return v.slice(1, -1).split(',').map((x) => stripQuotes(x)).filter((x) => x !== '');
    }
    return stripQuotes(v);
  };
  function blockScalar(parentIndent) {
    const lines = [];
    i++;
    while (i < raw.length) {
      const l = raw[i];
      if (l.trim() === '') {
        lines.push('');
        i++;
        continue;
      }
      if (indentOf(l) <= parentIndent) break;
      lines.push(l.trim());
      i++;
    }
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n');
  }
  function parseNode(minIndent) {
    skip();
    if (i >= raw.length) return null;
    const line = raw[i];
    if (indentOf(line) < minIndent) return null;
    const ind = indentOf(line);
    if (line.trim().startsWith('-')) return parseSeq(ind);
    return parseMap(ind);
  }
  function parseSeq(ind) {
    const arr = [];
    while (true) {
      skip();
      if (i >= raw.length) break;
      const l = raw[i];
      if (indentOf(l) !== ind || !l.trim().startsWith('-')) break;
      const rest = l.trim().replace(/^-\s*/, '');
      if (!rest) {
        i++;
        const child = parseNode(ind + 1);
        arr.push(child);
        continue;
      }
      const m = rest.match(/^([^:]+):\s*(.*)$/);
      if (m) {
        const obj = {};
        const key = stripQuotes(m[1]);
        const val = m[2];
        i++;
        if (val === '|' || val === '>') obj[key] = blockScalar(ind);
        else if (val === '') obj[key] = parseNode(ind + 1);
        else obj[key] = scalar(val);
        while (true) {
          skip();
          if (i >= raw.length) break;
          const n = raw[i];
          if (indentOf(n) <= ind) break;
          const km = n.trim().match(/^([^:]+):\s*(.*)$/);
          if (!km) { i++; continue; }
          const k2 = stripQuotes(km[1]);
          const v2 = km[2];
          i++;
          if (v2 === '|' || v2 === '>') obj[k2] = blockScalar(indentOf(n));
          else if (v2 === '') obj[k2] = parseNode(indentOf(n) + 1);
          else obj[k2] = scalar(v2);
        }
        arr.push(obj);
      } else {
        arr.push(scalar(rest));
        i++;
      }
    }
    return arr;
  }
  function parseMap(ind) {
    const obj = {};
    while (true) {
      skip();
      if (i >= raw.length) break;
      const l = raw[i];
      if (indentOf(l) !== ind) break;
      const t = l.trim();
      if (t.startsWith('-')) break;
      const m = t.match(/^([^:]+):\s*(.*)$/);
      if (!m) { i++; continue; }
      const key = stripQuotes(m[1]);
      const val = m[2];
      i++;
      if (val === '|' || val === '>') obj[key] = blockScalar(ind);
      else if (val === '') obj[key] = parseNode(ind + 1);
      else obj[key] = scalar(val);
    }
    return obj;
  }
  const result = parseNode(0);
  return result || {};
}

function splitFrontmatter(md) {
  const text = String(md || '').replace(/\r/g, '');
  const m = text.match(/^\s*---\n([\s\S]*?)\n---\s*(?:\n([\s\S]*))?$/);
  if (!m) return { data: null, body: text };
  return { data: m[1], body: (m[2] || '').trim() };
}

function applyConsult(profile, pains) {
  const ws = WORKSPACE_DIR;
  const names = {};
  const bots = [];
  (profile.team.bots || []).forEach((b) => {
    const bot = {
      id: uid('bot'),
      name: clampStr(String(b.name), 40),
      emoji: clampStr(String(b.emoji || '🤖'), 4),
      role: clampStr(String(b.role || 'general'), 20),
      model: clampStr(String(b.model || 'claude-sonnet-4-5'), 60),
      persona: clampStr(String(b.persona || ''), 4000),
      cwd: ws,
      pinned: !!b.pinned,
      color: '#7c9cff',
      keywords: Array.isArray(b.keywords) ? b.keywords.map(String).slice(0, 20) : [],
      createdAt: nowISO(),
    };
    store.bots.push(bot);
    bots.push(bot);
    names[bot.name] = bot.id;
  });
  const channels = [];
  (profile.team.channels || []).forEach((c) => {
    const members = (c.members || []).map((n) => names[n]).filter(Boolean);
    const ch = {
      id: uid('ch'),
      name: clampStr(String(c.name).replace(/^#/, ''), 40),
      mode: c.mode === 'mention' ? 'mention' : 'auto',
      botId: c.bot ? names[c.bot] || members[0] || null : members[0] || null,
      topic: clampStr(String(c.topic || ''), 200),
      pinned: false,
      members: members.length ? members : bots.map((b) => b.id),
      createdAt: nowISO(),
    };
    store.channels.push(ch);
    store.messages[ch.id] = [];
    channels.push(ch);
  });
  const main = channels[0] || null;
  if (main) {
    pushMessage(main.id, {
      kind: 'system',
      author: { type: 'system', name: 'MOA Hive 컨설턴트' },
      text: `**${profile.label}** 맞춤 팀을 만들었습니다 — 봇 ${bots.length}개 · 채널 ${channels.length}개.\n\n${profile.why}`,
    });
    if (bots[0]) {
      pushMessage(main.id, {
        kind: 'text',
        author: { type: 'bot', botId: bots[0].id, name: bots[0].name },
        text: `**바로 시작해 보세요**\n\n${profile.starterPrompt}`,
        meta: { engine: 'consult', engineLabel: '팀 컨설팅' },
      });
    }
    if (pains && pains.length) {
      pushMessage(main.id, {
        kind: 'system',
        author: { type: 'system', name: 'MOA Hive 컨설턴트' },
        text: `선택한 고민: ${pains.map((x) => '· ' + x).join(' / ')} — 이 팀이 그 지점을 나눠 맡습니다.`,
      });
    }
  }
  store.teams.push({
    id: uid('team'),
    name: profile.team.name,
    consultId: profile.id,
    pains: (pains || []).slice(0, 6),
    importedAt: nowISO(),
    bots: bots.length,
    channels: channels.length,
  });
  saveStore();
  return { profile: { id: profile.id, label: profile.label, name: profile.team.name }, bots: bots.map(botSafe), channels, mainChannelId: main ? main.id : null };
}

function importTeam(markdown) {
  const { data, body } = splitFrontmatter(markdown);
  if (!data) throw Object.assign(new Error('YAML frontmatter(--- ... ---)를 찾을 수 없습니다.'), { status: 400 });
  const y = parseYaml(data);
  const created = { bots: [], channels: [], team: null };
  const teamName = y.team || y.name || '가져온 팀';

  const botNames = new Map();
  (Array.isArray(y.bots) ? y.bots : []).forEach((b) => {
    if (!b || !b.name) return;
    const cwdCheck = validateCwd(b.cwd || '');
    const bot = {
      id: uid('bot'),
      name: clampStr(String(b.name), 40),
      emoji: clampStr(String(b.emoji || '🤖'), 4),
      role: clampStr(String(b.role || 'general'), 20),
      model: clampStr(String(b.model || 'claude-sonnet-4-5'), 60),
      persona: clampStr(String(b.persona || body || ''), 4000),
      cwd: cwdCheck.ok ? cwdCheck.path : WORKSPACE_DIR,
      pinned: !!b.pinned,
      color: clampStr(String(b.color || '#7c9cff'), 20),
      keywords: Array.isArray(b.keywords) ? b.keywords.map((k) => String(k)).slice(0, 20) : [],
      createdAt: nowISO(),
    };
    store.bots.push(bot);
    botNames.set(bot.name, bot.id);
    created.bots.push({ id: bot.id, name: bot.name, cwdOk: cwdCheck.ok, cwdError: cwdCheck.ok ? null : cwdCheck.error });
  });

  (Array.isArray(y.channels) ? y.channels : []).forEach((c) => {
    if (!c || !c.name) return;
    const members = (Array.isArray(c.members) ? c.members : Array.isArray(c.bots) ? c.bots : [])
      .map((n) => botNames.get(String(n)) || store.bots.find((b) => b.name === String(n))?.id)
      .filter(Boolean);
    const ch = {
      id: uid('ch'),
      name: clampStr(String(c.name).replace(/^#/, ''), 40),
      mode: c.mode === 'mention' ? 'mention' : 'auto',
      botId: c.bot ? botNames.get(String(c.bot)) || members[0] || null : members[0] || null,
      topic: clampStr(String(c.topic || ''), 200),
      pinned: !!c.pinned,
      members: members.length ? members : store.bots.map((b) => b.id),
      createdAt: nowISO(),
    };
    store.channels.push(ch);
    store.messages[ch.id] = [];
    created.channels.push({ id: ch.id, name: ch.name });
  });

  store.teams.push({ id: uid('team'), name: clampStr(String(teamName), 60), importedAt: nowISO(), bots: created.bots.length, channels: created.channels.length });
  saveStore();
  return { team: teamName, created };
}

/* ------------------------------------------------------------------ */
/* 팀 마켓                                                              */
/* ------------------------------------------------------------------ */
function loadMarket() {
  const packs = [];
  try {
    const files = fs.readdirSync(MARKET_DIR).filter((f) => f.endsWith('.md')).sort();
    for (const f of files) {
      const full = path.join(MARKET_DIR, f);
      const md = fs.readFileSync(full, 'utf8');
      const { data } = splitFrontmatter(md);
      if (!data) continue;
      const y = parseYaml(data);
      packs.push({
        id: (y.id || f.replace(/\.md$/, '')).toString(),
        tier: (y.tier || 'pro').toString(),
        title: (y.title || f).toString(),
        emoji: (y.emoji || '📦').toString(),
        tagline: (y.tagline || '').toString(),
        price: num(y.price, 0),
        priceLabel: (y.priceLabel || (num(y.price, 0) === 0 ? '무료' : `${num(y.price, 0).toLocaleString('ko-KR')}원`)).toString(),
        features: Array.isArray(y.features) ? y.features.map((x) => String(x)) : [],
        bots: num(y.botCount, Array.isArray(y.bots) ? y.bots.length : 0),
        channels: num(y.channelCount, Array.isArray(y.channels) ? y.channels.length : 0),
        installable: y.tier === 'free' || y.installable === true || y.installable === 'true',
        file: f,
        body: splitFrontmatter(md).body,
        purchaseUrl: (y.purchaseUrl || '').toString() || null,
      });
    }
  } catch (e) {
    console.error('[market]', e.message);
  }
  return packs;
}

/* ------------------------------------------------------------------ */
/* 대화 잡(job) 관리                                                    */
/* ------------------------------------------------------------------ */
const jobs = new Map(); // channelId -> { startedAt, botId }

function channelMessages(chId) {
  if (!Array.isArray(store.messages[chId])) store.messages[chId] = [];
  return store.messages[chId];
}

function pushMessage(chId, msg) {
  const m = Object.assign({ id: uid('msg'), channelId: chId, ts: nowISO(), kind: 'text' }, msg);
  channelMessages(chId).push(m);
  if (channelMessages(chId).length > 500) channelMessages(chId).splice(0, channelMessages(chId).length - 500);
  saveSoon();
  return m;
}

function pickBot(channel, text, preferredBotId) {
  const pool = store.bots.filter((b) => !channel.members || !channel.members.length || channel.members.includes(b.id));
  if (!pool.length) return null;
  if (preferredBotId) {
    const p = pool.find((b) => b.id === preferredBotId);
    if (p) return p;
  }
  // @멘션
  const mention = store.bots.find((b) => text.includes('@' + b.name) || text.includes('@' + b.name.replace(/\s+/g, '')));
  if (mention) return mention;
  if (channel.mode === 'mention' && channel.botId) {
    const b = pool.find((x) => x.id === channel.botId);
    if (b) return b;
  }
  if (channel.mode !== 'auto') return channel.botId ? pool.find((b) => b.id === channel.botId) || pool[0] : pool[0];

  // Auto 라우팅 점수
  let best = null;
  let bestScore = 0;
  for (const b of pool) {
    let score = 0;
    for (const kw of b.keywords || []) {
      if (kw && text.includes(kw)) score += 3;
    }
    if (text.includes(b.name)) score += 5;
    if (b.pinned) score += 0.5;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best || pool.find((b) => b.pinned) || pool[0];
}

async function generateReply(channel, bot, text) {
  const engines = detectEngines();
  const mode = engines.mode;
  const history = channelMessages(channel.id).slice(-12);
  let out = '';
  let usedMode = mode;
  let error = null;
  let orchestration = null;

  try {
    if (bot.isChief || bot.role === 'chief') {
      // 총괄 오케스트레이터: 하위 에이전트 위임 → 취합 보고
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
      const o = orchestrateReply(channel, bot, text);
      out = o.text;
      orchestration = o.orchestration;
      usedMode = 'orchestrator';
    } else if (mode === 'cli-claude' || mode === 'cli-codex') {
      out = await runCLI(mode, buildPrompt(bot, channel, text, history), bot.cwd);
    } else if (mode === 'api-anthropic') {
      out = await callAnthropic(bot, buildPrompt(bot, channel, text, history));
    } else if (mode === 'api-openai') {
      out = await callOpenAI(bot, buildPrompt(bot, channel, text, history));
    } else {
      await new Promise((r) => setTimeout(r, 450 + Math.random() * 500));
      out = simReply(bot, channel, text, history);
      usedMode = 'simulator';
    }
  } catch (e) {
    error = e.message;
    usedMode = 'simulator(fallback)';
    out = `⚠️ ${ENGINE_LABEL[mode] || mode} 호출 실패: ${e.message}\n\n아래는 로컬 시뮬레이터 응답입니다.\n\n${simReply(bot, channel, text, history)}`;
  }

  const meta = { engine: usedMode, engineLabel: ENGINE_LABEL[mode] || mode, model: bot.model, error };
  if (orchestration) meta.orchestration = orchestration;
  pushMessage(channel.id, { kind: 'text', author: { type: 'bot', botId: bot.id, name: bot.name }, text: out, meta });

  // 실행/파일 제안 → 승인 카드
  const plan = planAction(bot, text, channel);
  if (plan) {
    const v = plan.kind === 'shell' ? validateCommand(bot.cwd, plan.command) : validateFilePath(bot.cwd, plan.path);
    if (!v.ok) {
      pushMessage(channel.id, {
        kind: 'system',
        author: { type: 'system', name: 'MOA Hive 보안' },
        text: `승인 카드를 만들지 않았습니다 — ${v.error}`,
      });
    } else {
      const approval = {
        id: uid('apr'),
        channelId: channel.id,
        botId: bot.id,
        botName: bot.name,
        kind: plan.kind,
        action: plan.kind === 'shell' ? { command: plan.command } : { path: v.rel, bytes: Buffer.byteLength(plan.content) },
        payload: plan.kind === 'write' ? { path: v.rel, content: plan.content } : null,
        reason: plan.reason,
        status: 'pending',
        createdAt: nowISO(),
        cwd: bot.cwd,
      };
      // 자동 승인 규칙: 읽기 전용 명령만 즉시 실행
      const rule = plan.kind === 'shell' ? (store.settings.autoRules || []).find((r) => (r.commands || []).includes(v.argv[0])) : null;
      if (rule && READONLY_CMDS.has(v.argv[0])) {
        store.approvals.unshift(approval);
        const res = executeApproval(approval);
        approval.status = res.ok ? 'allowed' : 'failed';
        approval.decidedAt = nowISO();
        approval.result = { ok: res.ok, code: res.code ?? null, output: (res.output || res.error || '').slice(0, 2000) };
        approval.autoRule = rule.label;
        pushMessage(channel.id, {
          kind: 'result',
          author: { type: 'system', name: 'MOA Hive' },
          text: `⚡ 자동 승인 규칙(${rule.label})으로 실행했습니다.\n\`\`\`\n$ ${approval.action.command}\n${approval.result.output}\n\`\`\``,
          approvalId: approval.id,
          meta: { engine: 'auto-rule', exitCode: res.code ?? null },
        });
      } else {
        store.approvals.unshift(approval);
        pushMessage(channel.id, {
          kind: 'approval',
          author: { type: 'bot', botId: bot.id, name: bot.name },
          text: plan.reason,
          approvalId: approval.id,
          approval: { kind: plan.kind, command: approval.action.command, path: approval.action.path, bytes: approval.action.bytes, status: 'pending' },
          meta,
        });
      }
    }
  }

  // 총괄 모드: 인라인 제안 카드(추가 에이전트 / 자동 승인 규칙)
  if (bot.isChief || bot.role === 'chief') {
    maybeProposal(channel, bot);
  }
}

/* ------------------------------------------------------------------ */
/* 승인 실행                                                            */
/* ------------------------------------------------------------------ */
function executeApproval(apr) {
  if (apr.kind === 'shell') {
    const v = validateCommand(apr.cwd, apr.action.command);
    if (!v.ok) return { ok: false, error: v.error };
    try {
      const r = cp.spawnSync(v.argv[0], v.argv.slice(1), {
        cwd: v.cwd,
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        env: Object.assign({}, process.env, { MAUS_SANDBOX: '1' }),
      });
      const out = ((r.stdout || '') + (r.stderr ? '\n[stderr] ' + r.stderr : '')).slice(0, 4000);
      return { ok: r.status === 0, code: r.status, output: out || '(출력 없음)' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  if (apr.kind === 'write') {
    const v = validateFilePath(apr.cwd, apr.payload.path);
    if (!v.ok) return { ok: false, error: v.error };
    try {
      fs.mkdirSync(path.dirname(v.path), { recursive: true });
      fs.writeFileSync(v.path, apr.payload.content, 'utf8');
      return { ok: true, output: `저장됨: ${v.rel} (${Buffer.byteLength(apr.payload.content)} bytes)` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: '알 수 없는 작업 종류입니다.' };
}

/* ------------------------------------------------------------------ */
/* 라우팅                                                              */
/* ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  let base = PUBLIC_DIR;
  if (rel === '/config.js') {
    const file = path.join(ROOT, 'config.js');
    const body = fs.readFileSync(file, 'utf8');
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(body);
  }
  const file = path.normalize(path.join(base, rel));
  if (!isInside(base, file)) return jsonRes(res, 403, { error: 'forbidden' });
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    // SPA fallback
    const idx = path.join(base, 'index.html');
    if (fs.existsSync(idx)) {
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' });
      return res.end(fs.readFileSync(idx));
    }
    return jsonRes(res, 404, { error: 'not found' });
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

function botSafe(b) {
  return {
    id: b.id, name: b.name, emoji: b.emoji, role: b.role, model: b.model, persona: b.persona,
    cwd: b.cwd, pinned: !!b.pinned, color: b.color, keywords: b.keywords || [], createdAt: b.createdAt,
  };
}

/* ------------------------------------------------------------------ */
/* 모바일 원격 접속 (부가 기능)                                          */
/* 기본은 127.0.0.1 전용. 같은 Wi-Fi 접속을 켤 때만 0.0.0.0 + 접속 토큰.   */
/* ------------------------------------------------------------------ */
let LAN_MODE = false;
let BIND_HOST = HOST;
let ACCESS_TOKEN = '';
let FORCE_TOKEN = process.env.MOA_REQUIRE_TOKEN === '1'; // 터널 사용 시 토큰 상시 요구

function initRemote() {
  const flag = process.env.MOA_ALLOW_LAN === '1' || !!(CONFIG.remote && CONFIG.remote.allowLan) || !!(store.settings.remote && store.settings.remote.allowLan);
  LAN_MODE = flag;
  BIND_HOST = flag ? '0.0.0.0' : HOST;
  if (!flag && !FORCE_TOKEN) return;
  if (!store.settings.remote) store.settings.remote = { allowLan: flag, token: '' };
  if (!store.settings.remote.token) {
    store.settings.remote.token = crypto.randomBytes(9).toString('base64url');
    saveStore();
  }
  ACCESS_TOKEN = store.settings.remote.token;
}

function isLoopback(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

function cookieVal(req, name) {
  const c = req.headers.cookie || '';
  const hit = c.split(/;\s*/).find((x) => x.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
}

function tokenOk(req, url) {
  const t = url.searchParams.get('token') || req.headers['x-moa-token'] || cookieVal(req, 'moa_token');
  return !!ACCESS_TOKEN && t === ACCESS_TOKEN;
}

function lanUrls() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const k of Object.keys(nets)) {
    for (const n of nets[k] || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(`http://${n.address}:${PORT}/?token=${encodeURIComponent(ACCESS_TOKEN)}`);
    }
  }
  return out;
}

function authPage(res, ok) {
  res.writeHead(ok ? 200 : 401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MOA Hive 접속</title>
<body style="font-family:-apple-system,Pretendard,sans-serif;background:#0a0d16;color:#e8ecf6;padding:28px;line-height:1.6">
<h2 style="margin:0 0 8px">MOA Hive</h2>
<p style="color:#8b93a7;font-size:14px">${ok ? '연결되었습니다. 앱으로 이동하세요.' : '이 기기는 아직 등록되지 않았습니다. Mac의 MOA Hive → 설정 → 모바일 접속에 표시된 접속 토큰을 입력하세요.'}</p>
<form style="display:flex;gap:8px;margin-top:14px"><input name="token" placeholder="접속 토큰" style="flex:1;padding:12px;border-radius:10px;border:1px solid #333c55;background:#121724;color:#fff"><button style="padding:12px 16px;border-radius:10px;border:0;background:#7c9cff;color:#0a0d18;font-weight:700">접속</button></form>
</body></html>`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const p = url.pathname;
  const method = req.method;

  // 보안 헤더
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');

  const needAuth = (LAN_MODE && !isLoopback(req)) || FORCE_TOKEN;

  if (!p.startsWith('/api/')) {
    if (needAuth && !tokenOk(req, url)) return authPage(res, false);
    return serveStatic(req, res, p);
  }

  // 원격(비루프백)·터널 요청은 접속 토큰 필요
  if (needAuth) {
    if (url.searchParams.get('token') === ACCESS_TOKEN) {
      res.setHeader('set-cookie', `moa_token=${encodeURIComponent(ACCESS_TOKEN)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    } else if (!tokenOk(req, url)) {
      return jsonRes(res, 401, { error: '접속 토큰이 필요합니다.', hint: 'Mac의 설정 → 모바일 접속에서 토큰을 확인하세요.' });
    }
  }

  // PROD는 읽기 전용 — 모든 변경은 STG에서 하고 승격으로만 반영
  const isWrite = method !== 'GET' && method !== 'HEAD';
  if (isWrite && ACTIVE_ENV === 'prod' && p !== '/api/env' && p !== '/api/promote') {
    return jsonRes(res, 403, { error: 'PROD는 읽기 전용입니다. STG에서 변경한 뒤 Release Manager에서 승격하세요.', env: 'prod' });
  }

  try {
    /* --- 모바일 원격 접속 --- */
    if (p === '/api/remote' && method === 'GET') {
      return jsonRes(res, 200, {
        enabled: LAN_MODE || FORCE_TOKEN,
        lanEnabled: LAN_MODE,
        forceToken: FORCE_TOKEN,
        bind: BIND_HOST,
        port: PORT,
        localUrl: `http://127.0.0.1:${PORT}`,
        lanUrls: LAN_MODE ? lanUrls() : [],
        token: ACCESS_TOKEN || null,
        sameWifi: '같은 Wi-Fi에서 위 주소를 열고 토큰을 한 번 입력하면 홈 화면에 추가해 앱처럼 쓸 수 있습니다.',
        tunnels: [
          { name: 'Tailscale', cmd: `tailscale serve --bg ${PORT}`, note: '같은 tailnet 기기에서 https://<기기>.ts.net 으로 접속' },
          { name: 'Cloudflare Tunnel', cmd: `cloudflared tunnel --url http://127.0.0.1:${PORT}`, note: '발급된 trycloudflare.com 주소를 휴대폰에서 열기' },
        ],
        restartRequired: !!(store.settings.remote && !!store.settings.remote.allowLan !== LAN_MODE),
      });
    }
    if (p === '/api/remote' && method === 'POST') {
      const b = await readBody(req);
      if (b.allowLan === undefined) return jsonRes(res, 400, { error: 'allowLan(boolean)이 필요합니다.' });
      store.settings.remote = Object.assign({ allowLan: false, token: '' }, store.settings.remote || {}, { allowLan: !!b.allowLan });
      saveStore();
      return jsonRes(res, 200, { settings: publicSettings(), restartRequired: !!b.allowLan !== LAN_MODE, note: '적용하려면 서버를 재시작하세요.' });
    }

    /* --- 상태 --- */
    if (p === '/api/health' && method === 'GET') {
      return jsonRes(res, 200, {
        ok: true, app: 'MOA Hive', version: versions.prod.version, stg: versions.stg.version,
        env: ACTIVE_ENV, host: HOST, port: PORT, uptime: process.uptime(),
      });
    }
    if (p === '/api/state' && method === 'GET') {
      const channelId = url.searchParams.get('channelId') || store.channels[0]?.id;
      return jsonRes(res, 200, {
        bots: store.bots.map(botSafe),
        channels: store.channels,
        settings: publicSettings(),
        engines: detectEngines(),
        approvals: store.approvals.slice(0, 40),
        proposals: store.proposals.slice(0, 40),
        teams: store.teams,
        consultApplied: store.teams.filter((t) => t.consultId).map((t) => t.consultId),
        activeChannelId: channelId,
        messages: channelMessages(channelId),
        typing: jobs.has(channelId) ? jobs.get(channelId) : null,
        env: {
          active: ACTIVE_ENV,
          label: ENV_LABEL[ACTIVE_ENV],
          stg: { label: ENV_LABEL.stg, version: versions.stg.version, badge: `STG v${versions.stg.version}` },
          prod: { label: ENV_LABEL.prod, version: versions.prod.version, badge: `PROD v${versions.prod.version}` },
          pending: storeDiff().pending,
          readOnly: ACTIVE_ENV === 'prod',
        },
        serverTime: nowISO(),
      });
    }

    /* --- 환경(STG/PROD) --- */
    if (p === '/api/env' && method === 'GET') {
      return jsonRes(res, 200, {
        active: ACTIVE_ENV,
        envs: {
          stg: { label: ENV_LABEL.stg, version: versions.stg.version, badge: `STG v${versions.stg.version}`, file: 'data/stg-store.json', readOnly: false },
          prod: { label: ENV_LABEL.prod, version: versions.prod.version, badge: `PROD v${versions.prod.version}`, file: 'data/prod-store.json', readOnly: true },
        },
        diff: storeDiff(),
      });
    }
    if (p === '/api/env' && method === 'POST') {
      const b = await readBody(req);
      if (!['stg', 'prod'].includes(b.active)) return jsonRes(res, 400, { error: "active는 'stg' 또는 'prod'여야 합니다." });
      ACTIVE_ENV = b.active;
      store = envStores[ACTIVE_ENV];
      jobs.clear();
      return jsonRes(res, 200, {
        active: ACTIVE_ENV,
        store: { bots: store.bots.map(botSafe), channels: store.channels, messages: channelMessages(store.channels[0]?.id), teams: store.teams, settings: publicSettings() },
      });
    }

    /* --- 승격(Release Manager) --- */
    if (p === '/api/promote' && method === 'GET') {
      const diff = storeDiff();
      return jsonRes(res, 200, {
        ready: diff.pending,
        diff,
        stg: versions.stg,
        prod: versions.prod,
        nextVersion: String(versions.stg.version || '').replace(/-rc\.?\d*$/, ''),
      });
    }
    if (p === '/api/promote' && method === 'POST') {
      const b = await readBody(req);
      if (b.confirm !== true) {
        return jsonRes(res, 400, { error: "최종 확인이 필요합니다. { confirm: true }와 함께 다시 요청하세요." });
      }
      const diff = storeDiff();
      if (!diff.pending) return jsonRes(res, 409, { error: '승격할 변경 사항이 없습니다.', diff });
      const out = promoteToProd(clampStr(String(b.note || ''), 200));
      return jsonRes(res, 200, {
        ok: true,
        version: out.version,
        promotedFrom: out.entry.title,
        changes: out.entry.changes,
        diff: out.diff,
        releases: versions.releases.slice(0, 10),
      });
    }

    /* --- 변경 이력 --- */
    if (p === '/api/changelog' && method === 'GET') {
      let markdown = '';
      try { markdown = fs.readFileSync(CHANGELOG_FILE, 'utf8'); } catch (e) {}
      return jsonRes(res, 200, { app: 'MOA Hive', versions, releases: versions.releases, entries: parseChangelog(), markdown });
    }

    /* --- 엔진 --- */
    if (p === '/api/engines' && method === 'GET') {
      const force = url.searchParams.get('refresh') === '1';
      return jsonRes(res, 200, detectEngines(force));
    }

    /* --- 봇 --- */
    if (p === '/api/bots' && method === 'GET') return jsonRes(res, 200, { bots: store.bots.map(botSafe) });
    if (p === '/api/bots' && method === 'POST') {
      const b = await readBody(req);
      if (!b.name) return jsonRes(res, 400, { error: '봇 이름이 필요합니다.' });
      const cwdCheck = validateCwd(b.cwd || WORKSPACE_DIR);
      if (!cwdCheck.ok) return jsonRes(res, 400, { error: `cwd 거부: ${cwdCheck.error}` });
      const bot = {
        id: uid('bot'),
        name: clampStr(String(b.name), 40),
        emoji: clampStr(String(b.emoji || '🤖'), 4),
        role: clampStr(String(b.role || 'general'), 20),
        model: clampStr(String(b.model || 'claude-sonnet-4-5'), 60),
        persona: clampStr(String(b.persona || ''), 4000),
        cwd: cwdCheck.path,
        pinned: !!b.pinned,
        color: clampStr(String(b.color || '#7c9cff'), 20),
        keywords: Array.isArray(b.keywords) ? b.keywords.map(String).slice(0, 20) : String(b.keywords || '').split(',').map((s) => s.trim()).filter(Boolean),
        createdAt: nowISO(),
      };
      store.bots.push(bot);
      // 모든 채널 멤버에 추가(새 봇은 기본 전체 채널 소속)
      store.channels.forEach((c) => {
        if (!c.members) c.members = [];
        if (!c.members.includes(bot.id)) c.members.push(bot.id);
      });
      saveStore();
      return jsonRes(res, 201, { bot: botSafe(bot) });
    }
    const actMatch = p.match(/^\/api\/bots\/([\w-]+)\/activity$/);
    if (actMatch && method === 'GET') {
      const id = actMatch[1];
      const bot = store.bots.find((b) => b.id === id);
      if (!bot) return jsonRes(res, 404, { error: '봇을 찾을 수 없습니다.' });
      const items = [];
      for (const ch of store.channels) {
        for (const m of store.messages[ch.id] || []) {
          if (m.author && m.author.botId === id) {
            items.push({ id: m.id, channel: '#' + ch.name, channelId: ch.id, kind: m.kind, text: (m.text || '').slice(0, 160), ts: m.ts });
          }
        }
      }
      items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
      const engines = detectEngines();
      return jsonRes(res, 200, {
        bot: botSafe(bot),
        summary: String(bot.persona || '').split(/(?<=[.!?])\s/)[0].slice(0, 120),
        engine: engines.mode,
        engineLabel: ENGINE_LABEL[engines.mode] || engines.mode,
        working: [...jobs.values()].some((j) => j.botId === id || (j.delegateIds || []).includes(id)),
        activity: items.slice(0, 6),
      });
    }

    const botMatch = p.match(/^\/api\/bots\/([\w-]+)$/);
    if (botMatch) {
      const id = botMatch[1];
      const idx = store.bots.findIndex((b) => b.id === id);
      if (idx < 0) return jsonRes(res, 404, { error: '봇을 찾을 수 없습니다.' });
      if (method === 'PATCH') {
        const b = await readBody(req);
        const cur = store.bots[idx];
        if (b.cwd !== undefined) {
          const v = validateCwd(b.cwd);
          if (!v.ok) return jsonRes(res, 400, { error: `cwd 거부: ${v.error}` });
          cur.cwd = v.path;
        }
        if (b.name !== undefined) cur.name = clampStr(String(b.name), 40) || cur.name;
        if (b.emoji !== undefined) cur.emoji = clampStr(String(b.emoji), 4) || cur.emoji;
        if (b.role !== undefined) cur.role = clampStr(String(b.role), 20);
        if (b.model !== undefined) cur.model = clampStr(String(b.model), 60);
        if (b.persona !== undefined) cur.persona = clampStr(String(b.persona), 4000);
        if (b.pinned !== undefined) cur.pinned = !!b.pinned;
        if (b.color !== undefined) cur.color = clampStr(String(b.color), 20);
        if (b.keywords !== undefined)
          cur.keywords = Array.isArray(b.keywords) ? b.keywords.map(String).slice(0, 20) : String(b.keywords).split(',').map((s) => s.trim()).filter(Boolean);
        saveStore();
        return jsonRes(res, 200, { bot: botSafe(cur) });
      }
      if (method === 'DELETE') {
        store.bots.splice(idx, 1);
        store.channels.forEach((c) => { c.members = (c.members || []).filter((m) => m !== id); if (c.botId === id) c.botId = null; });
        saveStore();
        return jsonRes(res, 200, { ok: true, deleted: id });
      }
    }

    /* --- 채널 --- */
    if (p === '/api/channels' && method === 'GET') return jsonRes(res, 200, { channels: store.channels });
    if (p === '/api/channels' && method === 'POST') {
      const b = await readBody(req);
      if (!b.name) return jsonRes(res, 400, { error: '채널 이름이 필요합니다.' });
      const ch = {
        id: uid('ch'),
        name: clampStr(String(b.name).replace(/^#/, ''), 40),
        mode: b.mode === 'mention' ? 'mention' : 'auto',
        botId: b.botId || null,
        topic: clampStr(String(b.topic || ''), 200),
        pinned: !!b.pinned,
        members: Array.isArray(b.members) && b.members.length ? b.members : store.bots.map((x) => x.id),
        createdAt: nowISO(),
      };
      store.channels.push(ch);
      store.messages[ch.id] = [];
      saveStore();
      return jsonRes(res, 201, { channel: ch });
    }
    const chMatch = p.match(/^\/api\/channels\/([\w-]+)$/);
    if (chMatch) {
      const id = chMatch[1];
      const idx = store.channels.findIndex((c) => c.id === id);
      if (idx < 0) return jsonRes(res, 404, { error: '채널을 찾을 수 없습니다.' });
      if (method === 'PATCH') {
        const b = await readBody(req);
        const c = store.channels[idx];
        if (b.name !== undefined) c.name = clampStr(String(b.name).replace(/^#/, ''), 40) || c.name;
        if (b.mode !== undefined) c.mode = b.mode === 'mention' ? 'mention' : 'auto';
        if (b.botId !== undefined) c.botId = b.botId;
        if (b.topic !== undefined) c.topic = clampStr(String(b.topic), 200);
        if (b.pinned !== undefined) c.pinned = !!b.pinned;
        if (Array.isArray(b.members)) c.members = b.members;
        saveStore();
        return jsonRes(res, 200, { channel: c });
      }
      if (method === 'DELETE') {
        store.channels.splice(idx, 1);
        delete store.messages[id];
        saveStore();
        return jsonRes(res, 200, { ok: true, deleted: id });
      }
    }

    /* --- 메시지 --- */
    if (p === '/api/messages' && method === 'GET') {
      const chId = url.searchParams.get('channelId');
      if (!chId || !store.channels.find((c) => c.id === chId)) return jsonRes(res, 404, { error: '채널을 찾을 수 없습니다.' });
      return jsonRes(res, 200, {
        messages: channelMessages(chId),
        typing: jobs.has(chId) ? jobs.get(chId) : null,
        engines: detectEngines(),
      });
    }
    if (p === '/api/messages' && method === 'POST') {
      const b = await readBody(req);
      const chId = b.channelId;
      const channel = store.channels.find((c) => c.id === chId);
      if (!channel) return jsonRes(res, 404, { error: '채널을 찾을 수 없습니다.' });
      const text = clampStr(String(b.text || '').trim(), MAX_MSG);
      if (!text) return jsonRes(res, 400, { error: '메시지가 비어 있습니다.' });
      if (jobs.has(chId)) return jsonRes(res, 429, { error: '이 채널의 봇이 아직 응답 중입니다.' });

      const userMsg = pushMessage(chId, { kind: 'text', author: { type: 'user', name: '나' }, text });
      const bot = pickBot(channel, text, b.botId);
      if (!bot) {
        pushMessage(chId, { kind: 'system', author: { type: 'system', name: 'MOA Hive' }, text: '이 채널에 배정된 봇이 없습니다. 봇을 추가하거나 채널 멤버를 설정하세요.' });
        return jsonRes(res, 200, { userMessage: userMsg, replied: null, reason: 'no-bot' });
      }
      const delegateIds = bot.isChief || bot.role === 'chief' ? subAgents(channel, bot).map((b) => b.id) : [];
      jobs.set(chId, { startedAt: nowISO(), botId: bot.id, botName: bot.name, delegateIds, delegating: delegateIds.length > 0 });
      generateReply(channel, bot, text)
        .catch((e) => {
          pushMessage(chId, { kind: 'system', author: { type: 'system', name: 'MOA Hive' }, text: `응답 생성 오류: ${e.message}` });
        })
        .finally(() => { jobs.delete(chId); saveStore(); });

      return jsonRes(res, 200, { userMessage: userMsg, routedTo: { id: bot.id, name: bot.name }, typing: true });
    }

    /* --- 승인 --- */
    if (p === '/api/approvals' && method === 'GET') {
      return jsonRes(res, 200, { approvals: store.approvals.slice(0, 100) });
    }
    if (p === '/api/approve' && method === 'POST') {
      const b = await readBody(req);
      const ap = store.approvals.find((a) => a.id === b.id);
      if (!ap) return jsonRes(res, 404, { error: '승인 요청을 찾을 수 없습니다.' });
      if (ap.status !== 'pending') return jsonRes(res, 409, { error: `이미 처리된 요청입니다 (${ap.status}).`, approval: ap });
      const decision = b.decision === 'allow' ? 'allow' : b.decision === 'deny' ? 'deny' : null;
      if (!decision) return jsonRes(res, 400, { error: "decision은 'allow' 또는 'deny'여야 합니다." });

      if (decision === 'deny') {
        ap.status = 'denied';
        ap.decidedAt = nowISO();
        const msg = pushMessage(ap.channelId, {
          kind: 'result', author: { type: 'system', name: 'MOA Hive' },
          text: `❌ 거절됨 — ${ap.kind === 'shell' ? '`' + ap.action.command + '`' : '`' + ap.action.path + '`'} 실행하지 않았습니다.`,
          approvalId: ap.id,
        });
        saveStore();
        return jsonRes(res, 200, { approval: ap, message: msg });
      }

      const result = executeApproval(ap);
      ap.status = result.ok ? 'allowed' : 'failed';
      ap.decidedAt = nowISO();
      ap.result = { ok: result.ok, code: result.code ?? null, output: (result.output || result.error || '').slice(0, 2000) };
      const msg = pushMessage(ap.channelId, {
        kind: 'result', author: { type: 'system', name: 'MOA Hive' },
        text:
          (result.ok ? '✅ 승인 실행 완료' : '⚠️ 승인했지만 실행 실패') +
          `\n\`\`\`\n${ap.kind === 'shell' ? '$ ' + ap.action.command : ap.action.path}\n${ap.result.output}\n\`\`\``,
        approvalId: ap.id,
        meta: { engine: 'approval-broker', exitCode: result.code ?? null },
      });
      saveStore();
      return jsonRes(res, 200, { approval: ap, message: msg });
    }

    /* --- 팀 컨설팅(Setup Wizard) --- */
    if (p === '/api/consult' && method === 'GET') {
      const applied = store.teams.filter((t) => t.consultId).map((t) => t.consultId);
      return jsonRes(res, 200, {
        profiles: CONSULT.map((c) => ({
          id: c.id,
          label: c.label,
          emoji: c.emoji,
          tagline: c.tagline,
          pains: c.pains,
          why: c.why,
          usage: c.usage,
          starterPrompt: c.starterPrompt,
          teamName: c.team.name,
          bots: (c.team.bots || []).map((b) => ({ name: b.name, emoji: b.emoji, role: b.role })),
          channels: (c.team.channels || []).map((x) => ({ name: x.name, mode: x.mode })),
          applied: applied.includes(c.id),
        })),
        applied,
      });
    }
    if (p === '/api/consult/apply' && method === 'POST') {
      const b = await readBody(req);
      const profile = CONSULT.find((c) => c.id === b.id);
      if (!profile) return jsonRes(res, 404, { error: '컨설팅 프로필을 찾을 수 없습니다.' });
      if (!b.force && store.teams.some((t) => t.consultId === profile.id)) {
        return jsonRes(res, 409, { error: '이미 같은 팀을 만들었습니다. 새로 만들려면 force:true로 요청하세요.' });
      }
      const pains = Array.isArray(b.pains) ? b.pains.map((x) => String(x).slice(0, 80)).slice(0, 6) : [];
      const out = applyConsult(profile, pains);
      return jsonRes(res, 201, Object.assign({ ok: true, team: profile.team.name, pains }, out));
    }

    /* --- 자유 목적 분석 · 오케스트레이터 --- */
    if (p === '/api/consult/analyze' && method === 'POST') {
      const b = await readBody(req);
      const text = clampStr(String(b.text || '').trim(), 500);
      if (!text) return jsonRes(res, 400, { error: '목적을 입력해 주세요.' });
      const plan = analyzePurpose(text);
      if (b.create === true) {
        const created = applyOrchestrator(plan);
        return jsonRes(res, 201, { plan, created });
      }
      return jsonRes(res, 200, { plan });
    }
    if (p === '/api/orchestrator/apply' && method === 'POST') {
      const b = await readBody(req);
      const text = clampStr(String(b.text || '').trim(), 500);
      const plan = b.plan && b.plan.agents ? b.plan : analyzePurpose(text);
      if (!plan.agents || !plan.agents.length) return jsonRes(res, 400, { error: '설계할 에이전트가 없습니다.' });
      const created = applyOrchestrator(plan);
      return jsonRes(res, 201, { ok: true, plan, created });
    }
    if (p === '/api/proposals' && method === 'GET') {
      return jsonRes(res, 200, { proposals: store.proposals.slice(0, 50) });
    }
    if (p === '/api/proposal' && method === 'POST') {
      const b = await readBody(req);
      const prop = store.proposals.find((x) => x.id === b.id);
      if (!prop) return jsonRes(res, 404, { error: '제안을 찾을 수 없습니다.' });
      if (prop.status !== 'pending') return jsonRes(res, 409, { error: `이미 처리된 제안입니다 (${prop.status}).` });
      const decision = b.decision === 'accept' ? 'accept' : b.decision === 'pass' ? 'pass' : null;
      if (!decision) return jsonRes(res, 400, { error: "decision은 'accept' 또는 'pass'여야 합니다." });
      prop.decidedAt = nowISO();
      if (decision === 'pass') {
        prop.status = 'passed';
        pushMessage(prop.channelId, { kind: 'system', author: { type: 'system', name: 'MOA Hive' }, text: `⏭️ 제안을 넘겼습니다 — ${prop.title}`, proposalId: prop.id });
        saveStore();
        return jsonRes(res, 200, { proposal: prop });
      }
      let result = null;
      if (prop.action.type === 'add-bot') {
        const spec = prop.action.bot || {};
        const cwdCheck = validateCwd(WORKSPACE_DIR);
        const bot = {
          id: uid('bot'),
          name: clampStr(String(spec.name || '새 에이전트'), 40),
          emoji: clampStr(String(spec.emoji || '🤖'), 4),
          role: clampStr(String(spec.role || 'general'), 20),
          model: 'claude-sonnet-4-5',
          persona: clampStr(String(spec.persona || ''), 4000),
          cwd: cwdCheck.ok ? cwdCheck.path : WORKSPACE_DIR,
          pinned: false,
          color: '#7c9cff',
          keywords: Array.isArray(spec.keywords) ? spec.keywords.map(String) : [],
          createdAt: nowISO(),
        };
        store.bots.push(bot);
        const ch = store.channels.find((c) => c.id === prop.channelId);
        if (ch) {
          ch.members = ch.members || [];
          if (!ch.members.includes(bot.id)) ch.members.push(bot.id);
        }
        result = { type: 'bot', bot: botSafe(bot) };
        pushMessage(prop.channelId, { kind: 'system', author: { type: 'system', name: 'MOA Hive' }, text: `✅ ${bot.emoji} ${bot.name}을(를) 팀에 붙였습니다.`, proposalId: prop.id });
      } else if (prop.action.type === 'rule') {
        const rule = prop.action.rule || {};
        const entry = { id: uid('rule'), label: clampStr(String(rule.label || '자동 승인 규칙'), 60), commands: (rule.commands || []).filter((c) => READONLY_CMDS.has(c)), createdAt: nowISO() };
        store.settings.autoRules = store.settings.autoRules || [];
        store.settings.autoRules.push(entry);
        result = { type: 'rule', rule: entry };
        pushMessage(prop.channelId, { kind: 'system', author: { type: 'system', name: 'MOA Hive' }, text: `✅ 자동 승인 규칙 추가 — ${entry.label} (${entry.commands.join(', ') || '없음'}). 읽기 전용 명령만 적용됩니다.`, proposalId: prop.id });
      }
      prop.status = 'accepted';
      saveStore();
      return jsonRes(res, 200, { proposal: prop, result });
    }

    /* --- 팀 임포트 --- */
    if (p === '/api/import-team' && method === 'POST') {
      const b = await readBody(req);
      const md = b.markdown || b.md || '';
      if (!md.trim()) return jsonRes(res, 400, { error: '팀 정의 마크다운이 비어 있습니다.' });
      const out = importTeam(md);
      return jsonRes(res, 201, out);
    }
    if (p === '/api/import-template' && method === 'GET') {
      const tpl = path.join(ROOT, 'market', 'starter-pack.md');
      if (!fs.existsSync(tpl)) return jsonRes(res, 404, { error: '템플릿이 없습니다.' });
      return jsonRes(res, 200, { markdown: fs.readFileSync(tpl, 'utf8') });
    }

    /* --- 마켓 --- */
    if (p === '/api/market' && method === 'GET') {
      const packs = loadMarket().map((x) => ({ ...x, body: undefined, purchaseUrl: x.purchaseUrl || (x.tier === 'pro' ? store.settings.market.storeUrl : null) }));
      return jsonRes(res, 200, { packs, market: publicSettings().market });
    }
    const packPrev = p.match(/^\/api\/market\/([\w-]+)\/preview$/);
    if (packPrev && method === 'GET') {
      const pack = loadMarket().find((x) => x.id === packPrev[1]);
      if (!pack) return jsonRes(res, 404, { error: '팩을 찾을 수 없습니다.' });
      const raw = fs.readFileSync(path.join(MARKET_DIR, pack.file), 'utf8');
      return jsonRes(res, 200, { pack: { id: pack.id, title: pack.title, tier: pack.tier, priceLabel: pack.priceLabel }, markdown: raw });
    }
    const packInstall = p.match(/^\/api\/market\/([\w-]+)\/install$/);
    if (packInstall && method === 'POST') {
      const pack = loadMarket().find((x) => x.id === packInstall[1]);
      if (!pack) return jsonRes(res, 404, { error: '팩을 찾을 수 없습니다.' });
      const b = await readBody(req);
      const unlocked = pack.tier === 'free' || pack.installable || store.settings.market.demoUnlock || (b.license && String(b.license).trim().length >= 6);
      if (!unlocked) {
        return jsonRes(res, 402, {
          error: 'Pro 팩입니다. 구매 링크에서 결제한 뒤 라이선스 키를 입력하면 설치됩니다.',
          purchaseUrl: pack.purchaseUrl || store.settings.market.storeUrl,
        });
      }
      const raw = fs.readFileSync(path.join(MARKET_DIR, pack.file), 'utf8');
      const out = importTeam(raw);
      return jsonRes(res, 201, Object.assign({ pack: pack.title }, out));
    }

    /* --- 설정 --- */
    if (p === '/api/settings' && method === 'GET') return jsonRes(res, 200, { settings: publicSettings() });
    if (p === '/api/settings' && method === 'PATCH') {
      const b = await readBody(req);
      const s = store.settings;
      if (b.allowedRoot !== undefined) {
        const raw = String(b.allowedRoot || '').trim();
        if (raw === '') {
          s.allowedRoot = '';
        } else {
          if (raw.includes('\0')) return jsonRes(res, 400, { error: '허용되지 않는 문자가 있습니다.' });
          const abs = realish(path.resolve(expandHome(raw)));
          if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return jsonRes(res, 400, { error: '존재하는 폴더 경로가 필요합니다.' });
          s.allowedRoot = abs;
        }
      }
      if (b.enginePreferred !== undefined) {
        const allowed = ['auto', 'cli-claude', 'cli-codex', 'api-anthropic', 'api-openai', 'simulator'];
        if (!allowed.includes(b.enginePreferred)) return jsonRes(res, 400, { error: '알 수 없는 엔진 설정입니다.' });
        s.enginePreferred = b.enginePreferred;
      }
      if (b.apiKeys && typeof b.apiKeys === 'object') {
        for (const prov of ['anthropic', 'openai']) {
          const v = b.apiKeys[prov];
          if (v === undefined) continue;
          if (v === '' || v === null) {
            s.apiKeys[prov] = { key: '', updatedAt: null };
          } else if (typeof v === 'string') {
            if (v.length > 300) return jsonRes(res, 400, { error: 'API 키가 너무 깁니다.' });
            s.apiKeys[prov] = { key: v.trim(), updatedAt: nowISO() };
          }
        }
        engineCache.at = 0;
      }
      if (b.pickle && typeof b.pickle === 'object') {
        s.pickle = Object.assign({}, s.pickle, {
          enabled: b.pickle.enabled !== undefined ? !!b.pickle.enabled : s.pickle.enabled,
          title: clampStr(String(b.pickle.title ?? s.pickle.title), 120),
          body: clampStr(String(b.pickle.body ?? s.pickle.body), 400),
          url: clampStr(String(b.pickle.url ?? s.pickle.url), 300),
          cta: clampStr(String(b.pickle.cta ?? s.pickle.cta), 60),
        });
      }
      if (b.market && typeof b.market === 'object') {
        s.market = Object.assign({}, s.market, {
          storeUrl: clampStr(String(b.market.storeUrl ?? s.market.storeUrl), 300),
          bundleUrl: clampStr(String(b.market.bundleUrl ?? s.market.bundleUrl), 300),
          demoUnlock: b.market.demoUnlock !== undefined ? !!b.market.demoUnlock : !!s.market.demoUnlock,
        });
      }
      saveStore();
      return jsonRes(res, 200, { settings: publicSettings(), engines: detectEngines(true) });
    }

    /* --- 경로 검증(UI 미리보기용) --- */
    if (p === '/api/security/check-path') {
      const raw = url.searchParams.get('path') || '';
      const v = validateCwd(raw);
      return jsonRes(res, 200, { ok: v.ok, resolved: v.path || null, root: allowedRoot(), error: v.error || null });
    }

    return jsonRes(res, 404, { error: '없는 API입니다.' });
  } catch (e) {
    return jsonRes(res, e.status || 500, { error: e.message || '서버 오류' });
  }
});

loadStores();
initRemote();
server.listen(PORT, BIND_HOST, () => {
  console.log(`\n  MOA Hive  ·  http://${LAN_MODE ? BIND_HOST : HOST}:${PORT}${LAN_MODE ? '  (모바일 원격 접속 켜짐 — 토큰 필요)' : ''}\n  env: ${ACTIVE_ENV.toUpperCase()} (stg ${versions.stg.version} / prod ${versions.prod.version})\n  data: ${ENV_FILES.stg}\n        ${ENV_FILES.prod}\n  engine: ${detectEngines().mode}\n`);
});

process.on('SIGINT', () => {
  try { saveStore(); } catch (e) {}
  console.log('\n  MOA Hive 종료 — 저장 완료.');
  process.exit(0);
});
process.on('SIGTERM', () => {
  try { saveStore(); } catch (e) {}
  process.exit(0);
});
