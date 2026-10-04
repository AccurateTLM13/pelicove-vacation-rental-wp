/* All-Moh's-Paradise demo — progressive enhancements (no dependencies except optional Leaflet). */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TZ = 'America/Chicago';

  /* ---------- 1. Scroll reveal ---------- */
  function initReveal() {
    var sel = '.sbh-reveal, .sbh-reveal-stagger > .wp-block-column, .sbh-section-head, .sbh-card, .sbh-review, .wp-block-post-content > .alignfull .wp-block-columns';
    var els = Array.prototype.slice.call(document.querySelectorAll(sel));
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-visible'); }); return; }
    // v4.1: read every position first (one layout), then write classes. The old loop interleaved
    // getBoundingClientRect() with class changes, forcing a full re-layout per element (~1s TBT on mobile).
    var vh = window.innerHeight;
    var onScreen = els.map(function (e) { var r = e.getBoundingClientRect(); return r.top < vh && r.bottom > 0; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e, n) {
      var p = e.parentElement;
      if (p && p.classList.contains('sbh-reveal-stagger')) {
        var i = Array.prototype.indexOf.call(p.children, e);
        e.style.transitionDelay = (i * 90) + 'ms';
      }
      // Already on screen at load? show immediately (no flash)
      if (onScreen[n]) { e.classList.add('is-visible'); } else { io.observe(e); }
    });
    doc.classList.add('sbh-js-reveal');
  }

  /* ---------- 2. Header state on scroll ---------- */
  function initHeader() {
    var h = document.querySelector('.sbh-header-wrap');
    if (!h) return;
    var on = function () { h.classList.toggle('is-scrolled', window.scrollY > 24); };
    on(); window.addEventListener('scroll', on, { passive: true });
  }

  /* ---------- 3. Live weather + marine + sun ---------- */
  var WMO = {
    0: ['Clear sky', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
    45: ['Fog', '🌫️'], 48: ['Fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
    61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'], 66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
    71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 80: ['Rain showers', '🌦️'], 81: ['Rain showers', '🌧️'],
    82: ['Heavy showers', '⛈️'], 95: ['Thunderstorms', '⛈️'], 96: ['Thunderstorms', '⛈️'], 99: ['Thunderstorms', '⛈️']
  };
  function compass(deg) { return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((deg % 360) / 45)) % 8]; }
  function fmtTime(iso) { // iso local (America/Chicago) "2026-10-03T18:31"
    var t = iso.split('T')[1].split(':'); var h = +t[0], m = t[1];
    return ((h + 11) % 12 + 1) + ':' + m + (h < 12 ? ' AM' : ' PM');
  }
  function chicagoNowParts() {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    var o = {}; f.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  function minutesOfDay(iso) { var t = iso.split('T')[1].split(':'); return (+t[0]) * 60 + (+t[1]); }
  function initWeather() {
    var el = document.querySelector('[data-sbh-weather]');
    if (!el) return;
    var lat = el.getAttribute('data-lat'), lon = el.getAttribute('data-lon');
    var key = 'sbh-wx-' + lat + lon, cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) {}
    if (cached && Date.now() - cached.t < 15 * 60 * 1000) { render(cached.wx, cached.mx); return; }
    var wxUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago&forecast_days=5';
    var mxUrl = 'https://marine-api.open-meteo.com/v1/marine?latitude=30.21&longitude=-87.99' +
      '&current=wave_height,wave_period,wave_direction,sea_surface_temperature&length_unit=imperial&timezone=America%2FChicago';
    Promise.all([fetch(wxUrl).then(function (r) { return r.json(); }), fetch(mxUrl).then(function (r) { return r.json(); }).catch(function () { return null; })])
      .then(function (res) { try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), wx: res[0], mx: res[1] })); } catch (e) {} render(res[0], res[1]); })
      .catch(function () { el.innerHTML = '<p class="sbh-weather-error">Live conditions are unavailable right now. Check <a href="https://open-meteo.com/">Open-Meteo</a> or the NWS Mobile forecast.</p>'; });

    function render(wx, mx) {
      if (!wx || !wx.current) { el.innerHTML = '<p class="sbh-weather-error">Live conditions unavailable.</p>'; return; }
      var c = wx.current, dly = wx.daily, w = WMO[c.weather_code] || ['—', '🌡️'];
      var sea = mx && mx.current ? mx.current : null;
      var now = chicagoNowParts(), nowMin = (+now.hour % 24) * 60 + (+now.minute);
      var setMin = minutesOfDay(dly.sunset[0]), riseMin = minutesOfDay(dly.sunrise[0]);
      var sunMsg, sunPct;
      if (nowMin < riseMin) { sunMsg = 'Sunrise at ' + fmtTime(dly.sunrise[0]); sunPct = 0; }
      else if (nowMin < setMin) { var left = setMin - nowMin; sunMsg = 'Sunset in ' + (left >= 60 ? Math.floor(left / 60) + 'h ' : '') + (left % 60) + 'm'; sunPct = (nowMin - riseMin) / (setMin - riseMin); }
      else { sunMsg = 'Sun set at ' + fmtTime(dly.sunset[0]); sunPct = 1; }
      var arcX = 10 + 180 * sunPct, arcY = 70 - Math.sin(Math.PI * sunPct) * 58;
      var days = '';
      for (var i = 0; i < dly.time.length; i++) {
        var dd = new Date(dly.time[i] + 'T12:00:00'), dw = WMO[dly.weather_code[i]] || ['', '🌡️'];
        days += '<li><span class="d">' + (i === 0 ? 'Today' : dd.toLocaleDateString('en-US', { weekday: 'short' })) + '</span><span class="i" title="' + dw[0] + '">' + dw[1] + '</span><span class="t"><b>' + Math.round(dly.temperature_2m_max[i]) + '°</b> ' + Math.round(dly.temperature_2m_min[i]) + '°</span>' +
          (dly.precipitation_probability_max && dly.precipitation_probability_max[i] != null ? '<span class="p">' + dly.precipitation_probability_max[i] + '% rain</span>' : '') + '</li>';
      }
      var waterF = sea && sea.sea_surface_temperature != null ? Math.round(sea.sea_surface_temperature * 9 / 5 + 32) : null;
      el.innerHTML =
        '<div class="sbh-wx-now"><div class="sbh-wx-icon" aria-hidden="true">' + w[1] + '</div><div><div class="sbh-wx-temp">' + Math.round(c.temperature_2m) + '°<small>F</small></div><div class="sbh-wx-cond">' + w[0] + ' · feels ' + Math.round(c.apparent_temperature) + '°</div></div></div>' +
        '<dl class="sbh-wx-stats">' +
          '<div><dt>Wind</dt><dd>' + Math.round(c.wind_speed_10m) + ' mph ' + compass(c.wind_direction_10m) + '</dd></div>' +
          (sea && sea.wave_height != null ? '<div><dt>Waves</dt><dd>' + sea.wave_height.toFixed(1) + ' ft · ' + Math.round(sea.wave_period) + 's</dd></div>' : '') +
          (waterF ? '<div><dt>Gulf water</dt><dd>' + waterF + '°F</dd></div>' : '') +
          '<div><dt>UV max</dt><dd>' + Math.round(dly.uv_index_max[0]) + '</dd></div>' +
          '<div><dt>Humidity</dt><dd>' + c.relative_humidity_2m + '%</dd></div>' +
        '</dl>' +
        '<div class="sbh-wx-sun"><svg viewBox="0 0 200 80" aria-hidden="true"><path d="M10 70 Q100 -46 190 70" fill="none" stroke="currentColor" stroke-dasharray="3 5" opacity=".45"/><line x1="0" y1="70" x2="200" y2="70" stroke="currentColor" opacity=".3"/><circle cx="' + arcX.toFixed(1) + '" cy="' + arcY.toFixed(1) + '" r="8" fill="#F5BF1F"/></svg>' +
          '<div class="sbh-wx-sun-txt"><strong>' + sunMsg + '</strong><span>↑ ' + fmtTime(dly.sunrise[0]) + ' · ↓ ' + fmtTime(dly.sunset[0]) + '</span></div></div>' +
        '<ul class="sbh-wx-days">' + days + '</ul>' +
        '<p class="sbh-wx-src">Live data · <a href="https://open-meteo.com/">Open-Meteo</a> weather &amp; marine APIs · updated ' + fmtTime(c.time) + ' CT</p>';
      el.classList.add('is-loaded');
    }
  }

  /* ---------- 4. Lightbox (gallery + mosaic + "View all") ---------- */
  function initLightbox() {
    var sel = '.wp-block-gallery a[href$=".jpg"], .wp-block-gallery a[href$=".jpeg"], .wp-block-gallery a[href$=".png"], .wp-block-gallery a[href$=".webp"]';
    var links = Array.prototype.slice.call(document.querySelectorAll(sel)).filter(function (a) { return !a.closest('[data-lb-ref]'); });
    if (!links.length) return;
    var seen = {}, items = [];
    links.forEach(function (a) { var h = a.getAttribute('href'); if (seen[h] !== undefined) { a._lb = seen[h]; return; } var img = a.querySelector('img'); var fc = a.parentElement.querySelector('figcaption'); var room = a.closest('[data-room]'); seen[h] = items.length; a._lb = items.length; items.push({ src: a.href, alt: img ? img.alt : '', cap: (room ? room.getAttribute('data-room') + ' · ' : '') + (fc ? fc.textContent : (img ? img.alt : '')) }); });
    var box = document.createElement('div');
    box.className = 'sbh-lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Photo viewer'); box.setAttribute('data-lenis-prevent', ''); box.hidden = true;
    box.innerHTML = '<button class="sbh-lb-close" aria-label="Close photo viewer">×</button><button class="sbh-lb-prev" aria-label="Previous photo">‹</button><figure><img alt=""><figcaption><span class="sbh-lb-cap" aria-live="polite"></span><span class="sbh-lb-count"></span></figcaption></figure><button class="sbh-lb-next" aria-label="Next photo">›</button>';
    document.body.appendChild(box);
    var img = box.querySelector('img'), cap = box.querySelector('.sbh-lb-cap'), cnt = box.querySelector('.sbh-lb-count'), idx = 0, lastFocus = null;
    function show(i) {
      idx = (i + items.length) % items.length; var it = items[idx];
      box.classList.remove('is-ready'); img.onload = function () { box.classList.add('is-ready'); };
      img.src = it.src; img.alt = it.alt; cap.textContent = it.cap; cnt.textContent = (idx + 1) + ' / ' + items.length;
      [idx + 1, idx - 1].forEach(function (j) { var p = new Image(); p.src = items[(j + items.length) % items.length].src; });
    }
    function open(i) { lastFocus = document.activeElement; box.hidden = false; requestAnimationFrame(function () { box.classList.add('is-open'); }); doc.classList.add('sbh-lb-lock'); if (window.__lenis) window.__lenis.stop(); show(i || 0); box.querySelector('.sbh-lb-close').focus(); }
    function close() { box.classList.remove('is-open'); doc.classList.remove('sbh-lb-lock'); if (window.__lenis) window.__lenis.start(); setTimeout(function () { box.hidden = true; }, 200); if (lastFocus) lastFocus.focus(); }
    links.forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); open(a._lb); }); });
    document.querySelectorAll('[data-lb-ref] a[href]').forEach(function (a) { a.addEventListener('click', function (e) { var h = a.getAttribute('href'); if (seen[h] === undefined) return; e.preventDefault(); open(seen[h]); }); });
    document.querySelectorAll('[data-lb-all]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); open(0); }); });
    box.querySelector('.sbh-lb-close').onclick = close;
    box.querySelector('.sbh-lb-prev').onclick = function () { show(idx - 1); };
    box.querySelector('.sbh-lb-next').onclick = function () { show(idx + 1); };
    box.addEventListener('click', function (e) { if (e.target === box || e.target.tagName === 'FIGURE') close(); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(idx + 1); else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'Tab') { var f = box.querySelectorAll('button'); var first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    });
    var sx = null;
    box.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1)); sx = null; });
    window.sbhLightbox = { open: open, count: items.length };
  }

  /* ---------- 5. Trip countdown on the booking form ---------- */
  function initCountdown() {
    var out = document.querySelector('[data-sbh-countdown]');
    if (!out) return;
    var form = out.closest('form'), ci = form.querySelector('input[name="check-in"]'), co = form.querySelector('input[name="check-out"]');
    if (!ci) return;
    function todayCT() { var p = chicagoNowParts(); return new Date(p.year + '-' + p.month + '-' + p.day + 'T00:00:00'); }
    function upd() {
      if (!ci.value) { out.hidden = true; return; }
      var start = new Date(ci.value + 'T00:00:00'), days = Math.round((start - todayCT()) / 86400000);
      var nights = co && co.value ? Math.round((new Date(co.value + 'T00:00:00') - start) / 86400000) : null;
      if (co && !co.value) { var m = new Date(start.getTime() + 86400000); co.min = m.toISOString().slice(0, 10); }
      var head = days > 1 ? '<span class="sbh-cd-num">' + days + '</span> days until your beach trip' : days === 1 ? '<span class="sbh-cd-num">1</span> day to go — pack the sunscreen!' : days === 0 ? 'Your trip starts <strong>today</strong>! 🏖️' : 'That date is in the past — pick a future check-in.';
      var sub = [];
      if (nights !== null && nights > 0) sub.push(nights + (nights === 1 ? ' night' : ' nights'));
      if (nights !== null && nights <= 0) sub.push('Check-out must be after check-in');
      var mo = start.getMonth() + 1, dy = start.getDate();
      if ((mo === 3) || (mo === 4)) sub.push('Spring break rules apply (25+, in-person check-in)');
      if (mo === 11 || mo === 12 || mo === 1) sub.push('Monthly stays welcome this season');
      out.innerHTML = '<span class="sbh-cd-icon" aria-hidden="true">☀️</span><span><span class="sbh-cd-head">' + head + '</span>' + (sub.length ? '<span class="sbh-cd-sub">' + sub.join(' · ') + '</span>' : '') + '</span>';
      out.hidden = false;
    }
    ci.addEventListener('change', upd); ci.addEventListener('input', upd);
    if (co) { co.addEventListener('change', upd); co.addEventListener('input', upd); }
    upd();
  }

  /* ---------- 6. Leaflet map ---------- */
  function initMap() {
    var el = document.querySelector('[data-sbh-map]');
    if (!el || !window.L) return;
    var data = JSON.parse(el.getAttribute('data-sbh-map'));
    var c = data.area || data.house;
    var map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView([c.lat, c.lon], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    // Fictional demo: no house pin. Show only a broad, approximate area on Fort Morgan Road.
    var area = L.circle([c.lat, c.lon], { radius: c.radius || 2500, color: '#1F5E8C', weight: 2, dashArray: '6 6', fillColor: '#F5BF1F', fillOpacity: 0.16 }).addTo(map);
    area.bindTooltip(c.label || 'General area', { permanent: true, direction: 'top', className: 'sbh-house-tip' });
    var group = [[c.lat, c.lon]];
    data.pois.forEach(function (p) {
      var ic = L.divIcon({ className: 'sbh-pin sbh-pin-' + p.cat, html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
      L.marker([p.lat, p.lon], { icon: ic, title: p.name }).addTo(map).bindPopup('<strong>' + p.name + '</strong><br>≈ ' + p.mi + ' mi · ~' + p.min + ' min drive from the area');
      group.push([p.lat, p.lon]);
    });
    var near = data.pois.filter(function (p) { return p.mi < 8; }).map(function (p) { return [p.lat, p.lon]; });
    near.push([c.lat, c.lon]);
    map.fitBounds(L.latLngBounds(group), { padding: [30, 30] });
    var ctl = L.control({ position: 'topright' });
    ctl.onAdd = function () {
      var d = L.DomUtil.create('div', 'sbh-map-toggle');
      d.innerHTML = '<button type="button" data-z="near">Fort Morgan</button><button type="button" data-z="all" class="on">Whole coast</button>';
      L.DomEvent.disableClickPropagation(d);
      d.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        d.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        if (b.getAttribute('data-z') === 'near') map.flyToBounds(L.latLngBounds(near), { padding: [40, 40], duration: reduce ? 0 : 0.8 }); else map.flyToBounds(L.latLngBounds(group), { padding: [30, 30], duration: reduce ? 0 : 0.8 });
      });
      return d;
    };
    ctl.addTo(map);
    el.addEventListener('click', function () { map.scrollWheelZoom.enable(); });
  }

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  // v4.1.2: the live-weather widget is ~4,000 px down; start its two API calls only after the first paint (html.amp-p, see the inline head script).
  function afterPaint(fn) { var d = document.documentElement, done = false; function go() { if (!done) { done = true; fn(); } } if (d.classList.contains('amp-p')) return go(); window.addEventListener('amp:painted', go, { once: true }); setTimeout(go, 3500); }
  ready(function () { initHeader(); initReveal(); afterPaint(initWeather); initLightbox(); initCountdown(); initMap(); });
})();
