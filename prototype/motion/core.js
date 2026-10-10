/* PROTOTYPE motion core. Throwaway: delete with the prototype folder.

   Every animated block on the page is a container:
     <div class="anim" data-anim="map" role="img" aria-label="..."></div>
   Each animation registers a setup function:
     Motion.register('map', function (el, ctx) {
       // ctx.mode: 'light' | 'full'      ctx.reduced: true when the visitor turned motion off
       // ctx.colors(): palette read from the container's CSS variables (--a-ink, --a-soft, ...)
       // ctx.rand(seed): seeded random generator, so layouts are the same on every load
       return {
         beats: 4,           // number of states. 0 is the start state, beats - 1 is the end state
         beatMs: 3800,       // optional. How long full mode holds each beat
         loop: true,         // optional. false = full mode plays once and holds the last beat
         show: function (beat, instant) {},   // go to a state. instant = jump, no tween
         pause: function () {}, resume: function () {}   // optional. stop and restart idle motion
       };
     });

   What the core does with each container:
     light mode   plays 0 -> last beat once, the first time it scrolls into view.
     full mode    steps through every beat while in view, loops, and adds step buttons.
     reduced      shows the last beat with no motion.
     ?freeze=N    shows beat N with no motion (used for the design board screenshots).
   Mode comes from ?motion=light|full, else <body data-motion>, else light. */

(function () {
  var params = new URLSearchParams(location.search);
  var MODE = params.get('motion') || (document.body && document.body.dataset.motion) || 'light';
  var FREEZE = params.has('freeze') ? parseInt(params.get('freeze'), 10) : null;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var registry = {};

  function seeded(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function colors(el) {
    var cs = getComputedStyle(el);
    function v(name, fallback) { return (cs.getPropertyValue(name) || '').trim() || fallback; }
    return {
      ink: v('--a-ink', '#16150f'),
      muted: v('--a-muted', '#55534a'),
      soft: v('--a-soft', '#c9c6bc'),
      paper: v('--a-paper', '#fafaf6'),
      accent: v('--a-accent', '#2242e8'),
      accentSoft: v('--a-accent-soft', '#b9c4f7'),
      alert: v('--a-alert', '#c2412d')
    };
  }

  var ease = {
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    inOut: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  };

  window.Motion = {
    mode: MODE,
    reduced: REDUCED,
    freeze: FREEZE,
    ease: ease,
    shared: {},
    register: function (name, setup) { registry[name] = setup; }
  };

  var css = document.createElement('style');
  css.textContent =
    '.anim-steps{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}' +
    '.anim-steps button{width:28px;height:28px;padding:0;border:1px solid currentColor;background:transparent;color:inherit;font:600 11px/1 Archivo,sans-serif;cursor:pointer;opacity:.55}' +
    '.anim-steps button[aria-current="step"]{opacity:1;background:currentColor}' +
    '.anim-steps button[aria-current="step"] span{color:var(--a-paper,#fafaf6);mix-blend-mode:difference}' +
    '.anim-steps button:focus-visible{outline:2px solid var(--blue,#2242e8);outline-offset:2px}' +
    '@media (max-width:900px){.anim-steps button{width:36px;height:36px}}';
  document.head.appendChild(css);

  function wire(el, inst) {
    var beats = Math.max(1, inst.beats || 1);
    var last = beats - 1;
    var loop = MODE === 'full' && inst.loop !== false;
    var beatMs = inst.beatMs || 3600;
    var cur = 0, timer = null, started = false, visible = false, holdUntil = 0, steps = null;

    function mark() {
      if (!steps) return;
      steps.querySelectorAll('button').forEach(function (b, i) {
        if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
    }
    function go(n, instant) { cur = n; inst.show(n, !!instant); el.dataset.beat = n; mark(); }
    function schedule(ms) { clearTimeout(timer); timer = setTimeout(tick, ms); }
    function tick() {
      if (!visible) return;
      if (Date.now() < holdUntil) { schedule(holdUntil - Date.now()); return; }
      var next = cur + 1;
      if (next > last) { if (!loop) return; next = 0; }
      go(next);
      schedule(next === last ? beatMs * 1.6 : beatMs);
    }

    go(0, true);
    if (FREEZE !== null) { go(Math.min(FREEZE, last), true); return; }
    if (REDUCED) { go(last, true); return; }

    if (MODE === 'full' && beats > 2) {
      steps = document.createElement('div');
      steps.className = 'anim-steps';
      steps.setAttribute('aria-label', 'Animation steps');
      for (var i = 0; i < beats; i++) {
        (function (n) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Step ' + (n + 1) + ' of ' + beats);
          b.innerHTML = '<span>' + (n + 1) + '</span>';
          b.addEventListener('click', function () { holdUntil = Date.now() + 9000; go(n); schedule(9000); });
          steps.appendChild(b);
        })(i);
      }
      el.insertAdjacentElement('afterend', steps);
      mark();
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible = e.isIntersecting;
        if (visible) {
          if (inst.resume) inst.resume();
          if (!started) {
            started = true;
            if (MODE === 'light') go(last);
            else { go(1 % beats); schedule(beatMs); }
          } else if (MODE === 'full') {
            schedule(beatMs);
          }
        } else {
          clearTimeout(timer);
          if (inst.pause) inst.pause();
        }
      });
    }, { threshold: 0.35 });
    io.observe(el);
  }

  function boot() {
    document.body.dataset.motion = MODE;
    document.querySelectorAll('.anim[data-anim]').forEach(function (el) {
      var setup = registry[el.dataset.anim];
      if (!setup) { console.warn('[motion] no animation registered for', el.dataset.anim); return; }
      var seedBase = 0;
      for (var i = 0; i < el.dataset.anim.length; i++) seedBase = seedBase * 31 + el.dataset.anim.charCodeAt(i) | 0;
      var inst = setup(el, {
        mode: MODE,
        reduced: REDUCED,
        colors: function () { return colors(el); },
        rand: function (seed) { return seeded(seed == null ? seedBase : seed); },
        ease: ease
      });
      if (inst) wire(el, inst);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
