/* =====================================================================
   Facets — the firm's emblem, hidden until a light that follows the cursor
   reveals it.

   The mark is drawn as fine linework: the rim of the brand artwork plus the
   four dividers between its facets, taken along the centre of each bar in the
   logo, so the geometry matches the artwork exactly at any weight.

   Pipeline (the same shape as HillTrek's topo layer, in monochrome):
     1. GEOMETRY — the emblem's rim and dividers, placed and sized per host.
     2. BAKE     — the linework renders ONCE into three offscreen layers:
        dim (resting), hot (soft glow), core (crisp white).
     3. LIGHT    — per frame only two low-res alpha masks are painted at the
        cursor (accumulate / decay) and the baked layers composite through
        them. Nothing shows until the cursor arrives, and the reveal fades
        when it leaves; on touch screens the light traces the lines itself.

   Mount: any element carrying [data-facets]; the value scales intensity.
   ===================================================================== */
(() => {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // With a mouse the layer is invisible until the cursor reaches it. Touch screens
  // have no hover, so there the light traces the lines by itself.
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // The GeoAfrika emblem as centrelines, in the artwork's own coordinates
  // (viewBox 24.3 × 19.63, from images/src/brand/geo-logo-light.svg). The logo's white
  // areas are a rim and four dividers; these run down the middle of each of those bars,
  // so the linework sits exactly on the mark however thin it is drawn.
  const VB = 24.3, CX = 12.15, CY = 9.815;
  const OUTLINE = [[13.17, .4], [8.17, 0], [0, 7.05], [3.63, 19.63], [17.89, 19.63], [24.3, 12.21]];
  const JUNCTION = [7.82, 11.51];                 // where three of the dividers meet
  const DIVIDERS = [
    [JUNCTION, [3.71, 19.63]],                    // down to the bottom edge
    [JUNCTION, [21.34, 15.64]],                   // the long diagonal to the right edge
    [JUNCTION, [2.99, 4.47]],                     // up to the left edge
    [[13, 13.09], [13, .39]],                     // vertical, diagonal up to the top edge
  ];

  const closed = pts => [...pts, pts[0]];
  const measure = pts => { let len = 0; const cum = [0]; for (let k = 1; k < pts.length; k++) { len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); cum.push(len); } return { pts, cum, len }; };
  function pointAt(chain, s) {
    const { pts, cum } = chain;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
  }

  function mount(host) {
    const strength = Math.max(.1, Math.min(1, Number(host.dataset.facets) || 1));
    const canvas = document.createElement('canvas');
    canvas.className = 'facets'; canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    const ctx = canvas.getContext('2d');
    const cfg = { baseline: 0, intensity: .9 * strength, radius: 260, trail: .55, width: 1.1, reduced: .18 * strength };
    let W = 0, H = 0, dpr = 1, dw = 0, dh = 0, mw = 0, mh = 0;
    let dim, hot, core, tmp, tctx, m1c, m1, m2c, m2, walks = [];
    let rect = null, running = false, raf = 0, last = 0, lastMove = -1e9, pointer = null;
    let cx = null, cy = null, sx = null, sy = null, wi = 0, ws = 0, wasIdle = true, rebakeTimer = 0;
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

    // ---- 1 & 2: geometry + bake ----
    function bake() {
      rect = host.getBoundingClientRect();
      W = Math.round(rect.width); H = Math.round(rect.height);
      if (!W || !H) return;
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      dw = Math.round(W * dpr); dh = Math.round(H * dpr);
      canvas.width = dw; canvas.height = dh; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const narrow = W < 800, m = Math.min(W, H), tall = H > W * .5;
      // Placements: centre (fractions of the box) and emblem width in px. The mark sits
      // clear of the text; on a tall box a smaller one is cut by the far corner.
      const places = narrow
        ? [{ x: .5, y: .36, w: m * 1.09 }]
        : tall ? [{ x: .68, y: .47, w: m * .87 }, { x: .07, y: 1.02, w: m * .36 }]
               : [{ x: .74, y: .55, w: H * 1.33 }];
      // Rim and dividers as pixel-space polylines: they are both what gets stroked and
      // the paths the idle light walks along.
      const chains = [];
      for (const p of places) {
        const place = poly => poly.map(([x, y]) => [p.x * W + (x - CX) * (p.w / VB), p.y * H + (y - CY) * (p.w / VB)]);
        chains.push({ ...measure(closed(place(OUTLINE))), width: 1 });
        for (const dvd of DIVIDERS) chains.push({ ...measure(place(dvd)), width: .9 });
      }
      walks = chains.filter(c => c.len > 120).sort((a, b) => b.len - a.len);
      const draw = (c, alphaMul, blur, widthMul) => {
        const x = c.getContext('2d');
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        x.clearRect(0, 0, W, H);
        x.strokeStyle = '#fff'; x.lineJoin = 'round'; x.lineCap = 'round'; x.globalAlpha = alphaMul;
        if (blur) { x.shadowColor = '#fff'; x.shadowBlur = blur; }
        for (const ch of chains) {
          x.lineWidth = cfg.width * ch.width * widthMul;
          x.beginPath(); ch.pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke();
        }
        x.globalAlpha = 1;
      };
      dim = mk(dw, dh); draw(dim, 1, 0, 1);
      hot = mk(dw, dh); draw(hot, .95, 10, 1.25);
      core = mk(dw, dh); draw(core, 1, 0, 1.05);
      tmp = mk(dw, dh); tctx = tmp.getContext('2d');
      mw = Math.max(64, Math.round(W / 3)); mh = Math.max(48, Math.round(H / 3));
      m1c = mk(mw, mh); m1 = m1c.getContext('2d'); m2c = mk(mw, mh); m2 = m2c.getContext('2d');
      sx = sy = null;
      // Always leave a resting frame on the canvas: a rebake clears it, and if the
      // animation loop is throttled (occluded window, background tab) nothing else
      // would repaint it.
      still();
    }
    function still() {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, dw, dh);
      // Nothing at rest. Reduced motion gets a faint static mark instead, since the
      // cursor-driven reveal is switched off for those visitors.
      if (!dim || !reduceMotion) return;
      ctx.globalAlpha = cfg.reduced; ctx.drawImage(dim, 0, 0); ctx.globalAlpha = 1;
    }
    function nearestWalk() {
      if (!walks.length || cx === null) return;
      let bi = 0, bs = 0, bd = Infinity;
      walks.forEach((wk, i) => { wk.pts.forEach((p, k) => { const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (d < bd) { bd = d; bi = i; bs = wk.cum[k]; } }); });
      wi = bi; ws = bs;
    }
    function blob(gc, x, y, r, a) {
      if (x < -r || x > mw + r || y < -r || y > mh + r || r < 1) return;
      const gr = gc.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${a.toFixed(4)})`);
      gr.addColorStop(.55, `rgba(255,255,255,${(a * .45).toFixed(4)})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      gc.fillStyle = gr; gc.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // ---- 3: light ----
    function frame(ts) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!hot) return;
      const dt = Math.min(.05, (ts - last) / 1000 || .016); last = ts;
      const t = ts / 1000;
      const idle = pointer === null || ts - lastMove > 1500;
      let tx, ty, stamp = true;
      if (idle && canHover) {          // mouse away: the reveal fades and nothing remains
        stamp = false; tx = cx === null ? W / 2 : cx; ty = cy === null ? H / 2 : cy;
      } else if (idle) {
        if (walks.length) {
          if (!wasIdle) nearestWalk();
          ws += dt * 70;
          if (ws >= walks[wi].len) { wi = (wi + 1) % walks.length; ws = 0; }
          [tx, ty] = pointAt(walks[wi], ws);
        } else { tx = (Math.sin(t * .21) * .4 + .5) * W; ty = (Math.sin(t * .27 + 1.3) * .4 + .5) * H; }
      } else { tx = pointer[0]; ty = pointer[1]; }
      wasIdle = idle;
      if (cx === null) { cx = tx; cy = ty; }
      const k = Math.min(1, dt * (idle ? 3 : 10));
      cx += (tx - cx) * k; cy += (ty - cy) * k;

      // masks: decay, then stamp the light (interpolated so fast strokes never gap)
      const ms = mw / W;
      const keep = Math.pow(.86 + cfg.trail * .122, dt * 60), keep2 = Math.pow(keep, 2.4), build = 1 - Math.pow(.72, dt * 60);
      for (const [g, kp] of [[m1, keep], [m2, keep2]]) { g.globalCompositeOperation = 'destination-out'; g.fillStyle = `rgba(0,0,0,${(1 - kp).toFixed(4)})`; g.fillRect(0, 0, mw, mh); g.globalCompositeOperation = 'lighter'; }
      const r1 = cfg.radius * ms, r2 = cfg.radius * .42 * ms, lx = cx * ms, ly = cy * ms;
      if (!stamp) { sx = sy = null; }
      else {
        if (sx === null) { sx = lx; sy = ly; }
        const ddx = lx - sx, ddy = ly - sy, dist = Math.hypot(ddx, ddy), steps = Math.min(14, Math.max(1, Math.ceil(dist / (r1 * .35))));
        for (let s = 1; s <= steps; s++) { const f = s / steps; blob(m1, sx + ddx * f, sy + ddy * f, r1, build); blob(m2, sx + ddx * f, sy + ddy * f, r2, build); }
        sx = lx; sy = ly;
      }

      // composite: resting linework, then the hot and core layers through their masks
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, dw, dh);
      if (cfg.baseline > 0) { ctx.globalAlpha = cfg.baseline; ctx.drawImage(dim, 0, 0); }
      ctx.globalCompositeOperation = 'lighter';
      tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, dw, dh); tctx.drawImage(hot, 0, 0);
      tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(m1c, 0, 0, dw, dh);
      ctx.globalAlpha = cfg.intensity; ctx.drawImage(tmp, 0, 0);
      tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, dw, dh); tctx.drawImage(core, 0, 0);
      tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(m2c, 0, 0, dw, dh);
      ctx.globalAlpha = cfg.intensity * .85; ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    const start = () => { if (!running && !document.hidden && !reduceMotion) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    bake();
    if (reduceMotion) return;
    addEventListener('pointermove', e => {
      if (!rect) rect = host.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (x < -60 || y < -60 || x > W + 60 || y > H + 60) { pointer = null; return; }
      pointer = [x, y]; lastMove = performance.now();
    }, { passive: true });
    addEventListener('scroll', () => { rect = null; }, { passive: true });
    new ResizeObserver(() => { clearTimeout(rebakeTimer); rebakeTimer = setTimeout(bake, 150); }).observe(host);
    new IntersectionObserver(([e]) => e.isIntersecting ? start() : stop(), { threshold: 0 }).observe(host);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    start();
  }

  document.querySelectorAll('[data-facets]').forEach(mount);
})();
