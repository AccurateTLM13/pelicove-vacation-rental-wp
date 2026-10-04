/* All-Moh's-Paradise — booking engine (vanilla JS, no deps)
 * Range-picker calendar · instant quote · sticky card · booking dialog · mobile bar · CF7 prefill.
 * Rules mirror wp-content/plugins/amp-booking (server re-validates via REST + CF7). */
(function () {
  'use strict';
  var CFG = window.AMP_BK;
  if (!CFG) return;
  var doc = document.documentElement;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = MONTHS.map(function (m) { return m.slice(0, 3); });
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ---------- date helpers (YYYY-MM-DD strings, UTC math) ---------- */
  function T(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function S(t) { return new Date(t).toISOString().slice(0, 10); }
  function add(s, n) { return S(T(s) + n * 864e5); }
  function diff(a, b) { return Math.round((T(b) - T(a)) / 864e5); }
  function ymd(y, m, d) { return S(Date.UTC(y, m, d)); }
  function fmt(s, long) { var d = new Date(T(s)); return (long ? DOW[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] : MON[d.getUTCMonth()]) + ' ' + d.getUTCDate() + (long ? ', ' + d.getUTCFullYear() : ''); }
  function money(n, cents) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }); }
  var TODAY = CFG.today;

  /* ---------- availability rules ---------- */
  var booked = {}, exampleNight = {};
  CFG.booked.forEach(function (r) { for (var d = r['in']; d < r.out; d = add(d, 1)) { booked[d] = true; if (r.ex) exampleNight[d] = true; } });
  function season(d) { var m = +d.slice(5, 7); for (var i = 0; i < CFG.seasons.length; i++) if (CFG.seasons[i].months.indexOf(m) > -1) return CFG.seasons[i]; return CFG.seasons[0]; }
  function seasonByKey(k) { for (var i = 0; i < CFG.seasons.length; i++) if (CFG.seasons[i].key === k) return CFG.seasons[i]; return CFG.seasons[0]; }
  function minN(d) { return +season(d).min; }
  function free(d) { return !booked[d]; }
  function runFree(a, n) { for (var i = 0; i < n; i++) if (booked[add(a, i)]) return false; return true; }
  function canIn(d) { return d >= TODAY && free(d) && runFree(d, minN(d)); }
  function canOut(ci, d) { var n = diff(ci, d); return n >= minN(ci) && n <= CFG.maxNights && runFree(ci, n); }
  function dayState(d) {
    if (d < TODAY) return 'past';
    var b = booked[d], bPrev = booked[add(d, -1)];
    if (b && bPrev) return 'booked';
    if (b) return 'co-only';
    if (!canIn(d)) return bPrev ? 'booked' : 'no-ci';
    if (bPrev) return 'ci-only';
    return 'avail';
  }
  var STATE_TXT = { past: 'in the past', booked: 'booked', 'co-only': 'check-out only', 'ci-only': 'check-in only', 'no-ci': 'no check-in — minimum stay not available', avail: 'available' };

  /* ---------- quote (same math as amp_bk_quote) ---------- */
  function quote(ci, co, guests) {
    if (!ci || !co) return null;
    var n = diff(ci, co); if (n < 1) return { error: 'Check-out must be after check-in.' };
    var se = season(ci);
    if (n < +se.min) return { error: se.name + ' stays have a ' + se.min + '-night minimum.' };
    if (!runFree(ci, n)) return { error: 'Some of those nights are already booked.' };
    var lines = {}, order = [], rent = 0;
    for (var i = 0; i < n; i++) { var d = add(ci, i), s = season(d); if (!lines[s.key]) { lines[s.key] = { season: s.name, nightly: +s.nightly, nights: 0 }; order.push(s.key); } lines[s.key].nights++; rent += +s.nightly; }
    var pct = n >= 28 ? CFG.monthly : (n >= 7 ? CFG.weekly : 0);
    var disc = Math.round(rent * pct) / 100, taxable = rent - disc + CFG.cleaning, tax = Math.round(taxable * CFG.tax) / 100;
    return { nights: n, guests: guests, lines: order.map(function (k) { return lines[k]; }), rent: rent, pct: pct, discount: disc, cleaning: CFG.cleaning, tax: tax, total: Math.round((taxable + tax) * 100) / 100 };
  }

  /* ---------- shared trip state ---------- */
  var store = { ci: null, co: null, adults: 2, children: 0, subs: [] };
  try { var saved = JSON.parse(sessionStorage.getItem('amp-trip') || 'null'); if (saved) { store.adults = saved.adults || 2; store.children = saved.children || 0; if (saved.ci && canIn(saved.ci)) { store.ci = saved.ci; if (saved.co && saved.co > saved.ci && canOut(saved.ci, saved.co)) store.co = saved.co; } } } catch (e) {}
  (function fromUrl() { var q = new URLSearchParams(location.search); var ci = q.get('check_in'), co = q.get('check_out'); if (ci && /^\d{4}-\d\d-\d\d$/.test(ci) && canIn(ci)) { store.ci = ci; store.co = co && co > ci && canOut(ci, co) ? co : null; } if (q.get('adults')) store.adults = Math.max(1, Math.min(8, +q.get('adults') || 2)); if (q.get('children') !== null) store.children = Math.max(0, Math.min(8 - store.adults, +q.get('children') || 0)); })();
  function guests() { return store.adults + store.children; }
  function set(p) { for (var k in p) store[k] = p[k]; try { sessionStorage.setItem('amp-trip', JSON.stringify({ ci: store.ci, co: store.co, adults: store.adults, children: store.children })); } catch (e) {} store.subs.forEach(function (f) { f(); }); doc.dispatchEvent(new CustomEvent('amp:trip', { detail: tripInfo() })); }
  function sub(f) { store.subs.push(f); }
  function tripInfo() { return { ci: store.ci, co: store.co, guests: guests(), adults: store.adults, children: store.children, quote: quote(store.ci, store.co, guests()) }; }
  function currentSeasonKey() { return doc.getAttribute('data-season') || 'summer'; }
  function fromPrice() { var k = currentSeasonKey(); var s = seasonByKey(k === 'snowbird' ? 'winter' : k); return s; }
  function requestUrl() { var u = new URL(CFG.contactUrl, location.href); if (store.ci) u.searchParams.set('check_in', store.ci); if (store.co) u.searchParams.set('check_out', store.co); u.searchParams.set('adults', store.adults); u.searchParams.set('children', store.children); return u.toString() + '#inquiry'; }
  var uid = 0;

  /* =================================================================
   * Calendar (range picker)
   * ================================================================= */
  function Calendar(el, opts) {
    opts = opts || {};
    var self = this; this.el = el; this.opts = opts; uid++;
    var start = store.ci || TODAY; this.view = { y: +start.slice(0, 4), m: +start.slice(5, 7) - 1 };
    this.focusDay = store.ci || TODAY; this.hover = null;
    el.classList.add('amp-cal'); if (opts.prices) el.classList.add('amp-cal--prices');
    el.innerHTML = '<div class="amp-cal-nav"><button type="button" class="amp-cal-prev" aria-label="Previous month"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" class="amp-cal-next" aria-label="Next month"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div><div class="amp-cal-months"></div>' +
      '<div class="amp-cal-foot"><p class="amp-cal-msg" aria-live="polite"></p><button type="button" class="amp-cal-clear">Clear dates</button></div>' +
      (opts.legend ? '<ul class="amp-cal-legend" aria-label="Calendar legend"><li><i class="lg-avail"></i>Available</li><li><i class="lg-booked"></i>Booked</li><li><i class="lg-ci"></i>Check-in only</li><li><i class="lg-co"></i>Check-out only</li><li><i class="lg-noci"></i>No check-in (min. stay)</li><li><i class="lg-sel"></i>Your dates</li></ul>' : '');
    this.monthsEl = el.querySelector('.amp-cal-months'); this.msg = el.querySelector('.amp-cal-msg');
    el.querySelector('.amp-cal-prev').addEventListener('click', function () { self.shift(-1); });
    el.querySelector('.amp-cal-next').addEventListener('click', function () { self.shift(1); });
    el.querySelector('.amp-cal-clear').addEventListener('click', function () { set({ ci: null, co: null }); self.say('Dates cleared. Select a check-in date.'); });
    this.monthsEl.addEventListener('click', function (e) { var b = e.target.closest('.amp-day'); if (b) self.pick(b.getAttribute('data-d')); });
    this.monthsEl.addEventListener('mouseover', function (e) { var b = e.target.closest('.amp-day'); var h = b ? b.getAttribute('data-d') : null; if (h !== self.hover) { self.hover = h; self.paintPreview(); } });
    this.monthsEl.addEventListener('mouseleave', function () { self.hover = null; self.paintPreview(); });
    this.monthsEl.addEventListener('keydown', function (e) { self.key(e); });
    this.monthsEl.addEventListener('focusin', function (e) { var b = e.target.closest('.amp-day'); if (b) { self.focusDay = b.getAttribute('data-d'); self.hover = self.focusDay; self.paintPreview(); } });
    sub(function () { self.render(); });
    if (window.ResizeObserver) new ResizeObserver(function () { var n = self.count(); if (n !== self._n) self.render(); }).observe(el);
    this.render();
  }
  Calendar.prototype.count = function () { var o = this.opts.months; if (o === 'auto') return this.el.clientWidth >= 560 ? 2 : 1; return o || 2; };
  Calendar.prototype.shift = function (n) {
    var y = this.view.y, m = this.view.m + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var min = { y: +TODAY.slice(0, 4), m: +TODAY.slice(5, 7) - 1 };
    if (y * 12 + m < min.y * 12 + min.m) return;
    if (y * 12 + m > min.y * 12 + min.m + 20) return;
    this.view = { y: y, m: m }; this.render();
  };
  Calendar.prototype.say = function (t) { this.msg.textContent = t; };
  Calendar.prototype.status = function () {
    if (!store.ci) { var s = season(TODAY); return 'Select your check-in date.'; }
    if (!store.co) return 'Check-in ' + fmt(store.ci) + '. Now select check-out — ' + season(store.ci).name + ' stays need at least ' + minN(store.ci) + ' nights.';
    var n = diff(store.ci, store.co); return n + ' nights · ' + fmt(store.ci) + ' – ' + fmt(store.co);
  };
  Calendar.prototype.render = function () {
    var n = this._n = this.count(), html = '', ci = store.ci, co = store.co, selecting = ci && !co;
    var tY = +TODAY.slice(0, 4), tM = +TODAY.slice(5, 7) - 1;
    this.el.querySelector('.amp-cal-prev').disabled = (this.view.y * 12 + this.view.m) <= (tY * 12 + tM);
    for (var k = 0; k < n; k++) {
      var y = this.view.y + Math.floor((this.view.m + k) / 12), m = (this.view.m + k) % 12;
      var first = new Date(Date.UTC(y, m, 1)).getUTCDay(), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      var gid = 'amp-cal-' + uid + '-' + k;
      html += '<div class="amp-month"><h3 class="amp-month-title" id="' + gid + '">' + MONTHS[m] + ' ' + y + '</h3><table role="grid" aria-labelledby="' + gid + '"><thead><tr>' + ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function (d, i) { return '<th scope="col" abbr="' + DOW[i] + '">' + d + '</th>'; }).join('') + '</tr></thead><tbody><tr>';
      for (var b = 0; b < first; b++) html += '<td role="presentation"></td>';
      for (var d = 1; d <= days; d++) {
        var s = ymd(y, m, d), st = dayState(s), cls = ['amp-day', 'is-' + st], dis = false, why = STATE_TXT[st];
        if (selecting) {
          if (s > ci) { if (canOut(ci, s)) { cls.push('is-valid-out'); why = 'available for check-out (' + diff(ci, s) + ' nights)'; } else { dis = true; cls.push('is-invalid-out'); why = diff(ci, s) < minN(ci) ? 'below the ' + minN(ci) + '-night minimum' : 'unavailable — stay would include booked nights'; } }
          else if (s === ci) { cls.push('is-start'); why = 'selected check-in'; }
          else dis = !canIn(s);
        } else dis = !canIn(s);
        if (ci && s === ci) cls.push('is-start');
        if (co && s === co) cls.push('is-end');
        if (ci && co && s > ci && s < co) cls.push('is-in-range');
        if (s === TODAY) cls.push('is-today');
        if (exampleNight[s]) cls.push('is-example');
        if ((first + d - 1) % 7 === 0 && ((first + d - 1) / 7) | 0) {}
        var price = this.opts.prices && st !== 'past' ? '<span class="amp-day-price">' + money(season(s).nightly) + '</span>' : '';
        html += '<td role="gridcell"' + ((s === ci || s === co) ? ' aria-selected="true"' : '') + '><button type="button" class="' + cls.join(' ') + '" data-d="' + s + '" tabindex="' + (s === this.focusDay ? 0 : -1) + '"' + (dis ? ' aria-disabled="true"' : '') + ' aria-label="' + d + (price ? ' ' + money(season(s).nightly) : '') + ', ' + fmt(s, true) + ' — ' + why + (exampleNight[s] ? ' (example booking)' : '') + '"><span class="amp-day-n">' + d + '</span>' + (price ? ' ' + price : '') + '</button></td>';
        if ((first + d) % 7 === 0 && d < days) html += '</tr><tr>';
      }
      html += '</tr></tbody></table></div>';
    }
    this.monthsEl.innerHTML = html; this.monthsEl.setAttribute('data-n', n);
    if (!this.monthsEl.querySelector('[tabindex="0"]')) { var f = this.monthsEl.querySelector('.amp-day:not([aria-disabled])') || this.monthsEl.querySelector('.amp-day'); if (f) f.tabIndex = 0; }
    this.say(this.status()); this.paintPreview();
  };
  Calendar.prototype.paintPreview = function () {
    var ci = store.ci, h = this.hover, ok = ci && !store.co && h && h > ci && canOut(ci, h);
    this.monthsEl.querySelectorAll('.amp-day').forEach(function (b) { var d = b.getAttribute('data-d'); b.classList.toggle('is-preview', !!(ok && d > ci && d <= h)); b.classList.toggle('is-preview-end', !!(ok && d === h)); });
  };
  Calendar.prototype.pick = function (d) {
    var ci = store.ci, co = store.co;
    if (ci && !co && d > ci) {
      if (canOut(ci, d)) { set({ co: d }); this.say(this.status()); if (this.opts.onDone) this.opts.onDone(); return; }
      var n = diff(ci, d);
      if (n < minN(ci)) { this.say(season(ci).name + ' stays need at least ' + minN(ci) + ' nights — pick ' + fmt(add(ci, minN(ci))) + ' or later.'); this.flash(d); return; }
      if (canIn(d)) { set({ ci: d, co: null }); return; }
      this.say('That range includes booked nights. Pick an earlier check-out.'); this.flash(d); return;
    }
    if (!canIn(d)) {
      var st = dayState(d);
      this.say(st === 'co-only' ? fmt(d) + ' is check-out only — someone arrives that day.' : st === 'no-ci' ? 'Can’t check in ' + fmt(d) + ': the open gap is shorter than the ' + minN(d) + '-night minimum.' : st === 'past' ? 'That date has passed.' : fmt(d) + ' is booked.');
      this.flash(d); return;
    }
    set({ ci: d, co: null });
  };
  Calendar.prototype.flash = function (d) { var b = this.monthsEl.querySelector('[data-d="' + d + '"]'); if (b) { b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake'); } };
  Calendar.prototype.key = function (e) {
    var b = e.target.closest('.amp-day'); if (!b) return;
    var d = b.getAttribute('data-d'), nd = null, k = e.key;
    if (k === 'ArrowRight') nd = add(d, 1); else if (k === 'ArrowLeft') nd = add(d, -1); else if (k === 'ArrowDown') nd = add(d, 7); else if (k === 'ArrowUp') nd = add(d, -7);
    else if (k === 'PageDown') nd = add(d, 30); else if (k === 'PageUp') nd = add(d, -30);
    else if (k === 'Home') nd = add(d, -new Date(T(d)).getUTCDay()); else if (k === 'End') nd = add(d, 6 - new Date(T(d)).getUTCDay());
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); this.focusDay = d; this.pick(d); var me = this; requestAnimationFrame(function () { var x = me.monthsEl.querySelector('[data-d="' + d + '"]'); if (x) x.focus(); }); return; }
    else return;
    e.preventDefault(); if (nd < TODAY) nd = TODAY;
    this.focusDay = nd;
    var vy = this.view.y * 12 + this.view.m, ny = (+nd.slice(0, 4)) * 12 + (+nd.slice(5, 7) - 1), n = this.count();
    if (ny < vy || ny >= vy + n) { this.view = { y: Math.floor((ny - (ny < vy ? 0 : n - 1)) / 12), m: (ny - (ny < vy ? 0 : n - 1)) % 12 }; this.render(); }
    else { this.monthsEl.querySelectorAll('.amp-day[tabindex="0"]').forEach(function (x) { x.tabIndex = -1; }); }
    var t = this.monthsEl.querySelector('[data-d="' + nd + '"]'); if (t) { t.tabIndex = 0; t.focus(); }
  };

  /* =================================================================
   * Guests stepper
   * ================================================================= */
  function guestsHTML() {
    return '<div class="amp-guests-rows">' +
      row('adults', 'Adults', 'Age 13+') + row('children', 'Children', 'Ages 2–12') +
      '<div class="amp-g-row is-off"><div><strong>Pets</strong><small>Not permitted at this house</small></div><span class="amp-g-no">No pets</span></div>' +
      '<p class="amp-g-note">Sleeps up to ' + CFG.maxGuests + ' · renter must be 25+</p></div>';
    function row(k, t, s) { return '<div class="amp-g-row" data-k="' + k + '"><div><strong>' + t + '</strong><small>' + s + '</small></div><div class="amp-step"><button type="button" class="amp-step-dn" aria-label="Fewer ' + t.toLowerCase() + '">−</button><output aria-live="polite"></output><button type="button" class="amp-step-up" aria-label="More ' + t.toLowerCase() + '">+</button></div></div>'; }
  }
  function wireGuests(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.amp-step-up, .amp-step-dn'); if (!b) return;
      var k = b.closest('[data-k]').getAttribute('data-k'), up = b.classList.contains('amp-step-up'), p = {};
      p[k] = store[k] + (up ? 1 : -1);
      if (k === 'adults' && (p[k] < 1)) return; if (k === 'children' && p[k] < 0) return;
      if (up && guests() >= CFG.maxGuests) return;
      set(p);
    });
    function paint() { root.querySelectorAll('.amp-g-row[data-k]').forEach(function (r) { var k = r.getAttribute('data-k'); r.querySelector('output').textContent = store[k]; r.querySelector('.amp-step-dn').disabled = k === 'adults' ? store.adults <= 1 : store.children <= 0; r.querySelector('.amp-step-up').disabled = guests() >= CFG.maxGuests; }); }
    sub(paint); paint();
  }
  function guestsLabel() { var g = guests(); return g + (g === 1 ? ' guest' : ' guests'); }

  /* =================================================================
   * Quote block
   * ================================================================= */
  function quoteHTML(q) {
    if (!q) return '';
    if (q.error) return '<p class="amp-q-err" role="status">' + q.error + '</p>';
    var h = '<dl class="amp-q">';
    q.lines.forEach(function (l) { h += '<div><dt>' + money(l.nightly) + ' × ' + l.nights + ' night' + (l.nights > 1 ? 's' : '') + ' <small>' + l.season + '</small></dt><dd>' + money(l.nightly * l.nights) + '</dd></div>'; });
    if (q.discount) h += '<div class="amp-q-disc"><dt>' + (q.nights >= 28 ? 'Monthly' : 'Weekly') + ' discount (' + q.pct + '%) <span class="amp-ex">Example</span></dt><dd>−' + money(q.discount, true) + '</dd></div>';
    h += '<div><dt>Cleaning fee <span class="amp-ex">Example</span></dt><dd>' + money(q.cleaning) + '</dd></div>';
    h += '<div><dt>' + CFG.taxLabel + ' <a class="amp-q-src" href="' + CFG.taxSource + '" target="_blank" rel="noopener" aria-label="Source for the lodging tax rate (opens in a new tab)">source</a></dt><dd>' + money(q.tax, true) + '</dd></div>';
    h += '<div class="amp-q-total"><dt>Total <small>' + q.nights + ' nights · ' + q.guests + ' guests</small></dt><dd data-amp-total>' + money(q.total, true) + '</dd></div></dl>';
    return h;
  }

  /* =================================================================
   * Booking card (sidebar / dialog / inline)
   * ================================================================= */
  function Card(el, variant) {
    var id = 'amp-card-' + (++uid);
    el.classList.add('amp-card', 'amp-card--' + variant);
    var calWrap = variant === 'sidebar' ? '<div class="amp-pop" hidden data-lenis-prevent><div class="amp-pop-head"><strong>Select dates</strong><button type="button" class="amp-pop-close" aria-label="Close calendar">×</button></div><div class="amp-pop-cal"></div></div>' : '';
    el.innerHTML =
      '<div class="amp-card-head"><p class="amp-from"><strong data-amp-from></strong> <span data-amp-from-unit>night</span> <span class="amp-ex">Example rate</span></p><p class="amp-card-rating"><a href="' + (CFG.home || '/') + 'reviews/">Sample reviews</a></p></div>' +
      '<div class="amp-fields" role="group" aria-label="Your trip">' +
        '<button type="button" class="amp-field amp-f-ci" aria-expanded="false" aria-controls="' + id + '-pop"><span class="amp-f-lbl">Check-in</span><span class="amp-f-val" data-amp-ci>Add date</span></button>' +
        '<button type="button" class="amp-field amp-f-co" aria-expanded="false" aria-controls="' + id + '-pop"><span class="amp-f-lbl">Check-out</span><span class="amp-f-val" data-amp-co>Add date</span></button>' +
        '<button type="button" class="amp-field amp-f-g" aria-expanded="false" aria-controls="' + id + '-g"><span class="amp-f-lbl">Guests</span><span class="amp-f-val" data-amp-g></span><svg class="amp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '</div>' + calWrap +
      '<div class="amp-guests" id="' + id + '-g" hidden>' + guestsHTML() + '</div>' +
      '<a class="amp-cta" href="' + requestUrl() + '" data-amp-cta>Check availability</a>' +
      '<p class="amp-nocharge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.4-3 8.3-7 9-4-.7-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>No charge until confirmed — a request is free and non-binding.</p>' +
      '<div class="amp-quote" aria-live="polite"></div>' +
      '<p class="amp-fine">Rates are <strong>[Example]</strong> figures for this demo. Lodging tax rate (6%) is the real rate for unincorporated Fort Morgan. This is a fictional demo: nothing is booked or charged.</p>';
    if (variant === 'sidebar') el.querySelector('.amp-pop').id = id + '-pop';
    var pop = el.querySelector('.amp-pop'), gEl = el.querySelector('.amp-guests'), cal = null, cta = el.querySelector('[data-amp-cta]');
    wireGuests(gEl);
    function openPop(which) {
      if (variant !== 'sidebar') { BookingDialog.open(which); return; }
      if (!cal) cal = new Calendar(el.querySelector('.amp-pop-cal'), { months: 2, onDone: function () { closePop(); } });
      pop.hidden = false; el.classList.add('is-pop'); el.querySelectorAll('.amp-f-ci,.amp-f-co').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      var f = pop.querySelector('.amp-day[tabindex="0"]'); if (f) f.focus();
    }
    function closePop() { if (!pop) return; pop.hidden = true; el.classList.remove('is-pop'); el.querySelectorAll('.amp-f-ci,.amp-f-co').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
    el.querySelector('.amp-f-ci').addEventListener('click', function () { if (pop && !pop.hidden) closePop(); else openPop('ci'); });
    el.querySelector('.amp-f-co').addEventListener('click', function () { if (pop && !pop.hidden) closePop(); else openPop('co'); });
    if (pop) { pop.querySelector('.amp-pop-close').addEventListener('click', function () { closePop(); el.querySelector('.amp-f-ci').focus(); }); document.addEventListener('click', function (e) { if (!pop.hidden && !el.contains(e.target)) closePop(); }); el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { closePop(); el.querySelector('.amp-f-ci').focus(); } }); }
    var gb = el.querySelector('.amp-f-g');
    gb.addEventListener('click', function () { var o = gEl.hidden; gEl.hidden = !o; gb.setAttribute('aria-expanded', String(o)); });
    cta.addEventListener('click', function (e) { if (!store.ci || !store.co) { e.preventDefault(); openPop(store.ci ? 'co' : 'ci'); } });
    function paint() {
      var q = quote(store.ci, store.co, guests()), s = fromPrice();
      el.querySelector('[data-amp-ci]').textContent = store.ci ? fmt(store.ci) : 'Add date';
      el.querySelector('[data-amp-co]').textContent = store.co ? fmt(store.co) : 'Add date';
      el.querySelector('[data-amp-g]').textContent = guestsLabel();
      el.querySelector('[data-amp-from]').textContent = q && !q.error ? money(q.total, false) : money(s.nightly);
      el.querySelector('[data-amp-from-unit]').textContent = q && !q.error ? 'total · ' + q.nights + ' nights' : 'night · ' + s.name.toLowerCase();
      el.querySelector('.amp-quote').innerHTML = quoteHTML(q);
      var ready = q && !q.error; cta.textContent = ready ? 'Request to book' : 'Check availability'; cta.href = requestUrl(); cta.classList.toggle('is-ready', !!ready);
      el.classList.toggle('has-dates', !!store.ci);
    }
    sub(paint); doc.addEventListener('amp:season', paint); paint();
    return { open: openPop, close: closePop };
  }

  /* =================================================================
   * Booking dialog (site-wide compact card · mobile bottom sheet)
   * ================================================================= */
  var BookingDialog = (function () {
    var dlg, cal, last;
    function build() {
      dlg = document.createElement('div');
      dlg.className = 'amp-dialog'; dlg.hidden = true; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'amp-dlg-t'); dlg.setAttribute('data-lenis-prevent', '');
      dlg.innerHTML = '<div class="amp-dialog-scrim" data-close></div><div class="amp-dialog-panel"><div class="amp-dialog-head"><div><p class="amp-dialog-kicker">All-Moh’s-Paradise · Fort Morgan</p><h2 id="amp-dlg-t">Choose your dates</h2></div><button type="button" class="amp-dialog-close" data-close aria-label="Close">×</button></div>' +
        '<div class="amp-dialog-body"><div class="amp-dialog-cal"></div><div class="amp-dialog-side"><div class="amp-dialog-card"></div></div></div></div>';
      document.body.appendChild(dlg);
      cal = new Calendar(dlg.querySelector('.amp-dialog-cal'), { months: 'auto', legend: true });
      var card = dlg.querySelector('.amp-dialog-card');
      Card(card, 'dialog');
      // in the dialog, the calendar is always visible: date fields focus it instead of reopening
      card.querySelectorAll('.amp-f-ci,.amp-f-co').forEach(function (b) { b.replaceWith(b.cloneNode(true)); });
      card.querySelectorAll('.amp-f-ci,.amp-f-co').forEach(function (b) { b.addEventListener('click', function () { var f = dlg.querySelector('.amp-day[tabindex="0"]'); if (f) f.focus(); }); });
      sub(function () { card.querySelector('[data-amp-ci]').textContent = store.ci ? fmt(store.ci) : 'Add date'; card.querySelector('[data-amp-co]').textContent = store.co ? fmt(store.co) : 'Add date'; });
      var cta = card.querySelector('[data-amp-cta]'); cta.replaceWith(cta.cloneNode(true)); cta = card.querySelector('[data-amp-cta]');
      cta.addEventListener('click', function (e) { if (!store.ci || !store.co) { e.preventDefault(); var f = dlg.querySelector('.amp-day[tabindex="0"]'); if (f) f.focus(); cal.say(store.ci ? 'Select a check-out date first.' : 'Select a check-in date first.'); } });
      sub(function () { var q = quote(store.ci, store.co, guests()), ok = q && !q.error; cta.textContent = ok ? 'Request to book' : 'Select dates'; cta.href = requestUrl(); cta.classList.toggle('is-ready', !!ok); });
      cta.textContent = 'Select dates';
      dlg.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
      dlg.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
        if (e.key !== 'Tab') return;
        var f = [].filter.call(dlg.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]'), function (x) { return x.offsetParent !== null; });
        if (!f.length) return; var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      });
    }
    function open() {
      if (!dlg) build();
      last = document.activeElement; dlg.hidden = false; doc.classList.add('amp-lock');
      if (window.__lenis) window.__lenis.stop();
      requestAnimationFrame(function () { dlg.classList.add('is-open'); var f = dlg.querySelector('.amp-day[tabindex="0"]') || dlg.querySelector('.amp-dialog-close'); f.focus({ preventScroll: true }); });
    }
    function close() { if (!dlg || dlg.hidden) return; dlg.classList.remove('is-open'); doc.classList.remove('amp-lock'); if (window.__lenis) window.__lenis.start(); setTimeout(function () { dlg.hidden = true; }, 220); if (last && last.focus) last.focus({ preventScroll: true }); }
    return { open: open, close: close };
  })();

  /* =================================================================
   * Mobile bottom bar
   * ================================================================= */
  function MobileBar() {
    if (document.querySelector('.amp-mbar') || document.body.classList.contains('amp-no-mbar')) return;
    var bar = document.createElement('div'); bar.className = 'amp-mbar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Book your stay');
    bar.innerHTML = '<div class="amp-mbar-info"><strong data-mb-main></strong><span data-mb-sub></span></div><button type="button" class="amp-mbar-btn" data-amp-open>Check dates</button>';
    document.body.appendChild(bar); doc.classList.add('has-amp-mbar');
    function paint() {
      var q = quote(store.ci, store.co, guests()), s = fromPrice(), ok = q && !q.error;
      bar.querySelector('[data-mb-main]').innerHTML = ok ? money(q.total) + ' <small>total</small>' : money(s.nightly) + ' <small>/ night</small>';
      bar.querySelector('[data-mb-sub]').textContent = ok ? fmt(store.ci) + ' – ' + fmt(store.co) + ' · ' + guestsLabel() : 'Example rate · ' + s.min + '-night min';
      var btn = bar.querySelector('.amp-mbar-btn'); btn.textContent = ok ? 'Request' : 'Check dates';
    }
    bar.querySelector('.amp-mbar-btn').addEventListener('click', function (e) { var q = quote(store.ci, store.co, guests()); if (q && !q.error) { location.href = requestUrl(); e.stopImmediatePropagation(); } }, true);
    sub(paint); doc.addEventListener('amp:season', paint); paint();
  }

  /* =================================================================
   * Hero search bar + any [data-amp-open] trigger
   * ================================================================= */
  function wireTriggers() {
    document.addEventListener('click', function (e) { var t = e.target.closest('[data-amp-open]'); if (!t) return; e.preventDefault(); BookingDialog.open(); });
    document.querySelectorAll('[data-amp-search]').forEach(function (f) {
      function paint() { var q = quote(store.ci, store.co, guests()); f.querySelector('[data-s-ci]').textContent = store.ci ? fmt(store.ci) : 'Add date'; f.querySelector('[data-s-co]').textContent = store.co ? fmt(store.co) : 'Add date'; f.querySelector('[data-s-g]').textContent = guestsLabel(); var b = f.querySelector('[data-s-go]'); if (b) b.lastChild.textContent = q && !q.error ? money(q.total) + ' · Request' : 'Check availability'; }
      f.addEventListener('submit', function (e) { e.preventDefault(); var q = quote(store.ci, store.co, guests()); if (q && !q.error) location.href = requestUrl(); else BookingDialog.open(); });
      f.querySelectorAll('button[type="button"]').forEach(function (b) { b.addEventListener('click', function () { BookingDialog.open(); }); });
      sub(paint); paint();
    });
  }

  /* =================================================================
   * Rates table season highlight + live rate figures
   * ================================================================= */
  function wireRates() {
    function paint() {
            document.querySelectorAll('[data-amp-rate]').forEach(function (n) { var s = seasonByKey(n.getAttribute('data-amp-rate')); var f = n.getAttribute('data-f') || 'nightly'; n.textContent = f === 'min' ? s.min : f === 'weekly' ? money(Math.round(s.nightly * 7 * (1 - CFG.weekly / 100))) : money(s.nightly); });
      var cur = season(store.ci || TODAY).key, pref = currentSeasonKey() === 'snowbird' ? 'winter' : (currentSeasonKey() === 'summer' ? 'summer' : cur);
      document.querySelectorAll('tr[data-season]').forEach(function (r) { r.classList.toggle('is-current', r.getAttribute('data-season') === pref); });
    }
    sub(paint); doc.addEventListener('amp:season', paint); paint();
  }

  /* =================================================================
   * Contact page: prefill CF7 from the trip + show the quote
   * ================================================================= */
  function prefill() {
    var form = document.querySelector('.wpcf7 form'); if (!form) return;
    var ci = form.querySelector('[name="check-in"]'), co = form.querySelector('[name="check-out"]'), g = form.querySelector('[name="guests"]'), msg = form.querySelector('[name="your-message"]'), hid = form.querySelector('[name="quote-summary"]');
    var box = document.querySelector('[data-amp-summary]');
    function fire(i) { i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }
    function apply(fromTrip) {
      var t = tripInfo(), q = t.quote, ok = q && !q.error;
      if (fromTrip) {
        if (t.ci && ci) { ci.value = t.ci; fire(ci); }
        if (t.co && co) { co.value = t.co; fire(co); }
        if (g) { g.value = String(Math.min(8, t.guests)); fire(g); }
        if (ok && msg && !msg.value) msg.value = 'Hi! I’d like to request ' + q.nights + ' nights, ' + fmt(t.ci, true) + ' – ' + fmt(t.co, true) + ', for ' + t.adults + ' adult' + (t.adults > 1 ? 's' : '') + (t.children ? ' and ' + t.children + ' child' + (t.children > 1 ? 'ren' : '') : '') + '. The instant quote showed ' + money(q.total, true) + ' total (example rates). ';
      }
      if (hid) hid.value = ok ? q.nights + ' nights ' + t.ci + ' to ' + t.co + ', ' + t.guests + ' guests, [Example] total ' + money(q.total, true) : '';
      if (box) {
        box.hidden = false;
        box.innerHTML = ok ? '<p class="amp-sum-k">Your instant quote</p><p class="amp-sum-dates"><strong>' + fmt(t.ci, true) + '</strong> → <strong>' + fmt(t.co, true) + '</strong><br>' + q.nights + ' nights · ' + guestsLabel() + '</p>' + quoteHTML(q) + '<p class="amp-nocharge">No charge until confirmed. Demo site: requests are stored on this site only.</p><button type="button" class="amp-sum-edit" data-amp-open>Change dates</button>'
          : '<p class="amp-sum-k">Instant quote</p><p>Pick dates to see nightly rates, the cleaning fee and lodging tax before you send your request.</p><button type="button" class="amp-cta is-ready" data-amp-open>Check dates</button>';
      }
    }
    var hasParams = /check_in=/.test(location.search);
    apply(hasParams || !!store.ci);
    // With a page cache active (WP_CACHE), CF7 resets the form on window load; re-apply the trip afterwards.
    function reapply() { setTimeout(function () { apply(hasParams || !!store.ci); }, 0); }
    form.addEventListener('reset', reapply); form.addEventListener('wpcf7reset', reapply);
    sub(function () { apply(true); });
    // keep the trip in sync if the guest edits the native date inputs
    function fromForm() { if (ci && co && ci.value && co.value && (ci.value !== store.ci || co.value !== store.co)) { if (canIn(ci.value) && canOut(ci.value, co.value)) set({ ci: ci.value, co: co.value }); } }
    if (ci) ci.addEventListener('change', fromForm); if (co) co.addEventListener('change', fromForm);
  }

  /* ---------- boot ---------- */
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    document.querySelectorAll('[data-amp-card]').forEach(function (el) { Card(el, el.getAttribute('data-amp-card') || 'sidebar'); });
    document.querySelectorAll('[data-amp-calendar]').forEach(function (el) { new Calendar(el, { months: 'auto', legend: true, prices: true }); });
    MobileBar(); wireTriggers(); wireRates(); prefill();
    window.AMP = { store: store, set: set, quote: quote, dayState: dayState, canIn: canIn, canOut: canOut, open: BookingDialog.open, close: BookingDialog.close, season: season };
    doc.classList.add('amp-ready');
  });
})();
