/* MOA Hive — 클라이언트 (의존성 0) */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const S = {
    bots: [],
    channels: [],
    messages: [],
    approvals: [],
    settings: {},
    env: { active: 'stg', stg: {}, prod: {}, pending: false, readOnly: false },
    engines: {},
    activeChannelId: null,
    activeBotId: null,
    typing: null,
    tab: 'context',
    market: [],
    releases: [],
    changelog: [],
    proposals: [],
    inspector: {},
    inspectorFor: null,
    voiceListening: false,
    pollTimer: null,
    marketTarget: null,
    admin: false,
    officeOpen: true,
  };

  /* ── helpers ── */
  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      headers: { 'content-type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      const err = new Error(data.error || `요청 실패 (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  let toastTimer = null;
  function toast(msg, kind = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast ' + kind; }, 3200);
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function md(src) {
    let t = esc(src || '');
    const blocks = [];
    t = t.replace(/```([\s\S]*?)```/g, (m, code) => {
      blocks.push(`<pre><code>${code.replace(/^\n/, '')}</code></pre>`);
      return `\u0000B${blocks.length - 1}\u0000`;
    });
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|\n)\s*&gt;\s?(.+)/g, '$1<blockquote>$2</blockquote>');
    t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // lists
    const lines = t.split('\n');
    const out = [];
    let inList = false;
    for (const line of lines) {
      const m = line.match(/^\s*- (.*)$/);
      if (m) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${m[1]}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(line);
      }
    }
    if (inList) out.push('</ul>');
    t = out.join('\n');
    // paragraphs
    t = t
      .split(/\n{2,}/)
      .map((p) => {
        if (/^\s*<(ul|blockquote|pre)/.test(p)) return p;
        if (p.includes('\u0000B')) return p.replace(/\n/g, '<br>');
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');
    t = t.replace(/\u0000B(\d+)\u0000/g, (m, i) => blocks[Number(i)]);
    return t;
  }

  function isBotWorking(id) {
    const t = S.typing;
    if (!t) return false;
    return t.botId === id || (Array.isArray(t.delegateIds) && t.delegateIds.includes(id));
  }

  /* ── 관리자 모드 (일반 화면에서는 STG/PROD·Release 숨김) ── */
  function adminFromEnv() {
    let q = null;
    try { q = new URLSearchParams(location.search).get('admin'); } catch (e) {}
    if (q === '1') return true;
    if (q === '0') return false;
    try { return localStorage.getItem('moa_admin') === '1'; } catch (e) { return false; }
  }

  function applyAdminMode() {
    const on = !!S.admin;
    document.body.classList.toggle('admin-mode', on);
    const sw = $('#envSwitch');
    if (sw) sw.hidden = !on;
    const relTab = $('.rtab[data-tab="release"]');
    if (relTab) relTab.hidden = !on;
    if (!on && S.tab === 'release') setTab('context');
    const relPane = $('#releasePane');
    if (relPane && !on) relPane.hidden = true;
    const cb = $('#adminToggle');
    if (cb) cb.checked = on;
  }

  function setAdmin(on) {
    S.admin = !!on;
    try { localStorage.setItem('moa_admin', on ? '1' : '0'); } catch (e) {}
    applyAdminMode();
    renderSidebar();
    if (on) toast('관리자 모드 — STG/PROD 전환과 Release 패널이 표시됩니다.', '');
    else toast('일반 모드 — 관리자 도구를 숨겼습니다.', '');
  }

  /* ── 가상 오피스 ── */
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
    return `<button type="button" class="office-char ${characterClass(b.name)} ${working ? 'working' : 'idle'}" data-office-bot="${esc(b.id)}" data-testid="office-char" title="${esc(b.name)} 역할 카드 열기">
      <span class="char-bubble">${esc(bubble || '')}</span>
      <span class="char-avatar">${esc(b.emoji || '🤖')}</span>
      <span class="char-desk"></span>
      <span class="char-name">${esc(b.name)}</span>
    </button>`;
  }

  function renderOffice() {
    const floor = $('#officeFloor');
    if (!floor) return;
    const chief = S.bots.find((b) => b.isChief || b.role === 'chief');
    const rest = S.bots.filter((b) => b !== chief);
    const desks = rest.slice(0, 3);
    const lounge = rest.slice(3, 5);
    const delegating = !!(S.typing && S.typing.delegating);
    const put = (zone, list) => {
      const row = floor.querySelector(`[data-zone="${zone}"] .zone-row`);
      if (!row) return;
      row.innerHTML = list.length
        ? list.map((b) => {
            const working = isBotWorking(b.id);
            const bubble = working ? (b === chief && delegating ? '위임 중…' : '작업 중…') : '';
            return officeChar(b, working, bubble);
          }).join('')
        : '<span class="office-empty">아직 없음</span>';
    };
    put('chief', chief ? [chief] : []);
    put('agents', desks);
    put('lounge', lounge);
    const hint = $('#officeHint');
    if (hint) hint.textContent = chief ? `${chief.name} + 에이전트 ${rest.length}명` : '';
    floor.querySelectorAll('[data-office-bot]').forEach((el) => {
      el.addEventListener('click', () => openBot(el.dataset.officeBot));
    });
  }
  function botById(id) { return S.bots.find((b) => b.id === id); }
  function channelById(id) { return S.channels.find((c) => c.id === id); }
  function approvalById(id) { return S.approvals.find((a) => a.id === id) || null; }

  /* ── 초기 로드 ── */
  async function loadState(channelId) {
    const q = channelId ? `?channelId=${encodeURIComponent(channelId)}` : '';
    const d = await api('/state' + q);
    S.bots = d.bots;
    S.channels = d.channels;
    S.settings = d.settings;
    S.env = d.env;
    S.engines = d.engines;
    S.approvals = d.approvals || [];
    S.proposals = d.proposals || [];
    S.messages = d.messages || [];
    S.typing = d.typing;
    S.activeChannelId = d.activeChannelId;
    if (!S.activeBotId || !botById(S.activeBotId)) S.activeBotId = S.bots[0] ? S.bots[0].id : null;
    renderAll();
    loadRelease();
  }

  function renderAll() {
    applyAdminMode();
    renderEnv();
    renderSidebar();
    renderChatHead();
    renderOffice();
    renderMessages();
    renderBotContext();
    renderPickle();
    renderEngineChip();
  }

  function renderEnv() {
    const env = S.env || {};
    $$('.env-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.env === env.active));
    const label = env.active === 'prod' ? `PROD v${env.prod?.version || ''}` : `STG v${env.stg?.version || ''}`;
    const badge = $('#envBadge');
    badge.textContent = label;
    badge.style.opacity = env.pending && env.active === 'stg' ? '1' : '.85';
    const ro = !!env.readOnly;
    $('#readonlyBanner').hidden = !ro;
    $('#composer').disabled = ro;
    $('#sendBtn').disabled = ro;
    $('#composer').placeholder = ro
      ? 'PROD는 읽기 전용입니다 — STG에서 작성하세요'
      : '메시지 입력 — @봇이름 으로 호출, /shell ls -la 로 명령 제안';
  }

  function renderPickle() {
    const p = (S.settings && S.settings.pickle) || {};
    const card = $('#pickleCard');
    if (!p.enabled) { card.hidden = true; return; }
    card.hidden = false;
    card.href = p.url || 'https://pickle.com/i/X2XQHRSC3K55';
    $('.pickle-title', card).textContent = p.title || 'PC 밖에서도 AI 팀이 필요할 땐 Pickle';
    $('#pickleBody').textContent = p.body || '';
    $('#pickleCta').textContent = (p.cta || 'Pickle 초대 링크 열기') + ' →';
  }

  function renderEngineChip() {
    const e = S.engines || {};
    const label = { 'cli-claude': 'Claude CLI', 'cli-codex': 'Codex CLI', 'api-anthropic': 'Anthropic API', 'api-openai': 'OpenAI API', simulator: '로컬 시뮬레이터' }[e.mode] || '엔진 미확인';
    const chip = $('#engineChip');
    chip.textContent = `엔진 · ${label}`;
    const dot = $('#engineDot');
    dot.style.background = e.mode === 'simulator' ? '#ffc46b' : e.mode && e.mode.startsWith('cli') ? '#5ee0b0' : '#7c9cff';
  }

  function renderSidebar() {
    const chBox = $('#channelList');
    chBox.innerHTML = S.channels
      .slice()
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
      .map((c) => {
        const active = c.id === S.activeChannelId ? ' is-active' : '';
        const mode = c.mode === 'auto' ? 'Auto' : '멘션';
        return `<div class="row-item${active}" data-channel-id="${c.id}" data-testid="channel-item">
          <span class="row-emoji">${c.mode === 'auto' ? '#' : '💬'}</span>
          <span class="row-name">${esc(c.name)}</span>
          ${c.pinned ? '<span class="pin-mark">📌</span>' : ''}
          <span class="row-meta">${mode}</span>
        </div>`;
      })
      .join('');

    const botBox = $('#botList');
    botBox.innerHTML = S.bots
      .slice()
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
      .map((b) => {
        const active = b.id === S.activeBotId && S.tab === 'context' ? ' is-active' : '';
        const working = isBotWorking(b.id);
        const tail = working
          ? '<span class="row-work">⚡</span>'
          : b.pinned
          ? '<span class="pin-mark">📌</span>'
          : `<span class="row-meta">${esc(b.role)}</span>`;
        return `<div class="row-item${active}" data-bot-id="${b.id}" data-testid="bot-item">
          <span class="row-emoji ${working ? 'working' : 'idle'}">${esc(b.emoji || '🤖')}</span>
          <span class="row-name">${esc(b.name)}</span>
          ${tail}
        </div>`;
      })
      .join('');

    chBox.querySelectorAll('[data-channel-id]').forEach((el) =>
      el.addEventListener('click', () => selectChannel(el.dataset.channelId))
    );
    botBox.querySelectorAll('[data-bot-id]').forEach((el) => {
      el.addEventListener('click', () => openBot(el.dataset.botId));
      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        showCtxMenu(ev, el.dataset.botId);
      });
    });
  }

  function renderChatHead() {
    const c = channelById(S.activeChannelId);
    $('#channelName').textContent = c ? (c.mode === 'auto' ? '# ' + c.name : '💬 ' + c.name) : '—';
    $('#channelTopic').textContent = c ? c.topic || '' : '';
    $('#modeBtn').textContent = c ? (c.mode === 'auto' ? 'Auto 라우팅' : '@멘션 호출') : '—';
    const names = c ? (c.members || []).map((id) => botById(id)?.name).filter(Boolean).join(', ') : '';
    $('#channelMembers').textContent = names || '—';
    const pend = S.approvals.filter((a) => a.status === 'pending').length;
    $('#approvalSummary').textContent = pend ? `${pend}건 대기` : '없음';
  }

  function renderMessages() {
    const box = $('#messages');
    const c = channelById(S.activeChannelId);
    if (!c) {
      box.innerHTML = '<div class="diff-empty">채널을 선택하세요.</div>';
      return;
    }
    if (!S.messages.length && !S.typing) {
      box.innerHTML = `<div class="diff-empty">아직 메시지가 없습니다. ${c.mode === 'auto' ? 'Auto 모드 — 키워드에 따라 알맞은 봇이 답합니다.' : '@봇이름 으로 봇을 부르세요.'}</div>`;
      return;
    }

    const html = S.messages
      .map((m) => {
        const isUser = m.author.type === 'user';
        const isBot = m.author.type === 'bot';
        const isSystem = m.author.type === 'system';
        const cls = isUser ? 'user' : isSystem ? 'system' : m.kind === 'result' ? 'result' : 'bot';
        const bot = isBot ? botById(m.author.botId) : null;
        const avatar = isUser ? '🧑' : isSystem ? '🛡️' : bot ? bot.emoji : '🤖';
        const working = isBot && isBotWorking(m.author.botId);

        let engineBadge = '';
        if (isBot && m.meta && m.meta.engine) {
          const k = String(m.meta.engine).startsWith('cli') ? 'cli' : String(m.meta.engine).startsWith('api') ? 'api' : '';
          const lbl = String(m.meta.engine).includes('simulator')
            ? '시뮬레이터'
            : String(m.meta.engine) === 'orchestrator'
            ? '총괄 모드'
            : m.meta.engine;
          engineBadge = `<span class="badge-engine ${k}">${esc(lbl)}</span>`;
        }
        const stateBadge = isBot ? `<span class="bot-state ${working ? 'working' : 'idle'}">${working ? '⚡ 작업 중' : '✨ 대기 중'}</span>` : '';

        let approvalHtml = '';
        if (m.kind === 'approval' && m.approvalId) {
          const ap = approvalById(m.approvalId);
          const st = ap ? ap.status : m.approval?.status || 'pending';
          const stLabel = { pending: '승인 대기', allowed: '승인됨', denied: '거절됨', failed: '실행 실패' }[st] || st;
          const body =
            ap && ap.kind === 'write'
              ? `<div class="approval-cmd">파일 저장 · ${esc(ap.action.path)} (${ap.action.bytes} bytes)</div>`
              : `<div class="approval-cmd">$ ${esc(ap ? ap.action.command : m.approval?.command || '')}</div>`;
          const workCwd = ap ? `<div class="field-hint" style="margin-top:6px">cwd · ${esc(ap.cwd || '')}</div>` : '';
          approvalHtml = `<div class="approval ${st !== 'pending' ? 'done' : ''}" data-testid="approval-card" data-approval-id="${m.approvalId}">
            <div class="approval-head">🔐 승인 요청 · ${ap && ap.kind === 'write' ? '파일 쓰기' : '셸 명령'} <span class="status-pill status-${st}" data-testid="approval-status">${stLabel}</span></div>
            <div class="approval-body">${esc(m.text || '')}${body}${workCwd}</div>
            <div class="approval-actions">
              <button class="allow-btn" data-testid="allow-btn" data-decision="allow" data-approval="${m.approvalId}">허용</button>
              <button class="deny-btn" data-testid="deny-btn" data-decision="deny" data-approval="${m.approvalId}">거절</button>
            </div>
          </div>`;
        }

        let proposalHtml = '';
        if (m.kind === 'proposal' && m.proposalId) {
          const pr = (S.proposals || []).find((x) => x.id === m.proposalId);
          const st = pr ? pr.status : m.proposal?.status || 'pending';
          const stLabel = { pending: '제안 대기', accepted: '팀에 붙임', passed: '넘김' }[st] || st;
          const title = pr ? pr.title : m.proposal?.title || m.text;
          const bodyTxt = pr ? pr.body : m.proposal?.body || '';
          proposalHtml = `<div class="proposal ${st !== 'pending' ? 'done' : ''}" data-testid="proposal-card" data-proposal-id="${m.proposalId}">
            <div class="proposal-head">💡 다음에 붙이면 좋을 것 <span class="status-pill status-${st === 'accepted' ? 'allowed' : st === 'passed' ? 'denied' : 'pending'}" data-testid="proposal-status">${stLabel}</span></div>
            <div class="proposal-body"><span class="p-title">${esc(title)}</span>${esc(bodyTxt)}</div>
            <div class="proposal-actions">
              <button class="allow-btn" data-testid="proposal-accept" data-proposal="${m.proposalId}" data-decision="accept">OK · 자동 붙이기</button>
              <button class="deny-btn" data-testid="proposal-pass" data-proposal="${m.proposalId}" data-decision="pass">패스</button>
            </div>
          </div>`;
        }

        let orchHtml = '';
        if (m.meta && Array.isArray(m.meta.orchestration) && m.meta.orchestration.length) {
          const chips = m.meta.orchestration
            .map(
              (o) => `<span class="orch-chip ${o.status === 'done' ? 'done' : 'idle'}" data-bot-open="${o.id}" data-testid="orch-chip"><span class="oc-dot"></span>${esc(o.emoji || '🤖')} ${esc(o.name)}</span>`
            )
            .join('');
          const steps = m.meta.orchestration
            .map((o, i) => `<div class="orch-step"><span>${i + 1}.</span><span><b>${esc(o.name)}</b> — ${esc(o.task || '')}${o.summary ? ' → ' + esc(o.summary) : ''}</span></div>`)
            .join('');
          orchHtml = `<div class="orch" data-testid="orchestration"><div class="orch-head">🧠 위임 로그 · ${m.meta.orchestration.length}건</div><div class="orch-chips">${chips}</div><div class="orch-steps">${steps}</div></div>`;
        }

        return `<div class="msg ${cls}" data-testid="message" data-kind="${m.kind}">
          <div class="avatar ${isBot ? (working ? 'working' : 'idle') : ''}">${avatar}</div>
          <div class="bubble-wrap">
            <div class="who"><b>${esc(m.author.name || '')}</b>${stateBadge}${engineBadge}<span>${new Date(m.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span></div>
            <div class="bubble">${md(m.text || '')}${approvalHtml}${proposalHtml}${orchHtml}</div>
          </div>
        </div>`;
      })
      .join('');

    const typing = S.typing
      ? `<div class="msg bot" data-testid="typing-bubble"><div class="avatar working">💭</div><div class="bubble-wrap"><div class="who"><b>${esc(S.typing.botName || '봇')}</b><span class="bot-state working">⚡ 작업 중</span></div><div class="bubble">작업 중…${S.typing.delegating ? ' 하위 에이전트에 위임하는 중' : ' 입력 중'}</div></div></div>`
      : '';

    box.innerHTML = html + typing;
    box.scrollTop = box.scrollHeight;
  }

  function renderBotContext() {
    const b = botById(S.activeBotId);
    const sel = $('#botSelect');
    sel.innerHTML = S.bots.map((x) => `<option value="${x.id}"${x.id === S.activeBotId ? ' selected' : ''}>${esc(x.emoji)} ${esc(x.name)}</option>`).join('');
    if (!b) return;
    $('#bpEmoji').textContent = b.emoji;
    $('#bpName').textContent = b.name;
    $('#bpRole').textContent = `${b.role} · ${b.model}`;
    $('#editName').value = b.name;
    $('#editModel').value = b.model;
    $('#editPersona').value = b.persona || '';
    $('#editCwd').value = b.cwd || '';
    $('#editKeywords').value = (b.keywords || []).join(', ');
    $('#pinBtn').textContent = b.pinned ? '📌 고정됨' : '📌 고정';
    renderInspector(b);
    if (S.inspectorFor !== b.id) loadInspector(b.id);
    if (S.tab === 'context') {
      $$('#botList .row-item').forEach((el) => el.classList.toggle('is-active', el.dataset.botId === b.id));
    }
  }

  /* ── 봇 역할 인스펙터 ── */
  const ROLE_TASKS = {
    pm: ['이번 주 우선순위 3개로 정리해줘', 'PRD 초안 만들어줘', '회의록 액션 아이템 정리해줘'],
    dev: ['이 버그 재현 절차 정리해줘', '작은 리팩터 계획 세워줘', '테스트 체크리스트 만들어줘'],
    content: ['이번 주 릴스 3편 기획해줘', '캡션 3안 써줘', '해시태그 세트 추천해줘'],
    research: ['경쟁사 3곳 가격 비교해줘', '이 시장 규모 근거 찾아줘', '주간 지표 요약해줘'],
    chief: ['이번 주 목표로 팀에 일 분배해줘', '진행 상황 취합해서 보고해줘', '다음 주 계획 세워줘'],
    general: ['오늘 할 일 정리해줘', '이 문서 요약해줘', '다음 단계 제안해줘'],
  };

  // 기본 캐릭터별 대표 업무 — 역할 공통 문구보다 캐릭터 성격을 먼저 보여줍니다.
  const CHARACTER_TASKS = {
    'MOA Chief': ['이번 주 목표로 다섯 명에게 일 분배해줘', '산출물 취합해서 보고해줘', '내가 결정할 것만 골라줘'],
    Prototyper: ['새 아이디어 10개 발산해줘', '이 기능의 가능성 시나리오 그려줘', '새로운 컨셉 3안 제안해줘'],
    Builder: ['이 화면 실제로 만들어줘', '구현 순서와 실행 명령 정리해줘', '프로토타입을 제품 형태로 붙여줘'],
    Sweeper: ['중복 코드·화면 정리해줘', '이 흐름에서 군더더기 빼줘', '릴리즈 전 정리 체크리스트 만들어줘'],
    Grower: ['첫 100명 유입 실험 설계해줘', '사람들이 찾게 만드는 채널 정리해줘', '지표 보고 다음 실험 골라줘'],
    Maintainer: ['장애 나기 쉬운 지점 점검해줘', '모니터링·백업 계획 세워줘', '느린 부분과 보안 위험 정리해줘'],
  };

  function renderInspector(b) {
    if (!b) return;
    const d = S.inspector[b.id] || {};
    const working = isBotWorking(b.id);
    const av = $('#inspAvatar');
    av.textContent = b.emoji;
    av.className = 'insp-avatar ' + (working ? 'working' : 'idle');
    $('#inspName').textContent = b.name;
    const st = $('#inspState');
    st.className = 'insp-state ' + (working ? 'working' : 'idle');
    st.textContent = working ? '⚡ 작업 중' : '✨ 대기 중';
    const first = String(b.persona || '').split(/(?<=[.!?])\s/)[0] || '역할 요약이 없습니다.';
    $('#inspSummary').textContent = d.summary || first.slice(0, 140);
    const tasks = CHARACTER_TASKS[b.name] || ROLE_TASKS[b.role] || ROLE_TASKS.general;
    $('#taskList').innerHTML = tasks
      .map((t) => `<button class="task-btn" data-task="${esc(t)}">${esc(t)}</button>`)
      .join('');
    const acts = d.activity || [];
    $('#activityList').innerHTML = acts.length
      ? acts.slice(0, 4).map((a) => `<div class="act-item"><span class="a-ch">${esc(a.channel)}</span>${esc((a.text || '').replace(/\n/g, ' ').slice(0, 70))}</div>`).join('')
      : '<div class="act-empty">아직 처리 내역이 없습니다.</div>';
    $('#inspEngine').textContent = d.engineLabel ? `${d.engineLabel}` : (S.engines?.mode || '—');
    const cwd = $('#inspCwd');
    cwd.textContent = b.cwd || '—';
    cwd.title = b.cwd || '';
  }

  async function loadInspector(id) {
    try {
      const d = await api(`/bots/${id}/activity`);
      S.inspector[id] = d;
      S.inspectorFor = id;
      renderInspector(botById(id));
    } catch (e) { /* 무시 */ }
  }

  function runTask(prompt) {
    if (S.env.readOnly) return toast('PROD는 읽기 전용입니다. STG로 전환하세요.', 'bad');
    if (S.typing) return toast('봇이 아직 작업 중입니다 — 잠시 후 다시 눌러 주세요.', '');
    const input = $('#composer');
    input.value = prompt;
    input.focus();
    send();
  }

  /* ── 음성 입력 (Web Speech API) ── */
  let recognizer = null;
  let listening = false;
  function startVoice(inputSel, btnSel) {
    const el = $(inputSel);
    const btn = $(btnSel);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast('이 브라우저는 음성 입력을 지원하지 않습니다 — Chrome·Edge·Safari 최신 버전에서 쓰거나 직접 입력해 주세요.', 'bad');
      const h = $('#voiceHint');
      if (h) h.textContent = '이 브라우저는 음성 입력 미지원 — 직접 입력해 주세요';
      return;
    }
    if (listening && recognizer) { try { recognizer.stop(); } catch (e) {} return; }
    let rec;
    try { rec = new SR(); } catch (e) { toast('음성 입력을 시작할 수 없습니다.', 'bad'); return; }
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    recognizer = rec;
    listening = true;
    btn.classList.add('listening');
    let base = el.value ? el.value.replace(/\s+$/, '') + ' ' : '';
    rec.onresult = (ev) => {
      let finalTxt = '';
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalTxt += r[0].transcript;
        else interim += r[0].transcript;
      }
      el.value = base + (finalTxt || interim);
      if (finalTxt) base = el.value.replace(/\s+$/, '') + ' ';
    };
    rec.onerror = (e) => {
      listening = false;
      btn.classList.remove('listening');
      toast('음성 입력 실패(' + (e.error || 'unknown') + ') — 직접 입력해 주세요.', 'bad');
    };
    rec.onend = () => {
      listening = false;
      btn.classList.remove('listening');
    };
    try {
      rec.start();
      toast('듣고 있습니다 — 한국어로 말씀하세요.', '');
    } catch (e) {
      listening = false;
      btn.classList.remove('listening');
    }
  }

  /* ── 자유 목적 → 오케스트레이터 설계 ── */
  async function analyzePurposeFlow() {
    const text = $('#purposeInput').value.trim();
    if (!text) return toast('하고 싶은 일을 먼저 적어 주세요.', 'bad');
    W.purpose = text;
    W.mode = 'plan';
    try {
      const d = await api('/consult/analyze', { method: 'POST', body: { text } });
      W.plan = d.plan;
      renderPlanCard(d.plan);
      $('#applyConsult').textContent = '이 팀을 STG에 만들기';
      wizardStep(3);
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  function renderPlanCard(plan) {
    const agents = plan.agents || [];
    $('#consultCard').innerHTML = `
      <div class="cc-head"><span class="cc-emoji">${esc(plan.chief.emoji || '🧠')}</span>
        <div><div class="cc-title">${esc(plan.chief.name)} + 에이전트 ${agents.length}명</div>
        <div class="cc-sub">총괄 오케스트레이터 팀 · 로컬 규칙 기반 설계</div></div></div>
      <div class="cc-why">${esc(plan.why || '')}</div>
      <div class="plan-kpi"><span>목적: ${esc((plan.goal || '').slice(0, 42))}${(plan.goal || '').length > 42 ? '…' : ''}</span><span>${esc(plan.domain)}</span></div>
      <h4>위임 구조</h4>
      <ul>${(plan.steps || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h4>팀 구성</h4>
      <div class="team-preview">
        <span class="tp-chip">🧠 ${esc(plan.chief.name)}</span>
        ${agents.map((a) => `<span class="tp-chip">${esc(a.emoji)} ${esc(a.name)}</span>`).join('')}
        <span class="tp-chip ch">#${esc(plan.channel.name)}</span>
      </div>
      <h4>에이전트 역할</h4>
      <ul>${agents.map((a) => `<li><b>${esc(a.name)}</b> — ${esc((a.persona || '').slice(0, 70))}…</li>`).join('')}</ul>`;
  }

  async function decideProposal(id, decision) {
    if (S.env.readOnly) return toast('PROD는 읽기 전용입니다.', 'bad');
    try {
      const d = await api('/proposal', { method: 'POST', body: { id, decision } });
      const pr = await api('/proposals');
      S.proposals = pr.proposals;
      const ms = await api(`/messages?channelId=${encodeURIComponent(S.activeChannelId)}`);
      S.messages = ms.messages;
      renderMessages();
      renderSidebar();
      toast(decision === 'accept' ? '팀에 바로 붙였습니다.' : '제안을 넘겼습니다.', decision === 'accept' ? 'good' : '');
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  /* ── 선택 ── */
  async function selectChannel(id) {
    S.activeChannelId = id;
    closeDrawers();
    renderSidebar();
    renderChatHead();
    try {
      const d = await api(`/messages?channelId=${encodeURIComponent(id)}`);
      S.messages = d.messages;
      S.typing = d.typing;
      S.engines = d.engines || S.engines;
      renderMessages();
      renderOffice();
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  function openBot(id) {
    S.activeBotId = id;
    setTab('context');
    renderBotContext();
    renderSidebar();
    openRight();
  }
  async function ensureDM(bot) {
    const ex = S.channels.find((c) => c.mode === 'mention' && c.botId === bot.id && (c.members || []).length <= 1);
    if (ex) return selectChannel(ex.id);
    try {
      const d = await api('/channels', {
        method: 'POST',
        body: { name: bot.name, mode: 'mention', botId: bot.id, members: [bot.id], topic: `${bot.name} 1:1 대화` },
      });
      S.channels.push(d.channel);
      toast(`${bot.name} 1:1 채널을 만들었습니다.`, 'good');
      await selectChannel(d.channel.id);
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  /* ── 메시지 ── */
  async function send() {
    const input = $('#composer');
    const text = input.value.trim();
    if (!text) return;
    if (S.env.readOnly) return toast('PROD는 읽기 전용입니다. STG에서 보내세요.', 'bad');
    if (S.typing) return toast('봇이 아직 작업 중입니다 — 응답이 오면 이어서 보내 주세요.', '');
    input.value = '';
    input.style.height = 'auto';
    try {
      const d = await api('/messages', { method: 'POST', body: { channelId: S.activeChannelId, text } });
      S.messages.push(d.userMessage);
      const routedBot = d.routedTo ? botById(d.routedTo.id) : null;
      S.typing = d.typing ? { botId: d.routedTo?.id, botName: d.routedTo?.name || '봇', delegating: !!(routedBot && routedBot.isChief) } : null;
      renderMessages();
      renderOffice();
      if (d.routedTo) toast(`${d.routedTo.name}에게 라우팅됨`, '');
      startPolling();
    } catch (e) {
      toast(e.message, 'bad');
      input.value = text;
    }
  }

  function startPolling() {
    stopPolling();
    let ticks = 0;
    S.pollTimer = setInterval(async () => {
      ticks++;
      try {
        const d = await api(`/messages?channelId=${encodeURIComponent(S.activeChannelId)}`);
        const changed = JSON.stringify(d.messages.map((m) => m.id)) !== JSON.stringify(S.messages.map((m) => m.id));
        S.typing = d.typing;
        if (changed) {
          S.messages = d.messages;
          const ap = await api('/approvals');
          S.approvals = ap.approvals;
          renderMessages();
          renderChatHead();
        } else if (S.typing) {
          renderMessages();
        }
        renderOffice();
        if (!d.typing && !changed) { /* keep polling idle */ }
      } catch (e) { /* 무시 */ }
      if (ticks > 60) stopPolling();
    }, 1200);
  }
  function stopPolling() {
    if (S.pollTimer) clearInterval(S.pollTimer);
    S.pollTimer = null;
  }

  async function decide(approvalId, decision) {
    if (S.env.readOnly) return toast('PROD는 읽기 전용입니다.', 'bad');
    try {
      await api('/approve', { method: 'POST', body: { id: approvalId, decision } });
      const ap = await api('/approvals');
      S.approvals = ap.approvals;
      const d = await api(`/messages?channelId=${encodeURIComponent(S.activeChannelId)}`);
      S.messages = d.messages;
      renderMessages();
      renderChatHead();
      toast(decision === 'allow' ? '승인되어 실행했습니다.' : '거절했습니다.', decision === 'allow' ? 'good' : '');
    } catch (e) {
      toast(e.message, 'bad');
      const ap = await api('/approvals').catch(() => ({ approvals: [] }));
      S.approvals = ap.approvals;
      renderMessages();
    }
  }

  /* ── 탭/드로어 ── */
  function setTab(tab) {
    S.tab = tab;
    $$('.rtab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
    $('#contextPane').hidden = tab !== 'context';
    $('#releasePane').hidden = tab !== 'release';
    if (tab === 'release') loadRelease();
  }
  function openDrawer() { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); }
  function openRight() { if (window.innerWidth <= 980) { $('#rightPanel').classList.add('open'); $('#scrim').classList.add('show'); } }
  function closeDrawers() { $('#sidebar').classList.remove('open'); $('#rightPanel').classList.remove('open'); $('#scrim').classList.remove('show'); }

  /* ── 릴리즈 ── */
  async function loadRelease() {
    try {
      const [p, c] = await Promise.all([api('/promote'), api('/changelog')]);
      S.releases = c.releases || [];
      S.changelog = c.entries || [];
      $('#relBadge').textContent = `STG v${p.stg.version}`;
      $('#relStg').textContent = `v${p.stg.version}`;
      $('#relProd').textContent = `v${p.prod.version}`;
      renderDiff($('#relDiff'), p.diff);
      renderHistory();
    } catch (e) { /* 무시 */ }
  }

  function diffList(diff) {
    const g = [];
    if (diff.bots.added.length) g.push(`<div class="diff-group"><h4>봇 추가 (${diff.bots.added.length})</h4>${diff.bots.added.map((x) => `<div class="add">+ ${esc(x)}</div>`).join('')}</div>`);
    if (diff.bots.changed.length) g.push(`<div class="diff-group"><h4>봇 설정 변경 (${diff.bots.changed.length})</h4>${diff.bots.changed.map((x) => `<div class="chg">~ ${esc(x)}</div>`).join('')}</div>`);
    if (diff.bots.removed.length) g.push(`<div class="diff-group"><h4>봇 제거 (${diff.bots.removed.length})</h4>${diff.bots.removed.map((x) => `<div class="del">− ${esc(x)}</div>`).join('')}</div>`);
    if (diff.channels.added.length) g.push(`<div class="diff-group"><h4>채널 추가</h4>${diff.channels.added.map((x) => `<div class="add">+ ${esc(x)}</div>`).join('')}</div>`);
    if (diff.channels.changed.length) g.push(`<div class="diff-group"><h4>채널 변경</h4>${diff.channels.changed.map((x) => `<div class="chg">~ ${esc(x)}</div>`).join('')}</div>`);
    if (diff.channels.removed.length) g.push(`<div class="diff-group"><h4>채널 제거</h4>${diff.channels.removed.map((x) => `<div class="del">− ${esc(x)}</div>`).join('')}</div>`);
    if (diff.settings.length) g.push(`<div class="diff-group"><h4>설정</h4>${diff.settings.map((x) => `<div class="chg">~ ${esc(x)}</div>`).join('')}</div>`);
    if (!g.length) g.push('<div class="diff-empty">승격할 변경 사항이 없습니다.</div>');
    return g.join('');
  }

  function renderDiff(el, diff) {
    if (!el) return;
    el.innerHTML = diffList(diff);
  }

  function renderHistory() {
    const box = $('#historyList');
    box.innerHTML = (S.releases || [])
      .slice(0, 8)
      .map((r) => {
        const at = r.at ? new Date(r.at).toLocaleDateString('ko-KR') : '';
        return `<div class="hist-item"><div class="h-top">v${esc(r.version)} <span>${esc(r.env || '')} · ${esc(at)}</span></div>
          <ul>${(r.changes || []).slice(0, 4).map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
      })
      .join('') || '<div class="diff-empty">기록 없음</div>';
  }

  /* ── 마켓 ── */
  async function loadMarket() {
    try {
      const d = await api('/market');
      S.market = d.packs;
      $('#packList').innerHTML = d.packs
        .map(
          (p) => `<div class="pack ${p.tier === 'pro' ? 'pro' : ''}" data-testid="pack-card" data-pack-id="${p.id}">
        <div class="pack-top"><span class="pack-emoji">${esc(p.emoji)}</span><span class="pack-title">${esc(p.title)}</span>
          <span class="pack-tier ${p.tier}">${p.tier === 'pro' ? 'PRO' : 'FREE'}</span></div>
        <div class="pack-tag">${esc(p.tagline)}</div>
        <ul class="pack-feats">${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <div class="pack-foot"><span class="pack-price">${esc(p.priceLabel)}</span>
          <div class="pack-actions">
            <button data-act="preview" data-pack="${p.id}" data-testid="pack-preview">미리보기</button>
            ${
              p.tier === 'free'
                ? `<button class="buy" data-act="install" data-pack="${p.id}" data-testid="pack-install">설치</button>`
                : `<button class="buy" data-act="buy" data-pack="${p.id}" data-testid="pack-buy">구매</button>`
            }
          </div></div>
      </div>`
        )
        .join('');
      const store = d.market.storeUrl || '미설정';
      $('#marketStore').textContent = '판매 링크 · ' + store;
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  async function packAction(act, id) {
    const pack = S.market.find((p) => p.id === id);
    if (!pack) return;
    if (act === 'preview') {
      try {
        const d = await api(`/market/${id}/preview`);
        $('#previewTitle').textContent = `${pack.emoji} ${pack.title}`;
        $('#previewBody').innerHTML = md(d.markdown.replace(/^---[\s\S]*?---/, '').trim());
        S.marketTarget = pack;
        const btn = $('#previewAction');
        btn.textContent = pack.tier === 'free' ? '이 팩 설치' : `구매 링크 열기 (${pack.priceLabel})`;
        $('#previewModal').hidden = false;
      } catch (e) { toast(e.message, 'bad'); }
      return;
    }
    if (act === 'buy') {
      const url = pack.purchaseUrl || S.settings.market?.storeUrl;
      if (!url) return toast('설정에서 판매 링크를 먼저 넣어 주세요.', 'bad');
      window.open(url, '_blank', 'noopener');
      toast('판매 링크를 새 탭으로 열었습니다.');
      return;
    }
    if (act === 'install') {
      try {
        const d = await api(`/market/${id}/install`, { method: 'POST', body: {} });
        toast(`${d.pack} 설치 완료 — 봇 ${d.created.bots.length}개, 채널 ${d.created.channels.length}개`, 'good');
        $('#teamsModal').hidden = true;
        await loadState(d.created.channels[0] ? d.created.channels[0].id : S.activeChannelId);
      } catch (e) {
        if (e.status === 402) {
          toast('Pro 팩입니다. 구매 후 라이선스 키를 입력하세요.', 'bad');
          S.marketTarget = pack;
          openLicense(pack);
        } else toast(e.message, 'bad');
      }
    }
  }

  function openLicense(pack) {
    const box = document.createElement('div');
    box.className = 'license-row';
    box.style.marginTop = '8px';
    box.innerHTML = `<input placeholder="라이선스 키 (구매 후 발급)" data-testid="license-input" />
      <button class="primary-btn" data-testid="license-install">설치</button>`;
    const modal = $('#previewModal');
    modal.hidden = false;
    $('#previewTitle').textContent = `${pack.emoji} ${pack.title} — 라이선스 인증`;
    $('#previewBody').innerHTML = '';
    $('#previewAction').textContent = '구매 링크 열기';
    $('#previewBody').appendChild(box);
    box.querySelector('button').onclick = async () => {
      const license = box.querySelector('input').value.trim();
      if (license.length < 6) return toast('라이선스 키를 확인하세요.', 'bad');
      try {
        const d = await api(`/market/${pack.id}/install`, { method: 'POST', body: { license } });
        toast(`${d.pack} 설치 완료`, 'good');
        $('#previewModal').hidden = true;
        await loadState(d.created.channels[0] ? d.created.channels[0].id : S.activeChannelId);
      } catch (e) { toast(e.message, 'bad'); }
    };
  }

  /* ── 설정 ── */
  function openSettings() {
    const s = S.settings;
    const e = S.engines || {};
    $('#engineList').innerHTML = `
      <div class="engine-row"><b>Claude CLI</b><span>${e.claude?.installed ? '설치됨 · ' + esc(e.claude.version || '') : '없음'}</span></div>
      <div class="engine-row"><b>Codex CLI</b><span>${e.codex?.installed ? '설치됨 · ' + esc(e.codex.version || '') : '없음'}</span></div>
      <div class="engine-row"><b>Anthropic API</b><span>${s.apiKeys?.anthropic?.configured ? '키 설정됨' : '미설정'}</span></div>
      <div class="engine-row"><b>OpenAI API</b><span>${s.apiKeys?.openai?.configured ? '키 설정됨' : '미설정'}</span></div>
      <div class="engine-row"><b>현재 모드</b><span>${esc({ 'cli-claude': 'Claude CLI', 'cli-codex': 'Codex CLI', 'api-anthropic': 'Anthropic API', 'api-openai': 'OpenAI API', simulator: '로컬 시뮬레이터' }[e.mode] || e.mode)}</span></div>`;
    $('#anthState').textContent = s.apiKeys?.anthropic?.configured ? '설정됨 (원문 숨김)' : '미설정';
    $('#anthState').className = 'key-state' + (s.apiKeys?.anthropic?.configured ? ' on' : '');
    $('#openaiState').textContent = s.apiKeys?.openai?.configured ? '설정됨 (원문 숨김)' : '미설정';
    $('#openaiState').className = 'key-state' + (s.apiKeys?.openai?.configured ? ' on' : '');
    $('#anthropicKey').value = '';
    $('#openaiKey').value = '';
    $('#enginePref').value = s.enginePreferred || 'auto';
    $('#allowedRoot').value = s.allowedRoot || '';
    $('#pickleUrl').value = s.pickle?.url || '';
    $('#pickleTitle').value = s.pickle?.title || '';
    $('#pickleBodyInput').value = s.pickle?.body || '';
    $('#pickleEnabled').checked = !!s.pickle?.enabled;
    $('#marketUrl').value = s.market?.storeUrl || '';
    $('#demoUnlock').checked = !!s.market?.demoUnlock;
    $('#allowLan').checked = !!s.remote?.allowLan;
    const adminCb = $('#adminToggle');
    if (adminCb) adminCb.checked = !!S.admin;
    $('#settingsModal').hidden = false;
    loadRemote();
  }

  async function saveSettings() {
    const body = {
      enginePreferred: $('#enginePref').value,
      allowedRoot: $('#allowedRoot').value.trim(),
      pickle: {
        url: $('#pickleUrl').value.trim(),
        title: $('#pickleTitle').value.trim(),
        body: $('#pickleBodyInput').value.trim(),
        enabled: $('#pickleEnabled').checked,
      },
      market: { storeUrl: $('#marketUrl').value.trim(), demoUnlock: $('#demoUnlock').checked },
    };
    const ak = $('#anthropicKey').value.trim();
    const ok = $('#openaiKey').value.trim();
    if (ak) body.apiKeys = Object.assign({}, body.apiKeys, { anthropic: ak });
    if (ok) body.apiKeys = Object.assign({}, body.apiKeys, { openai: ok });
    try {
      const d = await api('/settings', { method: 'PATCH', body });
      S.settings = d.settings;
      S.engines = d.engines;
      const r = await api('/remote', { method: 'POST', body: { allowLan: $('#allowLan').checked } });
      if (r.restartRequired) toast('모바일 접속 설정은 서버 재시작 후 적용됩니다.', '');
      loadRemote();
      $('#settingsModal').hidden = true;
      renderPickle();
      renderEngineChip();
      toast('설정을 저장했습니다.', 'good');
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  /* ── 봇 편집 ── */
  async function saveBot() {
    const b = botById(S.activeBotId);
    if (!b) return;
    const body = {
      name: $('#editName').value.trim(),
      model: $('#editModel').value.trim(),
      persona: $('#editPersona').value,
      cwd: $('#editCwd').value.trim(),
      keywords: $('#editKeywords').value,
    };
    try {
      const d = await api(`/bots/${b.id}`, { method: 'PATCH', body });
      const i = S.bots.findIndex((x) => x.id === b.id);
      S.bots[i] = d.bot;
      renderSidebar();
      renderBotContext();
      renderChatHead();
      toast('봇 설정을 저장했습니다.', 'good');
    } catch (e) {
      toast(e.message, 'bad');
      const hint = $('#cwdHint');
      if (/cwd|경로|루트/.test(e.message)) { hint.textContent = e.message; hint.classList.add('bad'); }
    }
  }

  async function createBot() {
    try {
      const d = await api('/bots', {
        method: 'POST',
        body: { name: '새 봇', emoji: '🤖', role: 'general', persona: '내 업무를 돕는 새 봇입니다. 역할과 말투를 적어 주세요.', keywords: [] },
      });
      S.bots.push(d.bot);
      S.activeBotId = d.bot.id;
      renderSidebar();
      setTab('context');
      renderBotContext();
      toast('새 봇을 만들었습니다 — 오른쪽에서 설정하세요.', 'good');
      if (window.innerWidth <= 980) openRight();
    } catch (e) { toast(e.message, 'bad'); }
  }

  async function deleteBot(id) {
    const b = botById(id);
    if (!b) return;
    try {
      await api(`/bots/${id}`, { method: 'DELETE' });
      S.bots = S.bots.filter((x) => x.id !== id);
      if (S.activeBotId === id) S.activeBotId = S.bots[0]?.id || null;
      renderSidebar();
      renderBotContext();
      toast(`${b.name} 삭제됨`);
    } catch (e) { toast(e.message, 'bad'); }
  }

  function showCtxMenu(ev, botId) {
    const b = botById(botId);
    const menu = $('#ctxMenu');
    menu.innerHTML = `
      <button data-cmd="pin">${b.pinned ? '📌 고정 해제' : '📌 고정'}</button>
      <button data-cmd="edit">✏️ 프로필 편집</button>
      <button data-cmd="dm">💬 1:1 대화 열기</button>
      <button data-cmd="delete" class="danger">🗑️ 삭제</button>`;
    menu.style.left = Math.min(ev.clientX, window.innerWidth - 190) + 'px';
    menu.style.top = Math.min(ev.clientY, window.innerHeight - 170) + 'px';
    menu.hidden = false;
    menu.querySelectorAll('[data-cmd]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        menu.hidden = true;
        const cmd = btn.dataset.cmd;
        if (cmd === 'pin') {
          try {
            const d = await api(`/bots/${botId}`, { method: 'PATCH', body: { pinned: !b.pinned } });
            const i = S.bots.findIndex((x) => x.id === botId);
            S.bots[i] = d.bot;
            renderSidebar();
            renderBotContext();
          } catch (e) { toast(e.message, 'bad'); }
        } else if (cmd === 'edit') openBot(botId);
        else if (cmd === 'dm') ensureDM(b);
        else if (cmd === 'delete') deleteBot(botId);
      })
    );
  }

  /* ── 팀 임포트 ── */
  async function importTeam() {
    const mdText = $('#importInput').value.trim();
    if (!mdText) return toast('팀 정의를 붙여넣으세요.', 'bad');
    try {
      const d = await api('/import-team', { method: 'POST', body: { markdown: mdText } });
      toast(`${d.team} — 봇 ${d.created.bots.length}개 · 채널 ${d.created.channels.length}개 생성`, 'good');
      $('#teamsModal').hidden = true;
      await loadState(d.created.channels[0] ? d.created.channels[0].id : S.activeChannelId);
    } catch (e) { toast(e.message, 'bad'); }
  }

  /* ── 승격 ── */
  async function openPromote() {
    try {
      const p = await api('/promote');
      if (!p.ready) return toast('승격할 변경 사항이 없습니다.', 'bad');
      renderDiff($('#promoteDiff'), p.diff);
      $('#promoteAck').checked = false;
      $('#promoteConfirm').disabled = true;
      $('#promoteModal').hidden = false;
    } catch (e) { toast(e.message, 'bad'); }
  }

  async function confirmPromote() {
    if (!$('#promoteAck').checked) return;
    try {
      const d = await api('/promote', { method: 'POST', body: { confirm: true, note: $('#relNote').value.trim() } });
      $('#promoteModal').hidden = true;
      toast(`v${d.version} PROD 반영 완료`, 'good');
      await loadState(S.activeChannelId);
      await loadRelease();
    } catch (e) {
      toast(e.message, 'bad');
      if (e.status === 409) $('#promoteModal').hidden = true;
    }
  }

  async function switchEnv(env) {
    if (env === S.env.active) return;
    try {
      await api('/env', { method: 'POST', body: { active: env } });
      await loadState();
      toast(env === 'prod' ? 'PROD (운영) — 읽기 전용' : 'STG (스테이징) — 편집 가능', '');
    } catch (e) { toast(e.message, 'bad'); }
  }

  /* ── 가이드 / 원격 접속 ── */
  let remoteInfo = null;
  async function loadRemote() {
    try {
      remoteInfo = await api('/remote');
    } catch (e) {
      remoteInfo = null;
    }
    renderRemote();
  }

  function remoteHtml(target) {
    if (!remoteInfo) return '<span class="muted">상태를 불러오지 못했습니다.</span>';
    const r = remoteInfo;
    const on = r.lanEnabled || r.forceToken;
    const lines = [];
    lines.push(
      `<div>같은 Wi-Fi 접속 <b class="${r.lanEnabled ? 'remote-on' : 'remote-off'}">${r.lanEnabled ? '켜짐' : '꺼짐 (기본값)'}</b>` +
        ` · 토큰 <b class="${r.token ? 'remote-on' : 'remote-off'}">${r.token ? '발급됨' : '없음'}</b>` +
        ` · 바인딩 <code>${esc(r.bind)}:${r.port}</code></div>`
    );
    if (r.lanEnabled && r.lanUrls && r.lanUrls.length) {
      lines.push(`<div class="remote-row"><span class="remote-url">${esc(r.lanUrls[0])}</span><button class="copy-btn" data-copy="${esc(r.lanUrls[0])}">복사</button></div>`);
      if (r.lanUrls.length > 1) lines.push(`<div class="muted small">다른 주소: ${r.lanUrls.slice(1).map(esc).join(' · ')}</div>`);
    } else {
      lines.push('<div class="muted small">켜는 방법: 설정 → 모바일 원격 접속 체크 → 서버 재시작. 자세한 단계는 ③ 모바일 가이드.</div>');
    }
    if (r.token) lines.push(`<div class="remote-row"><span class="remote-url">토큰 ${esc(r.token)}</span><button class="copy-btn" data-copy="${esc(r.token)}">복사</button></div>`);
    lines.push(`<div class="muted small" style="margin-top:6px">Tailscale: <code>tailscale serve --bg ${r.port}</code> · Cloudflare: <code>MOA_REQUIRE_TOKEN=1 node server.js</code> + <code>cloudflared tunnel --url http://127.0.0.1:${r.port}</code></div>`);
    return lines.join('');
  }

  function renderRemote() {
    const a = $('#remoteLive');
    const b = $('#remoteBox');
    const html = remoteHtml();
    if (a) a.innerHTML = html;
    if (b) b.innerHTML = html;
    $$('[data-copy]').forEach((btn) => {
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          toast('복사했습니다.', 'good');
        } catch (e) {
          toast('복사할 수 없습니다 — 주소를 길게 눌러 복사하세요.', 'bad');
        }
      };
    });
  }

  function openGuide(tab = 'run') {
    $('#guideModal').hidden = false;
    $$('[data-guide-tab]').forEach((t) => t.classList.toggle('is-active', t.dataset.guideTab === tab));
    $('#guideRun').hidden = tab !== 'run';
    $('#guideDmg').hidden = tab !== 'dmg';
    $('#guideMobile').hidden = tab !== 'mobile';
    if (tab === 'mobile') loadRemote();
  }

  /* ── 팀 컨설팅 (Setup Wizard) ── */
  const W = { profiles: [], profile: null, pains: new Set(), step: 1, mode: 'profile', purpose: '', plan: null };

  async function loadConsult() {
    try {
      const d = await api('/consult');
      W.profiles = d.profiles || [];
    } catch (e) {
      W.profiles = [];
    }
  }

  function wizardStep(n) {
    W.step = n;
    $('#wizardStep1').hidden = n !== 1;
    $('#wizardStep2').hidden = n !== 2;
    $('#wizardStep3').hidden = n !== 3;
    $$('[data-step-dot]').forEach((d) => d.classList.toggle('is-active', Number(d.dataset.stepDot) <= n));
  }

  function renderRoles() {
    const box = $('#roleGrid');
    if (!W.profiles.length) {
      box.innerHTML = '<div class="diff-empty">프로필을 불러오지 못했습니다. 잠시 후 다시 시도하세요.</div>';
      return;
    }
    box.innerHTML = W.profiles
      .map(
        (p) => `<button class="role-card" data-role="${p.id}" data-testid="role-card">
        <span class="rc-emoji">${esc(p.emoji)}</span>
        <span class="rc-label">${esc(p.label)}</span>
        <span class="rc-tag">${esc(p.tagline)}</span>
        <span class="rc-meta">봇 ${p.bots.length} · 채널 ${p.channels.length}${p.applied ? ' · 이미 만듦' : ''}</span>
      </button>`
      )
      .join('');
    box.querySelectorAll('[data-role]').forEach((btn) =>
      btn.addEventListener('click', () => {
        W.profile = W.profiles.find((p) => p.id === btn.dataset.role);
        W.mode = 'profile';
        W.pains = new Set();
        renderPains();
        wizardStep(2);
      })
    );
  }

  function renderPains() {
    const box = $('#painList');
    box.innerHTML = (W.profile?.pains || [])
      .map(
        (x, i) => `<label class="pain-item" data-pain-index="${i}" data-testid="pain-item">
        <input type="checkbox" value="${esc(x)}" />
        <span>${esc(x)}</span></label>`
      )
      .join('');
    box.querySelectorAll('.pain-item').forEach((lab) => {
      const cb = lab.querySelector('input');
      cb.addEventListener('change', () => {
        if (cb.checked) W.pains.add(cb.value);
        else W.pains.delete(cb.value);
        lab.classList.toggle('sel', cb.checked);
      });
    });
  }

  function renderConsultCard() {
    const p = W.profile;
    if (!p) return;
    const pains = [...W.pains];
    const custom = $('#painCustom').value.trim();
    if (custom) pains.push(custom);
    $('#consultCard').innerHTML = `
      <div class="cc-head"><span class="cc-emoji">${esc(p.emoji)}</span>
        <div><div class="cc-title">${esc(p.teamName)}</div><div class="cc-sub">${esc(p.label)} · 봇 ${p.bots.length}개 · 채널 ${p.channels.length}개</div></div></div>
      <h4>왜 이 조합인가</h4>
      <div class="cc-why">${esc(p.why)}</div>
      ${pains.length ? `<h4>선택한 고민</h4><ul>${pains.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h4>이렇게 쓰세요</h4>
      <ul>${(p.usage || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h4>팀 구성</h4>
      <div class="team-preview">${p.bots.map((b) => `<span class="tp-chip">${esc(b.emoji)} ${esc(b.name)}</span>`).join('')}
        ${p.channels.map((c) => `<span class="tp-chip ch">#${esc(c.name)}</span>`).join('')}</div>
      <div class="starter-prompt">첫 프롬프트 · ${esc(p.starterPrompt)}</div>`;
  }

  async function applyConsultTeam() {
    if (S.env.readOnly) return toast('PROD는 읽기 전용입니다. STG로 전환하세요.', 'bad');
    if (W.mode === 'plan' && W.purpose) {
      try {
        const d = await api('/orchestrator/apply', { method: 'POST', body: { text: W.purpose } });
        toast(`${d.plan.chief.name} + 에이전트 ${d.created.agents.length}명 생성 완료`, 'good');
        $('#wizardModal').hidden = true;
        await loadState(d.created.mainChannelId);
        return;
      } catch (e) {
        toast(e.message, 'bad');
        return;
      }
    }
    if (!W.profile) return;
    const pains = [...W.pains];
    const custom = $('#painCustom').value.trim();
    if (custom) pains.push(custom);
    try {
      const d = await api('/consult/apply', { method: 'POST', body: { id: W.profile.id, pains } });
      toast(`${d.team} 생성 완료 — 봇 ${d.bots.length}개 · 채널 ${d.channels.length}개`, 'good');
      $('#wizardModal').hidden = true;
      await loadState(d.mainChannelId || S.activeChannelId);
      await loadConsult();
    } catch (e) {
      if (e.status === 409) {
        try {
          const d = await api('/consult/apply', { method: 'POST', body: { id: W.profile.id, pains, force: true } });
          toast(`${d.team} 팀을 하나 더 만들었습니다.`, 'good');
          $('#wizardModal').hidden = true;
          await loadState(d.mainChannelId || S.activeChannelId);
        } catch (e2) { toast(e2.message, 'bad'); }
      } else toast(e.message, 'bad');
    }
  }

  async function openWizard() {
    $('#wizardModal').hidden = false;
    W.mode = 'profile';
    W.plan = null;
    wizardStep(1);
    $('#painCustom').value = '';
    $('#applyConsult').textContent = '이 팀을 STG에 만들기';
    await loadConsult();
    renderRoles();
  }

  /* ── 이벤트 바인딩 ── */
  function bind() {
    $('#sendBtn').addEventListener('click', send);
    $('#composer').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        send();
      }
    });
    $('#composer').addEventListener('input', (ev) => {
      const el = ev.target;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    });

    $('#messages').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-decision]');
      if (btn && btn.dataset.approval) return decide(btn.dataset.approval, btn.dataset.decision);
      const pb = ev.target.closest('[data-proposal]');
      if (pb) return decideProposal(pb.dataset.proposal, pb.dataset.decision);
      const ob = ev.target.closest('[data-bot-open]');
      if (ob) return openBot(ob.dataset.botOpen);
    });
    $('#taskList').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-task]');
      if (b) runTask(b.dataset.task);
    });
    $('#micBtn').addEventListener('click', () => startVoice('#composer', '#micBtn'));
    $('#purposeMic').addEventListener('click', () => startVoice('#purposeInput', '#purposeMic'));
    $('#analyzeBtn').addEventListener('click', analyzePurposeFlow);

    $('#openSidebar').addEventListener('click', openDrawer);
    $('#closeSidebar').addEventListener('click', closeDrawers);
    $('#scrim').addEventListener('click', closeDrawers);
    $('#closeRight').addEventListener('click', closeDrawers);
    $('#rightToggle').addEventListener('click', () => {
      setTab('context');
      openRight();
    });

    $$('.rtab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
    $$('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        $$('.tab').forEach((x) => x.classList.toggle('is-active', x === t));
        $('#marketPane').hidden = t.dataset.teamTab !== 'market';
        $('#importPane').hidden = t.dataset.teamTab !== 'import';
      })
    );

    $$('[data-close]').forEach((b) => b.addEventListener('click', () => { b.closest('.modal').hidden = true; }));
    $$('.modal').forEach((m) => m.addEventListener('click', (ev) => { if (ev.target === m) m.hidden = true; }));

    $('#teamsBtn').addEventListener('click', async () => {
      $('#teamsModal').hidden = false;
      await loadMarket();
    });
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#newBotBtn').addEventListener('click', createBot);
    $('#saveBotBtn').addEventListener('click', saveBot);
    $('#deleteBotBtn').addEventListener('click', async () => {
      const b = botById(S.activeBotId);
      if (b && confirm(`${b.name}을(를) 삭제할까요?`)) deleteBot(S.activeBotId);
    });
    $('#pinBtn').addEventListener('click', async () => {
      const b = botById(S.activeBotId);
      if (!b) return;
      try {
        const d = await api(`/bots/${b.id}`, { method: 'PATCH', body: { pinned: !b.pinned } });
        S.bots[S.bots.findIndex((x) => x.id === b.id)] = d.bot;
        renderSidebar();
        renderBotContext();
      } catch (e) { toast(e.message, 'bad'); }
    });
    $('#botSelect').addEventListener('change', (ev) => { S.activeBotId = ev.target.value; renderBotContext(); renderSidebar(); });
    $('#messages').addEventListener('contextmenu', (ev) => ev.preventDefault());
    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('#ctxMenu')) $('#ctxMenu').hidden = true;
    });

    $('#modeBtn').addEventListener('click', async () => {
      const c = channelById(S.activeChannelId);
      if (!c) return;
      if (S.env.readOnly) return toast('PROD는 읽기 전용입니다.', 'bad');
      try {
        const d = await api(`/channels/${c.id}`, { method: 'PATCH', body: { mode: c.mode === 'auto' ? 'mention' : 'auto' } });
        S.channels[S.channels.findIndex((x) => x.id === c.id)] = d.channel;
        renderChatHead();
        renderSidebar();
        toast(c.mode === 'auto' ? '이제 @멘션 호출 모드입니다.' : '이제 Auto 라우팅 모드입니다.');
      } catch (e) { toast(e.message, 'bad'); }
    });

    $('#guideBtn').addEventListener('click', () => openGuide('run'));
    $('#wizardBtn').addEventListener('click', openWizard);
    $('#trustBar').addEventListener('click', () => openGuide('run'));
    $$('[data-wizard-close]').forEach((b) => b.addEventListener('click', () => { $('#wizardModal').hidden = true; }));
    $('#toStep3').addEventListener('click', () => { renderConsultCard(); wizardStep(3); });
    $('#backStep1').addEventListener('click', () => wizardStep(1));
    $('#backStep2').addEventListener('click', () => wizardStep(2));
    $('#applyConsult').addEventListener('click', applyConsultTeam);
    $('#onboardStart').addEventListener('click', () => {
      $('#onboardModal').hidden = true;
      try { localStorage.setItem('moa_onboarded', '1'); } catch (e) {}
      openWizard();
    });
    $('#onboardSkip').addEventListener('click', () => {
      $('#onboardModal').hidden = true;
      try { localStorage.setItem('moa_onboarded', '1'); } catch (e) {}
    });
    $$('[data-guide-close]').forEach((b) => b.addEventListener('click', () => { $('#guideModal').hidden = true; }));
    $$('[data-guide-tab]').forEach((t) =>
      t.addEventListener('click', () => {
        $$('[data-guide-tab]').forEach((x) => x.classList.toggle('is-active', x === t));
        $('#guideRun').hidden = t.dataset.guideTab !== 'run';
        $('#guideDmg').hidden = t.dataset.guideTab !== 'dmg';
        $('#guideMobile').hidden = t.dataset.guideTab !== 'mobile';
        if (t.dataset.guideTab === 'mobile') loadRemote();
      })
    );

    $('#saveSettings').addEventListener('click', saveSettings);
    const adminCb = $('#adminToggle');
    if (adminCb) adminCb.addEventListener('change', (ev) => setAdmin(ev.target.checked));
    const officeBtn = $('#officeToggle');
    if (officeBtn) {
      officeBtn.addEventListener('click', () => {
        const floor = $('#officeFloor');
        const willOpen = floor.hidden;
        floor.hidden = !willOpen;
        S.officeOpen = willOpen;
        officeBtn.textContent = willOpen ? '▾' : '▸';
        officeBtn.setAttribute('aria-expanded', String(willOpen));
        try { localStorage.setItem('moa_office', willOpen ? '1' : '0'); } catch (e) {}
      });
    }
    $('#loadTemplateBtn').addEventListener('click', async () => {
      try {
        const d = await api('/import-template');
        $('#importInput').value = d.markdown;
        $('#importHint').textContent = '스타터 팀 템플릿을 불러왔습니다. 그대로 가져오거나 수정하세요.';
      } catch (e) { toast(e.message, 'bad'); }
    });
    $('#importBtn').addEventListener('click', importTeam);

    $('#packList').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (b) packAction(b.dataset.act, b.dataset.pack);
    });
    $('#previewAction').addEventListener('click', async () => {
      const pack = S.marketTarget;
      if (!pack) return;
      if (pack.tier === 'free') {
        $('#previewModal').hidden = true;
        await packAction('install', pack.id);
      } else {
        const url = pack.purchaseUrl || S.settings.market?.storeUrl;
        if (!url) return toast('설정에서 판매 링크를 먼저 넣어 주세요.', 'bad');
        window.open(url, '_blank', 'noopener');
        toast('판매 링크를 새 탭으로 열었습니다.');
      }
    });

    $('#promoteBtn').addEventListener('click', openPromote);
    $('#promoteAck').addEventListener('change', (ev) => { $('#promoteConfirm').disabled = !ev.target.checked; });
    $('#promoteConfirm').addEventListener('click', confirmPromote);
    $('#envSwitch').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-env]');
      if (b) switchEnv(b.dataset.env);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) { $('#sidebar').classList.remove('open'); $('#rightPanel').classList.remove('open'); $('#scrim').classList.remove('show'); }
    });
  }

  /* ── 시작 ── */
  async function init() {
    S.admin = adminFromEnv();
    try { S.officeOpen = localStorage.getItem('moa_office') !== '0'; } catch (e) {}
    bind();
    applyAdminMode();
    const officeFloor = $('#officeFloor');
    const officeBtn = $('#officeToggle');
    if (officeFloor && !S.officeOpen) {
      officeFloor.hidden = true;
      if (officeBtn) { officeBtn.textContent = '▸'; officeBtn.setAttribute('aria-expanded', 'false'); }
    }
    try {
      await loadState();
      if (S.activeChannelId) {
        const d = await api(`/messages?channelId=${encodeURIComponent(S.activeChannelId)}`);
        S.messages = d.messages;
        S.typing = d.typing;
        renderMessages();
      }
    } catch (e) {
      toast('서버에 연결할 수 없습니다: ' + e.message, 'bad');
    }
    try {
      if (localStorage.getItem('moa_onboarded') !== '1') $('#onboardModal').hidden = false;
    } catch (e) {}
    setInterval(async () => {
      if (!S.activeChannelId) return;
      try {
        const d = await api(`/messages?channelId=${encodeURIComponent(S.activeChannelId)}`);
        const changed = JSON.stringify(d.messages.map((m) => m.id)) !== JSON.stringify(S.messages.map((m) => m.id));
        const typingChanged = !!d.typing !== !!S.typing;
        S.typing = d.typing;
        if (changed) {
          S.messages = d.messages;
          const [ap, pr] = await Promise.all([api('/approvals'), api('/proposals')]);
          S.approvals = ap.approvals;
          S.proposals = pr.proposals || [];
          renderMessages();
          renderChatHead();
        } else if (typingChanged) { renderMessages(); renderOffice(); }
        if (S.inspectorFor) renderInspector(botById(S.inspectorFor));
        renderSidebar();
        renderOffice();
      } catch (e) { /* 무시 */ }
    }, 2000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
