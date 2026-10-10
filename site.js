/* Talks photo lightbox: a tile opens its photo full size; the close button, the backdrop or Escape closes it. */

(function () {
  var lightbox = document.getElementById('lightbox');
  var lbImg = document.getElementById('lb-img');
  var lbMeta = document.getElementById('lb-meta');
  var lbTitle = document.getElementById('lb-title');
  var closeBtn = document.getElementById('lb-close');
  var tiles = document.querySelectorAll('.tile-photo');
  var opener = null;

  function openTile(tile) {
    var img = tile.querySelector('img');
    opener = tile;
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbMeta.textContent = tile.getAttribute('data-meta');
    lbTitle.textContent = tile.getAttribute('data-title');
    lightbox.hidden = false;
    closeBtn.focus();
  }

  function closeLightbox() {
    if (lightbox.hidden) { return; }
    lightbox.hidden = true;
    lbImg.removeAttribute('src');
    if (opener) { opener.focus(); }
  }

  Array.prototype.forEach.call(tiles, function (tile) {
    tile.addEventListener('click', function () { openTile(tile); });
  });
  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) { closeLightbox(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeLightbox(); }
  });
})();
