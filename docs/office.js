/* MOA Hive — 2D 가상 사무실 (외부 라이브러리·CDN 없음, 순수 canvas 2D)
   app.js → OfficeScene.init({...}) · OfficeScene.sync(bots, opts)
   - 시각(낮/노을/밤)에 따라 창밖 하늘·실내 조명이 바뀝니다.
   - 봇은 자기 책상에 앉아 타이핑하고, 가끔 커피·화분 쪽으로 걸어갔다 돌아옵니다.
   - 캐릭터는 DOM 버튼(투명 히트 영역)으로도 누를 수 있어 접근성·테스트가 유지됩니다. */
'use strict';

window.OfficeScene = (function () {
  var TAU = Math.PI * 2;

  /* ─────────── 색 팔레트 (시간대) ─────────── */
  var PAL = {
    day: {
      wall: ['#f7efe3', '#e9dac6'], base: '#d8c3a7', wallLine: 'rgba(150,120,90,0.18)',
      floor: ['#f1dfc4', '#e0c8a7'], plank: 'rgba(160,120,80,0.10)', seam: 'rgba(150,110,75,0.14)',
      rug: ['#dbe4f7', '#c2cfe9'], rugLine: 'rgba(120,140,185,0.35)',
      sky: ['#8fd4ff', '#dff3ff'], sun: '#ffe08a', glow: 'rgba(255,232,170,0.55)', star: 0,
      wood: '#d8ae7f', woodDark: '#b98d5f', woodLight: '#e7c39a',
      ink: 'rgba(60,52,70,0.55)', tint: 'rgba(255,214,150,0.05)', lamp: 0.12,
      beam: 'rgba(255,240,190,0.16)', night: 0
    },
    sunset: {
      wall: ['#f3d6b8', '#dcb492'], base: '#c69a74', wallLine: 'rgba(140,95,65,0.22)',
      floor: ['#e4c19c', '#cfa07a'], plank: 'rgba(150,95,60,0.12)', seam: 'rgba(140,90,60,0.16)',
      rug: ['#e3c3b2', '#cba294'], rugLine: 'rgba(150,105,90,0.35)',
      sky: ['#ffd08a', '#ff9a63', '#7c5a91'], sun: '#ffd27a', glow: 'rgba(255,170,90,0.6)', star: 0,
      wood: '#cfa077', woodDark: '#a97a55', woodLight: '#dfb68c',
      ink: 'rgba(70,45,45,0.55)', tint: 'rgba(255,138,70,0.15)', lamp: 0.55,
      beam: 'rgba(255,170,90,0.20)', night: 0
    },
    night: {
      wall: ['#5d6178', '#464a61'], base: '#33374a', wallLine: 'rgba(20,24,40,0.35)',
      floor: ['#5c5468', '#473f55'], plank: 'rgba(255,255,255,0.03)', seam: 'rgba(20,16,30,0.28)',
      rug: ['#4c5878', '#3e4763'], rugLine: 'rgba(130,150,200,0.25)',
      sky: ['#0b1430', '#22335e'], sun: '#f3efd6', glow: 'rgba(180,200,255,0.35)', star: 1,
      wood: '#6c5a52', woodDark: '#4b3d38', woodLight: '#7d6a5f',
      ink: 'rgba(210,215,240,0.45)', tint: 'rgba(22,32,74,0.30)', lamp: 1,
      beam: 'rgba(150,180,255,0.10)', night: 1
    }
  };

  /* ─────────── 좌석(자리) ─────────── */
  var SEATS = [
    { x: 0.500, y: 0.330, desk: 1, chief: 1 },
    { x: 0.125, y: 0.430, desk: 1 },
    { x: 0.125, y: 0.700, desk: 1 },
    { x: 0.875, y: 0.430, desk: 1 },
    { x: 0.875, y: 0.700, desk: 1 },
    { x: 0.395, y: 0.612 },
    { x: 0.605, y: 0.612 },
    { x: 0.500, y: 0.772 },
    { x: 0.185, y: 0.930 },
    { x: 0.300, y: 0.936 },
    { x: 0.700, y: 0.930 },
    { x: 0.590, y: 0.930 }
  ];

  /* 쉬는 곳 — 커피·화분·소파·책장 */
  var SPOTS = [
    { x: 0.300, y: 0.936, emoji: '☕' },
    { x: 0.700, y: 0.930, emoji: '🪴' },
    { x: 0.185, y: 0.930, emoji: '🛋️' },
    { x: 0.048, y: 0.400, emoji: '📚' },
    { x: 0.930, y: 0.420, emoji: '🖨️' }
  ];

  var STYLE_BASE = [
    { body: '#5b8def', hair: '#2b3350', acc: 'headset' },
    { body: '#e08c4a', hair: '#4a3323', acc: 'helmet' },
    { body: '#46b3a0', hair: '#274a45', acc: 'cap' },
    { body: '#9b7bea', hair: '#4a3d6b', acc: 'antenna' },
    { body: '#e0698b', hair: '#4a2434', acc: 'bun' },
    { body: '#58a55c', hair: '#2f4a2e', acc: 'leaf' },
    { body: '#7a8ca8', hair: '#2f3644', acc: 'glasses' },
    { body: '#c2933f', hair: '#443418', acc: 'scarf' }
  ];

  var SKIN = ['#f6d0ad', '#eec29c', '#f9dcc0', '#e8b58d'];

  var S = {
    canvas: null, ctx: null, overlay: null, stage: null, clock: null, phaseEl: null, times: null,
    w: 0, h: 0, u: 1, dpr: 1,
    bots: [], labels: {}, activeId: null, chiefId: null,
    mode: 'auto', phase: 'day', t: 0, last: 0, raf: 0, running: false,
    visible: true, reduced: false, lastClock: ''
  };

  /* ─────────── 작은 유틸 ─────────── */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), 0, 0, TAU); }
  function hash(str) {
    var t = String(str || '');
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  }
  function styleFor(name) {
    var n = String(name || '');
    var low = n.toLowerCase();
    if (/chief|팀장/.test(n) || /chief/.test(low)) return { body: '#5a6ad6', hair: '#232840', acc: 'chief', tie: '#ffd479' };
    if (/prototyper|아이디어|소재/i.test(n)) return { body: '#9b7bea', hair: '#4a3d6b', acc: 'antenna' };
    if (/builder|구현|개발|상세페이지/i.test(n)) return { body: '#e08c4a', hair: '#4a3323', acc: 'helmet' };
    if (/sweeper|정리|정돈/i.test(n)) return { body: '#46b3a0', hair: '#274a45', acc: 'cap' };
    if (/grower|성장|그로스/i.test(n)) return { body: '#58a55c', hair: '#2f4a2e', acc: 'leaf' };
    if (/maintainer|운영|보안|리뷰|분석/i.test(n)) return { body: '#7a8ca8', hair: '#2f3644', acc: 'glasses' };
    var s = STYLE_BASE[hash(n) % STYLE_BASE.length];
    return { body: s.body, hair: s.hair, acc: s.acc };
  }

  /* ─────────── 초기화 ─────────── */
  function init(opts) {
    opts = opts || {};
    S.stage = opts.stage;
    S.canvas = opts.canvas;
    S.overlay = opts.overlay;
    S.clock = opts.clock;
    S.phaseEl = opts.phaseEl;
    S.times = opts.times;
    S.labels = opts.labels || {};
    S.onPick = opts.onPick || null;
    if (!S.canvas) return;
    S.ctx = S.canvas.getContext('2d');
    S.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (S.times) {
      S.times.addEventListener('click', function (e) {
        var b = e.target.closest('[data-office-time]');
        if (!b) return;
        setMode(b.getAttribute('data-office-time'));
      });
    }
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { fit(); });
      ro.observe(S.stage || S.canvas);
    } else {
      window.addEventListener('resize', fit);
    }
    fit();
    tickClock();
    setInterval(tickClock, 10000);
    if (window.IntersectionObserver && S.stage) {
      new IntersectionObserver(function (rows) {
        S.visible = rows[0] ? rows[0].isIntersecting : true;
        if (S.visible) start(); else stop();
      }, { rootMargin: '120px' }).observe(S.stage);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (S.visible) start();
    });
    start();
  }

  function fit() {
    if (!S.canvas) return;
    var host = S.stage || S.canvas.parentElement;
    var w = Math.max(120, Math.round(host.clientWidth));
    var h = Math.max(110, Math.round(host.clientHeight));
    S.dpr = Math.min(3, window.devicePixelRatio || 1);
    S.w = w; S.h = h; S.u = h / 300;
    S.canvas.width = Math.round(w * S.dpr);
    S.canvas.height = Math.round(h * S.dpr);
    S.canvas.style.width = w + 'px';
    S.canvas.style.height = h + 'px';
    if (S.ctx) S.ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    drawOnce();
  }

  /* ─────────── 시간대 ─────────── */
  function autoPhase() {
    var hr = new Date().getHours() + new Date().getMinutes() / 60;
    if (hr >= 6 && hr < 17) return 'day';
    if (hr >= 17 && hr < 20) return 'sunset';
    return 'night';
  }
  function setMode(mode) {
    if (['auto', 'day', 'sunset', 'night'].indexOf(mode) < 0) return;
    S.mode = mode;
    updatePhase(true);
  }
  function updatePhase(force) {
    var next = S.mode === 'auto' ? autoPhase() : S.mode;
    if (!force && next === S.phase) return;
    S.phase = next;
    if (S.stage) S.stage.setAttribute('data-phase', next);
    if (S.phaseEl) {
      var lab = next === 'day' ? (S.labels.phaseDay || '낮') : next === 'sunset' ? (S.labels.phaseSunset || '노을') : (S.labels.phaseNight || '밤');
      S.phaseEl.textContent = lab;
    }
    if (S.times) {
      Array.prototype.forEach.call(S.times.querySelectorAll('[data-office-time]'), function (b) {
        var on = b.getAttribute('data-office-time') === S.mode;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    drawOnce();
  }
  function tickClock() {
    var d = new Date();
    var txt = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (S.clock && txt !== S.lastClock) { S.clock.textContent = txt; S.lastClock = txt; }
    if (S.mode === 'auto') updatePhase(false);
  }

  /* ─────────── 상태 동기화 (app.js → 여기) ─────────── */
  function sync(bots, opts) {
    opts = opts || {};
    if (opts.labels) S.labels = opts.labels;
    S.activeId = opts.activeId || null;
    S.chiefId = opts.chiefId || null;
    var busy = opts.busy || {};
    var list = (Array.isArray(bots) ? bots : []).slice(0, SEATS.length);
    var sig = list.map(function (b) { return b.id; }).join('|');
    var known = S.bots.map(function (r) { return r.id; }).join('|');
    if (sig !== known) {
      // 팀 구성이 바뀌면 좌석 재배치. 같은 이름의 봇은 자리를 지켜(언어 전환 시 다시 들어오지 않음),
      // 새로 온 봇만 오른쪽 문에서 걸어 들어옵니다.
      var keepId = {}, keepName = {};
      S.bots.forEach(function (r) { keepId[r.id] = r; keepName[r.name] = r; });
      var next = [];
      list.forEach(function (b, i) {
        var r = keepId[b.id] || keepName[b.name];
        var seat = SEATS[i] || SEATS[SEATS.length - 1];
        if (!r) {
          r = {
            id: b.id, x: 1.04 + (i % 3) * 0.05, y: 0.32 + i * 0.055, seat: seat, home: seat,
            stepT: Math.random() * 6, seed: Math.random() * 6, nextWander: S.t + 9 + i * 2 + Math.random() * 12,
            away: null, linger: 0, bubble: '', style: styleFor(b.name), el: null, bubbleEl: null,
            moving: true, speed: 0.19 + (i % 4) * 0.017
          };
        } else {
          r.id = b.id;
          r.seat = seat; r.home = seat; r.style = styleFor(b.name);
        }
        r.bot = b; r.name = b.name || '봇';
        next.push(r);
      });
      // 사라진 봇 정리
      S.bots.forEach(function (r) { if (next.indexOf(r) < 0 && r.el && r.el.parentNode) r.el.parentNode.removeChild(r.el); });
      S.bots = next;
      buildOverlay();
    } else {
      S.bots.forEach(function (r, i) { r.bot = list[i]; r.name = list[i].name || '봇'; });
    }
    S.bots.forEach(function (r) {
      var isChief = r.id === S.chiefId;
      r.delegating = !!(busy.chief && isChief);
      r.working = !!(busy.chief && isChief) || busy.agent === r.id;
      if (r.el) {
        r.el.classList.toggle('working', !!r.working);
        r.el.classList.toggle('idle', !r.working);
        r.el.classList.toggle('selected', r.id === S.activeId);
      }
    });
    updatePhase(true);
  }

  function buildOverlay() {
    if (!S.overlay) return;
    S.overlay.innerHTML = '';
    S.bots.forEach(function (r) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'office-hit idle';
      el.setAttribute('data-office-bot', r.id);
      el.setAttribute('data-testid', 'office-char');
      el.setAttribute('aria-label', (r.name || '봇') + ' — ' + (S.labels.openRole || '역할 카드 열기'));
      el.innerHTML = '<span class="office-bubble" data-office-bubble></span><span class="office-ring" aria-hidden="true"></span><span class="office-sr"></span>';
      el.addEventListener('mouseenter', function () { el.classList.add('hover'); });
      el.addEventListener('mouseleave', function () { el.classList.remove('hover'); });
      el.addEventListener('focus', function () { el.classList.add('hover'); });
      el.addEventListener('blur', function () { el.classList.remove('hover'); });
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (S.onPick) S.onPick(r.id);
      });
      S.overlay.appendChild(el);
      r.el = el;
      r.bubbleEl = el.querySelector('.office-bubble');
      r.bubble = '';
    });
    drawOnce();
  }

  /* ─────────── 애니메이션 루프 ─────────── */
  function start() {
    if (S.running || !S.ctx) return;
    S.running = true;
    S.last = 0;
    S.raf = requestAnimationFrame(frame);
  }
  function stop() {
    S.running = false;
    if (S.raf) cancelAnimationFrame(S.raf);
    S.raf = 0;
  }
  function frame(ts) {
    if (!S.running) return;
    if (!S.last) S.last = ts;
    var dt = clamp((ts - S.last) / 1000, 0, 0.05);
    S.last = ts; S.t += dt;
    update(dt);
    draw();
    placeBtns();
    S.raf = requestAnimationFrame(frame);
  }
  function update(dt) {
    if (S.reduced) return;
    S.bots.forEach(function (r) {
      r.stepT += dt;
      if (r.id === S.chiefId) { /* 팀장은 자리를 지킴 */ }
      if (!r.working && !r.away && S.t > r.nextWander) {
        r.nextWander = S.t + 9 + Math.random() * 16;
        if (Math.random() < 0.62) {
          var spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
          r.away = spot; r.linger = 0;
        }
      }
      var tx = r.seat.x, ty = r.seat.y;
      if (r.away && !r.working) { tx = r.away.x; ty = r.away.y; }
      var dx = tx - r.x, dy = ty - r.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.004) {
        // 화면 폭 대비 비율/초 — 해상도와 무관하게 같은 속도감
        var step = Math.min(d, (r.working ? 0.36 : (r.speed || 0.21)) * dt);
        r.moving = true;
        r.x += (dx / d) * step;
        r.y += (dy / d) * step;
      } else {
        r.moving = false;
        r.x = tx; r.y = ty;
        if (r.away) {
          if (!r.linger) r.linger = S.t + 3 + Math.random() * 2.5;
          else if (S.t > r.linger) { r.away = null; r.linger = 0; }
        }
      }
      if (r.working && r.away) { r.away = null; r.linger = 0; }
    });
  }

  function bubbleFor(r) {
    if (r.delegating) return S.labels.delegating || '배분 중…';
    if (r.working) return S.labels.working || '작업 중…';
    if (r.away) return r.away.emoji || '';
    return '';
  }

  function placeBtns() {
    if (!S.overlay) return;
    S.bots.forEach(function (r) {
      if (!r.el) return;
      var bub = bubbleFor(r);
      if (bub !== r.bubble) {
        r.bubble = bub;
        if (r.bubbleEl) r.bubbleEl.textContent = bub;
        r.el.classList.toggle('has-bubble', !!bub);
      }
      var s = S.u;
      var bw = Math.round(56 * s + 14);
      var bh = Math.round(66 * s + 14);
      var x = r.x * S.w - bw / 2;
      var y = r.y * S.h - bh + 4;
      r.el.style.width = bw + 'px';
      r.el.style.height = bh + 'px';
      r.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      r.el.style.zIndex = String(Math.round(r.y * 1000));
      var side = r.x < 0.13 ? 'left' : r.x > 0.87 ? 'right' : '';
      r.el.setAttribute('data-side', side);
    });
  }

  function drawOnce() {
    if (!S.ctx) return;
    draw();
    placeBtns();
  }

  /* ─────────── 그리기 ─────────── */
  function draw() {
    var g = S.ctx;
    if (!g) return;
    var pal = PAL[S.phase] || PAL.day;
    g.clearRect(0, 0, S.w, S.h);
    drawRoom(g, pal);
    drawRug(g, pal);
    var items = [];
    // 가구 (base y로 정렬 → 캐릭터와 앞뒤 관계 유지)
    for (var i = 0; i < SEATS.length; i++) {
      var seat = SEATS[i];
      if (seat.desk) {
        (function (s) {
          var occupants = S.bots.filter(function (r) { return r.seat === s; });
          items.push({ y: s.y * S.h + 26 * S.u, f: function () { drawDesk(g, s, pal, occupants); } });
        })(seat);
      }
    }
    items.push({ y: 0.74 * S.h, f: function () { drawTable(g, pal); } });
    items.push({ y: 0.985 * S.h, f: function () { drawSofa(g, pal); } });
    items.push({ y: 0.975 * S.h, f: function () { drawCoffee(g, pal); } });
    items.push({ y: 0.985 * S.h, f: function () { drawPlant(g, 0.930 * S.w, 0.955 * S.h, 1.15, pal); } });
    items.push({ y: 0.470 * S.h, f: function () { drawShelf(g, pal); } });
    items.push({ y: 0.520 * S.h, f: function () { drawPrinter(g, pal); } });
    items.push({ y: 0.450 * S.h, f: function () { drawPlant(g, 0.048 * S.w, 0.445 * S.h, 0.9, pal); } });
    S.bots.forEach(function (r) {
      items.push({ y: r.y * S.h + 2, f: function () { drawCharacter(g, r, pal); } });
    });
    items.sort(function (a, b) { return a.y - b.y; });
    for (var k = 0; k < items.length; k++) items[k].f();
    drawLamps(g, pal);
    drawZoneLabels(g, pal);
    drawVignette(g, pal);
  }

  function drawRoom(g, pal) {
    var w = S.w, h = S.h, wallH = h * 0.30;
    var wg = g.createLinearGradient(0, 0, 0, wallH);
    wg.addColorStop(0, pal.wall[0]); wg.addColorStop(1, pal.wall[1]);
    g.fillStyle = wg; g.fillRect(0, 0, w, wallH);
    // 벽지 패턴
    g.fillStyle = pal.wallLine;
    for (var x = 0; x < w; x += Math.max(18, w / 28)) g.fillRect(x, 0, 1, wallH);
    // 걸레받이
    g.fillStyle = pal.base; g.fillRect(0, wallH - h * 0.012, w, h * 0.016);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, wallH - h * 0.012, w, 1);

    // 바닥
    var fg = g.createLinearGradient(0, wallH, 0, h);
    fg.addColorStop(0, pal.floor[0]); fg.addColorStop(1, pal.floor[1]);
    g.fillStyle = fg; g.fillRect(0, wallH, w, h - wallH);
    var plank = Math.max(22, w / 26);
    for (var px = 0; px < w; px += plank) {
      g.fillStyle = (Math.round(px / plank) % 2) ? pal.plank : 'rgba(255,255,255,0.03)';
      g.fillRect(px, wallH, plank * 0.5, h - wallH);
    }
    g.strokeStyle = pal.seam; g.lineWidth = 1;
    for (var y = wallH + plank * 0.9; y < h; y += plank * 1.7) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    drawWindows(g, pal, wallH);
  }

  function drawWindows(g, pal, wallH) {
    var w = S.w, h = S.h, u = S.u;
    var wins = [[0.045, 0.325], [0.365, 0.645]];
    wins.forEach(function (win, wi) {
      var x = win[0] * w, ww = (win[1] - win[0]) * w;
      var y = h * 0.055, wh = wallH * 0.72;
      // 창틀
      g.fillStyle = 'rgba(255,255,255,0.55)';
      rr(g, x - 4 * u, y - 4 * u, ww + 8 * u, wh + 8 * u, 4 * u); g.fill();
      g.fillStyle = '#cbd6e6';
      rr(g, x - 2 * u, y - 2 * u, ww + 4 * u, wh + 4 * u, 3 * u); g.fill();
      // 하늘
      var sky = g.createLinearGradient(0, y, 0, y + wh);
      var cols = pal.sky;
      sky.addColorStop(0, cols[0]);
      sky.addColorStop(0.62, cols[1]);
      if (cols[2]) sky.addColorStop(1, cols[2]);
      g.fillStyle = sky;
      g.fillRect(x, y, ww, wh);
      // 해 / 달
      g.save();
      g.beginPath(); g.rect(x, y, ww, wh); g.clip();
      if (S.phase === 'night') {
        g.fillStyle = pal.sun;
        ell(g, x + ww * (wi ? 0.62 : 0.72), y + wh * 0.32, 9 * u, 9 * u); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (var st = 0; st < 9; st++) {
          var sx = x + ((st * 37 + wi * 23) % 100) / 100 * ww;
          var sy = y + ((st * 19 + 11) % 100) / 100 * wh * 0.8;
          g.globalAlpha = 0.35 + ((st * 13) % 60) / 100;
          g.fillRect(sx, sy, 1.3 * u, 1.3 * u);
        }
        g.globalAlpha = 1;
      } else {
        var sunX = S.phase === 'sunset' ? 0.5 : 0.68;
        var sunY = S.phase === 'sunset' ? 0.74 : 0.30;
        var glow = g.createRadialGradient(x + ww * sunX, y + wh * sunY, 1, x + ww * sunX, y + wh * sunY, 34 * u);
        glow.addColorStop(0, pal.glow); glow.addColorStop(1, 'rgba(255,230,170,0)');
        g.fillStyle = glow; g.fillRect(x, y, ww, wh);
        g.fillStyle = pal.sun;
        ell(g, x + ww * sunX, y + wh * sunY, 8.5 * u, 8.5 * u); g.fill();
        // 구름
        g.fillStyle = S.phase === 'sunset' ? 'rgba(255,225,200,0.75)' : 'rgba(255,255,255,0.85)';
        [[0.18, 0.34, 1], [0.56, 0.22, 0.8]].forEach(function (c) {
          ell(g, x + ww * c[0], y + wh * c[1], 13 * u * c[2], 5 * u * c[2]); g.fill();
          ell(g, x + ww * c[0] + 9 * u, y + wh * c[1] - 2 * u, 8 * u * c[2], 4.5 * u * c[2]); g.fill();
        });
      }
      // 창밖 건물 실루엣
      g.fillStyle = S.phase === 'night' ? 'rgba(10,16,36,0.85)' : S.phase === 'sunset' ? 'rgba(120,80,105,0.45)' : 'rgba(140,175,205,0.35)';
      var base = y + wh;
      [[0.02, 0.30, 0.22], [0.30, 0.18, 0.30], [0.50, 0.26, 0.20], [0.74, 0.14, 0.26]].forEach(function (b) {
        var bx = x + ww * b[0], bw = ww * b[1], bh = wh * b[2];
        g.fillRect(bx, base - bh, bw, bh);
        if (S.phase === 'night') {
          g.fillStyle = 'rgba(255,214,130,0.75)';
          for (var wy = base - bh + 4 * u; wy < base - 3 * u; wy += 7 * u) {
            for (var wx = bx + 3 * u; wx < bx + bw - 3 * u; wx += 6 * u) {
              if ((Math.round(wx) + Math.round(wy)) % 3 === 0) g.fillRect(wx, wy, 2.2 * u, 2.6 * u);
            }
          }
          g.fillStyle = 'rgba(10,16,36,0.85)';
        }
      });
      // 창틀 살
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillRect(x + ww / 2 - 1.5 * u, y, 3 * u, wh);
      g.fillRect(x, y + wh * 0.44, ww, 2.5 * u);
      g.restore();
      // 창틀 테두리
      g.strokeStyle = 'rgba(120,130,150,0.5)'; g.lineWidth = 1.2 * u;
      rr(g, x - 2 * u, y - 2 * u, ww + 4 * u, wh + 4 * u, 3 * u); g.stroke();
      // 창턱 화분
      if (wi === 0) {
        g.fillStyle = '#a9754f'; rr(g, x + ww * 0.08, y + wh - 2 * u, 10 * u, 7 * u, 2 * u); g.fill();
        g.fillStyle = '#5aa05e';
        ell(g, x + ww * 0.08 + 5 * u, y + wh - 5 * u, 5 * u, 4 * u); g.fill();
      }
    });
    // 햇빛 / 달빛이 바닥에 내려앉는 느낌
    var floorY = wallH;
    g.save();
    g.globalCompositeOperation = 'lighter';
    wins.forEach(function (win) {
      var x = win[0] * w, ww = (win[1] - win[0]) * w;
      var grd = g.createLinearGradient(x, floorY, x + ww * 0.4, h);
      grd.addColorStop(0, pal.beam); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x, floorY);
      g.lineTo(x + ww, floorY);
      g.lineTo(x + ww * 1.35, h * 0.86);
      g.lineTo(x - ww * 0.15, h * 0.86);
      g.closePath(); g.fill();
    });
    g.restore();
  }

  function drawRug(g, pal) {
    var cx = 0.5 * S.w, cy = 0.635 * S.h;
    var rx = 0.20 * S.w, ry = 0.175 * S.h;
    var grad = g.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    grad.addColorStop(0, pal.rug[0]); grad.addColorStop(1, pal.rug[1]);
    g.fillStyle = grad; ell(g, cx, cy, rx, ry); g.fill();
    g.strokeStyle = pal.rugLine; g.lineWidth = 2 * S.u; ell(g, cx, cy, rx * 0.86, ry * 0.82); g.stroke();
  }

  function drawDesk(g, seat, pal, occupants) {
    var cx = seat.x * S.w, cy = seat.y * S.h + 24 * S.u;
    var w = 68 * S.u, h = 40 * S.u;
    var working = occupants.some(function (r) { return r.working; });
    // 그림자
    g.fillStyle = 'rgba(30,20,15,0.16)';
    ell(g, cx, cy + h * 0.52, w * 0.56, h * 0.22); g.fill();
    // 의자 등받침 (앉은 사람 뒤)
    g.fillStyle = pal.night ? '#3c4157' : '#8d9ec4';
    rr(g, cx - 13 * S.u, cy - h * 0.98, 26 * S.u, 7 * S.u, 3 * S.u); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    rr(g, cx - 11 * S.u, cy - h * 0.92, 22 * S.u, 2.4 * S.u, 1.2 * S.u); g.fill();
    // 다리
    g.fillStyle = pal.woodDark;
    g.fillRect(cx - w * 0.44, cy + h * 0.1, 3 * S.u, h * 0.55);
    g.fillRect(cx + w * 0.40, cy + h * 0.1, 3 * S.u, h * 0.55);
    // 책상 상판
    g.fillStyle = pal.wood; rr(g, cx - w / 2, cy - h * 0.2, w, h * 0.66, 3 * S.u); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)';
    rr(g, cx - w / 2 + 2 * S.u, cy - h * 0.18, w - 4 * S.u, h * 0.16, 2 * S.u); g.fill();
    g.fillStyle = pal.woodDark;
    rr(g, cx - w / 2, cy + h * 0.34, w, h * 0.12, 2 * S.u); g.fill();
    // 모니터 (빛남)
    var mw = w * 0.52, mh = h * 0.44;
    var mx = cx - mw / 2, my = cy - h * 0.62;
    g.fillStyle = pal.night ? '#1a2236' : '#2a3040';
    rr(g, mx - 2 * S.u, my - 2 * S.u, mw + 4 * S.u, mh + 4 * S.u, 2.5 * S.u); g.fill();
    var glowA = (working ? 0.55 : 0.28) + pal.night * 0.35;
    var sg = g.createLinearGradient(mx, my, mx + mw, my + mh);
    sg.addColorStop(0, 'rgba(140,200,255,' + glowA + ')');
    sg.addColorStop(1, working ? 'rgba(255,220,150,' + (glowA + 0.18) + ')' : 'rgba(110,170,235,' + glowA * 0.7 + ')');
    g.fillStyle = sg; rr(g, mx, my, mw, mh, 1.5 * S.u); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (var i = 0; i < 3; i++) g.fillRect(mx + 2 * S.u, my + (3 + i * 3.5) * S.u, mw * (0.55 - i * 0.1), 1.2 * S.u);
    // 화면 빛 번짐
    g.save();
    g.globalCompositeOperation = 'lighter';
    var mg = g.createRadialGradient(cx, my + mh / 2, 1, cx, my + mh / 2, w * 0.62);
    mg.addColorStop(0, 'rgba(150,205,255,' + (working ? 0.26 : 0.13) + ')');
    mg.addColorStop(1, 'rgba(150,205,255,0)');
    g.fillStyle = mg; g.fillRect(cx - w * 0.7, my - 12 * S.u, w * 1.4, h * 1.4);
    g.restore();
    // 키보드 · 마우스 · 머그
    g.fillStyle = 'rgba(255,255,255,0.65)';
    rr(g, cx - 10 * S.u, cy + h * 0.16, 20 * S.u, 5 * S.u, 1.5 * S.u); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    ell(g, cx + 15 * S.u, cy + h * 0.19, 2.6 * S.u, 1.8 * S.u); g.fill();
    g.fillStyle = working ? '#ffb703' : '#e9e2d4';
    ell(g, cx - 23 * S.u, cy + h * 0.2, 3 * S.u, 3 * S.u); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    ell(g, cx - 23 * S.u, cy + h * 0.2, 1.8 * S.u, 1.2 * S.u); g.fill();
    // 서류 · 스탠드
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(cx + 22 * S.u, cy - h * 0.02, 9 * S.u, 6 * S.u);
    g.fillStyle = 'rgba(120,150,220,0.6)';
    g.fillRect(cx + 23 * S.u, cy + 0.5 * S.u, 7 * S.u, 1.2 * S.u);
    if (seat.chief) {
      g.fillStyle = '#f7c948';
      rr(g, cx - 6 * S.u, cy + h * 0.34, 12 * S.u, 3 * S.u, 1 * S.u); g.fill();
    }
  }

  function drawTable(g, pal) {
    var cx = 0.5 * S.w, cy = 0.628 * S.h;
    var rx = 0.105 * S.w, ry = 0.085 * S.h;
    g.fillStyle = 'rgba(30,20,15,0.15)';
    ell(g, cx, cy + ry * 0.45, rx * 1.02, ry * 0.5); g.fill();
    // 의자(테이블 둘레)
    g.fillStyle = pal.woodDark;
    [[0, -1.12], [-1.12, 0], [1.12, 0]].forEach(function (c) {
      ell(g, cx + rx * c[0], cy + ry * c[1], 9 * S.u, 6 * S.u); g.fill();
    });
    // 테이블 다리
    g.fillStyle = pal.woodDark;
    [[-0.6, 0.0], [0.6, 0.0]].forEach(function (l) {
      rr(g, cx + rx * l[0] - 2.5 * S.u, cy + ry * 0.1, 5 * S.u, ry * 0.95, 2 * S.u); g.fill();
    });
    // 상판 (테두리 → 안쪽)
    g.fillStyle = pal.woodDark;
    ell(g, cx, cy, rx, ry); g.fill();
    g.fillStyle = pal.wood;
    ell(g, cx, cy - 1.5 * S.u, rx * 0.95, ry * 0.9); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.2)';
    ell(g, cx, cy - ry * 0.3, rx * 0.74, ry * 0.52); g.fill();
    // 의자 4개
    g.fillStyle = pal.night ? '#3c4157' : '#8d9ec4';
    [[0, -1.18], [0, 1.18], [-1.32, 0], [1.32, 0]].forEach(function (c) {
      rr(g, cx + rx * c[0] - 9 * S.u, cy + ry * c[1] - 4 * S.u, 18 * S.u, 8 * S.u, 3 * S.u); g.fill();
    });
    // 테이블 위 소품
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(cx - 14 * S.u, cy - 4 * S.u, 14 * S.u, 9 * S.u);
    g.fillStyle = 'rgba(120,150,220,0.5)';
    g.fillRect(cx - 12 * S.u, cy - 2 * S.u, 10 * S.u, 1.4 * S.u);
    g.fillStyle = '#7c5cff';
    rr(g, cx + 6 * S.u, cy - 6 * S.u, 12 * S.u, 7 * S.u, 1.5 * S.u); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    rr(g, cx + 7 * S.u, cy - 5 * S.u, 10 * S.u, 2 * S.u, 1 * S.u); g.fill();
    g.fillStyle = '#e07a5f';
    ell(g, cx + 2 * S.u, cy + 8 * S.u, 4 * S.u, 3.4 * S.u); g.fill();
    // 서류 뭉치
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(cx - 24 * S.u, cy + 4 * S.u, 10 * S.u, 7 * S.u);
    g.fillStyle = pal.night ? '#2b3350' : '#4a5570';
    rr(g, cx - 30 * S.u, cy - 12 * S.u, 18 * S.u, 12 * S.u, 1.5 * S.u); g.fill();
    g.fillStyle = 'rgba(150,205,255,0.75)';
    rr(g, cx - 28 * S.u, cy - 10.5 * S.u, 14 * S.u, 9 * S.u, 1 * S.u); g.fill();
  }

  function drawSofa(g, pal) {
    var x = 0.105 * S.w, y = 0.878 * S.h, w = 0.145 * S.w, h = 0.10 * S.h;
    g.fillStyle = 'rgba(30,20,15,0.16)';
    rr(g, x + 2 * S.u, y + h * 0.72, w, h * 0.34, 6 * S.u); g.fill();
    var c1 = S.phase === 'night' ? '#5c6a8c' : '#8fa4d6';
    g.fillStyle = c1;
    rr(g, x, y, w, h * 0.8, 5 * S.u); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    rr(g, x + 3 * S.u, y + 3 * S.u, w - 6 * S.u, h * 0.5, 4 * S.u); g.fill();
    g.fillStyle = S.phase === 'night' ? '#4c5878' : '#7d92c6';
    rr(g, x - 2 * S.u, y + h * 0.1, 4 * S.u, h * 0.7, 2 * S.u); g.fill();
    rr(g, x + w - 2 * S.u, y + h * 0.1, 4 * S.u, h * 0.7, 2 * S.u); g.fill();
    // 쿠션
    g.fillStyle = '#f2b880';
    rr(g, x + w * 0.18, y + h * 0.16, 9 * S.u, 8 * S.u, 2 * S.u); g.fill();
  }

  function drawCoffee(g, pal) {
    var x = 0.262 * S.w, y = 0.895 * S.h, w = 0.075 * S.w, h = 0.076 * S.h;
    g.fillStyle = 'rgba(30,20,15,0.16)';
    rr(g, x + 2 * S.u, y + h * 0.7, w, h * 0.35, 4 * S.u); g.fill();
    g.fillStyle = pal.woodDark;
    rr(g, x, y, w, h, 3 * S.u); g.fill();
    g.fillStyle = S.phase === 'night' ? '#3d4257' : '#ecebe6';
    rr(g, x + w * 0.12, y + h * 0.08, w * 0.76, h * 0.62, 3 * S.u); g.fill();
    g.fillStyle = '#b23b3b';
    rr(g, x + w * 0.28, y + h * 0.2, w * 0.2, w * 0.2, 1.5 * S.u); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    rr(g, x + w * 0.55, y + h * 0.24, w * 0.12, h * 0.18, 1 * S.u); g.fill();
    // 김이 모락
    g.strokeStyle = S.phase === 'night' ? 'rgba(220,230,255,0.45)' : 'rgba(120,120,140,0.35)';
    g.lineWidth = 1.2 * S.u;
    for (var i = 0; i < 2; i++) {
      g.beginPath();
      var sx = x + w * (0.36 + i * 0.16);
      g.moveTo(sx, y + h * 0.1);
      g.quadraticCurveTo(sx + 3 * S.u, y - 4 * S.u, sx - 1 * S.u, y - 8 * S.u);
      g.stroke();
    }
    // 컵
    g.fillStyle = '#ffffff';
    ell(g, x + w * 0.72, y + h * 1.06, 3.4 * S.u, 2.6 * S.u); g.fill();
  }

  function drawPlant(g, x, y, k, pal) {
    var u = S.u * k;
    g.fillStyle = 'rgba(30,20,15,0.18)';
    ell(g, x, y, 13 * u, 4.5 * u); g.fill();
    g.fillStyle = S.phase === 'night' ? '#6d5a4a' : '#c07a4e';
    rr(g, x - 9 * u, y - 12 * u, 18 * u, 13 * u, 3 * u); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    rr(g, x - 8 * u, y - 11 * u, 16 * u, 3 * u, 1.5 * u); g.fill();
    var leaf = S.phase === 'night' ? '#3f7a54' : '#5faa62';
    var leaf2 = S.phase === 'night' ? '#356a49' : '#4c9152';
    [[-8, -26, -1], [-2, -34, 0], [6, -28, 1], [-11, -18, -1.3], [10, -18, 1.2]].forEach(function (l, i) {
      g.fillStyle = i % 2 ? leaf : leaf2;
      ell(g, x + l[0] * u, y - 12 * u + l[1] * u * 0.6, 7 * u, 5 * u); g.fill();
    });
    g.fillStyle = leaf2;
    g.beginPath(); g.moveTo(x, y - 12 * u); g.quadraticCurveTo(x + 2 * u, y - 30 * u, x + 4 * u, y - 40 * u); g.lineTo(x + 1 * u, y - 12 * u); g.fill();
  }

  function drawShelf(g, pal) {
    var x = 0.012 * S.w, y = 0.335 * S.h, w = 0.075 * S.w, h = 0.135 * S.h;
    g.fillStyle = 'rgba(30,20,15,0.16)';
    rr(g, x + 2 * S.u, y + h * 0.9, w, 6 * S.u, 2 * S.u); g.fill();
    g.fillStyle = pal.woodDark;
    rr(g, x, y, w, h, 2 * S.u); g.fill();
    g.fillStyle = S.phase === 'night' ? '#3f4557' : '#8a6a4d';
    rr(g, x + 2 * S.u, y + 2 * S.u, w - 4 * S.u, h - 4 * S.u, 2 * S.u); g.fill();
    var cols = ['#e07a5f', '#5b8def', '#f2c14e', '#6bbf7a', '#b47cd6'];
    for (var row = 0; row < 2; row++) {
      var by = y + h * (0.28 + row * 0.42);
      g.fillStyle = pal.woodLight;
      g.fillRect(x + 3 * S.u, by, w - 6 * S.u, 2 * S.u);
      for (var i = 0; i < 6; i++) {
        g.fillStyle = cols[(row * 3 + i) % cols.length];
        g.fillRect(x + (4 + i * 3.6) * S.u, by - (8 + (i % 3) * 1.5) * S.u, 2.4 * S.u, (8 + (i % 3) * 1.5) * S.u);
      }
    }
    // 화분
    g.fillStyle = '#6bbf7a';
    ell(g, x + w - 6 * S.u, y + 1 * S.u, 4 * S.u, 3 * S.u); g.fill();
  }

  function drawPrinter(g, pal) {
    var x = 0.905 * S.w, y = 0.395 * S.h, w = 0.075 * S.w, h = 0.105 * S.h;
    g.fillStyle = 'rgba(30,20,15,0.16)';
    rr(g, x + 2 * S.u, y + h * 0.9, w, 5 * S.u, 2 * S.u); g.fill();
    g.fillStyle = pal.woodDark;
    rr(g, x, y + h * 0.42, w, h * 0.55, 2 * S.u); g.fill();
    g.fillStyle = S.phase === 'night' ? '#4a4f63' : '#e7e4dc';
    rr(g, x + 3 * S.u, y, w - 6 * S.u, h * 0.5, 3 * S.u); g.fill();
    g.fillStyle = S.phase === 'night' ? '#2b3040' : '#c9c5bb';
    rr(g, x + w * 0.22, y + 2 * S.u, w * 0.56, h * 0.14, 1 * S.u); g.fill();
    g.fillStyle = '#8fd4a8';
    ell(g, x + w * 0.8, y + h * 0.42, 1.6 * S.u, 1.6 * S.u); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(x + w * 0.34, y - 4 * S.u, w * 0.34, 5 * S.u);
  }

  function drawCharacter(g, r, pal) {
    var s = S.u;
    var x = r.x * S.w;
    var y = r.y * S.h;
    var st = r.style;
    var walk = r.moving;
    var ph = r.stepT * 9;
    var bob = walk ? Math.abs(Math.sin(ph)) * 2.2 * s : Math.sin(S.t * 1.4 + r.seed) * 0.8 * s;
    var bodyW = 19 * s, bodyH = 17 * s, legH = 9 * s, headR = 10.5 * s;
    var feetY = y;
    var hipY = feetY - legH;
    var shoulderY = hipY - bodyH;
    var headY = shoulderY - headR + 1.5 * s;

    // 그림자
    g.fillStyle = 'rgba(25,18,40,0.20)';
    ell(g, x, feetY + 1 * s, 13 * s, 4 * s); g.fill();

    // 선택 표시 링
    if (r.id === S.activeId) {
      g.strokeStyle = 'rgba(124,156,255,0.85)';
      g.lineWidth = 1.6 * s;
      g.setLineDash([4 * s, 3 * s]);
      ell(g, x, feetY + 1 * s, 17 * s, 6 * s); g.stroke();
      g.setLineDash([]);
    }

    var swing = walk ? Math.sin(ph) * 3.2 * s : 0;
    // 다리
    g.fillStyle = '#3a4157';
    rr(g, x - 5.5 * s + swing, hipY - 1 * s, 4.4 * s, legH + 1 * s, 2 * s); g.fill();
    rr(g, x + 1.1 * s - swing, hipY - 1 * s, 4.4 * s, legH + 1 * s, 2 * s); g.fill();
    // 신발
    g.fillStyle = '#262b3c';
    rr(g, x - 6.2 * s + swing, feetY - 3 * s, 5.8 * s, 3 * s, 1.4 * s); g.fill();
    rr(g, x + 0.6 * s - swing, feetY - 3 * s, 5.8 * s, 3 * s, 1.4 * s); g.fill();

    var by = shoulderY - bob;
    // 몸통
    g.fillStyle = st.body;
    rr(g, x - bodyW / 2, by, bodyW, bodyH + bob, 6 * s); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)';
    rr(g, x - bodyW / 2 + 2 * s, by + 2 * s, bodyW - 4 * s, bodyH * 0.38, 4 * s); g.fill();
    // 팔
    var typing = r.working && !walk;
    var armSwing = typing ? Math.sin(S.t * 14 + r.seed) * 2 * s : walk ? Math.sin(ph + Math.PI) * 2.4 * s : 0;
    g.fillStyle = st.body;
    rr(g, x - bodyW / 2 - 3.2 * s, by + 3 * s + armSwing, 4.4 * s, 11 * s, 2.2 * s); g.fill();
    rr(g, x + bodyW / 2 - 1.2 * s, by + 3 * s - armSwing, 4.4 * s, 11 * s, 2.2 * s); g.fill();
    // 손
    g.fillStyle = SKIN[hash(r.id) % SKIN.length];
    ell(g, x - bodyW / 2 - 1 * s, by + 14 * s + armSwing, 2.2 * s, 2.2 * s); g.fill();
    ell(g, x + bodyW / 2 + 1 * s, by + 14 * s - armSwing, 2.2 * s, 2.2 * s); g.fill();
    // 넥타이 / 배지
    if (st.acc === 'chief') {
      g.fillStyle = st.tie || '#ffd479';
      g.beginPath(); g.moveTo(x, by + 2 * s); g.lineTo(x + 2.6 * s, by + 7 * s); g.lineTo(x, by + 16 * s); g.lineTo(x - 2.6 * s, by + 7 * s); g.closePath(); g.fill();
    } else {
      g.fillStyle = 'rgba(255,255,255,0.45)';
      rr(g, x + bodyW * 0.12, by + bodyH * 0.52, 3 * s, 3 * s, 1 * s); g.fill();
    }

    // 목
    g.fillStyle = SKIN[hash(r.id) % SKIN.length];
    g.fillRect(x - 3 * s, headY + headR - 1 * s, 6 * s, 4 * s);

    // 머리카락 뒤
    g.fillStyle = st.hair;
    if (st.acc === 'bun') { ell(g, x + headR * 0.9, headY - headR * 0.55, 4.4 * s, 4.4 * s); g.fill(); }
    ell(g, x, headY + 1 * s, headR * 1.02, headR * 1.02); g.fill();

    // 얼굴
    var skin = SKIN[hash(r.id + 's') % SKIN.length];
    g.fillStyle = skin;
    ell(g, x, headY + 1.4 * s, headR * 0.94, headR * 0.96); g.fill();
    // 앞머리
    g.fillStyle = st.hair;
    g.beginPath();
    g.ellipse(x, headY - headR * 0.18, headR * 1.0, headR * 0.72, 0, Math.PI, TAU);
    g.fill();
    g.fillRect(x - headR * 0.98, headY - headR * 0.28, headR * 0.3, headR * 0.6);
    g.fillRect(x + headR * 0.68, headY - headR * 0.28, headR * 0.3, headR * 0.6);

    // 눈 (가끔 깜빡)
    var blink = (S.t + r.seed) % 4.6 < 0.14;
    g.fillStyle = '#2b2f42';
    if (blink) {
      g.fillRect(x - 4.6 * s, headY + 0.6 * s, 3 * s, 0.9 * s);
      g.fillRect(x + 1.6 * s, headY + 0.6 * s, 3 * s, 0.9 * s);
    } else {
      ell(g, x - 3.1 * s, headY + 1.2 * s, 1.35 * s, 1.6 * s); g.fill();
      ell(g, x + 3.1 * s, headY + 1.2 * s, 1.35 * s, 1.6 * s); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(x - 3.6 * s, headY + 0.5 * s, 1.1 * s, 1.1 * s);
      g.fillRect(x + 2.6 * s, headY + 0.5 * s, 1.1 * s, 1.1 * s);
    }
    // 볼 · 입
    g.fillStyle = 'rgba(240,150,150,0.28)';
    ell(g, x - 6.2 * s, headY + 3.6 * s, 2 * s, 1.4 * s); g.fill();
    ell(g, x + 6.2 * s, headY + 3.6 * s, 2 * s, 1.4 * s); g.fill();
    g.strokeStyle = '#8a4a4a'; g.lineWidth = 1 * s; g.lineCap = 'round';
    g.beginPath();
    if (r.working) { g.arc(x, headY + 4.4 * s, 2.2 * s, 0.15 * Math.PI, 0.85 * Math.PI); }
    else { g.arc(x, headY + 3.8 * s, 2.2 * s, 0.2 * Math.PI, 0.8 * Math.PI); }
    g.stroke();

    // 액세서리
    drawAccessory(g, st, x, headY, headR, s, r);

    // 타이핑 이펙트
    if (typing) {
      g.strokeStyle = 'rgba(255,220,140,0.85)'; g.lineWidth = 1.4 * s;
      var tg = (S.t * 3 + r.seed) % 1;
      for (var i = 0; i < 2; i++) {
        var ang = -0.7 + i * 0.9;
        g.globalAlpha = 0.7 - tg * 0.5;
        g.beginPath();
        g.moveTo(x + bodyW / 2 + 2 * s, by + 12 * s);
        g.lineTo(x + bodyW / 2 + (5 + tg * 4) * s * Math.cos(ang), by + 12 * s + (5 + tg * 4) * s * Math.sin(ang));
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // 이름표
    var label = String(r.name || '');
    if (label.length > 9) label = label.slice(0, 8) + '…';
    var fs = Math.max(7.5, 8.6 * s);
    g.font = '700 ' + fs + 'px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    var tw = g.measureText(label).width;
    var px = x, py = feetY + 6 * s;
    g.fillStyle = S.phase === 'night' ? 'rgba(12,16,30,0.72)' : 'rgba(28,32,52,0.68)';
    rr(g, px - tw / 2 - 4 * s, py - fs * 0.92, tw + 8 * s, fs * 1.5, fs * 0.6); g.fill();
    g.fillStyle = r.working ? '#ffe0a8' : 'rgba(240,244,255,0.92)';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, px, py);
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  }

  function drawAccessory(g, st, x, headY, headR, s, r) {
    var acc = st.acc;
    if (acc === 'chief') {
      // 헤드셋
      g.strokeStyle = '#2f3650'; g.lineWidth = 2 * s;
      g.beginPath(); g.arc(x, headY + 1 * s, headR * 1.14, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      g.fillStyle = '#2f3650';
      rr(g, x - headR * 1.24, headY - 1.5 * s, 3.4 * s, 6 * s, 1.6 * s); g.fill();
      rr(g, x + headR * 1.02, headY - 1.5 * s, 3.4 * s, 6 * s, 1.6 * s); g.fill();
      g.strokeStyle = '#2f3650'; g.lineWidth = 1.2 * s;
      g.beginPath(); g.moveTo(x + headR * 1.05, headY + 2.6 * s); g.lineTo(x + headR * 0.72, headY + 6.5 * s); g.stroke();
    } else if (acc === 'antenna') {
      g.strokeStyle = '#4a3d6b'; g.lineWidth = 1.4 * s;
      g.beginPath(); g.moveTo(x, headY - headR * 0.9); g.lineTo(x, headY - headR * 1.7); g.stroke();
      var gl = 0.55 + Math.sin(S.t * 3 + r.seed) * 0.35;
      g.fillStyle = 'rgba(255,226,130,' + gl + ')';
      ell(g, x, headY - headR * 1.8, 2.8 * s, 2.8 * s); g.fill();
      g.fillStyle = 'rgba(255,240,180,0.35)';
      ell(g, x, headY - headR * 1.8, 5 * s, 5 * s); g.fill();
    } else if (acc === 'helmet') {
      g.fillStyle = '#f2b23e';
      g.beginPath(); g.ellipse(x, headY - headR * 0.25, headR * 1.1, headR * 0.98, 0, Math.PI, TAU); g.fill();
      g.fillStyle = '#d99a25';
      rr(g, x - headR * 1.18, headY - headR * 0.34, headR * 2.36, 2.4 * s, 1.2 * s); g.fill();
    } else if (acc === 'cap') {
      g.fillStyle = '#2f8f80';
      g.beginPath(); g.ellipse(x, headY - headR * 0.3, headR * 1.02, headR * 0.82, 0, Math.PI, TAU); g.fill();
      g.fillStyle = '#237063';
      rr(g, x - headR * 1.1, headY - headR * 0.36, headR * 1.45, 2.6 * s, 1.2 * s); g.fill();
    } else if (acc === 'leaf') {
      g.strokeStyle = '#2f6b3a'; g.lineWidth = 1.4 * s;
      g.beginPath(); g.moveTo(x, headY - headR * 0.9); g.lineTo(x + 1 * s, headY - headR * 1.6); g.stroke();
      g.fillStyle = '#6fc46f';
      ell(g, x + 4 * s, headY - headR * 1.55, 4 * s, 2.6 * s); g.fill();
      ell(g, x - 3 * s, headY - headR * 1.35, 3.4 * s, 2.2 * s); g.fill();
    } else if (acc === 'glasses') {
      g.strokeStyle = '#2b2f42'; g.lineWidth = 1.2 * s;
      ell(g, x - 3.4 * s, headY + 1.2 * s, 2.8 * s, 2.2 * s); g.stroke();
      ell(g, x + 3.4 * s, headY + 1.2 * s, 2.8 * s, 2.2 * s); g.stroke();
      g.beginPath(); g.moveTo(x - 0.6 * s, headY + 1.2 * s); g.lineTo(x + 0.6 * s, headY + 1.2 * s); g.stroke();
    } else if (acc === 'bun') {
      g.fillStyle = st.hair;
      ell(g, x, headY - headR * 0.86, 4.6 * s, 4 * s); g.fill();
    } else if (acc === 'scarf') {
      g.fillStyle = '#e07a5f';
      rr(g, x - 6 * s, headY + headR * 0.72, 12 * s, 3.4 * s, 1.6 * s); g.fill();
    } else {
      // 기본: 헤드폰 한쪽
      g.strokeStyle = '#2f3650'; g.lineWidth = 2 * s;
      g.beginPath(); g.arc(x, headY + 1 * s, headR * 1.12, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.fillStyle = '#2f3650';
      rr(g, x - headR * 1.24, headY - 1 * s, 3.2 * s, 5.4 * s, 1.6 * s); g.fill();
      rr(g, x + headR * 1.02, headY - 1 * s, 3.2 * s, 5.4 * s, 1.6 * s); g.fill();
    }
  }

  /* 조명: 책상 스탠드 · 테이블 펜던트 */
  function drawLamps(g, pal) {
    if (pal.lamp <= 0.05) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    var u = S.u;
    // 펜던트
    g.strokeStyle = 'rgba(40,40,55,0.5)'; g.lineWidth = 1.2 * u;
    g.beginPath(); g.moveTo(0.5 * S.w, 0); g.lineTo(0.5 * S.w, 0.52 * S.h); g.stroke();
    var pg = g.createRadialGradient(0.5 * S.w, 0.56 * S.h, 4 * u, 0.5 * S.w, 0.56 * S.h, 120 * u);
    pg.addColorStop(0, 'rgba(255,214,140,' + (0.34 * pal.lamp) + ')');
    pg.addColorStop(0.5, 'rgba(255,200,120,' + (0.10 * pal.lamp) + ')');
    pg.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = pg;
    g.fillRect(0.5 * S.w - 130 * u, 0.56 * S.h - 130 * u, 260 * u, 260 * u);
    g.fillStyle = pal.night ? '#3a3550' : '#4a4a5f';
    rr(g, 0.5 * S.w - 9 * u, 0.50 * S.h, 18 * u, 5 * u, 2.5 * u); g.fill();
    g.fillStyle = 'rgba(255,232,170,' + (0.85 * pal.lamp) + ')';
    ell(g, 0.5 * S.w, 0.505 * S.h, 6 * u, 1.8 * u); g.fill();
    // 책상 스탠드
    SEATS.filter(function (s) { return s.desk; }).forEach(function (s) {
      var cx = s.x * S.w + 24 * S.u, cy = s.y * S.h + 22 * S.u;
      var lg = g.createRadialGradient(cx, cy, 2 * u, cx, cy, 46 * u);
      lg.addColorStop(0, 'rgba(255,214,150,' + (0.22 * pal.lamp) + ')');
      lg.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = lg;
      g.fillRect(cx - 50 * u, cy - 50 * u, 100 * u, 100 * u);
    });
    g.restore();
  }

  function drawZoneLabels(g, pal) {
    var L = S.labels;
    var u = S.u;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = pal.ink;
    g.font = '800 ' + Math.max(7.5, 8.4 * u) + 'px system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif';
    g.fillText(L.zoneMeeting || '회의실', 0.5 * S.w, 0.775 * S.h);
    g.fillText(L.zoneMaker || '메이커 존', 0.125 * S.w, 0.355 * S.h);
    g.fillText(L.zoneLounge || '라운지', 0.185 * S.w, 0.858 * S.h);
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  }

  function drawVignette(g, pal) {
    var grad = g.createRadialGradient(S.w * 0.5, S.h * 0.55, S.h * 0.2, S.w * 0.5, S.h * 0.55, S.w * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, pal.night ? 'rgba(4,6,16,0.55)' : 'rgba(60,40,30,0.18)');
    g.fillStyle = grad; g.fillRect(0, 0, S.w, S.h);
    if (pal.tint && pal.tint !== 'rgba(255,214,150,0.05)') {
      g.fillStyle = pal.tint; g.fillRect(0, 0, S.w, S.h);
    }
  }

  return {
    init: init, sync: sync, setMode: setMode, fit: fit,
    getPhase: function () { return S.phase; }
  };
})();
