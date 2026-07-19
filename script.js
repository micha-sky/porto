/* Hero waveform: the five EEG bands from braino, drawn live.
   Cursor X speeds the signal up, cursor Y raises the amplitude.
   The ▶ button sonifies the same five bands with WebAudio. */

(() => {
  const canvas = document.getElementById('waves');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = getComputedStyle(document.documentElement);
  const BANDS = [
    { name: 'delta', color: css.getPropertyValue('--delta'), cycles: 2,  amp: 0.32, drift: 0.12, note: 55.0 },   // A1
    { name: 'theta', color: css.getPropertyValue('--theta'), cycles: 3.5, amp: 0.24, drift: 0.19, note: 82.41 }, // E2
    { name: 'alpha', color: css.getPropertyValue('--alpha'), cycles: 6,  amp: 0.18, drift: 0.27, note: 110.0 },  // A2
    { name: 'beta',  color: css.getPropertyValue('--beta'),  cycles: 11, amp: 0.11, drift: 0.41, note: 164.81 }, // E3
    { name: 'gamma', color: css.getPropertyValue('--gamma'), cycles: 19, amp: 0.06, drift: 0.63, note: 220.0 },  // A3
  ];

  let w = 0, h = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // cursor → signal: eased so the waves feel liquid, not twitchy
  let target = { speed: 1, energy: 1 };
  let cur = { speed: 1, energy: 1 };
  window.addEventListener('pointermove', (e) => {
    target.speed = 0.4 + 1.8 * (e.clientX / window.innerWidth);
    target.energy = 0.5 + 1.3 * (e.clientY / window.innerHeight);
  });

  let playing = false;
  let t = 0;
  let last = performance.now();

  function draw(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    cur.speed += (target.speed - cur.speed) * 0.04;
    cur.energy += (target.energy - cur.energy) * 0.04;
    t += dt * cur.speed;

    ctx.clearRect(0, 0, w, h);
    const boost = playing ? 1.25 : 1;

    BANDS.forEach((b, i) => {
      const baseY = h * (0.30 + i * 0.11);
      ctx.beginPath();
      const steps = Math.ceil(w / 4);
      for (let s = 0; s <= steps; s++) {
        const x = (s / steps) * w;
        const ph = (s / steps) * Math.PI * 2 * b.cycles;
        // two detuned partials per band so the lines breathe instead of loop
        const y = baseY +
          Math.sin(ph + t * (1 + b.drift * 4)) * h * b.amp * 0.25 * cur.energy * boost +
          Math.sin(ph * 0.5 - t * b.drift * 6) * h * b.amp * 0.12 * cur.energy;
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    if (!reduceMotion) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  /* ---------- sonification ---------- */
  const btn = document.getElementById('sonify');
  let audio = null;

  function buildAudio() {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);

    const voices = BANDS.map((b) => {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = b.note;
      const gain = ac.createGain();
      gain.gain.value = 0.05;
      // slow per-band LFO so the chord swells like a real EEG trace
      const lfo = ac.createOscillator();
      lfo.frequency.value = 0.06 + b.drift * 0.25;
      const lfoGain = ac.createGain();
      lfoGain.gain.value = 0.035;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      return { osc, gain };
    });

    return { ac, master, voices };
  }

  btn.addEventListener('click', () => {
    if (!audio) audio = buildAudio();
    if (audio.ac.state !== 'running') audio.ac.resume();
    playing = !playing;
    const now = audio.ac.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setValueAtTime(audio.master.gain.value, now);
    audio.master.gain.linearRampToValueAtTime(playing ? 0.5 : 0, now + 1.2);
    btn.innerHTML = playing
      ? '<span class="btn-icon">■</span> stop the signal'
      : '<span class="btn-icon">▶</span> hear this waveform';
  });
})();

/* Scroll reveal: below-the-fold blocks unfold as they enter.
   The data-reveal attribute is added here, not in the HTML,
   so nothing is hidden when JS is off. */
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const blocks = document.querySelectorAll(
    '.project, .section-head, .lede, .statement, .about-grid, .also, .footer-inner'
  );
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  blocks.forEach((el) => {
    el.setAttribute('data-reveal', '');
    io.observe(el);
  });
})();
