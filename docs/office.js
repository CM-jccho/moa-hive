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

  /* 의인화된 크리터 팔레트 — 역할별 소품(prop)으로 개성 */
  var STYLE_BASE = [
    { body: '#6f8cf0', belly: '#a8b8ff', prop: 'emoji', accent: '#ffe066' },
    { body: '#f0a15c', belly: '#ffc995', prop: 'emoji', accent: '#ffe066' },
    { body: '#57c9b4', belly: '#9ce8da', prop: 'emoji', accent: '#ccfff6' },
    { body: '#b18cf5', belly: '#d3bbff', prop: 'emoji', accent: '#ffe066' },
    { body: '#ef86a4', belly: '#ffb8cb', prop: 'emoji', accent: '#ffd6e3' },
    { body: '#6cc273', belly: '#a3e0a8', prop: 'emoji', accent: '#d6ffd9' },
    { body: '#93a6c4', belly: '#c0cfe6', prop: 'emoji', accent: '#cfe6ff' },
    { body: '#d3a44f', belly: '#f1cd87', prop: 'emoji', accent: '#ffe9b0' }
  ];

  var S = {
    canvas: null, ctx: null, overlay: null, stage: null, clock: null, phaseEl: null, times: null,
    w: 0, h: 0, u: 1, dpr: 1,
    bots: [], labels: {}, activeId: null, chiefId: null,
    mode: 'auto', phase: 'day', t: 0, last: 0, raf: 0, running: false,
    visible: true, reduced: false, lastClock: '', chatNext: 0
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
  function styleFor(name, emoji) {
    var n = String(name || '');
    var em = String(emoji || '');
    if (/chief|팀장/i.test(n)) return { body: '#6a7ce0', belly: '#a7b3ff', prop: 'crown', accent: '#ffd45e' };
    if (/prototyper|아이디어|소재/i.test(n)) return { body: '#b18cf5', belly: '#d8c3ff', prop: 'bulb', accent: '#ffe066' };
    if (/builder|구현|개발|상세페이지/i.test(n)) return { body: '#f0a15c', belly: '#ffc995', prop: 'helmet', accent: '#f7c948' };
    if (/sweeper|정리|정돈/i.test(n)) return { body: '#57c9b4', belly: '#9ce8da', prop: 'broom', accent: '#ccfff6' };
    if (/grower|성장|그로스/i.test(n)) return { body: '#6cc273', belly: '#a3e0a8', prop: 'sprout', accent: '#d6ffd9' };
    if (/maintainer|운영|보안|리뷰|분석/i.test(n)) return { body: '#8d9fc0', belly: '#bccbe4', prop: 'shield', accent: '#cfe6ff' };
    var base = STYLE_BASE[hash(n + em) % STYLE_BASE.length];
    return { body: base.body, belly: base.belly, prop: 'emoji', accent: base.accent, emoji: em };
  }

  /* 색 밝기 조절 (그라데이션용) */
  function shade(hex, amt) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var num = parseInt(h, 16);
    var r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amt));
    var g2 = Math.min(255, Math.max(0, ((num >> 8) & 255) + amt));
    var b = Math.min(255, Math.max(0, (num & 255) + amt));
    return 'rgb(' + Math.round(r) + ',' + Math.round(g2) + ',' + Math.round(b) + ')';
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
            away: null, linger: 0, bubble: '', style: styleFor(b.name, b.emoji), el: null, bubbleEl: null,
            moving: true, speed: 0.19 + (i % 4) * 0.017,
            chatText: '', chatUntil: 0, doneUntil: 0, jumpT: 0, wasWorking: false
          };
        } else {
          r.id = b.id;
          r.seat = seat; r.home = seat; r.style = styleFor(b.name, b.emoji);
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
      var was = r.working;
      r.working = !!(busy.chief && isChief) || busy.agent === r.id;
      if (was && !r.working) { r.doneUntil = S.t + 2.2; r.chatUntil = 0; }
      if (r.working) { r.chatUntil = 0; r.chatText = ''; }
      r.wasWorking = r.working;
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
        r.jumpT = 0.001;
        r.doneUntil = 0;
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
    // 3~4초마다 한 명이 짧은 한 줄을 띄웁니다
    if (S.t > S.chatNext) {
      S.chatNext = S.t + 3 + Math.random() * 1.6;
      var lines = S.labels.idle;
      var cands = S.bots.filter(function (r) { return !r.working && !r.away; });
      if (cands.length && lines && lines.length) {
        var who = cands[Math.floor(Math.random() * cands.length)];
        who.chatText = lines[Math.floor(Math.random() * lines.length)];
        who.chatUntil = S.t + 2.8;
      }
    }
    S.bots.forEach(function (r) {
      r.stepT += dt;
      if (r.jumpT > 0) { r.jumpT += dt; if (r.jumpT > 0.62) r.jumpT = 0; }
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
    if (r.delegating) return '🧠 ' + (S.labels.delegating || '배분 중…');
    if (r.working) return '⚡ ' + (S.labels.working || '작업 중…');
    if (r.chatUntil > S.t && r.chatText) return r.chatText;
    if (r.doneUntil > S.t) return '✅ ' + (S.labels.doneShort || '끝!');
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
      var bw = Math.round(46 * s + 12);
      var bh = Math.round(52 * s + 12);
      var x = r.x * S.w - bw / 2;
      var y = r.y * S.h - bh + 8;
      r.el.style.width = bw + 'px';
      r.el.style.height = bh + 'px';
      r.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      r.el.style.zIndex = String(Math.round(r.y * 26));
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
    items.sort(function (a, b) { return a.y - b.y; });
    for (var k = 0; k < items.length; k++) items[k].f();
    drawZoneLabels(g, pal);
    drawVignette(g, pal);
    S.bots.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (r) {
      drawCharacter(g, r, pal);
    });
    drawLinks(g, pal);
    drawLamps(g, pal);
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
    var pulse = 0.5 + 0.5 * Math.sin(S.t * (working ? 4.2 : 1.6) + seat.x * 9);
    var glowA = (working ? 0.45 : 0.24) + pulse * (working ? 0.28 : 0.1) + pal.night * 0.3;
    var sg = g.createLinearGradient(mx, my, mx + mw, my + mh);
    sg.addColorStop(0, 'rgba(140,200,255,' + glowA + ')');
    sg.addColorStop(1, working ? 'rgba(255,214,140,' + (glowA + 0.18) + ')' : 'rgba(110,170,235,' + glowA * 0.7 + ')');
    g.fillStyle = sg; rr(g, mx, my, mw, mh, 1.5 * S.u); g.fill();
    // 화면 위를 지나가는 스캔 라인
    g.save();
    rr(g, mx, my, mw, mh, 1.5 * S.u); g.clip();
    var scanX = mx + ((S.t * (working ? 0.55 : 0.3) + seat.y * 3) % 1) * mw;
    var scanG = g.createLinearGradient(scanX - 6 * S.u, 0, scanX + 6 * S.u, 0);
    scanG.addColorStop(0, 'rgba(255,255,255,0)');
    scanG.addColorStop(0.5, 'rgba(255,255,255,' + (working ? 0.5 : 0.28) + ')');
    scanG.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = scanG; g.fillRect(scanX - 6 * S.u, my, 12 * S.u, mh);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    for (var i = 0; i < 3; i++) g.fillRect(mx + 2 * S.u, my + (3 + i * 3.5) * S.u, mw * (0.55 - i * 0.1) * (working ? 1 : 0.8), 1.2 * S.u);
    g.restore();
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
    // 김이 모락모락 (3겹으로 피어오름)
    for (var i = 0; i < 3; i++) {
      var prog = (S.t * 0.45 + i / 3) % 1;
      var steam = 1 - prog;
      g.strokeStyle = 'rgba(255,255,255,' + (0.34 * steam) + ')';
      g.lineWidth = (1.4 + prog) * S.u;
      g.beginPath();
      var sx = x + w * (0.34 + i * 0.14);
      var sy = y + h * 0.08 - prog * 15 * S.u;
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + (3 + i) * S.u * Math.sin(S.t * 2 + i), sy - 4 * S.u, sx - (1 + prog * 3) * S.u, sy - 8 * S.u);
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
    var groundY = r.y * S.h;
    var st = r.style || styleFor(r.name, r.emoji);
    var walking = r.moving;
    var ph = r.stepT * 10;

    // 통통 튀는 이동 + 클릭 점프
    var hop = walking ? Math.abs(Math.sin(ph)) * 4.4 * s : Math.sin(S.t * 1.5 + r.seed) * 1.1 * s;
    var jump = r.jumpT > 0 ? Math.sin(Math.min(1, r.jumpT / 0.62) * Math.PI) * 14 * s : 0;
    var lift = hop + jump;
    var squashBase = walking ? Math.sin(ph) * 0.055 : Math.sin(S.t * 1.5 + r.seed) * 0.02 + (r.working ? Math.sin(S.t * 9) * 0.03 : 0);
    var squash = 1 + squashBase - (jump > 0 ? 0.05 : 0);
    var bw = 17 * s / Math.sqrt(Math.max(0.8, squash));
    var bh = 15 * s * squash;
    var cy = groundY - lift - bh;      // 몸통 중심
    var topY = cy - bh;                // 몸통 위

    // 그림자 (점프하면 작아짐)
    g.fillStyle = 'rgba(25,18,40,' + (0.24 - (lift / (40 * s)) * 0.12) + ')';
    ell(g, x, groundY + 1.5 * s, bw * (1 - lift / (60 * s)), 4.2 * s); g.fill();

    // 선택 링
    if (r.id === S.activeId) {
      g.strokeStyle = 'rgba(124,156,255,0.9)';
      g.lineWidth = 1.6 * s;
      g.setLineDash([4 * s, 3 * s]);
      ell(g, x, groundY + 1.5 * s, bw * 1.15, 5.6 * s); g.stroke();
      g.setLineDash([]);
    }

    // 발 (통통)
    var stepL = walking ? Math.sin(ph) * 2.6 * s : 0;
    g.fillStyle = shade(st.body, -38);
    ell(g, x - 7 * s + stepL, groundY - 2.2 * s, 5.2 * s, 3.4 * s); g.fill();
    ell(g, x + 7 * s - stepL, groundY - 2.2 * s, 5.2 * s, 3.4 * s); g.fill();

    // 뒤쪽 날개
    var flap = walking ? Math.sin(ph * 2) * 0.55 : Math.sin(S.t * 2.2 + r.seed) * 0.18;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    [1, -1].forEach(function (dir) {
      g.save();
      g.translate(x + dir * (bw + 1.5 * s), cy - 2 * s);
      g.rotate(dir * (0.5 + flap));
      ell(g, dir * 4 * s, 0, 5.5 * s, 3.2 * s); g.fill();
      g.restore();
    });

    // 몸통 (동글동글 + 그라데이션 + 배)
    var bg = g.createLinearGradient(0, topY, 0, cy + bh);
    bg.addColorStop(0, shade(st.body, 26));
    bg.addColorStop(1, shade(st.body, -18));
    g.fillStyle = bg;
    ell(g, x, cy, bw, bh); g.fill();
    g.fillStyle = st.belly || shade(st.body, 40);
    ell(g, x, cy + bh * 0.3, bw * 0.62, bh * 0.54); g.fill();
    // 광택
    g.fillStyle = 'rgba(255,255,255,0.34)';
    ell(g, x - bw * 0.36, cy - bh * 0.42, bw * 0.28, bh * 0.2); g.fill();

    // 팔 (작업 중엔 빠르게 움직임)
    var armSwing = r.working ? Math.sin(S.t * 14 + r.seed) * 1.8 * s : walking ? Math.sin(ph + Math.PI) * 1.6 * s : 0;
    g.fillStyle = shade(st.body, -10);
    ell(g, x - bw * 0.92, cy + 2 * s + armSwing, 4.2 * s, 3.2 * s); g.fill();
    ell(g, x + bw * 0.92, cy + 2 * s - armSwing, 4.2 * s, 3.2 * s); g.fill();

    // 얼굴 — 큰 눈 · 볼 · 입
    var eyeY = cy - bh * 0.12;
    var eyeR = 5.4 * s;
    var pupil = 2.9 * s;
    var blink = (S.t + r.seed) % 4.4 < 0.13;
    var look = Math.sin(S.t * 0.6 + r.seed) * 0.9 * s;
    if (blink) {
      g.strokeStyle = '#33304a'; g.lineWidth = 1.4 * s; g.lineCap = 'round';
      [-1, 1].forEach(function (d) {
        g.beginPath();
        g.arc(x + d * 6 * s, eyeY, eyeR * 0.9, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
      });
    } else {
      [-1, 1].forEach(function (d) {
        g.fillStyle = '#ffffff';
        ell(g, x + d * 6 * s, eyeY, eyeR, eyeR * (r.working ? 0.9 : 1.05)); g.fill();
        g.fillStyle = '#2c2a3e';
        ell(g, x + d * 6 * s + look, eyeY + (r.working ? 0.6 * s : 0.2 * s), pupil, pupil * (r.working ? 1.05 : 1.15)); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.95)';
        ell(g, x + d * 6 * s + look - 1.1 * s, eyeY - 1.2 * s, 1.1 * s, 1.1 * s); g.fill();
      });
    }
    // 집중 눈썹
    if (r.working) {
      g.strokeStyle = '#33304a'; g.lineWidth = 1.2 * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 9.6 * s, eyeY - 6.2 * s); g.lineTo(x - 3.4 * s, eyeY - 7.4 * s); g.stroke();
      g.beginPath(); g.moveTo(x + 9.6 * s, eyeY - 6.2 * s); g.lineTo(x + 3.4 * s, eyeY - 7.4 * s); g.stroke();
    }
    // 볼
    g.fillStyle = 'rgba(255,140,160,0.30)';
    ell(g, x - 11 * s, eyeY + 3.6 * s, 2.4 * s, 1.7 * s); g.fill();
    ell(g, x + 11 * s, eyeY + 3.6 * s, 2.4 * s, 1.7 * s); g.fill();
    // 입
    g.strokeStyle = '#5c3a4a'; g.lineWidth = 1.15 * s; g.lineCap = 'round';
    g.beginPath();
    if (r.working) { g.moveTo(x - 2 * s, eyeY + 5.4 * s); g.lineTo(x + 2 * s, eyeY + 5.4 * s); }
    else if (blink) { g.arc(x, eyeY + 4.2 * s, 2.4 * s, 0.1 * Math.PI, 0.9 * Math.PI); }
    else {
      g.arc(x - 1.3 * s, eyeY + 4.4 * s, 1.5 * s, 0.1 * Math.PI, 1.1 * Math.PI);
      g.arc(x + 1.3 * s, eyeY + 4.4 * s, 1.5 * s, 0.1 * Math.PI, 1.1 * Math.PI);
    }
    g.stroke();

    // 역할 소품
    drawProp(g, st, x, topY, bw, bh, s, r);

    // 작업 중 — 손끝 스파크
    if (r.working && !walking) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 3; i++) {
        var tw = (S.t * 2.4 + i * 0.33 + r.seed) % 1;
        g.fillStyle = 'rgba(255,228,150,' + (0.75 * (1 - tw)) + ')';
        var ax = x + (i % 2 ? 1 : -1) * (bw + (2 + tw * 6) * s);
        var ay = cy - 4 * s - tw * 8 * s;
        g.beginPath(); g.arc(ax, ay, (2.4 - tw * 1.4) * s, 0, TAU); g.fill();
      }
      g.restore();
    }

    // 클릭 반짝임
    if (r.jumpT > 0) {
      var jp = r.jumpT / 0.62;
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (var sp = 0; sp < 8; sp++) {
        var ang = -Math.PI / 2 + (sp - 3.5) * 0.4;
        var dist = (16 + jp * 30) * s;
        g.globalAlpha = Math.max(0, 1 - jp);
        g.fillStyle = sp % 2 ? 'rgba(255,232,150,1)' : 'rgba(180,214,255,1)';
        g.beginPath();
        g.arc(x + Math.cos(ang) * dist, cy - 6 * s + Math.sin(ang) * dist * 0.9, (2.8 - jp * 1.7) * s, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
    }

    // 이름표
    var label = String(r.name || '');
    if (label.length > 9) label = label.slice(0, 8) + '…';
    var fs = Math.max(7, 8.2 * s);
    g.font = '700 ' + fs + 'px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    var tw2 = g.measureText(label).width;
    var py = groundY + 11 * s;
    g.fillStyle = S.phase === 'night' ? 'rgba(10,14,26,0.78)' : 'rgba(28,32,52,0.62)';
    rr(g, x - tw2 / 2 - 3.5 * s, py - fs * 0.78, tw2 + 7 * s, fs * 1.45, fs * 0.7); g.fill();
    g.fillStyle = r.working ? '#ffe0a8' : 'rgba(240,244,255,0.92)';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, x, py);
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  }

  /* 역할별 소품 — 크리터 머리 위/손에 달린 작은 물건 */
  function drawProp(g, st, x, topY, bw, bh, s, r) {
    var prop = st.prop || 'emoji';
    var bob = Math.sin(S.t * 2 + r.seed) * 1.2 * s;
    if (prop === 'crown') {
      var cw = 15 * s, chh = 9 * s, cy0 = topY - 3 * s + bob;
      g.fillStyle = st.accent || '#ffd45e';
      g.beginPath();
      g.moveTo(x - cw / 2, cy0 + chh);
      g.lineTo(x - cw / 2, cy0 + chh * 0.35);
      g.lineTo(x - cw / 4, cy0 + chh * 0.68);
      g.lineTo(x, cy0);
      g.lineTo(x + cw / 4, cy0 + chh * 0.68);
      g.lineTo(x + cw / 2, cy0 + chh * 0.35);
      g.lineTo(x + cw / 2, cy0 + chh);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.arc(x, cy0 + chh * 0.62, 1.7 * s, 0, TAU); g.fill();
    } else if (prop === 'bulb') {
      g.strokeStyle = '#6b5aa0'; g.lineWidth = 1.5 * s;
      g.beginPath(); g.moveTo(x, topY + 1 * s); g.quadraticCurveTo(x + 3 * s, topY - 5 * s, x, topY - 9 * s + bob); g.stroke();
      var gl = 0.7 + Math.sin(S.t * 3.2 + r.seed) * 0.3;
      g.save();
      g.globalCompositeOperation = 'lighter';
      var gr = g.createRadialGradient(x, topY - 12 * s + bob, 1, x, topY - 12 * s + bob, 14 * s);
      gr.addColorStop(0, 'rgba(255,236,150,' + (0.55 * gl) + ')');
      gr.addColorStop(1, 'rgba(255,220,120,0)');
      g.fillStyle = gr;
      g.fillRect(x - 16 * s, topY - 28 * s + bob, 32 * s, 32 * s);
      g.restore();
      g.fillStyle = '#ffe066';
      ell(g, x, topY - 12 * s + bob, 4.4 * s, 4.8 * s); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      ell(g, x - 1.3 * s, topY - 13.4 * s + bob, 1.5 * s, 1.5 * s); g.fill();
      g.fillStyle = '#c9a227';
      g.fillRect(x - 2.2 * s, topY - 7.4 * s + bob, 4.4 * s, 1.6 * s);
    } else if (prop === 'helmet') {
      g.fillStyle = st.accent || '#f7c948';
      g.beginPath(); g.ellipse(x, topY + 1.5 * s, bw * 0.86, 11 * s, 0, Math.PI, TAU); g.fill();
      g.fillStyle = shade(st.accent || '#f7c948', -30);
      rr(g, x - bw * 0.95, topY + 0.2 * s, bw * 1.9, 3 * s, 1.6 * s); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      rr(g, x - 2 * s, topY - 9 * s, 4 * s, 9 * s, 2 * s); g.fill();
    } else if (prop === 'broom') {
      g.save();
      g.translate(x + bw * 0.95, topY + bh * 0.9);
      g.rotate(-0.5 + Math.sin(S.t * 3 + r.seed) * 0.08);
      g.strokeStyle = '#a9743f'; g.lineWidth = 2.2 * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 4 * s); g.lineTo(0, -12 * s); g.stroke();
      g.fillStyle = '#ffd45e';
      g.beginPath(); g.moveTo(-4 * s, -12 * s); g.lineTo(4 * s, -12 * s); g.lineTo(6 * s, -18 * s); g.lineTo(-6 * s, -18 * s); g.closePath(); g.fill();
      g.restore();
      // 반짝이
      for (var i = 0; i < 2; i++) {
        var tw = (S.t * 2 + i * 0.5 + r.seed) % 1;
        g.fillStyle = 'rgba(255,245,190,' + (0.8 * (1 - tw)) + ')';
        g.beginPath(); g.arc(x + bw + (4 + tw * 8) * s, topY - 6 * s - tw * 8 * s, 1.6 * s, 0, TAU); g.fill();
      }
    } else if (prop === 'sprout') {
      g.strokeStyle = '#3f8a4a'; g.lineWidth = 1.6 * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, topY + 2 * s); g.quadraticCurveTo(x + 2 * s, topY - 5 * s, x, topY - 8 * s + bob); g.stroke();
      g.fillStyle = '#7ed684';
      ell(g, x + 4.6 * s, topY - 8 * s + bob, 5 * s, 3 * s); g.fill();
      g.fillStyle = '#5fbf67';
      ell(g, x - 4 * s, topY - 6 * s + bob, 4.2 * s, 2.6 * s); g.fill();
    } else if (prop === 'shield') {
      var sy = topY + bh * 0.55;
      g.fillStyle = st.accent || '#9fd2ff';
      g.beginPath();
      g.moveTo(x - bw - 4 * s, sy - 6 * s);
      g.lineTo(x - bw + 5 * s, sy - 6 * s);
      g.lineTo(x - bw + 5 * s, sy + 2 * s);
      g.quadraticCurveTo(x - bw + 0.5 * s, sy + 9 * s, x - bw - 4 * s, sy + 2 * s);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.65)';
      ell(g, x - bw + 0.5 * s, sy - 1 * s, 2 * s, 2 * s); g.fill();
      // 고글
      g.strokeStyle = 'rgba(60,80,120,0.75)'; g.lineWidth = 1.4 * s;
      g.beginPath(); g.arc(x, topY + 4 * s, bw * 0.86, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    } else {
      // 업종 봇 — 자기 이모지를 든 채로
      var em = st.emoji || r.emoji || '✨';
      var by = topY + bh * 0.35 + bob;
      g.fillStyle = 'rgba(255,255,255,0.86)';
      ell(g, x + bw + 7 * s, by, 7.2 * s, 7.2 * s); g.fill();
      g.fillStyle = 'rgba(90,100,140,0.12)';
      ell(g, x + bw + 7 * s, by + 1 * s, 6.2 * s, 6.2 * s); g.fill();
      g.font = Math.max(8, 9.6 * s) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(em, x + bw + 7 * s, by + 0.5 * s);
      g.textAlign = 'start'; g.textBaseline = 'alphabetic';
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

  /* 팀장 ↔ 작업 봇 사이로 날아가는 데이터 패킷 */
  function drawLinks(g, pal) {
    var chief = null;
    S.bots.forEach(function (r) { if (r.id === S.chiefId) chief = r; });
    if (!chief) return;
    var u = S.u;
    S.bots.forEach(function (r) {
      if (!r.working || r.id === S.chiefId) return;
      var x1 = chief.x * S.w, y1 = chief.y * S.h - 30 * u;
      var x2 = r.x * S.w, y2 = r.y * S.h - 30 * u;
      var mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 34 * u;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(140,190,255,0.55)';
      g.lineWidth = 1.5 * u;
      g.setLineDash([3 * u, 6 * u]);
      g.lineDashOffset = -S.t * 26;
      g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(mx, my, x2, y2); g.stroke();
      g.setLineDash([]);
      for (var k = 0; k < 2; k++) {
        var p = (S.t * 0.75 + k * 0.5) % 1;
        var inv = 1 - p;
        var px = inv * inv * x1 + 2 * inv * p * mx + p * p * x2;
        var py = inv * inv * y1 + 2 * inv * p * my + p * p * y2;
        var rad = 10 * u;
        var grd = g.createRadialGradient(px, py, 0, px, py, rad);
        grd.addColorStop(0, 'rgba(255,246,190,0.95)');
        grd.addColorStop(0.35, 'rgba(190,220,255,0.55)');
        grd.addColorStop(1, 'rgba(150,190,255,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(px, py, rad, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.beginPath(); g.arc(px, py, 2.2 * u, 0, TAU); g.fill();
      }
      g.restore();
    });
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
