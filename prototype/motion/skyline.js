/* PROTOTYPE motion module: skyline. Throwaway: delete with the prototype folder.
   A quiet row of small hotel buildings along the bottom of the hero.
   Light: the buildings rise once. Full: rise, windows light in a wave, then a few windows blink. */

(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var PHONE_QUERY = '(max-width: 600px)';
  var BAND_PX = 110;
  var BAND_PHONE_PX = 80;
  var WIN_W = 2.5, WIN_H = 3.5, WIN_GAP = 3;
  var PAD_X = 3, PAD_TOP = 5, PAD_BOTTOM = 4;
  var RISE_MS = 600;
  var RISE_SPREAD_MS = 100;   // each rise takes 600 ms and the starts are spread over 100 ms, so the whole rise is 700 ms
  var RESET_MS = 300;
  var WAVE_MS = 1400;
  var LIT_MS = 400;
  var LIT_SHARE = 0.3;
  var BLINK_MS = 700;

  function svgEl(tag) { return document.createElementNS(NS, tag); }

  function rectEl(x, y, w, h, fill) {
    var r = svgEl('rect');
    r.setAttribute('x', x);
    r.setAttribute('y', y);
    r.setAttribute('width', w);
    r.setAttribute('height', h);
    r.style.fill = fill;
    return r;
  }

  Motion.register('skyline', function (el, ctx) {
    var full = ctx.mode === 'full';
    var phone = window.matchMedia(PHONE_QUERY);
    var svg = null;
    var colors = null;
    var buildings = [];   // one <g> per building, left to right
    var wins = [];        // { el, lit0, on, frac }: lit0 is the windows' final lit state, frac is x / width
    var cur = 0;
    var inView = false;
    var calmAt = 0;       // time after which the blinking may start (the wave is over by then)
    var blinker = null;
    var blinkWait = null;
    var lastW = -1, lastH = -1;

    function size() {
      el.style.height = (phone.matches ? BAND_PHONE_PX : BAND_PX) + 'px';
    }

    function build() {
      var W = el.clientWidth, H = el.clientHeight;
      var rnd = ctx.rand();
      var c = ctx.colors();
      lastW = W;
      lastH = H;
      colors = c;

      if (svg) svg.remove();
      svg = svgEl('svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.style.display = 'block';
      svg.style.width = '100%';
      svg.style.height = '100%';
      el.appendChild(svg);

      buildings = [];
      wins = [];
      var x = 0;
      while (x < W) {
        var bw = 14 + Math.round(rnd() * 20);
        var bh = H * (0.3 + rnd() * 0.7);
        var by = H - bh;
        var g = svgEl('g');
        g.style.transformBox = 'fill-box';
        g.style.transformOrigin = '50% 100%';
        g.style.transform = 'scaleY(0)';
        g.appendChild(rectEl(x, by, bw, bh, c.soft));
        if (rnd() < 0.2) g.appendChild(rectEl(x - 1, by, bw + 2, 1, c.ink));

        var cols = Math.floor((bw - 2 * PAD_X + WIN_GAP) / (WIN_W + WIN_GAP));
        var rows = Math.floor((bh - PAD_TOP - PAD_BOTTOM + WIN_GAP) / (WIN_H + WIN_GAP));
        var gridX = x + (bw - (cols * WIN_W + (cols - 1) * WIN_GAP)) / 2;
        for (var r = 0; r < rows; r++) {
          for (var k = 0; k < cols; k++) {
            var wx = gridX + k * (WIN_W + WIN_GAP);
            var win = rectEl(wx, by + PAD_TOP + r * (WIN_H + WIN_GAP), WIN_W, WIN_H, c.paper);
            g.appendChild(win);
            wins.push({ el: win, lit0: rnd() < LIT_SHARE, on: false, frac: wx / W });
          }
        }
        svg.appendChild(g);
        buildings.push(g);
        x += bw + 3 + Math.floor(rnd() * 6);
      }
    }

    function paint(w, on, transition) {
      w.on = on;
      w.el.style.transition = transition;
      w.el.style.fill = on ? colors.accent : colors.paper;
    }

    function reset(instant) {
      buildings.forEach(function (g) {
        g.style.transition = instant ? 'none' : 'transform ' + RESET_MS + 'ms ease-out';
        g.style.transform = 'scaleY(0)';
      });
      wins.forEach(function (w) {
        paint(w, false, instant ? 'none' : 'fill ' + RESET_MS + 'ms ease-out');
      });
    }

    function rise(instant) {
      var last = Math.max(1, buildings.length - 1);
      buildings.forEach(function (g, i) {
        var delay = Math.round(RISE_SPREAD_MS * i / last);
        g.style.transition = instant ? 'none' : 'transform ' + RISE_MS + 'ms ease-out ' + delay + 'ms';
        g.style.transform = 'scaleY(1)';
      });
      wins.forEach(function (w) { paint(w, false, 'none'); });
    }

    function lightUp(instant) {
      calmAt = instant ? 0 : Date.now() + WAVE_MS + LIT_MS;
      wins.forEach(function (w) {
        var delay = Math.round(WAVE_MS * w.frac);
        var t = instant ? 'none' : 'fill ' + LIT_MS + 'ms ease-out ' + delay + 'ms';
        paint(w, w.lit0, t);
      });
    }

    function blink() {
      if (!wins.length) return;
      for (var k = 0; k < 3; k++) {
        var w = wins[Math.floor(Math.random() * wins.length)];
        paint(w, !w.on, 'fill 600ms ease-in-out');
      }
    }

    function stopBlink() {
      clearTimeout(blinkWait);
      clearInterval(blinker);
      blinkWait = null;
      blinker = null;
    }

    function startBlink() {
      if (blinker || blinkWait || !inView || cur !== 2 || !wins.length) return;
      blinkWait = setTimeout(function () {
        blinkWait = null;
        blinker = setInterval(blink, BLINK_MS);
      }, Math.max(0, calmAt - Date.now()));
    }

    function show(beat, instant) {
      stopBlink();
      cur = beat;
      if (beat === 0) {
        reset(instant);
      } else if (beat === 1) {
        rise(instant);
      } else {
        rise(instant); // buildings must be up when jumping straight to the lit beat
        lightUp(instant);
        startBlink();
      }
    }

    size();
    build();
    if (phone.addEventListener) phone.addEventListener('change', size);
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        if (el.clientWidth === lastW && el.clientHeight === lastH) return;
        build();
        show(cur, true);
      }).observe(el);
    }

    return {
      beats: full ? 3 : 2,
      beatMs: 4200,
      loop: full,
      show: show,
      pause: function () { inView = false; stopBlink(); },
      resume: function () { inView = true; startBlink(); }
    };
  });
})();
