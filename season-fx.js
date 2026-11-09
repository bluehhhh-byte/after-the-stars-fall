/**
 * SeasonFX — ambient, interactive weather for each chapter's season.
 *   rain      봄비   (tap → ripples)
 *   petals    봄 꽃잎 (tap → burst of petals; pointer → wind)
 *   fireflies 여름밤  (tap → fireflies gather there for a moment)
 *   leaves    가을 낙엽 (tap → gust; pointer → wind)
 *   snow      겨울 눈  (pointer → flakes drift away; tap → a breath of wind)
 * Draws on a canvas over the book; pointer events are read from the host element.
 * Respects prefers-reduced-motion and pauses when the tab is hidden.
 */
window.SeasonFX = (function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const COUNT = { rain: 70, petals: 9, fireflies: 20, leaves: 24, snow: 80, none: 0 };

  const PALETTE = {
    dark: {
      rain: 'rgba(205,214,238,',
      petal: ['rgba(246,205,214,', 'rgba(238,182,196,', 'rgba(250,224,228,'],
      fly: 'rgba(242,220,163,',
      leaf: ['rgba(214,128,66,', 'rgba(176,86,45,', 'rgba(222,170,70,', 'rgba(150,95,45,'],
      snow: 'rgba(242,238,230,',
      ripple: 'rgba(216,181,106,'
    },
    light: {
      rain: 'rgba(80,95,130,',
      petal: ['rgba(222,120,145,', 'rgba(205,100,130,', 'rgba(236,150,170,'],
      fly: 'rgba(200,140,40,',
      leaf: ['rgba(190,100,40,', 'rgba(150,70,35,', 'rgba(200,150,50,', 'rgba(120,75,35,'],
      snow: 'rgba(110,120,150,',
      ripple: 'rgba(142,59,44,'
    }
  };

  let canvas, ctx, host;
  let W = 0, H = 0, dpr = 1;
  let season = 'none', density = 1;
  let enabled = true, dark = true;
  let particles = [], ripples = [];
  let wind = 0;
  let pointer = { x: -999, y: -999, until: 0 };
  let attract = null;
  let rafId = 0, lastT = 0, running = false;
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const pal = () => PALETTE[dark ? 'dark' : 'light'];

  function spawn(key, fresh) {
    const p = { x: rnd(0, W), y: fresh ? rnd(-H * 0.1, H) : rnd(-40, -10), vx: 0, vyImp: 0 };
    switch (key) {
      case 'rain':
        p.len = rnd(10, 24); p.vy = rnd(9, 15) * (H / 860); p.a = rnd(0.10, 0.26); p.w = rnd(0.6, 1.1);
        break;
      case 'petals':
        p.s = rnd(5, 9); p.vy = rnd(0.35, 0.8); p.rot = rnd(0, TAU); p.spin = rnd(-0.03, 0.03);
        p.ph = rnd(0, TAU); p.sway = rnd(0.4, 1.1); p.c = pick(pal().petal); p.a = rnd(0.55, 0.9);
        break;
      case 'fireflies':
        p.y = rnd(0, H); p.vx = rnd(-0.25, 0.25); p.vy = rnd(-0.2, 0.2);
        p.ph = rnd(0, TAU); p.r = rnd(1.4, 2.6); p.f = rnd(0.015, 0.035);
        break;
      case 'leaves':
        p.s = rnd(7, 12); p.vy = rnd(0.5, 1.1); p.rot = rnd(0, TAU); p.spin = rnd(-0.04, 0.04);
        p.ph = rnd(0, TAU); p.sway = rnd(0.5, 1.4); p.c = pick(pal().leaf); p.a = rnd(0.6, 0.9);
        break;
      case 'snow':
        p.r = rnd(0.8, 2.4); p.vy = rnd(0.3, 1.0) * (p.r / 1.6); p.ph = rnd(0, TAU);
        p.sway = rnd(0.2, 0.7); p.a = rnd(0.35, 0.85);
        break;
    }
    return p;
  }

  function rebuild() {
    particles = [];
    ripples = [];
    attract = null;
    const area = (W * H) / (430 * 860);
    const n = clamp(Math.round((COUNT[season] || 0) * density * Math.sqrt(area)), 0, 180);
    for (let i = 0; i < n; i++) particles.push(spawn(season, true));
  }

  // ---------------------------------------------------------------- update
  function step(dt, now) {
    wind *= Math.pow(0.96, dt);
    const ptrActive = now < pointer.until;
    const att = attract && now < attract.until ? attract : (attract = null);
    const c = pal();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      switch (season) {
        case 'rain': {
          p.y += p.vy * dt;
          p.x += (-0.35 + wind * 0.8) * p.vy * 0.08 * dt;
          if (p.y > H + p.len) { p.y = rnd(-40, -10); p.x = rnd(-20, W + 20); }
          break;
        }
        case 'petals':
        case 'leaves': {
          p.ph += (season === 'leaves' ? 0.025 : 0.02) * dt;
          p.x += (Math.sin(p.ph) * p.sway + wind + p.vx) * dt;
          p.y += (p.vy + p.vyImp) * dt;
          p.rot += (p.spin + p.vx * 0.01) * dt;
          p.vx *= Math.pow(0.95, dt);
          p.vyImp *= Math.pow(0.94, dt);
          if (p.y > H + 20) { Object.assign(p, spawn(season, false)); }
          if (p.x < -30) p.x = W + 20; else if (p.x > W + 30) p.x = -20;
          break;
        }
        case 'fireflies': {
          p.vx += rnd(-0.03, 0.03) * dt;
          p.vy += rnd(-0.03, 0.03) * dt;
          if (att) {
            p.vx += (att.x - p.x) * 0.0022 * dt;
            p.vy += (att.y - p.y) * 0.0022 * dt;
          }
          const sp = Math.hypot(p.vx, p.vy);
          const lim = att ? 1.6 : 0.5;
          if (sp > lim) { p.vx *= lim / sp; p.vy *= lim / sp; }
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
          p.ph += p.f * dt;
          break;
        }
        case 'snow': {
          p.ph += 0.01 * dt;
          if (ptrActive) {
            const dx = p.x - pointer.x, dy = p.y - pointer.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < 90) { const f = (90 - d) / 90; p.vx += (dx / d) * f * 0.45 * dt; p.vyImp += (dy / d) * f * 0.25 * dt; }
          }
          p.x += (Math.sin(p.ph) * p.sway + wind * 0.6 + p.vx) * dt;
          p.y += (p.vy + p.vyImp) * dt;
          p.vx *= Math.pow(0.95, dt);
          p.vyImp *= Math.pow(0.93, dt);
          if (p.y > H + 6) { p.y = rnd(-20, -4); p.x = rnd(0, W); }
          if (p.x < -10) p.x = W + 5; else if (p.x > W + 10) p.x = -5;
          break;
        }
      }
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.r += 2.2 * dt;
      r.life -= 0.018 * dt;
      if (r.life <= 0) ripples.splice(i, 1);
    }
    void c;
  }

  // ---------------------------------------------------------------- draw
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const c = pal();
    switch (season) {
      case 'rain':
        ctx.lineCap = 'round';
        for (const p of particles) {
          ctx.strokeStyle = c.rain + p.a + ')';
          ctx.lineWidth = p.w;
          const sx = (-0.35 + wind * 0.8) * p.len * 0.35;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - sx, p.y - p.len); ctx.stroke();
        }
        break;
      case 'petals':
        for (const p of particles) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.c + p.a + ')';
          const s = p.s;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.bezierCurveTo(s * 0.9, -s * 0.4, s * 0.9, s * 0.5, 0, s);
          ctx.bezierCurveTo(-s * 0.9, s * 0.5, -s * 0.9, -s * 0.4, 0, -s);
          ctx.fill();
          ctx.restore();
        }
        break;
      case 'fireflies':
        for (const p of particles) {
          const a = 0.25 + 0.75 * Math.pow(Math.abs(Math.sin(p.ph)), 3);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
          g.addColorStop(0, c.fly + (a * 0.45) + ')');
          g.addColorStop(1, c.fly + '0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 7, 0, TAU); ctx.fill();
          ctx.fillStyle = c.fly + a + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        }
        break;
      case 'leaves':
        for (const p of particles) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          const s = p.s;
          ctx.fillStyle = p.c + p.a + ')';
          ctx.beginPath();
          ctx.moveTo(-s, 0);
          ctx.quadraticCurveTo(0, -s * 0.7, s, 0);
          ctx.quadraticCurveTo(0, s * 0.7, -s, 0);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,' + (p.a * 0.25) + ')';
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.8, 0); ctx.stroke();
          ctx.restore();
        }
        break;
      case 'snow':
        for (const p of particles) {
          ctx.fillStyle = c.snow + p.a + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        }
        break;
    }

    for (const r of ripples) {
      ctx.strokeStyle = c.ripple + (r.life * 0.6) + ')';
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.35, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * 0.55, r.r * 0.55 * 0.35, 0, 0, TAU); ctx.stroke();
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = clamp((now - (lastT || now)) / 16.67, 0.2, 3);
    lastT = now;
    step(dt, now);
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function shouldRun() {
    return enabled && !reduced && season !== 'none' && !document.hidden && W > 0 && H > 0;
  }

  function sync() {
    if (shouldRun()) {
      if (!running) { running = true; lastT = 0; rafId = requestAnimationFrame(frame); }
    } else if (running) {
      running = false;
      cancelAnimationFrame(rafId);
      if (ctx) ctx.clearRect(0, 0, W, H);
    }
  }

  // ---------------------------------------------------------------- input
  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function tap(x, y) {
    if (!running) return;
    switch (season) {
      case 'rain':
        ripples.push({ x, y, r: 2, life: 1 });
        setTimeout(() => ripples.push({ x: x + rnd(-6, 6), y: y + rnd(-3, 3), r: 2, life: 0.8 }), 180);
        break;
      case 'petals':
        for (let i = 0; i < 5; i++) {
          const p = spawn('petals', true);
          p.x = x + rnd(-6, 6); p.y = y + rnd(-6, 6);
          p.vx = rnd(-3.2, 3.2); p.vyImp = rnd(-3.4, -0.6);
          particles.push(p);
        }
        if (particles.length > 60) particles.splice(0, particles.length - 60);
        break;
      case 'fireflies':
        attract = { x, y, until: performance.now() + 2200 };
        break;
      case 'leaves':
      case 'snow':
        for (const p of particles) {
          const dx = p.x - x, dy = p.y - y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 260) {
            const f = (260 - d) / 260;
            p.vx += (dx / d) * f * (season === 'leaves' ? 6 : 4);
            p.vyImp += (dy / d) * f * 3 - f * 1.5;
          }
        }
        break;
    }
  }

  function bindInput() {
    host.addEventListener('pointermove', (e) => {
      if (!running) return;
      wind = clamp(wind + (e.movementX || 0) * 0.02, -2.2, 2.2);
      const l = toLocal(e);
      pointer = { x: l.x, y: l.y, until: performance.now() + 500 };
    }, { passive: true });
    host.addEventListener('pointerdown', (e) => {
      const l = toLocal(e);
      tap(l.x, l.y);
    }, { passive: true });
  }

  // ---------------------------------------------------------------- api
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(0, Math.round(r.width));
    H = Math.max(0, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
    sync();
  }

  function init(canvasEl, hostEl) {
    canvas = canvasEl;
    host = hostEl;
    ctx = canvas.getContext('2d');
    bindInput();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    resize();
  }

  function setSeason(key, dens) {
    const d = typeof dens === 'number' ? dens : 1;
    if (!COUNT.hasOwnProperty(key)) key = 'none';
    if (key === season && d === density) return;
    season = key;
    density = d;
    rebuild();
    sync();
  }

  function setEnabled(v) { enabled = !!v; sync(); }
  function setTheme(isDark) {
    dark = !!isDark;
    for (const p of particles) {
      if (season === 'petals') p.c = pick(pal().petal);
      if (season === 'leaves') p.c = pick(pal().leaf);
    }
  }

  return { init, setSeason, setEnabled, setTheme, tap, get season() { return season; }, get running() { return running; } };
})();
