/* Motion: booking curve.
   Registers 'curve'. Full mode: 4 beats, loops. Light mode: 2 beats, plays once. */

(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var FONT = 'Archivo, sans-serif';
  var EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var ASPECT = 1.6;   // width : height, used only when the container has no height yet
  var TODAY = 0.65;   // where the "today" line sits along the x axis
  var SPLIT = 0.45;   // where the second dotted line sits
  var idCounter = 0;

  // Share of the night booked (0 to 1) at x. x = 0 is 12 weeks out, x = 1 is the night.
  function bookedShare(x) { return 0.04 + 0.88 * Math.pow(x, 2.5); }

  // The ML forecast. Only used to place the blend line.
  function mlShare(x) { return 0.04 + 0.9 * Math.pow(x, 1.7); }

  // The blend starts on the booked curve at "today" and reaches halfway to the ML forecast by the night.
  function blendShare(x) {
    var along = (x - TODAY) / (1 - TODAY);
    return bookedShare(x) + 0.5 * along * (mlShare(x) - bookedShare(x));
  }

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

  // Points along fn from x0 to x1, in SVG coordinates inside the plot box.
  function curvePoints(fn, x0, x1, steps, plot) {
    var points = [];
    for (var i = 0; i <= steps; i++) {
      var x = x0 + (x1 - x0) * i / steps;
      points.push([plot.left + x * plot.width, plot.bottom - fn(x) * plot.height]);
    }
    return points;
  }

  function pointsToPath(points) {
    var d = '';
    for (var i = 0; i < points.length; i++) {
      d += (i ? 'L' : 'M') + points[i][0].toFixed(2) + ' ' + points[i][1].toFixed(2);
    }
    return d;
  }

  function polylineLength(points) {
    var total = 0;
    for (var i = 1; i < points.length; i++) {
      var dx = points[i][0] - points[i - 1][0];
      var dy = points[i][1] - points[i - 1][1];
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
  }

  // Writes property values to nodes. Each item is { node, prop, value, ms, delay }.
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

  Motion.register('curve', function (el, ctx) {
    var full = ctx.mode === 'full';
    var svg = null;
    var drawn = null;     // everything except the axes; fades out on the loop reset
    var nodes = {};       // animated nodes, by name
    var lengths = {};     // stroke lengths, by name
    var built = null;     // container size the SVG was last built for
    var beat = 0;
    var resetTimer = null;

    function containerSize() {
      var w = el.clientWidth || 480;
      return { w: w, h: el.clientHeight || Math.round(w / ASPECT) };
    }

    // The state each animated node should be in at a given beat.
    function targetsFor(b) {
      var items = [];
      function add(node, prop, value, ms, delay) {
        if (node) items.push({ node: node, prop: prop, value: value, ms: ms, delay: delay || 0 });
      }
      add(nodes.today, 'opacity', b >= 1 ? 1 : 0, 900);
      add(nodes.solid, 'stroke-dashoffset', (b >= 1 ? 0 : lengths.solid) + 'px', 1300);
      add(nodes.dot, 'opacity', b >= 1 ? 1 : 0, 400, 1200);
      if (full) {
        add(nodes.zones, 'opacity', b >= 2 ? 1 : 0, 1000);
        add(nodes.reveal, 'transform', 'scaleX(' + (b >= 1 ? 1 : 0) + ')', 1100, 1300);
        add(nodes.blend, 'stroke-dashoffset', (b >= 3 ? 0 : lengths.blend) + 'px', 1300);
        add(nodes.caption, 'opacity', b >= 3 ? 1 : 0, 900, 500);
      }
      return items;
    }

    function buildSvg() {
      var size = containerSize();
      var c = ctx.colors();
      var plot = { left: 30, right: size.w - 14, top: 30, bottom: size.h - 30 };
      plot.width = plot.right - plot.left;
      plot.height = plot.bottom - plot.top;
      var todayX = plot.left + TODAY * plot.width;
      var splitX = plot.left + SPLIT * plot.width;

      built = size;
      clearTimeout(resetTimer);
      if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
      nodes = {};
      lengths = {};

      svg = createSvgEl('svg', {
        viewBox: '0 0 ' + size.w + ' ' + size.h, width: '100%', height: '100%', 'aria-hidden': 'true'
      }, el);
      svg.style.display = 'block';

      // Axes stay visible at every beat.
      var axes = createSvgEl('g', {}, svg);
      createSvgEl('line', {
        x1: plot.left, x2: plot.right, y1: plot.bottom + 0.5, y2: plot.bottom + 0.5,
        stroke: c.soft, 'stroke-width': 1
      }, axes);
      addText(axes, '0', 0, plot.bottom + 4, 'start', c.muted);
      addText(axes, 'all', 0, plot.top + 4, 'start', c.muted);
      addText(axes, '12 weeks out', plot.left, size.h - 10, 'start', c.muted);
      addText(axes, 'the night', plot.right, size.h - 10, 'end', c.muted);

      drawn = createSvgEl('g', {}, svg);

      // Zones sit first so they stay behind the curve.
      if (full) {
        nodes.zones = createSvgEl('g', {}, drawn);
        createSvgEl('rect', {
          x: plot.left, y: plot.top, width: splitX - plot.left, height: plot.height,
          fill: c.accentSoft, 'fill-opacity': 0.35
        }, nodes.zones);
        createSvgEl('rect', {
          x: splitX, y: plot.top, width: plot.right - splitX, height: plot.height,
          fill: c.soft, 'fill-opacity': 0.3
        }, nodes.zones);
        createSvgEl('line', {
          x1: splitX, x2: splitX, y1: plot.top, y2: plot.bottom,
          stroke: c.muted, 'stroke-width': 1, 'stroke-dasharray': '2 4'
        }, nodes.zones);
        addText(nodes.zones, 'ML better', plot.left + 8, plot.top + 14, 'start', c.ink);
        addText(nodes.zones, 'curve better', splitX + 8, plot.top + 14, 'start', c.ink);
      }

      nodes.today = createSvgEl('g', {}, drawn);
      createSvgEl('line', {
        x1: todayX, x2: todayX, y1: plot.top, y2: plot.bottom,
        stroke: c.muted, 'stroke-width': 1, 'stroke-dasharray': '2 4'
      }, nodes.today);
      addText(nodes.today, 'today', todayX + 6, plot.bottom - 6, 'start', c.muted);

      // Solid curve: the whole curve in light mode, the part up to "today" in full mode.
      var solidPoints = curvePoints(bookedShare, 0, full ? TODAY : 1, full ? 60 : 90, plot);
      lengths.solid = polylineLength(solidPoints) + 1;
      nodes.solid = createSvgEl('path', {
        d: pointsToPath(solidPoints), fill: 'none', stroke: c.ink, 'stroke-width': 2.5,
        'stroke-linejoin': 'round', 'stroke-dasharray': lengths.solid + ' ' + lengths.solid
      }, drawn);

      if (full) {
        // The forecast part is dashed. A clip rectangle that grows from "today" reveals it left to right.
        var clipId = 'curve-reveal-' + (++idCounter);
        var defs = createSvgEl('defs', {}, svg);
        var clip = createSvgEl('clipPath', { id: clipId }, defs);
        nodes.reveal = createSvgEl('rect', { x: todayX, y: 0, width: size.w - todayX, height: size.h }, clip);
        nodes.reveal.style.transformOrigin = todayX + 'px 0px';
        createSvgEl('path', {
          d: pointsToPath(curvePoints(bookedShare, TODAY, 1, 60, plot)), fill: 'none', stroke: c.ink,
          'stroke-width': 2.5, 'stroke-dasharray': '5 5', 'clip-path': 'url(#' + clipId + ')'
        }, drawn);

        var blendPoints = curvePoints(blendShare, TODAY, 1, 60, plot);
        lengths.blend = polylineLength(blendPoints) + 1;
        nodes.blend = createSvgEl('path', {
          d: pointsToPath(blendPoints), fill: 'none', stroke: c.accent, 'stroke-width': 2.5,
          'stroke-linejoin': 'round', 'stroke-dasharray': lengths.blend + ' ' + lengths.blend
        }, drawn);
      }

      nodes.dot = createSvgEl('circle', {
        cx: todayX, cy: plot.bottom - bookedShare(TODAY) * plot.height, r: 3.5, fill: c.ink
      }, drawn);

      if (full) {
        nodes.caption = addText(drawn, 'In production: the average of both', plot.right, 18, 'end', c.ink, 13);
      }

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
