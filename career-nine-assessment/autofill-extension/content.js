// Career-9 Assessment Autofill (dev tool)
//
// Random-fills the assessment portal purely through the DOM, mirroring the
// in-app dev autofill (src/utils/devAutoFill.ts) but usable without the
// sessionStorage prefill path. A 350ms polling loop detects which screen is
// on display and performs at most one action per tick, then cools down long
// enough for React re-renders / the 400ms auto-advance to settle.
//
// The panel mounts on EVERY page and always shows `route — detected screen`.
// Autofill only ever acts from the demographics page onward:
//   demographics → general instructions → section select → section
//   instructions → questions (choice / ranking / text / dropdown) → stops on
//   the last question. It NEVER submits — that is left to the human.
(() => {
  'use strict';
  if (window.__c9AutofillLoaded) return;
  window.__c9AutofillLoaded = true;

  const TICK_MS = 350;
  const COOLDOWN_MS = 700; // > the app's 400ms auto-advance delay
  const RUN_KEY = 'c9AutofillRunning';

  let lastActionAt = 0;
  let questionKey = null; // location.pathname of the question being worked
  let targetK = null; // how many options to pick on the current question
  let checkedBeforeClick = null; // replacement/cap detection for single-choice
  let demoSubmitTries = 0;

  // ---------- utils ----------
  const rand = (n) => Math.floor(Math.random() * n);
  const randOf = (arr) => arr[rand(arr.length)];
  const randInt = (min, max) => min + rand(max - min + 1);
  const randToken = () => 'autofill-' + Math.random().toString(36).slice(2, 8);
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const txt = (el) => (el.textContent || '').trim();
  const isOtherOption = (s) => /^other\b/i.test((s || '').trim());

  const allButtons = () => [...document.querySelectorAll('button')].filter(visible);
  const buttonByText = (re) => allButtons().find((b) => re.test(txt(b)));

  // Set a value on a React-controlled input/select so onChange fires.
  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ---------- control panel ----------
  let panel = null;
  let routeEl = null;
  let statusEl = null;
  let toggleBtn = null;

  function mountPanel() {
    if (panel || !document.body) return;
    panel = document.createElement('div');
    panel.id = 'c9-autofill-panel';
    panel.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'z-index:2147483647',
      'background:#0f172a',
      'color:#e2e8f0',
      'font:12px/1.5 system-ui,sans-serif',
      'border-radius:10px',
      'padding:10px 12px',
      'box-shadow:0 4px 18px rgba(0,0,0,.35)',
      'width:230px',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = '⚡ C9 Autofill (dev)';
    title.style.cssText = 'font-weight:700;margin-bottom:2px';

    const hostEl = document.createElement('div');
    const DEV_HOSTS = ['localhost', '127.0.0.1', 'staging-assessment.career-9.com'];
    const isDevHost = DEV_HOSTS.includes(location.hostname) || /^192\.168\.|^10\./.test(location.hostname);
    hostEl.textContent = isDevHost
      ? location.hostname
      : `⚠ LIVE — ${location.hostname} (writes real data!)`;
    hostEl.style.cssText = isDevHost
      ? 'color:#64748b;margin-bottom:2px'
      : 'color:#f87171;font-weight:700;margin-bottom:2px';

    routeEl = document.createElement('div');
    routeEl.style.cssText = 'color:#7dd3fc;margin-bottom:4px;word-break:break-all';

    statusEl = document.createElement('div');
    statusEl.textContent = 'Idle';
    statusEl.style.cssText = 'color:#94a3b8;margin-bottom:8px;min-height:18px;word-break:break-word';

    toggleBtn = document.createElement('button');
    toggleBtn.style.cssText =
      'width:100%;border:none;border-radius:8px;padding:7px 0;font-weight:700;cursor:pointer;font-size:12px';
    toggleBtn.addEventListener('click', () => {
      setRunning(!running());
      setStatus(running() ? 'Running…' : 'Stopped');
    });

    panel.appendChild(title);
    panel.appendChild(hostEl);
    panel.appendChild(routeEl);
    panel.appendChild(statusEl);
    panel.appendChild(toggleBtn);
    document.body.appendChild(panel);
    updateToggle();
  }

  function updateToggle() {
    if (!toggleBtn) return;
    const on = running();
    toggleBtn.textContent = on ? '■ Stop' : '▶ Start';
    toggleBtn.style.background = on ? '#ef4444' : '#22c55e';
    toggleBtn.style.color = '#fff';
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function running() {
    try {
      return sessionStorage.getItem(RUN_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setRunning(on) {
    try {
      if (on) sessionStorage.setItem(RUN_KEY, '1');
      else sessionStorage.removeItem(RUN_KEY);
    } catch {
      /* storage blocked — panel still works for this page */
    }
    updateToggle();
  }

  function stop(msg) {
    setRunning(false);
    setStatus(msg);
  }

  function act(fn, msg) {
    fn();
    lastActionAt = Date.now();
    setStatus(msg);
  }

  // ---------- surface detection ----------
  const isDemographicsPage = () =>
    /^\/demographics\//.test(location.pathname) ||
    [...document.querySelectorAll('h2')].some((h) => visible(h) && txt(h) === 'Your Details');

  const isQuestionPage = () =>
    /^\/studentAssessment\/sections\/[^/]+\/questions\//.test(location.pathname) ||
    !!document.querySelector('[data-proctoring-option-id]') ||
    !!document.querySelector('input.form-control[placeholder="Type your answer..."]');

  function detectSurface() {
    if (buttonByText(/^OK(\s*\(\d+\))?$/)) return 'instructions popup';
    if (buttonByText(/^Yes, Submit$/)) return 'submit confirm';
    if (buttonByText(/^Continue$/)) return 'warning dialog';
    if (buttonByText(/I'?m Ready to Start/)) return 'general instructions';
    if (isDemographicsPage()) return 'demographics';
    if (location.pathname === '/studentAssessment' && document.querySelector('.section-card'))
      return 'section select';
    if (/^\/studentAssessment\/sections\/[^/]+$/.test(location.pathname) && buttonByText(/^Start Assessment$/))
      return 'section instructions';
    if (isQuestionPage()) return 'question page';
    return 'nothing to fill';
  }

  // ---------- question page ----------
  const nextButton = () => buttonByText(/^NEXT( SECTION)? →$/);
  const submitButton = () => buttonByText(/^✓ Submit$/);

  function isBelowMin() {
    const hint = [...document.querySelectorAll('small')].find(
      (s) => visible(s) && /Select \d+ more option/.test(txt(s)),
    );
    if (hint) return true;
    const next = nextButton();
    if (next) return next.disabled;
    const submit = submitButton();
    if (submit) return submit.disabled;
    return false;
  }

  function advance() {
    const next = nextButton();
    if (next) {
      if (next.disabled) {
        setStatus('Next disabled — waiting');
        return;
      }
      act(() => next.click(), txt(next) === 'NEXT SECTION →' ? 'Next section →' : 'Next question →');
      return;
    }
    // The "✓ Submit" button sits in the sidebar, which is hidden on narrow
    // windows — accept a non-visible match for done-detection.
    const submit = [...document.querySelectorAll('button')].find((b) => /^✓ Submit$/.test(txt(b)));
    if (submit) {
      stop('✅ Done — last question filled. Submit manually.');
      return;
    }
    setStatus('Waiting for auto-advance…');
  }

  function handleQuestion() {
    const key = location.pathname;
    if (key !== questionKey) {
      questionKey = key;
      targetK = null;
      checkedBeforeClick = null;
    }

    // Dropdown-type question: pick a random category first.
    const catSel = [...document.querySelectorAll('select.form-select')]
      .filter(visible)
      .find(
        (s) =>
          !s.closest('[data-proctoring-option-id]') &&
          s.options.length > 0 &&
          /select a categ/i.test(txt(s.options[0])),
      );
    if (catSel && !catSel.value) {
      const opts = [...catSel.options].filter((o) => o.value);
      if (opts.length) {
        const pick = randOf(opts);
        act(() => setNativeValue(catSel, pick.value), `Picked category "${pick.value}"`);
        return;
      }
    }

    // Ranking question: assign a random available rank, one per tick.
    const rankSelects = [...document.querySelectorAll('[data-proctoring-option-id] select')].filter(visible);
    if (rankSelects.length) {
      const unranked = rankSelects.filter((s) => !s.value);
      if (unranked.length) {
        const sel = randOf(unranked);
        const opts = [...sel.options].filter((o) => o.value);
        if (opts.length) {
          act(
            () => setNativeValue(sel, randOf(opts).value),
            `Ranked ${rankSelects.length - unranked.length + 1}/${rankSelects.length}`,
          );
          return;
        }
      }
      advance();
      return;
    }

    // Text / MQT question: fill each response box with a random token.
    const textInputs = [
      ...document.querySelectorAll('input.form-control[placeholder="Type your answer..."]'),
    ].filter(visible);
    if (textInputs.length) {
      const empty = textInputs.find((i) => !i.value.trim());
      if (empty) {
        act(() => {
          setNativeValue(empty, randToken());
          empty.blur();
        }, 'Filled text answer');
        return;
      }
      advance();
      return;
    }

    // Choice question: random k selections, honoring min (hint / disabled
    // Next) and max (disabled checkboxes, or single-choice replacement).
    const boxes = [...document.querySelectorAll('label[data-proctoring-option-id] input[type="checkbox"]')].filter(
      visible,
    );
    if (boxes.length) {
      const checkedCount = boxes.filter((b) => b.checked).length;
      if (targetK == null) targetK = randInt(1, boxes.length);
      if (checkedBeforeClick != null && checkedCount <= checkedBeforeClick) {
        // Our last click replaced a selection instead of adding one
        // (single-choice) or was swallowed by the cap — stop adding.
        targetK = Math.max(1, checkedCount);
      }
      checkedBeforeClick = null;

      if (checkedCount < targetK || isBelowMin()) {
        const candidates = boxes.filter((b) => !b.checked && !b.disabled);
        if (candidates.length) {
          checkedBeforeClick = checkedCount;
          act(() => randOf(candidates).click(), `Selected option ${checkedCount + 1}`);
          return;
        }
        targetK = checkedCount; // cap reached, nothing left to click
      }

      if (checkedCount > 0 && !isBelowMin()) {
        advance();
        return;
      }
      setStatus('Waiting on selection…');
      return;
    }

    // Nothing fillable (e.g. game-only question) — just move on.
    advance();
  }

  // ---------- demographic page ----------
  function handleDemographics() {
    const form = [...document.querySelectorAll('form')].find((f) => {
      const sub = f.querySelector('button[type="submit"]');
      return sub && visible(sub) && /^(Next$|Saving)/.test(txt(sub));
    });
    if (!form) {
      setStatus('Demographics: form not found — waiting');
      return;
    }

    const fillNext = () => {
      const email = form.querySelector('input[type="email"]');
      if (visible(email) && !email.value.trim()) {
        act(() => setNativeValue(email, `${randToken()}@example.com`), 'Filled email');
        return true;
      }

      const tel = form.querySelector('input[type="tel"]');
      if (visible(tel) && !tel.value.trim()) {
        act(() => setNativeValue(tel, '9' + String(randInt(100000000, 999999999))), 'Filled phone');
        return true;
      }

      for (const input of [...form.querySelectorAll('input[type="text"]')].filter(visible)) {
        if (!input.value.trim()) {
          act(() => setNativeValue(input, randToken()), 'Filled text field');
          return true;
        }
      }

      for (const input of [...form.querySelectorAll('input[type="number"]')].filter(visible)) {
        if (!input.value.trim()) {
          act(() => setNativeValue(input, String(randInt(10, 40))), 'Filled number field');
          return true;
        }
      }

      for (const input of [...form.querySelectorAll('input[type="date"]')].filter(visible)) {
        if (!input.value) {
          let v = '2008-06-15';
          if (input.min && v < input.min) v = input.min;
          if (input.max && v > input.max) v = input.max;
          act(() => setNativeValue(input, v), 'Filled date field');
          return true;
        }
      }

      for (const sel of [...form.querySelectorAll('select')].filter(visible)) {
        if (!sel.value) {
          const opts = [...sel.options].filter((o) => o.value);
          const preferred = opts.filter((o) => !isOtherOption(o.value) && !isOtherOption(txt(o)));
          const pool = preferred.length ? preferred : opts;
          if (pool.length) {
            act(() => setNativeValue(sel, randOf(pool).value), 'Picked dropdown value');
            return true;
          }
        }
      }

      // Radio / checkbox groups: group by field container, pick one per group.
      for (const type of ['radio', 'checkbox']) {
        const groups = new Map();
        for (const el of [...form.querySelectorAll(`input[type="${type}"]`)].filter(visible)) {
          const box = el.closest('.mb-3') || el.parentElement || form;
          if (!groups.has(box)) groups.set(box, []);
          groups.get(box).push(el);
        }
        for (const group of groups.values()) {
          if (!group.some((el) => el.checked)) {
            const preferred = group.filter((el) => !isOtherOption(el.value));
            act(() => randOf(preferred.length ? preferred : group).click(), `Picked ${type} option`);
            return true;
          }
        }
      }

      return false;
    };

    if (fillNext()) return;

    const submit = form.querySelector('button[type="submit"]');
    if (submit && visible(submit) && !submit.disabled && /^Next$/.test(txt(submit))) {
      demoSubmitTries += 1;
      if (demoSubmitTries > 5) {
        stop('Demographic form not accepted — check validation errors.');
        return;
      }
      act(() => submit.click(), 'Submitted demographics');
      return;
    }
    setStatus('Demographics: waiting…');
  }

  // ---------- main loop ----------
  function tick() {
    if (!panel) mountPanel();
    const surface = detectSurface();
    if (routeEl) routeEl.textContent = `${location.pathname} — ${surface}`;

    if (!running()) return;
    if (Date.now() - lastActionAt < COOLDOWN_MS) return;

    switch (surface) {
      case 'instructions popup': {
        const ok = buttonByText(/^OK(\s*\(\d+\))?$/);
        if (ok.disabled) setStatus('Waiting for OK countdown…');
        else act(() => ok.click(), 'Dismissed section instructions');
        return;
      }

      case 'submit confirm':
        // This tool never submits — hands off.
        stop('Submit dialog open — stopped (submit is manual).');
        return;

      case 'warning dialog': {
        // Inactivity warning: acknowledge, then Continue.
        const cont = buttonByText(/^Continue$/);
        if (cont.disabled) {
          let host = cont.parentElement;
          let ack = null;
          while (host && !ack) {
            ack = host.querySelector('input[type="checkbox"]');
            host = host.parentElement;
          }
          if (ack && !ack.checked) act(() => ack.click(), 'Acknowledged warning');
          else setStatus('Continue disabled — waiting');
        } else {
          act(() => cont.click(), 'Closed warning dialog');
        }
        return;
      }

      case 'general instructions': {
        const ready = buttonByText(/I'?m Ready to Start/);
        const ack = [...document.querySelectorAll('input[type="checkbox"]')]
          .filter(visible)
          .find((c) => !c.closest('[data-proctoring-option-id]'));
        if (ack && !ack.checked) act(() => ack.click(), 'Ticked acknowledgement');
        else if (!ready.disabled) act(() => ready.click(), "Clicked I'm Ready to Start");
        return;
      }

      case 'demographics':
        handleDemographics();
        return;

      case 'section select': {
        // Prefer the first section not already marked completed.
        const cards = [...document.querySelectorAll('.section-card')].filter(visible);
        const target = cards.find((c) => !/completed/i.test(txt(c))) || cards[0];
        if (target) act(() => target.click(), 'Opened section');
        return;
      }

      case 'section instructions': {
        const start = buttonByText(/^Start Assessment$/);
        if (!start.disabled) act(() => start.click(), 'Started section');
        return;
      }

      case 'question page':
        demoSubmitTries = 0;
        handleQuestion();
        return;

      default:
        setStatus('Waiting — autofill runs from the demographics page onward');
    }
  }

  console.debug('[c9-autofill] injected on', location.href);
  setInterval(tick, TICK_MS);
  mountPanel();
})();
