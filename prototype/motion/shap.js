/* PROTOTYPE motion module: forecast waterfall. Throwaway: delete with the prototype folder.
   Registers 'shap'. Full mode: 4 beats, loops. Light mode: 2 beats, plays once. */

(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var FONT = 'Archivo, sans-serif';
  var EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var LABELS = ['Starting point', 'Last 7 days', 'On the books, revenue', 'On the books, rooms', "Hotel's average"];

  // Input bars, top to bottom. Each starts where the bar above it ended.
  // Values are shares of the forecast width (1.00). The rooms bar ends at 1.03,
  // so the average bar steps back from 1.03 to 1.00.
  var BARS = [
    { from: 0, to: 0.26, kind: 'start' },
    { from: 0.26, to: 0.72, kind: 'up' },
    { from: 0.72, to: 0.91, kind: 'up' },
    { from: 0.91, to: 1.03, kind: 'up' },
    { from: 1.03, to: 1.0, kind: 'average' }
  ];
  var WIDEST = 1.03;        // the plot's right edge sits here, so the rooms bar fits inside it
  var FORECAST_SLOT = 5.6;  // five input rows, a gap of 0.6 row, then the forecast row

  // Full mode: the beat each input bar appears in, and its delay in ms.
  var APPEARS = [
    { beat: 1, delay: 0 },
    { beat: 1, delay: 800 },
    { beat: 2, delay: 0 },
    { beat: 2, delay: 800 },
    { beat: 2, delay: 1600 }
  ];

  function createSvgEl(name, attrs, parent) {
    var node = document.createElementNS(SVG_NS, name);
    for (var key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) node.setAttribute(key, attrs[key]);
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function addText(parent, text, x, y, anchor, fill, size, weight) {
    var node = createSvgEl('text', {
      x: x, y: y, 'text-anchor': anchor, fill: fill,
      'font-family': FONT, 'font-size': size || 12, 'font-weight': weight || 400
    }, parent);
    node.textContent = text;
    return node;
  }

  // Width of a 12px label, measured with the page font when the browser allows it.
  var measurer;
  function textWidth(text, weight) {
    if (measurer === undefined) {
      var canvas = document.createElement('canvas');
      measurer = canvas.getContext ? canvas.getContext('2d') : null;
    }
    if (!measurer) return text.length * 6.4;
    measurer.font = (weight || 400) + ' 12px ' + FONT;
    return measurer.measureText(text).width;
  }

  // Splits a label into lines that fit maxWidth. Words only break between spaces.
  function wrapLines(text, maxWidth, weight) {
    var words = text.split(' ');
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var candidate = line ? line + ' ' + words[i] : words[i];
      if (line && textWidth(candidate, weight) > maxWidth) {
        lines.push(line);
        line = words[i];
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Geometry for a container of size w by h. The label column is about 26% of the width,
  // widened only when the longest label would not fit on a phone.
  function layoutFor(w, h) {
    var top = 26, bottom = 8, right = 12;   // top band holds the caption
    var longest = 0;
    for (var i = 0; i < LABELS.length; i++) longest = Math.max(longest, textWidth(LABELS[i], 400));
    var labelColumn = Math.max(0.26 * w, Math.min(longest + 10, 0.42 * w));
    var plotLeft = labelColumn + 4;
    var plotRight = w - right;
    var pitch = (h - top - bottom) / (5 + 0.6 + 1);
    return {
      labelWidth: labelColumn - 12,
      barHeight: Math.min(pitch * 0.5, 22),
      rowY: function (slot) { return top + pitch * (slot + 0.5); },
      x: function (share) { return plotLeft + share * (plotRight - plotLeft) / WIDEST; }
    };
  }

  function addLabel(parent, text, slot, weight, fill, layout) {
    var lines = wrapLines(text, layout.labelWidth, weight);
    var label = createSvgEl('text', {
      'font-family': FONT, 'font-size': 12, 'font-weight': weight, fill: fill
    }, parent);
    for (var k = 0; k < lines.length; k++) {
      var span = createSvgEl('tspan', {
        x: 0, y: (layout.rowY(slot) + 4 + (k - (lines.length - 1) / 2) * 13).toFixed(2)
      }, label);
      span.textContent = lines[k];
    }
  }

  // Sets property values on nodes. Each item is { node, prop, value, ms, delay }.
  // 'instant' jumps with no transition. 'rewind' makes every change a 300 ms fade (used going backwards).
  // 'advance' uses each item's own ms and delay.
  function writeState(items, mode) {
    var batches = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var batch = null;
      for (var j = 0; j < batches.length; j++) {
        if (batches[j].node === item.node) batch = batches[j];
      }
      if (!batch) {
        batch = { node: item.node, transitions: [], sets: [] };
        batches.push(batch);
      }
      var ms = mode === 'instant' ? 0 : mode === 'rewind' ? 300 : item.ms;
      if (ms) {
        var delay = mode === 'advance' ? item.delay : 0;
        batch.transitions.push(item.prop + ' ' + ms + 'ms ' + EASE_OUT + ' ' + delay + 'ms');
      }
      batch.sets.push([item.prop, item.value]);
    }
    for (var k = 0; k < batches.length; k++) {
      var b = batches[k];
      b.node.style.transition = b.transitions.length ? b.transitions.join(', ') : 'none';
      for (var m = 0; m < b.sets.length; m++) b.node.style.setProperty(b.sets[m][0], b.sets[m][1]);
    }
  }

  Motion.register('shap', function (el, ctx) {
    var full = ctx.mode === 'full';
    var svg = null;
    var drawn = null;          // bars, connectors, forecast outline and caption; fades on the loop reset
    var bars = [];
    var connectors = [];       // connectors[i] leads into the bar after bar i (the last one leads into the forecast)
    var forecastOutline = null;
    var outlineLength = 1;
    var caption = null;
    var built = null;          // container size the SVG was last built for
    var beat = 0;
    var resetTimer = null;

    function containerSize() {
      var w = el.clientWidth || 600;
      return { w: w, h: el.clientHeight || Math.round(w / (w >= 560 ? 3 : 4 / 3)) };
    }

    // The state each animated node should be in at a given beat.
    function targetsFor(b) {
      var items = [];
      var i;
      function add(node, prop, value, ms, delay) {
        if (node) items.push({ node: node, prop: prop, value: value, ms: ms, delay: delay || 0 });
      }
      if (!full) {
        // Light mode: every bar, connector and the forecast outline fade in together.
        for (i = 0; i < BARS.length; i++) {
          add(bars[i], 'opacity', b >= 1 ? 1 : 0, 1000);
          add(connectors[i], 'opacity', b >= 1 ? 1 : 0, 1000);
        }
        add(forecastOutline, 'opacity', b >= 1 ? 1 : 0, 1000);
        return items;
      }
      for (i = 0; i < BARS.length; i++) {
        var appears = APPEARS[i];
        add(bars[i], 'transform', 'scaleX(' + (b >= appears.beat ? 1 : 0) + ')', 1000, appears.delay);
        if (i > 0) add(connectors[i - 1], 'opacity', b >= appears.beat ? 1 : 0, 600, appears.delay);
      }
      add(forecastOutline, 'stroke-dashoffset', (b >= 3 ? 0 : outlineLength) + 'px', 1300);
      add(connectors[BARS.length - 1], 'opacity', b >= 3 ? 1 : 0, 800);
      add(caption, 'opacity', b >= 3 ? 1 : 0, 900, 500);
      return items;
    }

    function buildSvg() {
      var size = containerSize();
      var c = ctx.colors();
      var layout = layoutFor(size.w, size.h);
      var bh = layout.barHeight;
      var forecastY = layout.rowY(FORECAST_SLOT);
      var i;

      built = size;
      clearTimeout(resetTimer);
      if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
      bars = [];
      connectors = [];

      svg = createSvgEl('svg', {
        viewBox: '0 0 ' + size.w + ' ' + size.h, width: '100%', height: '100%', 'aria-hidden': 'true'
      }, el);
      svg.style.display = 'block';

      // Labels never animate.
      var labelGroup = createSvgEl('g', {}, svg);
      for (i = 0; i < BARS.length; i++) addLabel(labelGroup, LABELS[i], i, 400, c.muted, layout);
      addLabel(labelGroup, 'Forecast', FORECAST_SLOT, 600, c.ink, layout);

      drawn = createSvgEl('g', {}, svg);

      for (i = 0; i < BARS.length; i++) {
        var spec = BARS[i];
        var x1 = layout.x(spec.from);
        var x2 = layout.x(spec.to);
        var y = layout.rowY(i);
        var bar = createSvgEl('rect', {
          x: Math.min(x1, x2), y: y - bh / 2, width: Math.abs(x2 - x1), height: bh
        }, drawn);
        if (spec.kind === 'start') {
          bar.setAttribute('fill', c.accentSoft);
          bar.setAttribute('stroke', c.accent);
          bar.setAttribute('stroke-width', 1);
        } else if (spec.kind === 'up') {
          bar.setAttribute('fill', c.accent);
        } else {
          bar.setAttribute('fill', 'none');
          bar.setAttribute('stroke', c.accent);
          bar.setAttribute('stroke-width', 1.5);
        }
        // Bars grow from where they start.
        bar.style.transformOrigin = x1 + 'px ' + y + 'px';
        bars.push(bar);
      }

      for (i = 0; i < BARS.length; i++) {
        var edge = layout.x(BARS[i].to);
        var nextY = i < BARS.length - 1 ? layout.rowY(i + 1) : forecastY;
        connectors.push(createSvgEl('line', {
          x1: edge, x2: edge, y1: layout.rowY(i) + bh / 2, y2: nextY - bh / 2,
          stroke: c.soft, 'stroke-width': 1, 'stroke-dasharray': '3 3'
        }, drawn));
      }

      var left = layout.x(0);
      var right = layout.x(1);
      var top = forecastY - bh / 2;
      var bottom = forecastY + bh / 2;
      outlineLength = 2 * (right - left) + 2 * bh + 1;
      forecastOutline = createSvgEl('path', {
        d: 'M' + left + ' ' + top + 'H' + right + 'V' + bottom + 'H' + left + 'Z',
        fill: 'none', stroke: c.ink, 'stroke-width': 1.5,
        'stroke-dasharray': outlineLength + ' ' + outlineLength
      }, drawn);

      caption = full ? addText(drawn, 'Why the number moved', size.w - 12, 16, 'end', c.ink, 13) : null;

      writeState(targetsFor(beat), 'instant');
    }

    function show(target, instant) {
      if (!drawn) return;
      clearTimeout(resetTimer);
      var previous = beat;
      beat = target;
      var fade = drawn.style;
      if (instant) {
        fade.transition = 'none';
        fade.opacity = '1';
        writeState(targetsFor(target), 'instant');
        return;
      }
      if (target === 0 && previous !== 0) {
        // Loop reset: fade everything out quickly, then set beat 0 with no transition.
        fade.transition = 'opacity 300ms ease';
        fade.opacity = '0';
        resetTimer = setTimeout(function () {
          fade.transition = 'none';
          writeState(targetsFor(0), 'instant');
          fade.opacity = '1';
        }, 300);
        return;
      }
      fade.transition = 'opacity 300ms ease';
      fade.opacity = '1';
      writeState(targetsFor(target), target < previous ? 'rewind' : 'advance');
    }

    buildSvg();

    // Labels are wrapped with the real font widths, so rebuild once the font has loaded.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        buildSvg();
        show(beat, true);
      });
    }

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        var size = containerSize();
        if (Math.abs(size.w - built.w) > 0.5 || Math.abs(size.h - built.h) > 0.5) {
          buildSvg();
          show(beat, true);
        }
      }).observe(el);
    }

    return {
      beats: full ? 4 : 2,
      beatMs: 3800,
      loop: full,
      show: show,
      // Nothing idles in this module, so pausing and resuming do nothing.
      pause: function () {},
      resume: function () {}
    };
  });
})();
