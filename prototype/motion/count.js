/* PROTOTYPE motion module: count. Throwaway: delete with the prototype folder.
   Light: each number counts up once. Full: an odometer roll, then the rule under each number draws in. */

(function () {
  var ROLL_MS = 1400;
  var STAGGER_MS = 120;
  var RULE_MS = 1200;
  var RULE_DELAY_MS = 300;
  var EASE = 'cubic-bezier(0.33, 1, 0.68, 1)';

  // A .count's rule is the single .count-rule in its nearest cell: the closest ancestor
  // that holds one count and one rule. Returns null when no such cell exists.
  function ruleFor(node, root) {
    var n = node.parentElement;
    while (n && root.contains(n)) {
      var rules = n.querySelectorAll('.count-rule');
      if (n.querySelectorAll('.count').length > 1 || rules.length > 1) return null;
      if (rules.length === 1) return rules[0];
      n = n.parentElement;
    }
    return null;
  }

  Motion.register('count', function (el, ctx) {
    var full = ctx.mode === 'full';
    var raf = 0;
    var timers = [];

    var items = Array.prototype.map.call(el.querySelectorAll('.count'), function (node) {
      var to = parseInt(node.dataset.to, 10) || 0;
      var prefix = node.dataset.prefix || '';
      var suffix = node.dataset.suffix || '';
      var final = prefix + to + suffix;
      node.setAttribute('aria-label', final);
      node.style.display = 'inline-block';
      node.style.minWidth = final.length + 'ch';
      node.style.fontVariantNumeric = 'tabular-nums';
      return { el: node, to: to, prefix: prefix, suffix: suffix, final: final, rule: ruleFor(node, el) };
    });

    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      timers.forEach(function (t) { clearTimeout(t); });
      timers = [];
    }

    function setRule(it, scale, transition) {
      if (!it.rule) return;
      it.rule.style.transition = transition || 'none';
      it.rule.style.transform = 'scaleX(' + scale + ')';
    }

    function countUp() {
      var start = null;
      raf = requestAnimationFrame(function frame(now) {
        if (start === null) start = now;
        var p = Math.min(1, (now - start) / ROLL_MS);
        var e = ctx.ease.out(p);
        items.forEach(function (it) {
          it.el.textContent = it.prefix + Math.round(it.to * e) + it.suffix;
        });
        if (p < 1) raf = requestAnimationFrame(frame);
      });
    }

    function roll() {
      items.forEach(function (it) {
        var digits = String(it.to).split('');
        it.el.textContent = '';
        it.el.appendChild(document.createTextNode(it.prefix));
        it.strips = digits.map(function (ch, i) {
          var cell = document.createElement('span');
          cell.style.cssText = 'display:inline-block;width:1ch;height:1em;overflow:hidden;line-height:1;vertical-align:top;text-align:center';
          var strip = document.createElement('span');
          strip.setAttribute('aria-hidden', 'true');
          strip.style.display = 'block';
          for (var d = 0; d < 10; d++) {
            var row = document.createElement('span');
            row.style.cssText = 'display:block;height:1em';
            row.textContent = String(d);
            strip.appendChild(row);
          }
          cell.appendChild(strip);
          it.el.appendChild(cell);
          return { el: strip, to: Number(ch), delay: (digits.length - 1 - i) * STAGGER_MS };
        });
        it.el.appendChild(document.createTextNode(it.suffix));
      });

      // Read a layout property so the strips and rules are at their start position before they move.
      void el.offsetWidth;

      items.forEach(function (it) {
        it.strips.forEach(function (s) {
          s.el.style.transition = 'transform ' + ROLL_MS + 'ms ' + EASE + ' ' + s.delay + 'ms';
          s.el.style.transform = 'translateY(' + (-s.to) + 'em)';
        });
        setRule(it, 1, 'transform ' + RULE_MS + 'ms ' + EASE + ' ' + RULE_DELAY_MS + 'ms');
        var total = (it.strips.length - 1) * STAGGER_MS + ROLL_MS;
        timers.push(setTimeout(function () { it.el.textContent = it.final; }, total));
      });
    }

    function show(beat, instant) {
      stop();
      if (beat === 0) {
        items.forEach(function (it) {
          it.el.textContent = it.prefix + '0' + it.suffix;
          setRule(it, 0);
        });
      } else if (instant) {
        items.forEach(function (it) {
          it.el.textContent = it.final;
          setRule(it, full ? 1 : 0);
        });
      } else if (full) {
        roll();
      } else {
        countUp();
      }
    }

    return {
      beats: 2,
      beatMs: 2400,
      loop: false,
      show: show,
      pause: function () {},
      resume: function () {}
    };
  });
})();
