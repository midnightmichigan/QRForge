/* QRForge app — 100% client-side, no network calls. */
(function () {
  'use strict';

  var QR = window.QRCode;
  if (!QR) {
    document.getElementById('error-line').textContent =
      'Engine failed to load (qrcode.js missing).';
    return;
  }

  var QUIET = 4;          // quiet-zone modules, fixed per best practice
  var PNG_SCALE = 1024;   // PNG export edge length in px

  // ------------------------------------------------------------ DOM refs
  function $(id) { return document.getElementById(id); }

  var els = {
    tabs: Array.prototype.slice.call(document.querySelectorAll('.tab')),
    panes: {
      url: $('pane-url'), wifi: $('pane-wifi'),
      contact: $('pane-contact'), email: $('pane-email')
    },
    url: $('in-url'), hintUrl: $('hint-url'),
    wifiSsid: $('wifi-ssid'), wifiPass: $('wifi-pass'),
    wifiSec: $('wifi-sec'), wifiHidden: $('wifi-hidden'),
    ctFirst: $('ct-first'), ctLast: $('ct-last'), ctPhone: $('ct-phone'),
    ctEmail: $('ct-email'), ctOrg: $('ct-org'), ctUrl: $('ct-url'),
    emTo: $('em-to'), emSubject: $('em-subject'), emBody: $('em-body'),
    ec: $('sel-ec'), fg: $('col-fg'), bg: $('col-bg'),
    contrast: $('contrast-note'),
    meta: $('meta-line'), error: $('error-line'),
    holder: $('qr-holder'), empty: $('qr-empty'),
    payload: $('payload-view'),
    btnSvg: $('btn-svg'), btnPng: $('btn-png'),
    btnClear: $('btn-clear'), btnCopy: $('btn-copy')
  };

  var state = { tab: 'url', text: '', version: 0, level: 'M', mask: 0, ok: false };

  // ------------------------------------------------------------ payload builders
  function escWifi(s) {
    return String(s).replace(/([\\;,":])/g, '\\$1');
  }

  function buildUrl() {
    var t = els.url.value.trim();
    if (!t) return { text: '', note: '' };
    // If it looks like a bare domain, assume https:// so phone cameras open it.
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t) && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) {
      return { text: 'https://' + t, note: '“https://” was added so scanners open it as a link.' };
    }
    return { text: t, note: '' };
  }

  function buildWifi() {
    var ssid = els.wifiSsid.value;
    var sec = els.wifiSec.value;
    if (!ssid.trim()) return { text: '', note: '' };
    return { text: 'WIFI:T:' + sec + ';S:' + escWifi(ssid) + ';' +
      (sec !== 'nopass' ? 'P:' + escWifi(els.wifiPass.value) + ';' : '') +
      (els.wifiHidden.checked ? 'H:true;' : '') + ';', note: '' };
  }

  function buildContact() {
    var fn = (els.ctFirst.value.trim() + ' ' + els.ctLast.value.trim()).trim();
    if (!fn && !els.ctPhone.value.trim() && !els.ctEmail.value.trim() &&
        !els.ctOrg.value.trim() && !els.ctUrl.value.trim()) {
      return { text: '', note: '' };
    }
    var lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    lines.push('N:' + els.ctLast.value.trim() + ';' + els.ctFirst.value.trim() + ';;;');
    lines.push('FN:' + fn);
    if (els.ctOrg.value.trim()) lines.push('ORG:' + els.ctOrg.value.trim());
    if (els.ctPhone.value.trim()) lines.push('TEL;TYPE=CELL:' + els.ctPhone.value.trim());
    if (els.ctEmail.value.trim()) lines.push('EMAIL:' + els.ctEmail.value.trim());
    if (els.ctUrl.value.trim()) lines.push('URL:' + els.ctUrl.value.trim());
    lines.push('END:VCARD');
    return { text: lines.join('\n'), note: '' };
  }

  function buildEmail() {
    var to = els.emTo.value.trim();
    if (!to) return { text: '', note: '' };
    var q = [];
    if (els.emSubject.value) q.push('subject=' + encodeURIComponent(els.emSubject.value));
    if (els.emBody.value) q.push('body=' + encodeURIComponent(els.emBody.value));
    return { text: 'mailto:' + to + (q.length ? '?' + q.join('&') : ''), note: '' };
  }

  var builders = { url: buildUrl, wifi: buildWifi, contact: buildContact, email: buildEmail };

  // ------------------------------------------------------------ color / contrast
  function lum(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255;
    var g = parseInt(hex.slice(3, 5), 16) / 255;
    var b = parseInt(hex.slice(5, 7), 16) / 255;
    function f(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function updateContrast() {
    var L1 = lum(els.fg.value), L2 = lum(els.bg.value);
    var ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    var el = els.contrast;
    if (ratio >= 4.5) {
      el.className = 'contrast ok';
      el.textContent = 'Contrast ' + ratio.toFixed(1) + ':1 — excellent for scanning.';
    } else if (ratio >= 3) {
      el.className = 'contrast ok';
      el.textContent = 'Contrast ' + ratio.toFixed(1) + ':1 — okay, but test-scan before printing.';
    } else {
      el.className = 'contrast bad';
      el.textContent = 'Contrast ' + ratio.toFixed(1) + ':1 — too low. Many scanners will fail. Use darker darks / lighter lights.';
    }
  }

  // ------------------------------------------------------------ render
  function render() {
    var built = builders[state.tab]();
    els.hintUrl.textContent = built.note || '';
    els.error.textContent = '';
    state.ok = false;
    els.btnSvg.disabled = true;
    els.btnPng.disabled = true;

    if (!built.text) {
      els.holder.innerHTML = '';
      els.empty.style.display = '';
      els.meta.textContent = 'Enter something to forge a code.';
      els.payload.textContent = '';
      return;
    }

    var bytes = QR._utf8Bytes(built.text);
    var level = els.ec.value;
    var maxBytes = QR.byteCapacity(20, level);
    if (bytes.length > maxBytes) {
      els.holder.innerHTML = '';
      els.empty.style.display = '';
      els.meta.textContent = 'Too long for a QR code.';
      els.payload.textContent = built.text;
      els.error.textContent = 'Too long: ' + bytes.length + ' bytes, but the largest QR code ' +
        '(version 40 is unsupported; this forge supports up to version 20) holds at most ' +
        maxBytes + ' bytes at error-correction level ' + level + '. Shorten the text, or ' +
        'use a lower error-correction level.';
      return;
    }

    var r;
    try {
      r = QR.encode(built.text, level);
    } catch (e) {
      els.error.textContent = 'Could not encode: ' + e.message;
      return;
    }

    state.text = built.text;
    state.version = r.version;
    state.level = level;
    state.mask = r.mask;
    state.ok = true;

    var fg = els.fg.value, bg = els.bg.value;
    var svg = QR.toSVG(r, { fg: fg, bg: bg, quiet: QUIET });
    // Force the SVG to scale to its container.
    svg = svg.replace('<svg ', '<svg style="width:100%;height:auto;" ');
    els.holder.innerHTML = svg;
    els.empty.style.display = 'none';
    els.meta.textContent = 'Version ' + r.version + ' (' + r.size + '×' + r.size +
      ' modules) · level ' + level + ' · ' + bytes.length + ' bytes · static';
    els.payload.textContent = built.text;
    els.btnSvg.disabled = false;
    els.btnPng.disabled = false;
  }

  var raf = null;
  function scheduleRender() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () { raf = null; render(); });
  }

  // ------------------------------------------------------------ downloads
  function download(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function svgString() {
    var r = QR.encode(state.text, state.level);
    return QR.toSVG(r, { fg: els.fg.value, bg: els.bg.value, quiet: QUIET });
  }

  els.btnSvg.addEventListener('click', function () {
    if (!state.ok) return;
    download(new Blob([svgString()], { type: 'image/svg+xml' }), 'qrforge-code.svg');
  });

  els.btnPng.addEventListener('click', function () {
    if (!state.ok) return;
    var r = QR.encode(state.text, state.level);
    var cell = Math.max(1, Math.floor(PNG_SCALE / (r.size + QUIET * 2)));
    var px = (r.size + QUIET * 2) * cell;
    var canvas = document.createElement('canvas');
    canvas.width = px; canvas.height = px;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = els.bg.value;
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = els.fg.value;
    for (var y = 0; y < r.size; y++) {
      for (var x = 0; x < r.size; x++) {
        if (r.modules[y][x]) {
          ctx.fillRect((x + QUIET) * cell, (y + QUIET) * cell, cell, cell);
        }
      }
    }
    canvas.toBlob(function (blob) {
      if (blob) download(blob, 'qrforge-code.png');
    }, 'image/png');
  });

  // ------------------------------------------------------------ misc actions
  els.btnCopy.addEventListener('click', function () {
    var t = builders[state.tab]().text;
    if (!t) return;
    function done() {
      els.btnCopy.textContent = 'Copied!';
      setTimeout(function () { els.btnCopy.textContent = 'Copy payload'; }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
      done();
    }
  });

  els.btnClear.addEventListener('click', function () {
    var inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea');
    Array.prototype.forEach.call(inputs, function (i) { i.value = ''; });
    els.wifiHidden.checked = false;
    render();
  });

  // ------------------------------------------------------------ wiring
  els.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      els.tabs.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.tab = tab.getAttribute('data-tab');
      Object.keys(els.panes).forEach(function (k) {
        els.panes[k].classList.toggle('active', k === state.tab);
      });
      render();
    });
  });

  var inputs = document.querySelectorAll('input, textarea, select');
  Array.prototype.forEach.call(inputs, function (el) {
    el.addEventListener('input', scheduleRender);
    el.addEventListener('change', scheduleRender);
  });
  els.fg.addEventListener('input', updateContrast);
  els.bg.addEventListener('input', updateContrast);

  updateContrast();
  render();
})();
