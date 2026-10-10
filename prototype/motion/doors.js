/* PROTOTYPE motion: doors. Throwaway: delete with the prototype folder.

   One map, three ways in. Three equal panels side by side, each drawing the same small map.
     panel 1  Names only      stays quiet
     panel 2  Read, audited   a lens sweeps across the map and the dots under it light up
     panel 3  Write, approved one dot waits for a person (dashed ring turning), then is approved (solid ring)
   Full mode: 4 beats (quiet, lens, waiting, approved). Light mode: 2 beats (quiet, final picture).
   The map shape comes from Motion.shared.mapLayout (map.js) when it is loaded, otherwise a plain stand-in. */

(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var SEED_MAP = 7001;      // same seed as map.js, so the shape matches
  var GAP = 16;
  var LABELS = ['Names only', 'Read, audited', 'Write, approved'];
  var DUR = 1400;           // dot, ring and lens-fade ease time
  var LENS_FADE = 800;
  var SWEEP = 3200;         // one pass of the lens across the map
  var FX = 1000;            // the brief fill when the write is approved

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function bell(rand) { return (rand() + rand() + rand() - 1.5) / 1.5; }

  // stand-in when map.js is not loaded: 12 bell shaped blobs on a 4 x 3 grid
  function fallbackLayout(rand, n) {
    var K = 12, cx = [], cy = [], pts = [], k, i;
    for (k = 0; k < K; k++) {
      cx.push(((k % 4) + 0.5) / 4 + (rand() - 0.5) * 0.04);
      cy.push((Math.floor(k / 4) + 0.5) / 3 + (rand() - 0.5) * 0.05);
    }
    for (i = 0; i < n; i++) {
      k = Math.floor(rand() * K);
      pts.push({
        x: clamp(cx[k] + bell(rand) * 0.085, 0.03, 0.97),
        y: clamp(cy[k] + bell(rand) * 0.105, 0.03, 0.97),
        hub: false,
        cluster: k
      });
    }
    return pts;
  }

  Motion.register('doors', function (el, ctx) {
    var full = ctx.mode === 'full';
    var BEATS = full ? 4 : 2;
    var ease = ctx.ease;
    // lensA: lens shown. dotA: the waiting dot shown. ringS: ring closed from dashed to solid.
    var STATES = full ? [
      { lensA: 0, dotA: 0, ringS: 0 },
      { lensA: 1, dotA: 0, ringS: 0 },
      { lensA: 1, dotA: 1, ringS: 0 },
      { lensA: 1, dotA: 1, ringS: 1 }
    ] : [
      { lensA: 0, dotA: 0, ringS: 0 },
      { lensA: 1, dotA: 1, ringS: 1 }
    ];

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(canvas);
    var g = canvas.getContext('2d');

    var W = 0, H = 0, dpr = 1, narrow = false, pw = 0, pad = 10, fontPx = 12, lineH = 15;
    var mx = 0, my = 0, mw = 1, mh = 1;
    var r = 1.1, dotR = 3, ringR = 10, lensR = 30, lensX0 = 0, lensX1 = 0, lensYc = 0, lensAmp = 0;
    var lines = [], pts = [], PX = null, PY = null, hubOf = null, lensB = null, dotIdx = 0;
    var cache = {};
    var col = ctx.colors();

    var beat = 0, paused = true, tweening = false, raf = 0, t0 = 0, endT = 0, fxT0 = -1;
    var cur = { lensA: 0, dotA: 0, ringS: 0, s: 0.5 };
    var from = { lensA: 0, dotA: 0, ringS: 0, s: 0.5 };
    var sFrom = 0.5, sTo = 0.5, sT0 = 0, sDur = 1;

    function wrapLabel(text, maxW) {
      if (g.measureText(text).width <= maxW) return [text];
      var sp = text.indexOf(' ');
      return sp < 0 ? [text] : [text.slice(0, sp), text.slice(sp + 1)];
    }

    /* ---- layout for the current size ---- */
    function layout() {
      narrow = W < 520;
      pw = (W - GAP * 2) / 3;
      pad = narrow ? 8 : 10;
      fontPx = narrow ? 11 : 12;
      lineH = fontPx + 3;
      g.font = fontPx + 'px Archivo, sans-serif';
      var rows = 1, k, i;
      lines = [];
      for (k = 0; k < 3; k++) { lines.push(wrapLabel(LABELS[k], pw - pad * 2)); rows = Math.max(rows, lines[k].length); }

      mx = pad; my = pad + rows * lineH + 4;
      mw = Math.max(10, pw - pad * 2); mh = Math.max(10, H - pad - my);

      var n = narrow ? 160 : 260;
      if (!cache[n]) {
        var make = Motion.shared && Motion.shared.mapLayout ? Motion.shared.mapLayout : fallbackLayout;
        cache[n] = make(ctx.rand(SEED_MAP), n);
      }
      pts = cache[n];
      PX = new Float32Array(n); PY = new Float32Array(n); hubOf = new Uint8Array(n); lensB = new Float32Array(n);
      for (i = 0; i < n; i++) {
        PX[i] = mx + pts[i].x * mw;
        PY[i] = my + pts[i].y * mh;
        hubOf[i] = pts[i].hub ? 1 : 0;
      }
      r = 1.1 * clamp(pw / 240, 0.7, 1.1);

      // the waiting dot: the hub nearest the middle of the map, or the nearest dot if there are no hubs
      var best = 1e9, bestAny = 1e9, anyIdx = 0;
      dotIdx = -1;
      for (i = 0; i < n; i++) {
        var d = Math.pow(pts[i].x - 0.58, 2) + Math.pow(pts[i].y - 0.45, 2);
        if (d < bestAny) { bestAny = d; anyIdx = i; }
        if (hubOf[i] && d < best) { best = d; dotIdx = i; }
      }
      if (dotIdx < 0) dotIdx = anyIdx;
      dotR = r * 2.6;
      ringR = clamp(Math.min(mw, mh) * 0.09, 7, 14);

      // lens: radius about 18% of the panel height, kept inside the panel
      lensR = Math.min(H * 0.18, pw * 0.3);
      lensX0 = lensR + 3; lensX1 = Math.max(lensX0, pw - lensR - 3);
      lensYc = clamp(my + mh / 2, lensR + 3, Math.max(lensR + 3, H - lensR - 3));
      lensAmp = Math.max(0, Math.min(mh * 0.14, (H - lensR * 2 - 6) / 2));
    }

    /* ---- state ---- */
    function restS(b) { return (full && b === 1) ? 0.32 : 0.5; }   // where the lens sits in a still picture

    function settle() {
      var st = STATES[beat];
      cur.lensA = st.lensA; cur.dotA = st.dotA; cur.ringS = st.ringS; cur.s = restS(beat);
      tweening = false; fxT0 = -1;
    }

    function startTween(now) {
      var present = cur.lensA > 0.05;
      from.lensA = cur.lensA; from.dotA = cur.dotA; from.ringS = cur.ringS; from.s = cur.s;
      t0 = now;
      if (beat === 0) {                                   // lens fades out where it is
        sFrom = cur.s; sTo = cur.s; sT0 = now; sDur = 1;
      } else if (full && beat === 1) {                    // sweep across the map
        sFrom = present ? cur.s : 0;
        sTo = sFrom > 0.5 ? 0 : 1;
        sT0 = now + (present ? 0 : 250);
        sDur = SWEEP * Math.max(0.4, Math.abs(sTo - sFrom));
      } else {                                            // settle in the middle
        sFrom = present ? cur.s : 0.5; sTo = 0.5; sT0 = now; sDur = 1200;
      }
      cur.s = sFrom;
      fxT0 = (full && beat === 3) ? now + 150 : -1;
      endT = Math.max(t0 + DUR, sT0 + sDur, fxT0 >= 0 ? fxT0 + FX : 0) + 30;
      tweening = true;
      kick();
    }

    function step(now) {
      if (!tweening) return;
      var st = STATES[beat], el = now - t0;
      var e = ease.out(clamp(el / DUR, 0, 1));
      cur.lensA = lerp(from.lensA, st.lensA, ease.out(clamp(el / LENS_FADE, 0, 1)));
      cur.dotA = lerp(from.dotA, st.dotA, e);
      cur.ringS = lerp(from.ringS, st.ringS, e);
      cur.s = lerp(sFrom, sTo, ease.inOut(clamp((now - sT0) / sDur, 0, 1)));
      if (now >= endT) {
        cur.lensA = st.lensA; cur.dotA = st.dotA; cur.ringS = st.ringS; cur.s = sTo;
        tweening = false; fxT0 = -1;
      }
    }

    function rotating() { return full && beat === 2 && !paused; }

    /* ---- draw ---- */
    function dots(skipLensDots) {
      // soft dots, one path. In panel 2 the dots under the lens are skipped and drawn separately.
      var i, n = PX.length;
      g.fillStyle = col.soft; g.globalAlpha = 1;
      g.beginPath();
      for (i = 0; i < n; i++) {
        if (skipLensDots && lensB[i] > 0) continue;
        var rr = hubOf[i] ? r * 1.5 : r;
        g.moveTo(PX[i] + rr, PY[i]); g.arc(PX[i], PY[i], rr, 0, TAU);
      }
      g.fill();
    }

    function draw(now) {
      if (!W || !H || !PX) return;
      var k, i, n = PX.length;
      g.clearRect(0, 0, W, H);

      for (k = 0; k < 3; k++) {
        g.save();
        g.translate(k * (pw + GAP), 0);

        g.globalAlpha = 1; g.strokeStyle = col.soft; g.lineWidth = 1;
        g.strokeRect(0.5, 0.5, pw - 1, H - 1);

        g.font = fontPx + 'px Archivo, sans-serif'; g.fillStyle = col.muted;
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        for (i = 0; i < lines[k].length; i++) g.fillText(lines[k][i], pad, pad + fontPx + i * lineH - 2);

        var lensOn = (k === 1 && cur.lensA > 0.004), lx = 0, ly = 0;
        if (lensOn) {
          lx = lerp(lensX0, lensX1, cur.s);
          ly = clamp(lensYc + Math.sin(cur.s * TAU) * lensAmp, lensR + 3, Math.max(lensR + 3, H - lensR - 3));
          for (i = 0; i < n; i++) {
            var dd = Math.sqrt(Math.pow(PX[i] - lx, 2) + Math.pow(PY[i] - ly, 2));
            lensB[i] = clamp((lensR - dd) / 4, 0, 1) * cur.lensA;
          }
        } else if (k === 1) {
          for (i = 0; i < n; i++) lensB[i] = 0;
        }
        dots(k === 1);

        if (k === 1 && lensOn) {
          for (i = 0; i < n; i++) {
            var b = lensB[i];
            if (b <= 0) continue;
            var rr = hubOf[i] ? r * 1.5 : r;
            if (b < 1) { g.globalAlpha = 1 - b; g.fillStyle = col.soft; g.beginPath(); g.arc(PX[i], PY[i], rr, 0, TAU); g.fill(); }
            g.globalAlpha = b; g.fillStyle = col.ink;
            g.beginPath(); g.arc(PX[i], PY[i], rr * (1 + 0.6 * b), 0, TAU); g.fill();
          }
          g.globalAlpha = cur.lensA; g.strokeStyle = col.ink; g.lineWidth = 1.5;
          g.beginPath(); g.arc(lx, ly, lensR, 0, TAU); g.stroke();
        }

        if (k === 2 && cur.dotA > 0.003) {
          var dA = cur.dotA, px = PX[dotIdx], py = PY[dotIdx];
          var env = fxT0 >= 0 ? now - fxT0 : -1, grow = 1, fillA = 0;
          if (env >= 0) {                                   // approved: the dot puffs out and settles, the ring fills briefly
            grow = 1 + 0.45 * (1 - ease.out(clamp(env / 900, 0, 1)));
            fillA = 0.35 * Math.sin(Math.PI * clamp(env / FX, 0, 1));
          }
          var rr2 = ringR * (0.7 + 0.3 * dA);
          if (fillA > 0.003) {
            g.globalAlpha = fillA * dA; g.fillStyle = col.accentSoft;
            g.beginPath(); g.arc(px, py, rr2, 0, TAU); g.fill();
          }
          var period = TAU * rr2 / 10, gap = period * 0.5 * (1 - cur.ringS);
          g.globalAlpha = dA; g.strokeStyle = col.accent; g.lineWidth = 1.5;
          if (gap < 0.05) g.setLineDash([]);
          else { g.setLineDash([period - gap, gap]); g.lineDashOffset = -((now / 9000) % 1) * TAU * rr2; }
          g.beginPath(); g.arc(px, py, rr2, 0, TAU); g.stroke();
          g.setLineDash([]);
          g.globalAlpha = dA; g.fillStyle = col.accent;
          g.beginPath(); g.arc(px, py, dotR * (0.4 + 0.6 * dA) * grow, 0, TAU); g.fill();
        }
        g.restore();
      }
      g.globalAlpha = 1;
    }

    /* ---- running ---- */
    function loop(now) {
      raf = 0;
      step(now);
      draw(now);
      if (tweening || rotating()) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf && W) raf = requestAnimationFrame(loop); }

    function measure() {
      col = ctx.colors();
      var w = el.clientWidth, h = el.clientHeight;
      if (w === W && h === H) return;
      W = w; H = h;
      if (!W || !H) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      settle();                                           // a resize redraws the current beat at once
      draw(performance.now());
      if (rotating()) kick();
    }

    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(el);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (W && H) { layout(); draw(performance.now()); } });
    }
    measure();

    return {
      beats: BEATS,
      beatMs: 3600,
      loop: true,
      show: function (b, instant) {
        b = clamp(Math.round(b), 0, BEATS - 1);
        if (!instant && b === beat && !tweening) return;
        var now = performance.now();
        step(now);
        beat = b;
        if (!W || !H) return;                             // not measured yet. measure() applies this beat once it has a size
        if (instant || paused) { settle(); draw(now); if (rotating()) kick(); }
        else startTween(now);
      },
      pause: function () {
        paused = true;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      },
      resume: function () {
        paused = false;
        if (tweening || rotating()) kick();
      }
    };
  });
})();
