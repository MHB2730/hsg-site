/* hsgattorneys.co.za — progressive enhancement. Everything works without this file. */
(() => {
  'use strict';
  const d = document, $ = (s, r = d) => r.querySelector(s), $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  d.documentElement.classList.add('js');



  /* ---- header: mobile menu ---- */
  const toggle = $('.nav-toggle'), menu = $('.menu');
  if (toggle && menu) {
    const setOpen = open => {
      d.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.nav-toggle-label').textContent = open ? 'Close' : 'Menu';
      if (open) menu.querySelector('a')?.focus({ preventScroll: true });
    };
    toggle.addEventListener('click', () => setOpen(!d.body.classList.contains('menu-open')));
    d.addEventListener('keydown', e => { if (e.key === 'Escape' && d.body.classList.contains('menu-open')) { setOpen(false); toggle.focus(); } });
    matchMedia('(min-width: 961px)').addEventListener('change', e => { if (e.matches) setOpen(false); });
    $$('a', menu).forEach(a => a.addEventListener('click', () => setOpen(false)));
  }

  /* ---- reveal on scroll ---- */
  const revealEls = $$('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revealEls.forEach(el => io.observe(el));
  } else revealEls.forEach(el => el.classList.add('in'));

  /* ---- count-up numbers ---- */
  const counters = $$('[data-count]');
  if (counters.length) {
    const fmt = (el, n) => el.dataset.raw ? String(n) : n.toLocaleString('en-ZA');
    const run = el => {
      const target = Number(el.dataset.count), dur = 1400, t0 = performance.now();
      const from = el.dataset.raw ? Math.max(0, target - 60) : 0;
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(el, Math.round(from + (target - from) * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      (reduceMotion || d.hidden) ? (el.textContent = fmt(el, target)) : requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }, { threshold: 0.4 });
    counters.forEach(el => io.observe(el));
  }

  /* ---- magnetic buttons (fine pointers only) ---- */
  if (finePointer && !reduceMotion) {
    const mags = $$('.hero .btn, .band .btn');
    addEventListener('pointermove', e => {
      for (const b of mags) {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy), reach = 110;
        b.style.transform = dist < reach ? `translate(${dx * .22 * (1 - dist / reach)}px, ${dy * .22 * (1 - dist / reach)}px)` : '';
      }
    }, { passive: true });
  }

  /* ---- practice explorer: tabs with hover intent, keyboard, accordion below 860px ---- */
  $$('.explorer').forEach(ex => {
    const tabs = $$('.explorer-tab', ex), panels = $$('.explorer-panel', ex);
    let timer = 0;
    const activate = (i, focus) => {
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; });
      panels.forEach((p, j) => { p.hidden = i !== j; });
      // Replay the staggered entrance for the panel that just appeared (the panels
      // stay in the layout, so the animation needs restarting by hand).
      panels[i].querySelectorAll('.explorer-service').forEach(el => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => activate(i));
      t.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; clearTimeout(timer); timer = setTimeout(() => activate(i), 120); });
      t.addEventListener('pointerleave', () => clearTimeout(timer));
      t.addEventListener('keydown', e => {
        const n = tabs.length;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); activate((i + 1) % n, true); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); activate((i - 1 + n) % n, true); }
        if (e.key === 'Home') { e.preventDefault(); activate(0, true); }
        if (e.key === 'End') { e.preventDefault(); activate(n - 1, true); }
      });
    });
    activate(0);
  });

  /* ---- colour lens on greyscale photography ---- */
  $$('.lens').forEach(lens => {
    const colour = $('.lens-colour', lens);
    if (!colour) return;
    const radius = () => Math.max(90, Math.min(lens.clientWidth, lens.clientHeight) * .28);
    lens.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || lens.classList.contains('is-on')) return;
      const r = lens.getBoundingClientRect();
      lens.classList.add('touched');
      colour.style.clipPath = `circle(${radius()}px at ${e.clientX - r.left}px ${e.clientY - r.top}px)`;
    });
    lens.addEventListener('pointerleave', () => { if (!lens.classList.contains('is-on')) colour.style.clipPath = ''; });
    lens.addEventListener('click', () => { lens.classList.add('touched'); lens.classList.toggle('is-on'); colour.style.clipPath = ''; });
  });

  /* ---- milestones: mark passed dots ---- */
  const ms = $$('.milestone');
  if (ms.length) {
    const io = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) e.target.classList.add('in'); }, { threshold: 0.6 });
    ms.forEach(el => io.observe(el));
  }

  /* ---- in-page nav (about): highlight the section in view ---- */
  const subnav = $('.subnav');
  if (subnav) {
    const links = $$('a[href^="#"]', subnav);
    const targets = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
    const setActive = id => links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
    const io = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
    targets.forEach(t => io.observe(t));
  }

  /* ---- horizontal timeline: buttons, progress, drag ---- */
  $$('.timeline').forEach(tl => {
    const track = $('.timeline-track', tl), prev = $('[data-prev]', tl), next = $('[data-next]', tl), bar = $('.timeline-progress i', tl);
    if (!track) return;
    const step = () => { const a = $$('.tl-item', track); return a.length > 1 ? a[1].offsetLeft - a[0].offsetLeft : track.clientWidth; };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const p = max > 0 ? track.scrollLeft / max : 0, w = max > 0 ? track.clientWidth / track.scrollWidth : 1;
      if (bar) { bar.style.width = (w * 100) + '%'; bar.style.transform = `translateX(${p * (100 / w - 100)}%)`; }
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
    };
    // Index-based animation that always ends exactly on a snap position, so the
    // browser's own snapping (kept on for touch) never fights it.
    let anim = 0;
    const goTo = index => {
      const max = track.scrollWidth - track.clientWidth;
      const target = Math.max(0, Math.min(max, Math.round(index) * step()));
      cancelAnimationFrame(anim);
      if (reduceMotion || d.hidden) { track.scrollLeft = target; update(); return; }
      const from = track.scrollLeft, dist = target - from, t0 = performance.now(), dur = 520;
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        track.scrollLeft = p < 1 ? from + dist * e : target;
        if (p < 1) anim = requestAnimationFrame(tick); else update();
      };
      anim = requestAnimationFrame(tick);
    };
    const current = () => track.scrollLeft / step();
    prev?.addEventListener('click', () => goTo(Math.round(current()) - 1));
    next?.addEventListener('click', () => goTo(Math.round(current()) + 1));
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    let dragging = false, startX = 0, startLeft = 0;
    track.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; dragging = true; startX = e.clientX; startLeft = track.scrollLeft; track.classList.add('dragging'); });
    addEventListener('pointermove', e => { if (dragging) track.scrollLeft = startLeft - (e.clientX - startX); });
    addEventListener('pointerup', () => { if (dragging) { dragging = false; track.classList.remove('dragging'); } });
    track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') next?.click(); if (e.key === 'ArrowLeft') prev?.click(); });
    update();
  });

  /* ---- client reviews: one quote at a time, moving on by itself until touched ---- */
  $$('.reviews').forEach(root => {
    const tabs = $$('.review-tab', root), panels = $$('.review', root);
    const bar = $('.reviews-progress i', root), hold = $('.reviews-toggle', root);
    if (tabs.length < 2 || tabs.length !== panels.length) return;
    const HOLD = 7000;
    let at = -1, auto = !reduceMotion, timer = 0, t0 = 0, raf = 0;

    const show = i => {
      at = (i + panels.length) % panels.length;
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(j === at)); t.tabIndex = j === at ? 0 : -1; });
      panels.forEach((p, j) => p.classList.toggle('is-on', j === at));
    };
    const tick = now => {
      if (!auto) return;
      const p = Math.min(1, (now - t0) / HOLD);
      if (bar) bar.style.transform = `scaleX(${p})`;
      raf = p < 1 ? requestAnimationFrame(tick) : 0;
    };
    const arm = () => {
      clearTimeout(timer); cancelAnimationFrame(raf);
      if (hold) { hold.hidden = false; hold.textContent = auto ? 'Pause' : 'Play'; }
      if (!auto) { if (bar) bar.style.transform = 'scaleX(0)'; return; }
      t0 = performance.now(); raf = requestAnimationFrame(tick);
      timer = setTimeout(() => { show(at + 1); arm(); }, HOLD);
    };
    // Any deliberate choice ends the rotation: past that point the panel only moves when
    // the reader moves it, or starts it again.
    const settle = i => { auto = false; arm(); show(i); };
    // The rotation starts by itself, so there has to be a plain way to stop it that does
    // not depend on hovering (WCAG 2.2.2). It only appears once something is rotating.
    hold?.addEventListener('click', () => { auto = !auto; arm(); });

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => settle(i));
      t.addEventListener('keydown', e => {
        const n = tabs.length, go = k => { settle(k); tabs[k].focus(); };
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); go((i + 1) % n); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); go((i - 1 + n) % n); }
        if (e.key === 'Home') { e.preventDefault(); go(0); }
        if (e.key === 'End') { e.preventDefault(); go(n - 1); }
      });
    });
    // Hovering or reading with the keyboard holds the current one in place.
    const pause = () => { clearTimeout(timer); cancelAnimationFrame(raf); };
    root.addEventListener('pointerenter', pause);
    root.addEventListener('focusin', pause);
    root.addEventListener('pointerleave', () => auto && arm());
    root.addEventListener('focusout', e => { if (auto && !root.contains(e.relatedTarget)) arm(); });
    d.addEventListener('visibilitychange', () => d.hidden ? pause() : (auto && arm()));

    show(0);
    // Nothing rotates until the panel is actually on screen.
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      arm();
    }, { threshold: .25 }).observe(root);
  });

  /* ---- people filter ---- */
  const filters = $('.filters');
  if (filters) {
    const people = $$('.person[data-section]'), groups = $$('.person-group');
    const apply = key => {
      $$('.chip', filters).forEach(c => c.setAttribute('aria-pressed', String(c.dataset.filter === key)));
      people.forEach(p => p.classList.toggle('hidden', key !== 'all' && p.dataset.section !== key));
      groups.forEach(g => g.hidden = key !== 'all' && g.dataset.section !== key);
      history.replaceState(null, '', key === 'all' ? location.pathname : `#${key}`);
    };
    filters.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) apply(c.dataset.filter); });
    const initial = location.hash.slice(1);
    if (initial && $(`.chip[data-filter="${initial}"]`, filters)) apply(initial);
  }

  /* ---- contact form ---- */
  const form = $('#contact-form');
  if (form) {
    const status = $('.form-status', form), btn = $('button[type=submit]', form);
    const show = (msg, ok) => { status.textContent = msg; status.className = 'form-status show' + (ok ? ' ok' : ''); };
    const validate = () => {
      let ok = true;
      $$('.field', form).forEach(f => {
        const input = $('input, textarea', f);
        const bad = input && ((input.required && !input.value.trim()) || (input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)));
        f.classList.toggle('invalid', !!bad);
        if (bad) ok = false;
      });
      const consent = $('#consent', form);
      if (consent && !consent.checked) { ok = false; consent.focus(); show('Please tick the consent box so we may respond to you.', false); }
      return ok;
    };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validate()) { if (!$('#consent', form) || $('#consent', form).checked) show('Please complete the highlighted fields.', false); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      data.consent = !!data.consent;
      btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending…';
      try {
        const r = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.success) { form.reset(); show('Thank you. Your enquiry has been sent and we will be in touch.', true); }
        else throw new Error(j.error || 'send failed');
      } catch (err) {
        const to = form.dataset.mailto || '';
        const body = encodeURIComponent(`Name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || ''}\n\n${data.message}`);
        show('We could not send your message automatically. Please email us directly instead.', false);
        status.insertAdjacentHTML('beforeend', ` <a href="mailto:${to}?subject=${encodeURIComponent('Website enquiry')}&body=${body}">Open your email app</a>.`);
      } finally { btn.disabled = false; btn.textContent = btn.dataset.label; }
    });
    $$('input, textarea', form).forEach(i => i.addEventListener('input', () => i.closest('.field')?.classList.remove('invalid')));
    if (new URLSearchParams(location.search).get('sent') === '1') show('Thank you. Your enquiry has been sent and we will be in touch.', true);
    // A calculator result arrives as ?enquiry=… : drop it into the message so the
    // figures the visitor saw come through with the enquiry.
    const carried = new URLSearchParams(location.search).get('enquiry');
    if (carried) {
      const msg = $('#message', form);
      const tail = ['', '', 'Please confirm these figures for my transaction.'].join('\n');
      if (msg && !msg.value.trim()) msg.value = carried.slice(0, 500) + tail;
    }
  }

  /* ---- video & map facades (third parties load only on request) ---- */
  $$('.video[data-youtube]').forEach(v => {
    // The whole poster is the target, not just the button in the middle of it; the
    // button stays for keyboard use and its click bubbles up to here.
    v.addEventListener('click', () => {
      const f = d.createElement('iframe');
      // playsinline keeps it in the page on iPhone, where a tap cannot start audio
      // automatically and YouTube shows its own play control instead.
      f.src = `https://www.youtube-nocookie.com/embed/${v.dataset.youtube}?autoplay=1&rel=0&playsinline=1`;
      f.title = v.dataset.title || 'Video'; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
      v.replaceChildren(f);
    });
  });
  $$('.map-facade[data-q]').forEach(m => {
    $('button', m)?.addEventListener('click', () => {
      const f = d.createElement('iframe');
      f.src = `https://www.google.com/maps?q=${encodeURIComponent(m.dataset.q)}&output=embed`;
      f.title = `Map: ${m.dataset.q}`; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
      m.replaceChildren(f);
    });
  });

  /* ---- LinkedIn posts: each embed loads as its card nears the viewport ---- */
  $$('.li-feed').forEach(feed => {
    const load = box => {
      if (box.dataset.loaded) return;
      box.dataset.loaded = '1';
      const f = d.createElement('iframe');
      f.src = box.dataset.embed;
      f.title = box.dataset.title || 'Post on LinkedIn';
      f.loading = 'lazy'; f.frameBorder = '0'; f.allowFullscreen = true;
      box.replaceChildren(f);
    };
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) { load(e.target); io.unobserve(e.target); } }, { rootMargin: '300px 0px' })
      : null;
    const watch = box => io ? io.observe(box) : load(box);
    $$('.li-embed[data-embed]', feed).forEach(box => { if (!box.closest('.li-card')?.hidden) watch(box); });

    $('[data-more]', feed)?.addEventListener('click', e => {
      const hidden = $$('.li-card[hidden]', feed);
      hidden.forEach(c => { c.hidden = false; c.classList.remove('is-hidden'); c.classList.add('in'); });
      hidden.forEach(c => { const box = $('.li-embed[data-embed]', c); if (box) watch(box); });
      e.currentTarget.remove();
    });
  });

  /* ---- footer year ---- */
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();
