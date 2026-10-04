/* All-Moh's-Paradise — cinematic layer: video hero, season switch, synthesized surf sound,
 * "A day at" story, collage parallax, Lenis smooth scroll, reviews sort/filter, Pannellum 360, room scrollspy.
 * Everything respects prefers-reduced-motion. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var reduce = mq.matches;
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- Season (Summer / Snowbird) ---------- */
  function setSeason(k, silent) {
    doc.setAttribute('data-season', k);
    try { localStorage.setItem('amp-season', k); } catch (e) {}
    $$('.amp-season [role="radio"]').forEach(function (b) { var on = b.getAttribute('data-k') === k; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    if (!silent) doc.dispatchEvent(new CustomEvent('amp:season', { detail: k }));
    Hero.season(k);
  }
  function initSeason() {
    $$('.amp-season').forEach(function (g) {
      g.addEventListener('click', function (e) { var b = e.target.closest('[role="radio"]'); if (b) setSeason(b.getAttribute('data-k')); });
      g.addEventListener('keydown', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0) return;
        e.preventDefault(); var bs = $$('[role="radio"]', g), i = bs.indexOf(document.activeElement); var n = bs[(i + 1) % bs.length]; setSeason(n.getAttribute('data-k')); n.focus();
      });
    });
    setSeason(doc.getAttribute('data-season') || 'summer', true);
  }

  /* ---------- Synthesized surf (Web Audio — no audio file) ---------- */
  var Surf = (function () {
    var ctx, master, lp, swell, foamG, timer, on = false;
    function noise(c, sec, brown) {
      var b = c.createBuffer(2, c.sampleRate * sec, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch), last = 0; for (var i = 0; i < d.length; i++) { var w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } }
      return b;
    }
    function build() {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      var s1 = ctx.createBufferSource(); s1.buffer = noise(ctx, 7, true); s1.loop = true;
      lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 450; lp.Q.value = 0.4;
      swell = ctx.createGain(); swell.gain.value = 0.25; s1.connect(lp); lp.connect(swell); swell.connect(master); s1.start();
      var s2 = ctx.createBufferSource(); s2.buffer = noise(ctx, 5, false); s2.loop = true;
      var hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 0.6;
      foamG = ctx.createGain(); foamG.gain.value = 0; s2.connect(hp); hp.connect(foamG); foamG.connect(master); s2.start();
      return true;
    }
    function wave() {
      var t = ctx.currentTime, d = 6 + Math.random() * 4.5, peak = 0.75 + Math.random() * 0.25;
      swell.gain.cancelScheduledValues(t); lp.frequency.cancelScheduledValues(t); foamG.gain.cancelScheduledValues(t);
      swell.gain.setTargetAtTime(peak, t, d * 0.18); lp.frequency.setTargetAtTime(1300 + Math.random() * 500, t, d * 0.2);
      foamG.gain.setTargetAtTime(0.05 * peak, t + d * 0.32, d * 0.06);
      swell.gain.setTargetAtTime(0.22, t + d * 0.42, d * 0.22); lp.frequency.setTargetAtTime(420, t + d * 0.42, d * 0.25); foamG.gain.setTargetAtTime(0, t + d * 0.5, d * 0.2);
      timer = setTimeout(wave, d * 1000);
    }
    return {
      toggle: function () {
        if (!ctx && !build()) return false;
        on = !on; if (ctx.state === 'suspended') ctx.resume();
        master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.6);
        if (on) wave(); else clearTimeout(timer);
        return on;
      },
      off: function () { if (on) this.toggle(); },
      get on() { return on; }
    };
  })();

  /* ---------- Video hero ---------- */
  var Hero = (function () {
    var root, vids = {}, cur, small, playing = !reduce, inView = true, deferred = false;
    // Start the background video only after the page has loaded and the browser is idle (keeps it off the critical path / LCP).
    function afterLoadIdle(fn) {
      function idle() { (window.requestIdleCallback || function (f) { return setTimeout(f, 200); })(function () { setTimeout(fn, 1200); }, { timeout: 3000 }); }
      if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
    }
    function srcs(v) { if (v._loaded) return; $$('source', v).forEach(function (s) { s.src = small && s.getAttribute('data-src-sm') ? s.getAttribute('data-src-sm') : s.getAttribute('data-src'); }); v.load(); v._loaded = true; }
    function play(v) { if (!v) return; srcs(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    function sync() {
      Object.keys(vids).forEach(function (k) { var v = vids[k]; if (k === cur && playing && !deferred && inView && !document.hidden) play(v); else if (!v.paused) v.pause(); });
      var pb = $('.amp-hero-play', root); if (pb) { pb.setAttribute('aria-pressed', String(!playing)); pb.setAttribute('aria-label', playing ? 'Pause background video' : 'Play background video'); pb.classList.toggle('is-paused', !playing); }
    }
    return {
      init: function () {
        root = $('.amp-hero'); if (!root) return;
        small = window.matchMedia('(max-width: 760px)').matches;
        var conn = navigator.connection || {};
        if (small || reduce || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')) { doc.classList.add('amp-novideo'); playing = false; }
        else { deferred = true; afterLoadIdle(function () { deferred = false; sync(); }); }
        $$('video[data-season-video]', root).forEach(function (v) { vids[v.getAttribute('data-season-video')] = v; v.addEventListener('playing', function () { v.classList.add('is-playing'); }); });
        cur = doc.getAttribute('data-season') || 'summer';
        $$('video', root).forEach(function (v) { v.classList.toggle('is-active', v.getAttribute('data-season-video') === cur); });
        var pb = $('.amp-hero-play', root); if (pb) pb.addEventListener('click', function () { playing = !playing; sync(); });
        var sb = $('.amp-hero-sound', root);
        if (sb) sb.addEventListener('click', function () { var on = Surf.toggle(); sb.setAttribute('aria-pressed', String(!!on)); sb.classList.toggle('is-on', !!on); $('.amp-sound-label', sb).textContent = on ? 'Sound off' : 'Sound on'; });
        if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { inView = en[0].isIntersecting; if (!inView && Surf.on) { Surf.off(); if (sb) { sb.setAttribute('aria-pressed', 'false'); sb.classList.remove('is-on'); $('.amp-sound-label', sb).textContent = 'Sound on'; } } sync(); }, { threshold: 0.05 }).observe(root);
        document.addEventListener('visibilitychange', sync);
        mq.addEventListener && mq.addEventListener('change', function (e) { if (e.matches) { playing = false; sync(); } });
        sync();
      },
      season: function (k) {
        if (!root || !vids[k]) return; cur = k;
        $$('video', root).forEach(function (v) { v.classList.toggle('is-active', v.getAttribute('data-season-video') === k); });
        sync();
      }
    };
  })();

  /* ---------- Sunrise / sunset for the story ---------- */
  function initSunTimes() {
    var els = $$('[data-amp-sun]'); if (!els.length) return;
    var lat = els[0].getAttribute('data-lat'), lon = els[0].getAttribute('data-lon');
    var key = 'amp-sun-' + new Date().toDateString();
    function fmt(iso) { var t = iso.split('T')[1].split(':'); var h = +t[0]; return ((h + 11) % 12 + 1) + ':' + t[1] + (h < 12 ? ' AM' : ' PM'); }
    function paint(d) { els.forEach(function (e) { var w = e.getAttribute('data-amp-sun'); if (w === 'sunrise') e.textContent = 'Sunrise tomorrow ' + fmt(d.daily.sunrise[1]) + ' CT'; else e.textContent = 'Sunset tonight ' + fmt(d.daily.sunset[0]) + ' CT'; e.hidden = false; }); }
    try { var c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c) return paint(c); } catch (e) {}
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=sunrise,sunset&timezone=America%2FChicago&forecast_days=2').then(function (r) { return r.json(); }).then(function (d) { if (!d.daily) return; try { sessionStorage.setItem(key, JSON.stringify(d)); } catch (e) {} paint(d); }).catch(function () {});
  }

  /* ---------- "A day at" scroll story ---------- */
  function initStory() {
    var s = $('.amp-story'); if (!s) return;
    var figs = $$('.amp-story-media figure', s), steps = $$('.amp-step', s), clock = $('.amp-story-clock', s);
    function act(i) { figs.forEach(function (f, j) { f.classList.toggle('is-active', j === i); }); steps.forEach(function (st, j) { st.classList.toggle('is-active', j === i); }); s.style.setProperty('--sky', steps[i].getAttribute('data-sky')); if (clock) clock.textContent = steps[i].getAttribute('data-time'); s.setAttribute('data-step', i); }
    act(0);
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) act(steps.indexOf(e.target)); }); }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (st) { io.observe(st); });
  }

  /* ---------- Collage parallax ---------- */
  function initParallax() {
    var els = $$('[data-speed]'); if (!els.length || reduce) return;
    var ticking = false;
    function upd() { var vh = innerHeight; els.forEach(function (e) { var r = e.parentElement.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) return; var c = (r.top + r.height / 2 - vh / 2) / vh; e.style.transform = 'translate3d(0,' + (c * -60 * parseFloat(e.getAttribute('data-speed'))).toFixed(1) + 'px,0)'; }); ticking = false; }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true }); upd();
  }

  /* ---------- Lenis smooth scroll ---------- */
  function initLenis() {
    if (reduce || window.matchMedia('(pointer: coarse)').matches || !window.matchMedia('(pointer: fine)').matches) return;
    if (!window.Lenis) {
      var src = (window.AMP_LENIS || '');
      if (!src) return;
      afterIdle(function () { load('script', { src: src }).then(initLenis).catch(function () {}); });
      return;
    }
    try {
      var l = new window.Lenis({ autoRaf: true, lerp: 0.11, smoothWheel: true, anchors: { offset: -96 }, prevent: function (n) { return n.closest && n.closest('[data-lenis-prevent], .leaflet-container, .pnlm-container'); } });
      window.__lenis = l; doc.classList.add('has-lenis');
    } catch (e) {}
  }

  /* ---------- Reviews: sort + topic filter ---------- */
  function initReviews() {
    var wrap = $('[data-amp-reviews]'); if (!wrap) return;
    var list = $('.amp-rv-list', wrap), cards = $$('.amp-rv', list), sel = $('[data-amp-sort]', wrap), count = $('[data-amp-count]', wrap), topic = null;
    function apply() {
      var mode = sel ? sel.value : 'recent';
      var sorted = cards.slice().sort(function (a, b) {
        var da = a.getAttribute('data-date'), db = b.getAttribute('data-date');
        if (mode === 'oldest') return da < db ? -1 : 1;
        if (mode === 'detailed') return +b.getAttribute('data-len') - +a.getAttribute('data-len');
        if (mode === 'highest') return (+b.getAttribute('data-rating') - +a.getAttribute('data-rating')) || (da < db ? 1 : -1);
        if (mode === 'lowest') return (+a.getAttribute('data-rating') - +b.getAttribute('data-rating')) || (da < db ? 1 : -1);
        return da < db ? 1 : -1;
      });
      var shown = 0;
      sorted.forEach(function (c) { var ok = !topic || (' ' + c.getAttribute('data-topics') + ' ').indexOf(' ' + topic + ' ') > -1; c.hidden = !ok; if (ok) shown++; list.appendChild(c); });
      if (count) count.textContent = 'Showing ' + shown + ' of ' + cards.length + ' reviews' + (topic ? ' mentioning “' + $('[data-topic="' + topic + '"]', wrap).getAttribute('data-label') + '”' : '');
    }
    if (sel) sel.addEventListener('change', apply);
    $$('[data-topic]', wrap).forEach(function (b) { b.addEventListener('click', function () { topic = topic === b.getAttribute('data-topic') ? null : b.getAttribute('data-topic'); $$('[data-topic]', wrap).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-topic') === topic)); }); apply(); }); });
    $$('.amp-rv-more', list).forEach(function (b) { b.addEventListener('click', function () { var c = b.closest('.amp-rv'); var o = c.classList.toggle('is-open'); b.setAttribute('aria-expanded', String(o)); b.textContent = o ? 'Show less' : 'Read more'; }); });
    apply();
  }

  function afterIdle(fn) { var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(fn, { timeout: 2500 }); }; if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true }); }
  /* ---------- Pannellum 360 (lazy) ---------- */
  function load(tag, attrs) { return new Promise(function (res, rej) { var e = document.createElement(tag); for (var k in attrs) e[k] = attrs[k]; e.onload = res; e.onerror = rej; document.head.appendChild(e); }); }
  function initPano() {
    $$('[data-amp-pano]').forEach(function (el) {
      var btn = $('[data-amp-pano-load]', el.parentElement), cfg = JSON.parse(el.getAttribute('data-amp-pano')), base = el.getAttribute('data-base'), started = false;
      function start() {
        if (started) return; started = true; if (btn) { btn.disabled = true; btn.textContent = 'Loading 360° view…'; }
        Promise.all([load('link', { rel: 'stylesheet', href: base + 'pannellum.css' }), window.pannellum ? 1 : load('script', { src: base + 'pannellum.js' })]).then(function () {
          el.parentElement.classList.add('is-live');
          Object.keys(cfg.scenes).forEach(function (k) { (cfg.scenes[k].hotSpots || []).forEach(function (h) { if (h.type === 'info') { h.cssClass = 'amp-hs-info'; h.createTooltipFunc = tip; h.createTooltipArgs = h.text; } else { h.cssClass = 'amp-hs-scene'; h.createTooltipFunc = tip; h.createTooltipArgs = h.text; } }); });
          cfg['default'].autoRotate = reduce ? 0 : -2;
          var v = window.pannellum.viewer(el, cfg);
          var tabs = $$('[data-scene]', el.parentElement.parentElement);
          v.on('scenechange', function (id) { tabs.forEach(function (t) { t.setAttribute('aria-pressed', String(t.getAttribute('data-scene') === id)); }); });
          tabs.forEach(function (t) { t.addEventListener('click', function () { v.loadScene(t.getAttribute('data-scene')); }); });
          if (btn) btn.hidden = true;
        }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = '360° viewer failed to load — retry'; started = false; } });
      }
      function tip(div, text) { div.classList.add('amp-hs'); var s = document.createElement('span'); s.className = 'amp-hs-tip'; s.textContent = text; div.appendChild(s); div.setAttribute('aria-label', text); div.setAttribute('role', 'img'); }
      if (btn) btn.addEventListener('click', start);
      $$('[data-scene]', el.parentElement.parentElement).forEach(function (t) { t.addEventListener('click', function () { if (started) return; var id = t.getAttribute('data-scene'); cfg['default'].firstScene = id; $$('[data-scene]', el.parentElement.parentElement).forEach(function (x) { x.setAttribute('aria-pressed', String(x === t)); }); start(); }); });
      if (location.hash === '#tour360') start();
    });
  }

  /* ---------- Room tour scrollspy ---------- */
  function initRooms() {
    var nav = $('.amp-rooms-nav'); if (!nav || !('IntersectionObserver' in window)) return;
    var links = $$('a[href^="#room-"]', nav);
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { links.forEach(function (a) { var on = a.getAttribute('href') === '#' + e.target.id; a.classList.toggle('is-active', on); if (on) { a.setAttribute('aria-current', 'true'); var sc = nav.querySelector('.amp-rooms-track'); if (sc) sc.scrollTo({ left: a.offsetLeft - 20, behavior: reduce ? 'auto' : 'smooth' }); } else a.removeAttribute('aria-current'); }); } }); }, { rootMargin: '-40% 0px -55% 0px' });
    links.forEach(function (a) { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) io.observe(t); });
  }

  /* Keep --amp-header-h in sync with the (shrinking) sticky header */
  function initHeaderVar() {
    var h = $('.sbh-header-wrap'); if (!h) return;
    function upd() { doc.style.setProperty('--amp-header-h', Math.round(h.getBoundingClientRect().height) + 'px'); }
    upd(); if (window.ResizeObserver) new ResizeObserver(upd).observe(h);
  }
  ready(function () { initHeaderVar(); initSeason(); Hero.init(); initSunTimes(); initStory(); initParallax(); initLenis(); initReviews(); initPano(); initRooms(); });
})();
