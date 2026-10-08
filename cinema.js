'use strict';

(() => {
  const body = document.body;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('#motion-toggle');
  const cover = document.querySelector('.cover-intro');
  const stage = document.querySelector('.cover-stage');
  const journey = document.querySelector('.journey');
  const session = document.querySelector('.session-scene');
  const title = document.querySelector('.cover-title');
  const description = document.querySelector('.cover-description');
  const heroStory = document.querySelector('.hero-story');
  const photo = document.querySelector('.cover-photo');
  const sides = [...document.querySelectorAll('.hero-side')];
  const cards = [...document.querySelectorAll('.gallery-card')];
  const journeyArticles = [...document.querySelectorAll('.journey-step')];
  const sessionArticles = [...document.querySelectorAll('.session-step')];
  const sessionPhoto = document.querySelector('.session-photo');
  const sessionPhotoImg = sessionPhoto?.querySelector('img') || null;
  const sessionSvg = sessionPhoto?.querySelector('.cycle-svg') || null;
  const sessionButtons = [...document.querySelectorAll('.session-rail button')];
  let canvas = document.querySelector('#universe');
  const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => {p = clamp(p); return p * p * (3 - 2 * p);};
  const ramp = (p, a, b) => ease((p - a) / (b - a));
  // Each frame first holds for reading, then the camera travels to the next one.
  const travel = p => {
    const n = clamp(p) * 3;
    return Math.floor(n) + ramp(n % 1, .28, .87);
  };
  let manual = null;
  let enabled = !preference.matches;
  let frame = 0;
  let lastTime = 0;
  let ranges = [];
  let target = [0, 0, 0];
  let current = [0, 0, 0];
  let pointer = [0, 0];
  let smoothPointer = [0, 0];
  let viewport = {width: innerWidth, height: innerHeight};
  let artIsVisible = true;
  let galleryWidth = 440;
  let world = null;
  const cues = [...document.querySelectorAll('.copy-more')];

  function measure() {
    viewport = {width: innerWidth, height: innerHeight};
    ranges = [cover, journey, session].map((element, index) => {
      const bounds = element.getBoundingClientRect();
      const pinned = index === 0 ? stage : element.querySelector(index === 1 ? '.journey-stage' : '.session-stage');
      return {top: bounds.top + scrollY, height: bounds.height,
        distance: Math.max(1, bounds.height - pinned.offsetHeight)};
    });
    galleryWidth = cards[0]?.offsetWidth || 440;
    world?.resize();
    if (!enabled) world?.draw(0, 0, 0, 'still', [0, 0]);
    refreshCues();
    updateTargets();
  }

  function refreshCues() {
    cues.forEach(cue => {
      const panel = cue.dataset.copy === 'journey' ? document.querySelector('.journey-stories') : document.querySelector('.session-steps');
      cue.hidden = !enabled || panel.scrollHeight <= panel.clientHeight + 16 || panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 10;
    });
  }

  function updateTargets() {
    if (!enabled || !ranges.length) return;
    const y = scrollY;
    target = ranges.map(range => clamp((y - range.top) / range.distance));
    artIsVisible = ranges.some(range => y + viewport.height > range.top && y < range.top + range.height);
    body.classList.toggle('scene-mode', artIsVisible);
    requestFrame();
  }

  function requestFrame() {
    if (!frame && enabled && !document.hidden) frame = requestAnimationFrame(render);
  }

  function showArticle(container, articles, index, amount) {
    const changed = container.dataset.active !== String(index);
    container.dataset.active = String(index);
    articles.forEach((article, i) => {
      const active = i === index;
      article.classList.toggle('active', active);
      article.inert = !active;
      article.setAttribute('aria-hidden', String(!active));
      const fade = active ? clamp(1 - Math.abs(amount - index) * 1.65, .2, 1) : 0;
      article.style.opacity = fade.toFixed(3);
      article.style.transform = `translate3d(0,${(amount - index) * -24}px,0)`;
    });
    if (changed) {
      container.querySelector('.journey-stories, .session-steps')?.scrollTo({top: 0});
      refreshCues();
      window.dispatchEvent(new Event('cinema:scene'));
    }
  }

  function render(time) {
    frame = 0;
    if (!enabled || document.hidden) return;
    const delta = lastTime ? Math.min(50, time - lastTime) : 16;
    lastTime = time;
    const damping = 1 - Math.exp(-delta / 115);
    current = current.map((p, i) => Math.abs(target[i] - p) < .0001 ? target[i] : lerp(p, target[i], damping));
    smoothPointer = smoothPointer.map((p, i) => lerp(p, pointer[i], damping * .6));
    const mobile = viewport.width <= 760;
    const t = time / 1000;
    const h = current[0];
    const flight = ramp(h, .1, .45);
    const finale = ramp(h, .68, 1);
    const mouseX = smoothPointer[0];
    const mouseY = smoothPointer[1];

    title.style.transform = `translate3d(${mouseX * 8}px,${-ramp(h, .03, .28) * 90 + mouseY * 7}px,0) scale(${1 + ramp(h, .03, .3) * .45})`;
    title.style.opacity = (1 - ramp(h, .1, .3)).toFixed(4);
    description.style.opacity = (1 - ramp(h, .04, .16)).toFixed(4);
    description.inert = h > .15;
    stage.style.setProperty('--hero-progress', `${h * 100}%`);
    const storyOpacity = ramp(h, .31, .47) * (1 - ramp(h, .73, .9));
    heroStory.style.opacity = storyOpacity.toFixed(4);
    heroStory.style.transform = `translate3d(${(1 - ramp(h, .3, .5)) * -60}px,${(1 - storyOpacity) * 20}px,0)`;

    const x = mobile ? lerp(viewport.width * .72, 0, flight) : lerp(viewport.width * .87, viewport.width * .21, flight);
    const centerX = lerp(x, 0, finale);
    const centerY = mobile ? lerp(viewport.height * .03, viewport.height * .15, flight) * (1 - finale) : lerp(90, 0, flight);
    const angleY = lerp(-58, -14, flight) * (1 - finale) + mouseX * 4;
    const angleZ = lerp(-14, -5, flight) * (1 - finale);
    const scale = lerp(.72, 1, flight) + finale * (mobile ? .08 : .59);
    photo.style.opacity = ramp(h, .12, .28).toFixed(4);
    photo.inert = h < .22;
    photo.style.transform = `translate3d(calc(-50% + ${centerX}px),calc(-50% + ${centerY + Math.sin(t * .65) * 3}px),${flight * 40}px) rotateY(${angleY}deg) rotateX(${mouseY * -3}deg) rotateZ(${angleZ}deg) scale(${scale})`;
    sides.forEach((side, i) => {
      const sign = i ? 1 : -1;
      const sideOpacity = ramp(h, .15, .34) * (1 - ramp(h, .55, .8));
      side.style.opacity = (sideOpacity * .55).toFixed(4);
      const orbit = (h - .4) * Math.PI * 2 + (i ? .4 : -.4);
      const sideX = sign * viewport.width * (mobile ? .47 : .39) + Math.sin(orbit) * viewport.width * .2;
      const sideY = Math.cos(orbit) * viewport.height * (mobile ? .1 : .15);
      side.style.transform = `translate3d(calc(-50% + ${sideX}px),calc(-50% + ${sideY}px),${-150 + Math.cos(orbit) * 80}px) rotateY(${-sign * 35 + Math.sin(orbit) * 20}deg) rotateZ(${sign * 10}deg)`;
    });

    const g = travel(current[1]);
    const gi = Math.min(3, Math.round(g));
    showArticle(journey, journeyArticles, gi, g);
    document.querySelector('.gallery-index').textContent = `0${gi + 1} — 04`;
    cards.forEach((card, i) => {
      const d = i - g;
      const visible = clamp(1.55 - Math.abs(d), 0, 1);
      card.classList.toggle('active', i === gi);
      card.inert = i !== gi;
      card.setAttribute('aria-hidden', String(i !== gi));
      card.style.opacity = visible.toFixed(4);
      card.style.transform = `translate3d(calc(-50% + ${d * galleryWidth * .83 + mouseX * 8}px),calc(-50% + ${Math.sin(d * 1.4) * (mobile ? 25 : 65) + Math.sin(t * .55 + i) * 4}px),${-Math.abs(d) * 290}px) rotateY(${-d * 42 - 9 + mouseX * 4}deg) rotateX(${mobile ? 0 : mouseY * -3}deg) rotateZ(${-4 - d * 6}deg) scale(${1 - Math.min(.22, Math.abs(d) * .08)})`;
    });

    const s = travel(current[2]);
    const si = Math.min(3, Math.round(s));
    showArticle(session, sessionArticles, si, s);
    document.querySelector('.session-index').textContent = `0${si + 1} — 04`;
    sessionButtons.forEach((button, i) => {
      if (i === si) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    const open = ramp(current[2], .05, .75);
    sessionPhoto.style.borderRadius = `${lerp(mobile ? 18 : 50, 2, open)}%`;
    sessionPhoto.style.transform = `translate3d(-50%,calc(-50% + ${Math.sin(t * .4) * 3}px),0) rotateY(${lerp(22, -8, open) + mouseX * 3}deg) rotateZ(${lerp(5, -3, open)}deg) scale(${lerp(.88, 1.06, open)})`;
    if (sessionPhotoImg) sessionPhotoImg.style.transform = `scale(${lerp(1.22, 1.08, open)}) translate3d(${Math.sin(s * .6) * -25}px,0,0)`;
    else if (sessionSvg) sessionSvg.style.transform = `scale(${lerp(1.05, 1, open)})`;

    if (world) {
      const y = scrollY;
      let scene = 'ambient';
      if (y < ranges[0].top + ranges[0].height) scene = 'hero';
      else if (y + viewport.height > ranges[1].top && y < ranges[1].top + ranges[1].height) scene = 'gallery';
      else if (y + viewport.height > ranges[2].top && y < ranges[2].top + ranges[2].height) scene = 'session';
      world.draw(t, h, g, scene, smoothPointer);
    }
    const unfinished = current.some((p, i) => Math.abs(target[i] - p) > .0001);
    if (artIsVisible || unfinished) requestFrame(); else lastTime = 0;
  }

  function resetReading() {
    [title, description, heroStory, photo, ...sides, ...cards, ...journeyArticles, ...sessionArticles, sessionPhoto, sessionPhotoImg].forEach(element => {
      if (!element) return;
      element.removeAttribute('style');
      element.inert = false;
      element.removeAttribute('aria-hidden');
    });
    if (sessionSvg) sessionSvg.removeAttribute('style');
    delete journey.dataset.active;
    delete session.dataset.active;
    journeyArticles.forEach(article => article.classList.remove('active'));
    stage.style.removeProperty('--hero-progress');
  }

  function configure(preserve = false) {
    const old = enabled;
    let chapter = null;
    if (preserve) [...document.querySelectorAll('[data-chapter]')].forEach(element => {
      if (element.getBoundingClientRect().top <= innerHeight * .35) chapter = element;
    });
    enabled = manual === null ? !preference.matches : manual;
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    body.classList.toggle('cinema-ready', enabled);
    body.classList.toggle('motion-disabled', !enabled);
    document.documentElement.classList.toggle('no-motion', !enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.querySelector('span').textContent = enabled ? 'On' : 'Off';
    if (!enabled) {resetReading(); body.classList.remove('scene-mode'); world?.draw(0, 0, 0, 'still', [0, 0]);}
    measure();
    current = [...target];
    window.dispatchEvent(new Event('cinema:scene'));
    if (preserve && old !== enabled && chapter) window.scrollTo({top: chapter.getBoundingClientRect().top + scrollY - 80, behavior: 'instant'});
    requestFrame();
  }

  function goToScene(container, index) {
    if (!enabled) {
      const article = container === journey ? journeyArticles[index] : sessionArticles[index];
      article.scrollIntoView({behavior: 'auto', block: 'start'});
      return;
    }
    const range = ranges[container === journey ? 1 : 2];
    scrollTo({top: range.top + index / 3 * range.distance, behavior: 'smooth'});
  }

  document.querySelectorAll('.timeline-nav a').forEach((link, index) => link.addEventListener('click', event => {
    if (!enabled) return;
    event.preventDefault();
    history.pushState(null, '', link.hash);
    goToScene(journey, index);
  }));
  sessionButtons.forEach((button, index) => button.addEventListener('click', () => goToScene(session, index)));
  cues.forEach(cue => cue.addEventListener('click', () => {
    const panel = cue.dataset.copy === 'journey' ? document.querySelector('.journey-stories') : document.querySelector('.session-steps');
    panel.scrollBy({top: panel.clientHeight * .68, behavior: 'smooth'});
  }));
  document.querySelectorAll('.journey-stories,.session-steps').forEach(panel => panel.addEventListener('scroll', refreshCues, {passive: true}));
  function syncHash() {
    const match = location.hash.match(/^#moc-([1-4])$/);
    if (match && enabled) goToScene(journey, Number(match[1]) - 1);
  }
  toggle.addEventListener('click', () => {manual = !enabled; configure(true);});
  preference.addEventListener('change', () => configure(true));
  window.addEventListener('scroll', updateTargets, {passive: true});
  window.addEventListener('resize', measure, {passive: true});
  window.addEventListener('hashchange', syncHash);
  window.addEventListener('pageshow', () => {measure(); syncHash();});
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') pointer = [(event.clientX / viewport.width - .5) * 2, (event.clientY / viewport.height - .5) * 2];
  }, {passive: true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {cancelAnimationFrame(frame); frame = 0; lastTime = 0;}
    else requestFrame();
  });

  // A telemetry backdrop: graticule, latency traces with spikes, a scan line.
  // Decorative only — it visualizes the dossier's subject, not measured data.
  function createWorld() {
    const ctx = canvas.getContext('2d', {alpha: false});
    if (!ctx) return null;
    let width = innerWidth, height = innerHeight;
    const traces = [
      {yc: .24, amp: .045, speed: .62, freq: 1.05, color: '#8fb0ff', alpha: .34},
      {yc: .40, amp: .060, speed: .84, freq: .78, color: '#5ce8c5', alpha: .55},
      {yc: .58, amp: .038, speed: 1.12, freq: 1.32, color: '#5ce8c5', alpha: .30},
      {yc: .76, amp: .050, speed: .48, freq: .90, color: '#3aa08c', alpha: .22}
    ];
    const hash = (n) => {n = Math.imul(n ^ 61, 0x27d4eb2d) ^ n >>> 15; n = Math.imul(n, 0x45d9f3b); return ((n ^ n >>> 13) >>> 0) / 4294967295;};
    const dust = Array.from({length: 70}, (_, i) => ({
      x: ((i * 7919 + 17) % 997) / 997,
      y: ((i * 3571 + 23) % 991) / 991,
      phase: i * 1.618, size: .6 + (i % 4) * .3
    }));
    function resize() {
      width = innerWidth; height = innerHeight;
      const pixel = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixel); canvas.height = Math.round(height * pixel);
      ctx.setTransform(pixel, 0, 0, pixel, 0, 0);
    }
    function traceValue(trace, x01, t, energy) {
      const ph = t * trace.speed;
      let v = Math.sin(x01 * 6.2 * trace.freq + ph) * .58
        + Math.sin(x01 * 14.8 * trace.freq - ph * 1.53 + 1.7) * .27
        + Math.sin(x01 * 3.1 + ph * .61) * .15;
      // Sparse latency spikes: deterministic per time-bucket, so "still" is stable.
      const bucket = Math.floor((t * trace.speed + x01 * 2.4) / 2.6);
      const seed = hash(bucket * 131 + Math.round(x01 * 37));
      if (seed > .84) {
        const sx = ((bucket * 2654435761 >>> 8) % 1000) / 1000;
        v -= Math.exp(-((x01 - sx) ** 2) / .0016) * 1.9 * energy;
      }
      return v * trace.amp * height * energy;
    }
    function draw(time, hero, gallery, scene, mouse) {
      const moving = scene !== 'still';
      const t = moving ? time : 0;
      const mobile = width <= 760;
      const base = ctx.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, '#04060c'); base.addColorStop(.5, '#071019'); base.addColorStop(1, '#03050a');
      ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(width * .58, height * .34, 0, width * .58, height * .34, Math.max(width, height) * .72);
      glow.addColorStop(0, '#0e3a35'); glow.addColorStop(.5, '#08202360'); glow.addColorStop(1, '#04060c00');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      // Graticule
      ctx.strokeStyle = '#5ce8c5'; ctx.lineWidth = 1;
      const step = mobile ? 56 : 76;
      ctx.globalAlpha = .05;
      ctx.beginPath();
      for (let gx = step; gx < width; gx += step) {ctx.moveTo(gx + Math.sin(t * .1 + gx) * .6, 0); ctx.lineTo(gx, height);}
      for (let gy = step; gy < height; gy += step) {ctx.moveTo(0, gy + Math.cos(t * .08 + gy) * .6); ctx.lineTo(width, gy);}
      ctx.stroke();
      ctx.globalAlpha = .09;
      ctx.beginPath();
      for (let gx = step * 4; gx < width; gx += step * 4) {ctx.moveTo(gx, 0); ctx.lineTo(gx, height);}
      for (let gy = step * 4; gy < height; gy += step * 4) {ctx.moveTo(0, gy); ctx.lineTo(width, gy);}
      ctx.stroke();
      // Scene energy & placement
      let energy = 1, alphaScale = 1, xShift = 0, yShift = 0;
      if (scene === 'hero') {energy = 1 + ramp(hero, .1, .6) * .5; alphaScale = 1 + ramp(hero, .1, .5) * .4;}
      else if (scene === 'gallery') {energy = .55; alphaScale = .7; xShift = width * .16;}
      else if (scene === 'session') {energy = .8; alphaScale = .9; yShift = height * .04;}
      else {energy = .6; alphaScale = .8;}
      // Traces
      const steps = mobile ? 90 : 160;
      traces.forEach((trace, ti) => {
        const yc = height * trace.yc + yShift + mouse[1] * 5;
        const dim = scene === 'session' && ti !== 1 ? .35 : 1;
        ctx.globalAlpha = trace.alpha * alphaScale * dim;
        ctx.strokeStyle = trace.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const x01 = i / steps;
          const x = x01 * width - xShift;
          const y = yc + traceValue(trace, x01, t, energy) + Math.sin(t * .7 + ti) * 1.5 - mouse[1] * 4;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = trace.alpha * alphaScale * dim * .3;
        ctx.lineWidth = 4;
        ctx.stroke();
      });
      // Scan line
      const scan = ((t * .11) % 1) * (width + 260) - 130;
      const scanGrad = ctx.createLinearGradient(scan - 130, 0, scan + 60, 0);
      scanGrad.addColorStop(0, '#5ce8c500'); scanGrad.addColorStop(.75, '#5ce8c516'); scanGrad.addColorStop(1, '#5ce8c534');
      ctx.globalAlpha = 1;
      ctx.fillStyle = scanGrad;
      ctx.fillRect(scan - 130, 0, 190, height);
      ctx.fillStyle = '#a8f5e2';
      ctx.globalAlpha = .22;
      ctx.fillRect(scan, 0, 1.4, height);
      // Sample dust
      ctx.fillStyle = '#bfeee0';
      dust.forEach(dot => {
        ctx.globalAlpha = .05 + (Math.sin(t * .4 + dot.phase) + 1) * .05;
        ctx.beginPath(); ctx.arc(dot.x * width, dot.y * height + Math.sin(t * .18 + dot.phase) * 8, dot.size, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, 0, 0, height);
      shade.addColorStop(0, '#03050a55'); shade.addColorStop(.5, '#03050a00'); shade.addColorStop(1, '#03050a77');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
    }
    resize(); canvas.dataset.renderer = 'canvas2d'; canvas.dataset.background = 'latency-traces';
    body.classList.add('star-ready');
    return {resize, draw};
  }

  configure();
  document.fonts.ready.then(() => {
    try {world = createWorld();}
    catch(error) {
      canvas.dataset.rendererError = String(error.message).slice(0, 180);
      world = null;
    }
    measure();
    if (!enabled) world?.draw(0, 0, 0, 'still', [0, 0]);
    else requestFrame();
    syncHash();
  });
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.querySelector('main'));
})();
