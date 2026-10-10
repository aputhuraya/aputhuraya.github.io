/* PROTOTYPE motion: map. Throwaway: delete with the prototype folder.

   One database drawn as dots.
     beat 0  a flat field of dots. One of them is the wrong number.
     beat 1  the dots gather into 12 areas, a few big hub dots appear, thin links fade in.
     beat 2  the agent walks a route across six hubs.
     beat 3  everything dims except the wrong number, which gets a ring.
   Full mode: 4 beats, 1800 dots, captions, a tiny idle wobble.
   Light mode: 2 beats (field, map), 700 dots, no captions, no idle motion.

   Also publishes Motion.shared.mapLayout(rand, n) so doors.js draws the same map shape. */

(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var SEED_MAP = 7001;      // doors.js uses the same seed, so both modules draw the same shape
  var SEED_FIELD = 7002;
  var SEED_PHASE = 7003;
  var HUB_COUNT = 20;
  var LINK_COUNT = 70;
  var DOT_ALPHA = 0.55;
  var DIM_ALPHA = 0.2;
  var LINK_ALPHA = 0.35;
  var DUR = 1400;           // how long each dot takes to move
  var SPREAD = 300;         // the last dot starts this much later than the first
  var ROUTE_MS = 1500;      // the route draws itself in about this long

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function bell(rand) { return (rand() + rand() + rand() - 1.5) / 1.5; }   // roughly -1..1, bell shaped

  /* Builds the map shape in 0..1 coordinates. cols x rows areas, jittered, each with a bell shaped blob of dots.
     Returns the dots plus the hubs, the links, the route across six hubs, and the one wrong dot. */
  function build(rand, n, cols, rows) {
    var K = cols * rows, cw = 1 / cols, ch = 1 / rows, i, j, k;
    var weight = [], wsum = 0, cx = [], cy = [];
    for (k = 0; k < K; k++) { weight.push(0.5 + rand() * 1.1); wsum += weight[k]; }
    for (k = 0; k < K; k++) {
      cx.push(((k % cols) + 0.5) * cw + (rand() - 0.5) * 0.32 * cw);
      cy.push((Math.floor(k / cols) + 0.5) * ch + (rand() - 0.5) * 0.32 * ch);
    }

    var pts = [], members = [], cores = [];
    for (k = 0; k < K; k++) { members.push([]); cores.push([]); }
    for (i = 0; i < n; i++) {
      var pick = rand() * wsum, c = 0, acc = weight[0];
      while (pick > acc && c < K - 1) { c++; acc += weight[c]; }
      var core = rand() < 0.08;                       // core dots sit tight around the middle of an area
      var spread = (core ? 0.16 : 0.36) * (0.75 + 0.25 * weight[c]);
      pts.push({
        x: clamp(cx[c] + bell(rand) * spread * cw, 0.03, 0.97),
        y: clamp(cy[c] + bell(rand) * spread * ch, 0.03, 0.97),
        hub: false,
        cluster: c
      });
      members[c].push(i);
      if (core) cores[c].push(i);
    }

    // distance in area-sized units, so the same number means the same thing on a 4 x 3 and a 2 x 6 grid
    function dist(a, b) {
      var dx = (pts[a].x - pts[b].x) / cw, dy = (pts[a].y - pts[b].y) / ch;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // each area's dots, nearest to its middle first
    var byCenter = members.map(function (m, kk) {
      return m.slice().sort(function (a, b) {
        var da = Math.pow((pts[a].x - cx[kk]) / cw, 2) + Math.pow((pts[a].y - cy[kk]) / ch, 2);
        var db = Math.pow((pts[b].x - cx[kk]) / cw, 2) + Math.pow((pts[b].y - cy[kk]) / ch, 2);
        return da - db;
      });
    });

    // hubs: one per area first, then a second (and third) hub in the biggest areas, until there are 20
    var hubs = [];
    for (k = 0; k < K; k++) {
      if (byCenter[k].length) { pts[byCenter[k][0]].hub = true; hubs.push(byCenter[k][0]); }
    }
    var bySize = [];
    for (k = 0; k < K; k++) bySize.push(k);
    bySize.sort(function (a, b) { return (members[b].length - members[a].length) || (a - b); });
    for (var round = 0; round < 3 && hubs.length < HUB_COUNT; round++) {
      for (var q = 0; q < K && hubs.length < HUB_COUNT; q++) {
        k = bySize[q];
        var list = byCenter[k], found = -1;
        for (j = 0; j < list.length && found < 0; j++) {
          if (pts[list[j]].hub) continue;
          var clear = true;
          for (var h = 0; h < hubs.length; h++) {
            if (pts[hubs[h]].cluster === k && dist(list[j], hubs[h]) < 0.3) { clear = false; break; }
          }
          if (clear) found = list[j];
        }
        if (found >= 0) { pts[found].hub = true; hubs.push(found); }
      }
    }

    // links: each hub to its two nearest hubs in other areas, each hub to two core dots in its own area,
    // then random core to core links inside an area until there are about 70
    var edges = [], seen = {};
    function link(a, b) {
      if (a === undefined || b === undefined || a === b) return;
      var key = a < b ? a + '-' + b : b + '-' + a;
      if (seen[key]) return;
      seen[key] = true;
      edges.push([a, b]);
    }
    function poolOf(area) { return cores[area].length > 2 ? cores[area] : byCenter[area].slice(0, 8); }
    hubs.forEach(function (a) {
      var near = hubs.filter(function (b) { return pts[b].cluster !== pts[a].cluster; })
        .sort(function (b1, b2) { return dist(a, b1) - dist(a, b2); });
      link(a, near[0]);
      link(a, near[1]);
    });
    hubs.forEach(function (a) {
      var pool = poolOf(pts[a].cluster);
      for (var t = 0; t < 2 && pool.length; t++) link(a, pool[Math.floor(rand() * pool.length)]);
    });
    var guard = 0;
    while (edges.length < LINK_COUNT && guard++ < 400) {
      var pool2 = poolOf(Math.floor(rand() * K));
      if (pool2.length > 1) link(pool2[Math.floor(rand() * pool2.length)], pool2[Math.floor(rand() * pool2.length)]);
    }
    if (edges.length > LINK_COUNT) edges.length = LINK_COUNT;

    // route: six hubs, left to right on a wide map and top to bottom on a tall one, zigzagging across the other way
    var vertical = rows > cols, route = [], used = {}, cross = [0.35, 0.65, 0.4, 0.62, 0.38, 0.6];
    for (i = 0; i < 6; i++) {
      var along = 0.1 + 0.8 * i / 5, best = -1, bd = 1e9;
      for (j = 0; j < hubs.length; j++) {
        var hh = hubs[j];
        if (used[hh]) continue;
        var a1 = vertical ? pts[hh].y : pts[hh].x, a2 = vertical ? pts[hh].x : pts[hh].y;
        var d = Math.pow(a1 - along, 2) + Math.pow(a2 - cross[i], 2);
        if (d < bd) { bd = d; best = hh; }
      }
      if (best >= 0) { used[best] = true; route.push(best); }
    }
    for (i = 1; i < route.length; i++) link(route[i - 1], route[i]);   // the agent walks the links, so they exist

    // the wrong number: an ordinary dot in the same area as the last hub on the route, a little way from it
    var wrong = -1, wd = 1e9;
    if (route.length) {
      var last = route[route.length - 1];
      members[pts[last].cluster].forEach(function (m) {
        if (pts[m].hub) return;
        var dd = dist(m, last);
        if (dd >= 0.2 && dd < wd) { wd = dd; wrong = m; }
      });
    }
    if (wrong < 0) { for (i = 0; i < n; i++) { if (!pts[i].hub) { wrong = i; break; } } }

    return { pts: pts, edges: edges, hubs: hubs, route: route, wrong: wrong };
  }

  // doors.js reads this. Same seed and same dot count give the same dots.
  Motion.shared.mapLayout = function (rand, n, narrow) {
    return (narrow ? build(rand, n, 2, 6) : build(rand, n, 4, 3)).pts;
  };

  Motion.register('map', function (el, ctx) {
    var full = ctx.mode === 'full';
    var N = full ? 1800 : 700;
    var BEATS = full ? 4 : 2;
    var ease = ctx.ease;
    var CAPS = ['Somewhere in here.', 'Mostly islands. A few hubs.', 'The agent walks the links.', 'One wrong number, found.'];
    var KEYS = ['hub', 'link', 'dim', 'alert', 'ringP', 'ringS', 'route'];
    // hub: hub dots grown and accent coloured. link: links shown. dim: everything but the wrong dot faded.
    // alert: wrong dot in alert colour. ringP: pulsing ring. ringS: solid ring. route: how much of the route is drawn.
    var STATES = full ? [
      { hub: 0, link: 0, dim: 0, alert: 1, ringP: 1, ringS: 0, route: 0 },
      { hub: 1, link: 1, dim: 0, alert: 0, ringP: 0, ringS: 0, route: 0 },
      { hub: 1, link: 1, dim: 0, alert: 0, ringP: 0, ringS: 0, route: 1 },
      { hub: 1, link: 1, dim: 1, alert: 1, ringP: 0, ringS: 1, route: 1 }
    ] : [
      { hub: 0, link: 0, dim: 0, alert: 0, ringP: 0, ringS: 0, route: 0 },
      { hub: 1, link: 1, dim: 0, alert: 0, ringP: 0, ringS: 0, route: 0 }
    ];

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(canvas);
    var g = canvas.getContext('2d');

    // per dot arrays. X,Y = where it is now. X0,Y0 = where this move started. TX,TY = where it is going.
    // FX,FY = its spot in the field. MX,MY = its spot in the map. DX,DY = where it is drawn (with the wobble).
    var X = new Float32Array(N), Y = new Float32Array(N), X0 = new Float32Array(N), Y0 = new Float32Array(N);
    var TX = new Float32Array(N), TY = new Float32Array(N), FX = new Float32Array(N), FY = new Float32Array(N);
    var MX = new Float32Array(N), MY = new Float32Array(N), DX = new Float32Array(N), DY = new Float32Array(N);
    var delay = new Float32Array(N), phase = new Float32Array(N), isHub = new Uint8Array(N);
    var pr = ctx.rand(SEED_PHASE), i;
    for (i = 0; i < N; i++) { phase[i] = pr() * TAU; delay[i] = N > 1 ? SPREAD * i / (N - 1) : 0; }

    var W = 0, H = 0, dpr = 1, narrow = false, sc = 1, r = 1.4, pad = 10;
    var ox = 0, oy = 0, ow = 1, oh = 1;
    var col = ctx.colors();
    var models = {}, model = null, wrong = -1;
    var beat = 0, paused = true, tweening = false, raf = 0, t0 = 0, routeDur = ROUTE_MS, routeDoneT = 0;
    var cur = {}, from = {}, goal = STATES[0];
    var capA = [0, 0, 0, 0], capFrom = [0, 0, 0, 0], capTo = [0, 0, 0, 0];
    copyState(cur, goal);
    copyState(from, goal);

    function copyState(dst, src) { for (var q = 0; q < KEYS.length; q++) dst[KEYS[q]] = src[KEYS[q]]; }

    /* ---- layout for the current size ---- */
    function layout() {
      narrow = W < 520;
      sc = clamp(W / 800, 0.6, 1.25);
      r = 1.4 * sc;
      pad = Math.max(8, Math.round(W * 0.02));
      var bottom = full ? 30 : pad;           // room for the caption
      ox = pad; oy = pad; ow = W - pad * 2; oh = Math.max(10, H - pad - bottom);

      var key = narrow ? 'n' : 'w';
      model = models[key] || (models[key] = build(ctx.rand(SEED_MAP), N, narrow ? 2 : 4, narrow ? 6 : 3));
      wrong = full ? model.wrong : -1;
      var pts = model.pts, k;
      for (k = 0; k < N; k++) {
        MX[k] = ox + pts[k].x * ow;
        MY[k] = oy + pts[k].y * oh;
        isHub[k] = pts[k].hub ? 1 : 0;
      }

      // field: a jittered grid over the whole area. The wrong dot gets the grid cell nearest (0.62, 0.40).
      var fr = ctx.rand(SEED_FIELD);
      var cols = Math.max(1, Math.round(Math.sqrt(N * ow / oh))), rws = Math.ceil(N / cols), total = cols * rws;
      var slots = [];
      for (k = 0; k < total; k++) slots.push(k);
      for (k = total - 1; k > 0; k--) {
        var j = Math.floor(fr() * (k + 1)), tmp = slots[k];
        slots[k] = slots[j]; slots[j] = tmp;
      }
      if (wrong >= 0) {
        var bestSlot = 0, bestD = 1e9;
        for (k = 0; k < total; k++) {
          var ddx = (k % cols + 0.5) / cols - 0.62, ddy = (Math.floor(k / cols) + 0.5) / rws - 0.4;
          if (ddx * ddx + ddy * ddy < bestD) { bestD = ddx * ddx + ddy * ddy; bestSlot = k; }
        }
        var at = slots.indexOf(bestSlot);
        slots[at] = slots[wrong]; slots[wrong] = bestSlot;
      }
      for (k = 0; k < N; k++) {
        var s = slots[k];
        FX[k] = ox + (((s % cols) + 0.5 + (fr() - 0.5) * 0.7) / cols) * ow;
        FY[k] = oy + ((Math.floor(s / cols) + 0.5 + (fr() - 0.5) * 0.7) / rws) * oh;
      }
    }

    /* ---- state ---- */
    function applyTargets() {
      var toMap = beat >= 1, k;
      for (k = 0; k < N; k++) { TX[k] = toMap ? MX[k] : FX[k]; TY[k] = toMap ? MY[k] : FY[k]; }
      goal = STATES[beat];
      for (k = 0; k < 4; k++) capTo[k] = (full && k === beat) ? 1 : 0;
    }

    function settle() {                       // jump to the current beat, no tween
      applyTargets();
      X.set(TX); Y.set(TY);
      copyState(cur, goal);
      for (var k = 0; k < 4; k++) capA[k] = capTo[k];
      tweening = false;
      routeDoneT = cur.route >= 0.999 ? performance.now() : 0;
    }

    function startTween(now) {
      copyState(from, cur);
      X0.set(X); Y0.set(Y);
      for (var k = 0; k < 4; k++) capFrom[k] = capA[k];
      applyTargets();
      routeDur = goal.route > cur.route ? ROUTE_MS : 900;
      t0 = now;
      tweening = true;
      routeDoneT = 0;
      kick();
    }

    function step(now) {
      if (!tweening) return;
      var el = now - t0, p = clamp(el / DUR, 0, 1), e = ease.out(p), k, q;
      for (k = 0; k < KEYS.length; k++) {
        if (KEYS[k] === 'route') continue;
        cur[KEYS[k]] = lerp(from[KEYS[k]], goal[KEYS[k]], e);
      }
      cur.route = lerp(from.route, goal.route, ease.inOut(clamp(el / routeDur, 0, 1)));
      for (k = 0; k < N; k++) {
        q = ease.out(clamp((el - delay[k]) / DUR, 0, 1));
        X[k] = X0[k] + (TX[k] - X0[k]) * q;
        Y[k] = Y0[k] + (TY[k] - Y0[k]) * q;
      }
      // old caption fades out first, the new one fades in after
      for (k = 0; k < 4; k++) {
        capA[k] = capTo[k] > capFrom[k]
          ? lerp(capFrom[k], capTo[k], clamp((p - 0.3) / 0.5, 0, 1))
          : lerp(capFrom[k], capTo[k], clamp(p / 0.3, 0, 1));
      }
      if (el >= DUR + SPREAD + 20) {
        X.set(TX); Y.set(TY);
        copyState(cur, goal);
        for (k = 0; k < 4; k++) capA[k] = capTo[k];
        tweening = false;
      }
      if (cur.route >= 0.999) { if (!routeDoneT) routeDoneT = now; } else routeDoneT = 0;
    }

    /* ---- draw ---- */
    function disc(x, y, rad) { g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }

    function draw(now) {
      if (!W || !H || !model) return;
      var k, e, a0 = lerp(DOT_ALPHA, DIM_ALPHA, cur.dim);
      g.clearRect(0, 0, W, H);

      var amp = (full && !paused) ? 0.7 * sc : 0;     // idle wobble, under 1px
      for (k = 0; k < N; k++) {
        if (amp) {
          DX[k] = X[k] + Math.sin(now * 0.0011 + phase[k]) * amp;
          DY[k] = Y[k] + Math.cos(now * 0.0009 + phase[k] * 1.7) * amp;
        } else { DX[k] = X[k]; DY[k] = Y[k]; }
      }

      // links
      if (cur.link > 0.004) {
        g.globalAlpha = LINK_ALPHA * cur.link * (1 - 0.75 * cur.dim);
        g.strokeStyle = col.soft; g.lineWidth = 1;
        g.beginPath();
        for (k = 0; k < model.edges.length; k++) {
          e = model.edges[k];
          g.moveTo(DX[e[0]], DY[e[0]]); g.lineTo(DX[e[1]], DY[e[1]]);
        }
        g.stroke();
      }

      // ordinary dots, one path
      g.globalAlpha = a0; g.fillStyle = col.ink;
      g.beginPath();
      for (k = 0; k < N; k++) {
        if (isHub[k] || k === wrong) continue;
        g.moveTo(DX[k] + r, DY[k]); g.arc(DX[k], DY[k], r, 0, TAU);
      }
      g.fill();

      // route line, and where its head is
      var rt = model.route, headX = 0, headY = 0, headOn = false;
      if (full && cur.route > 0.002 && rt.length > 1) {
        var segs = [], total = 0, s;
        for (s = 1; s < rt.length; s++) {
          var sl = Math.sqrt(Math.pow(DX[rt[s]] - DX[rt[s - 1]], 2) + Math.pow(DY[rt[s]] - DY[rt[s - 1]], 2));
          segs.push(sl); total += sl;
        }
        var left = total * cur.route;
        g.globalAlpha = 1 - 0.75 * cur.dim;
        g.strokeStyle = col.accent; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(DX[rt[0]], DY[rt[0]]);
        for (s = 0; s < segs.length; s++) {
          if (left >= segs[s]) { g.lineTo(DX[rt[s + 1]], DY[rt[s + 1]]); left -= segs[s]; }
          else {
            var tt = segs[s] ? left / segs[s] : 0;
            g.lineTo(lerp(DX[rt[s]], DX[rt[s + 1]], tt), lerp(DY[rt[s]], DY[rt[s + 1]], tt));
            break;
          }
        }
        g.stroke();

        // the small dot: at the head while the route draws, then it walks back and forth along the finished route
        var f = cur.route;
        if (cur.route >= 0.999 && !paused) {
          var u = ((now - (routeDoneT || now)) / 3200) % 2;
          f = 1 - ease.inOut(u < 1 ? u : 2 - u);
        }
        var dd = total * f;
        for (s = 0; s < segs.length; s++) {
          if (dd <= segs[s] || s === segs.length - 1) {
            var t2 = segs[s] ? clamp(dd / segs[s], 0, 1) : 0;
            headX = lerp(DX[rt[s]], DX[rt[s + 1]], t2); headY = lerp(DY[rt[s]], DY[rt[s + 1]], t2);
            break;
          }
          dd -= segs[s];
        }
        headOn = true;
      }

      // hubs
      var hr = r * (1 + 2 * cur.hub), hubA = lerp(1, DIM_ALPHA, cur.dim);
      for (k = 0; k < model.hubs.length; k++) {
        var hb = model.hubs[k];
        if (cur.hub < 0.999) { g.globalAlpha = a0 * (1 - cur.hub); g.fillStyle = col.ink; disc(DX[hb], DY[hb], hr); }
        if (cur.hub > 0.001) { g.globalAlpha = hubA * cur.hub; g.fillStyle = col.accent; disc(DX[hb], DY[hb], hr); }
      }

      // the wrong number
      if (wrong >= 0) {
        var wx = DX[wrong], wy = DY[wrong], wr = r * (1 + 0.8 * cur.alert);
        if (cur.alert < 0.999) { g.globalAlpha = a0 * (1 - cur.alert); g.fillStyle = col.ink; disc(wx, wy, wr); }
        if (cur.alert > 0.001) { g.globalAlpha = cur.alert; g.fillStyle = col.alert; disc(wx, wy, wr); }
        var rs = clamp(sc, 0.75, 1);
        g.strokeStyle = col.alert; g.lineWidth = 1.5;
        if (cur.ringP > 0.01) {                         // slow pulse
          var ph = (Math.sin(now / 650) + 1) / 2;
          g.globalAlpha = cur.ringP * (0.9 - ph * 0.6);
          g.beginPath(); g.arc(wx, wy, (5 + ph * 8) * rs, 0, TAU); g.stroke();
        }
        if (cur.ringS > 0.01) {                         // 14px ring, solid
          g.globalAlpha = cur.ringS;
          g.beginPath(); g.arc(wx, wy, lerp(6, 14, cur.ringS) * rs, 0, TAU); g.stroke();
        }
      }

      if (headOn) {
        var ha = 1 - cur.dim, hs = 3.2 * clamp(sc, 0.8, 1.1);
        g.globalAlpha = 0.9 * ha; g.fillStyle = col.paper; disc(headX, headY, hs + 1.5);
        g.globalAlpha = ha; g.fillStyle = col.accent; disc(headX, headY, hs);
      }

      // captions, bottom right
      if (full) {
        g.font = '12px Archivo, sans-serif'; g.fillStyle = col.muted;
        g.textAlign = 'right'; g.textBaseline = 'alphabetic';
        for (k = 0; k < 4; k++) {
          if (capA[k] > 0.01) { g.globalAlpha = capA[k]; g.fillText(CAPS[k], W - pad, H - 11); }
        }
      }
      g.globalAlpha = 1;
    }

    /* ---- running ---- */
    function loop(now) {
      raf = 0;
      step(now);
      draw(now);
      if (tweening || (full && !paused)) raf = requestAnimationFrame(loop);
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
      settle();                               // a resize redraws the current beat at once
      draw(performance.now());
    }

    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(el);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw(performance.now()); });
    measure();

    return {
      beats: BEATS,
      beatMs: 4200,
      loop: true,
      show: function (b, instant) {
        b = clamp(Math.round(b), 0, BEATS - 1);
        if (!instant && b === beat && !tweening) return;
        var now = performance.now();
        step(now);                            // so a move in flight starts the next one from where it is
        beat = b;
        if (!W || !H) return;                 // not measured yet. measure() applies this beat once it has a size
        if (instant || paused) { settle(); draw(now); }
        else startTween(now);
      },
      pause: function () {
        paused = true;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      },
      resume: function () {
        paused = false;
        if (full || tweening) kick();
      }
    };
  });
})();
