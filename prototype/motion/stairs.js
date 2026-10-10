/* PROTOTYPE motion module: stair steps. Throwaway: delete with the prototype folder.
   Registers 'stairs'. Full mode: 5 beats, loops. Light mode: 2 beats, plays once. */

(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var FONT = 'Archivo, sans-serif';
  var EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var HEIGHTS = [0.35, 0.55, 0.75, 0.95];   // share of the container height, one per step
  var GAP = 12;

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

  // Step blocks across the full width, bottom-aligned on the baseline (one pixel above the bottom edge).
  function stepBoxes(w, h) {
    var boxes = [];
    var width = (w - GAP * (HEIGHTS.length - 1)) / HEIGHTS.length;
    for (var i = 0; i < HEIGHTS.length; i++) {
      var base = h - 1;
      boxes.push({ left: i * (width + GAP), width: width, base: base, top: base - h * HEIGHTS[i] });
    }
    return boxes;
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

  Motion.register('stairs', function (el, ctx) {
    var full = ctx.mode === 'full';
    var svg = null;
    var drawn = null;        // steps, stair line and numbers; fades out on the loop reset
    var colors = null;
    var rises = [];          // full mode: one { group, topLine } per step
    var numbers = [];        // "01" to "04", one per step
    var stairLine = null;    // light mode: one polyline along the step tops
    var lineLength = 1;
    var built = null;        // container size the SVG was last built for
    var beat = 0;
    var resetTimer = null;

    function containerSize() {
      return { w: el.clientWidth || 600, h: el.clientHeight || 140 };
    }

    // The state each animated node should be in at a given beat.
    function targetsFor(b) {
      var items = [];
      var i;
      function add(node, prop, value, ms, delay) {
        if (node) items.push({ node: node, prop: prop, value: value, ms: ms, delay: delay || 0 });
      }
      if (full) {
        for (i = 0; i < rises.length; i++) {
          var rose = b >= i + 1;
          var active = b === i + 1;   // the step that rose on this beat keeps an accent top line
          add(rises[i].group, 'transform', 'scaleY(' + (rose ? 1 : 0) + ')', 1000);
          add(rises[i].topLine, 'stroke', active ? colors.accent : colors.ink, 500);
          add(rises[i].topLine, 'stroke-width', active ? '3px' : '2px', 500);
          add(numbers[i], 'opacity', rose ? 1 : 0, 800, 350);
        }
      } else {
        add(stairLine, 'stroke-dashoffset', (b >= 1 ? 0 : lineLength) + 'px', 1400);
        for (i = 0; i < numbers.length; i++) {
          add(numbers[i], 'opacity', b >= 1 ? 1 : 0, 700, 200 + i * 300);
        }
      }
      return items;
    }

    function buildSvg() {
      var size = containerSize();
      var boxes = stepBoxes(size.w, size.h);
      var i;
      colors = ctx.colors();
      built = size;
      clearTimeout(resetTimer);
      if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
      rises = [];
      numbers = [];
      stairLine = null;

      svg = createSvgEl('svg', {
        viewBox: '0 0 ' + size.w + ' ' + size.h, width: '100%', height: '100%', 'aria-hidden': 'true'
      }, el);
      svg.style.display = 'block';

      // The baseline is the only thing visible at beat 0.
      createSvgEl('line', {
        x1: 0, x2: size.w, y1: size.h - 0.5, y2: size.h - 0.5, stroke: colors.soft, 'stroke-width': 1
      }, svg);

      drawn = createSvgEl('g', {}, svg);

      if (full) {
        for (i = 0; i < boxes.length; i++) {
          var box = boxes[i];
          var group = createSvgEl('g', {}, drawn);
          group.style.transformOrigin = (box.left + box.width / 2) + 'px ' + box.base + 'px';
          createSvgEl('rect', {
            x: box.left, y: box.top, width: box.width, height: box.base - box.top,
            fill: colors.soft, 'fill-opacity': 0.25
          }, group);
          var topLine = createSvgEl('line', {
            x1: box.left, x2: box.left + box.width, y1: box.top, y2: box.top,
            stroke: colors.ink, 'stroke-width': 2
          }, group);
          rises.push({ group: group, topLine: topLine });
        }
      } else {
        // One line along the step tops, joined by short verticals at each step edge.
        var points = [[boxes[0].left, boxes[0].top]];
        for (i = 0; i < boxes.length; i++) {
          points.push([boxes[i].left + boxes[i].width, boxes[i].top]);
          if (i < boxes.length - 1) {
            points.push([boxes[i].left + boxes[i].width, boxes[i + 1].top]);
            points.push([boxes[i + 1].left, boxes[i + 1].top]);
          }
        }
        lineLength = polylineLength(points) + 1;
        stairLine = createSvgEl('path', {
          d: pointsToPath(points), fill: 'none', stroke: colors.ink, 'stroke-width': 2,
          'stroke-dasharray': lineLength + ' ' + lineLength
        }, drawn);
      }

      // Numbers sit just under each top edge, at the left. The tallest step leaves no room above it.
      for (i = 0; i < boxes.length; i++) {
        numbers.push(addText(drawn, '0' + (i + 1), boxes[i].left + 10, boxes[i].top + 18,
          'start', colors.ink, 12, 700));
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
      beats: full ? 5 : 2,
      beatMs: 2600,
      loop: full,
      show: show,
      // Nothing idles in this module, so pausing and resuming do nothing.
      pause: function () {},
      resume: function () {}
    };
  });
})();
