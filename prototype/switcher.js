/* PROTOTYPE switcher. A floating bar that cycles between the variant pages.
   Arrow buttons or the left and right arrow keys. Delete with the prototype folder. */

(function () {
  if (location.search.indexOf('noswitcher') !== -1) return; // clean screenshots

  var VARIANTS = [
    { file: 'variant-a.html', label: 'A · Ledger' },
    { file: 'variant-b.html', label: 'B · Stage' },
    { file: 'variant-c.html', label: 'C · Index' },
    { file: 'variant-d.html?motion=light', label: 'D · Light motion' },
    { file: 'variant-d.html?motion=full', label: 'D · Full motion' }
  ];

  var motion = new URLSearchParams(location.search).get('motion');
  var current = location.pathname.split('/').pop() + (motion ? '?motion=' + motion : '');
  if (current === 'variant-d.html') current = 'variant-d.html?motion=light';
  var index = VARIANTS.findIndex(function (v) { return v.file === current; });
  if (index < 0) index = 0;

  function go(step) {
    var next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length];
    location.href = next.file;
  }

  var bar = document.createElement('div');
  bar.setAttribute('role', 'navigation');
  bar.setAttribute('aria-label', 'Prototype variants');
  bar.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:20px', 'transform:translateX(-50%)',
    'z-index:9999', 'display:flex', 'align-items:center', 'gap:4px',
    'padding:6px', 'background:#16150f', 'color:#fafaf6', 'border-radius:999px',
    'box-shadow:0 6px 24px rgba(0,0,0,0.28)', 'font:600 13px/1 Archivo, sans-serif'
  ].join(';');

  function button(text, label, step) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.setAttribute('aria-label', label);
    b.style.cssText = 'width:44px;height:44px;border:0;border-radius:999px;background:#2242e8;color:#fafaf6;font:700 18px/1 Archivo, sans-serif;cursor:pointer';
    b.addEventListener('click', function () { go(step); });
    return b;
  }

  var name = document.createElement('span');
  name.textContent = VARIANTS[index].label + '  (' + (index + 1) + '/' + VARIANTS.length + ')';
  name.style.cssText = 'padding:0 14px;white-space:nowrap';

  bar.appendChild(button('←', 'Previous variant', -1));
  bar.appendChild(name);
  bar.appendChild(button('→', 'Next variant', 1));
  document.body.appendChild(bar);

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });
})();
