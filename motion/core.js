/* Motion core for the portfolio page.

   Every animated block is a container:
     <div class="anim" data-anim="map" data-motion="full" role="img" aria-label="..."></div>
   data-motion is "light" (default) or "full".

   Each animation file registers a setup function:
     Motion.register('map', function (el, ctx) {
       // ctx.mode: 'light' | 'full'      ctx.reduced: true when the visitor turned motion off
       // ctx.colors(): palette from the container's CSS variables (--a-ink, --a-soft, ...)
       // ctx.rand(seed): seeded random generator, so layouts are the same on every load
       return {
         beats: 4,           // number of states. 0 is the start state, beats - 1 is the end state
         beatMs: 3800,       // optional. How long full motion holds each beat
         loop: true,         // optional. false = full motion plays once and holds the last beat
         show: function (beat, instant) {},   // go to a state. instant = jump, no tween
         pause: function () {}, resume: function () {}   // optional. stop and restart idle motion
       };
     });

   What the core does with each container:
     light     plays 0 -> last beat once, the first time it scrolls into view.
     full      steps through every beat while in view, loops, and adds step buttons.
     reduced   shows the last beat with no motion. */

(function () {
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
    reduced: REDUCED,
    ease: ease,
    shared: {},
    register: function (name, setup) { registry[name] = setup; }
  };

  function wire(el, inst, mode) {
    var beats = Math.max(1, inst.beats || 1);
    var last = beats - 1;
    var loop = mode === 'full' && inst.loop !== false;
    var beatMs = inst.beatMs || 3600;
    var cur = 0, timer = null, started = false, visible = false, holdUntil = 0, steps = null;

    function mark() {
      if (!steps) return;
      steps.querySelectorAll('button').forEach(function (b, i) {
        if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
    }
    function go(n, instant) { cur = n; inst.show(n, !!instant); mark(); }
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
    if (REDUCED) { go(last, true); return; }

    if (mode === 'full' && beats > 2) {
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
            if (mode === 'light') go(last);
            else { go(1 % beats); schedule(beatMs); }
          } else if (mode === 'full') {
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
    document.querySelectorAll('.anim[data-anim]').forEach(function (el) {
      var setup = registry[el.dataset.anim];
      if (!setup) return;
      var mode = el.dataset.motion === 'full' ? 'full' : 'light';
      var seedBase = 0;
      for (var i = 0; i < el.dataset.anim.length; i++) seedBase = seedBase * 31 + el.dataset.anim.charCodeAt(i) | 0;
      var inst = setup(el, {
        mode: mode,
        reduced: REDUCED,
        colors: function () { return colors(el); },
        rand: function (seed) { return seeded(seed == null ? seedBase : seed); },
        ease: ease
      });
      if (inst) wire(el, inst, mode);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
