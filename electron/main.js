'use strict';
/* MOA Hive — Electron 메인 프로세스
   로컬 server.js를 백그라운드로 띄우고 BrowserWindow로 127.0.0.1에 접속합니다.
   앱을 닫으면 서버도 함께 정리합니다. 외부 사이트는 기본 브라우저로 넘깁니다. */
const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');

const isDev = !app.isPackaged;
const RUNTIME_ROOT = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'runtime');
// 패키지 앱은 설치 폴더가 읽기 전용일 수 있으므로 데이터는 userData 아래에 둡니다.
const HOME_DIR = isDev ? path.join(__dirname, '..') : path.join(app.getPath('userData'), 'home');
const HOST = '127.0.0.1';

let serverProc = null;
let serverPort = null;
let mainWindow = null;
let quitting = false;

/* ── 포트 · 헬스 체크 ── */
function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, HOST);
  });
}

function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port, path: '/api/health', timeout: 800 }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body).app === 'MOA Hive');
        } catch (_) {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function pickPort() {
  for (let p = 3847; p < 3860; p++) {
    if (await portFree(p)) return { port: p, existing: false };
    if (await checkHealth(p)) return { port: p, existing: true };
  }
  return { port: 3870 + Math.floor(Math.random() * 40), existing: false };
}

function waitForServer(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = async () => {
      if (await checkHealth(port)) return resolve(true);
      if (Date.now() > deadline) return resolve(false);
      setTimeout(tick, 350);
    };
    tick();
  });
}

/* ── 서버 프로세스 ── */
function ensureHome() {
  try {
    fs.mkdirSync(HOME_DIR, { recursive: true });
    const seedVersion = path.join(RUNTIME_ROOT, 'version.json');
    const homeVersion = path.join(HOME_DIR, 'version.json');
    if (!fs.existsSync(homeVersion) && fs.existsSync(seedVersion)) fs.copyFileSync(seedVersion, homeVersion);
  } catch (e) {
    console.error('[home] 준비 실패:', e.message);
  }
}

function startServer(port) {
  const serverJs = path.join(RUNTIME_ROOT, 'server.js');
  console.log('[moa] server.js 시작:', serverJs, 'port', port, 'home', HOME_DIR);
  serverProc = spawn(process.execPath, [serverJs], {
    cwd: RUNTIME_ROOT,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      MOA_HOME: HOME_DIR,
    }),
  });
  serverProc.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
  serverProc.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  serverProc.on('exit', (code, signal) => {
    serverProc = null;
    if (!quitting && code !== 0 && code !== null) {
      dialog.showErrorBox('MOA Hive 서버 종료', '로컬 서버가 예기치 않게 종료되었습니다 (code ' + code + '). 앱을 다시 실행해 주세요.');
    }
  });
}

function stopServer() {
  quitting = true;
  if (!serverProc) return;
  const child = serverProc;
  try {
    child.kill('SIGTERM');
  } catch (_) {}
  setTimeout(() => {
    try {
      if (child && !child.killed) child.kill('SIGKILL');
    } catch (_) {}
  }, 2500).unref();
}

/* ── 창 ── */
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: 'MOA Hive',
            submenu: [
              { role: 'about', label: 'MOA Hive 정보' },
              { type: 'separator' },
              { role: 'hide', label: 'MOA Hive 가리기' },
              { role: 'hideOthers', label: '다른 앱 가리기' },
              { role: 'unhide', label: '모두 보기' },
              { type: 'separator' },
              { role: 'quit', label: 'MOA Hive 종료' },
            ],
          },
        ]
      : []),
    {
      label: '편집',
      submenu: [
        { role: 'undo', label: '실행 취소' },
        { role: 'redo', label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut', label: '잘라내기' },
        { role: 'copy', label: '복사' },
        { role: 'paste', label: '붙여넣기' },
        { role: 'selectAll', label: '모두 선택' },
      ],
    },
    {
      label: '보기',
      submenu: [
        { role: 'reload', label: '새로고침' },
        { role: 'toggleDevTools', label: '개발자 도구' },
        { type: 'separator' },
        { role: 'resetZoom', label: '기본 크기' },
        { role: 'zoomIn', label: '확대' },
        { role: 'zoomOut', label: '축소' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
      ],
    },
    {
      label: '창',
      submenu: [
        { role: 'minimize', label: '최소화' },
        { role: 'zoom', label: '확대/복원' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front', label: '앞으로 가져오기' }] : [{ role: 'close', label: '닫기' }]),
      ],
    },
    {
      label: '도움말',
      submenu: [
        { label: 'GitHub 저장소', click: () => shell.openExternal('https://github.com/CM-jccho/moa-hive') },
        { label: '웹 데모', click: () => shell.openExternal('https://cm-jccho.github.io/moa-hive/') },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'about', label: 'MOA Hive 정보' }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#070910',
    title: 'MOA Hive',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });

  const baseUrl = 'http://' + HOST + ':' + port;
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 로컬 앱 밖으로 나가지 않게 하고, 외부 링크는 기본 브라우저로
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(baseUrl)) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(baseUrl);
}

async function boot() {
  ensureHome();
  const picked = await pickPort();
  serverPort = picked.port;
  if (!picked.existing) {
    startServer(picked.port);
    const ok = await waitForServer(picked.port, 25000);
    if (!ok) {
      dialog.showErrorBox(
        'MOA Hive를 시작하지 못했습니다',
        '로컬 서버가 응답하지 않습니다. Node.js가 손상되지 않았는지 확인하거나 앱을 다시 실행해 주세요.'
      );
      app.quit();
      return;
    }
  }
  createWindow(picked.port);
}

/* ── 앱 수명 ── */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    app.setAboutPanelOptions({
      applicationName: 'MOA Hive',
      applicationVersion: app.getVersion(),
      copyright: '로컬 우선 AI 봇 팀 메신저 · 100% 내 PC 실행',
    });
    boot().catch((e) => {
      dialog.showErrorBox('MOA Hive 시작 오류', String(e && e.message ? e.message : e));
      app.quit();
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverPort) createWindow(serverPort);
  });

  app.on('before-quit', stopServer);
  app.on('window-all-closed', () => app.quit());
  process.on('exit', stopServer);
}
