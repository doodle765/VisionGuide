/* VisionGuide AI
 * - COCO-SSD object detection (offline libs in /lib, optional local model in /model)
 * - Native Text-to-Speech (bridged to eSpeak NG)
 * - Continuous background voice commands bridged to Vosk (Language, English, Urdu, Repeat, Location, Where is <object>)
 */
(() => {
  'use strict';

  /* ---------------- Config ---------------- */
  const LOCAL_MODEL_URL = 'model/model.json'; // used if present, otherwise COCO-SSD default
  const MIN_SCORE = 0.5;
  const DETECT_INTERVAL_MS = 350;
  const SAME_OBJECT_COOLDOWN_MS = 5000;

  const LANGS = {
    en: { speech: 'en-US', recog: 'en-US', name: 'English', label: 'Language : English' },
    ur: { speech: 'ur-PK', recog: 'ur-PK', name: 'اردو', label: 'زبان : اردو' }
  };

  /* ---------------- Strings ---------------- */
  const T = {
    en: {
      holdToSpeak: 'Listening for commands...',
      listening: 'Listening ...',
      scanning: 'Scanning ...',
      loading: 'Loading model…',
      cameraStarting: 'Starting camera…',
      cameraError: 'Camera unavailable. Please allow camera access.',
      detected: (o, p) => `${o} Detected: ${p}%`,
      spokenDetected: (o, dir) => {
        if (dir === 'left') return `${o} on your left. Move right.`;
        if (dir === 'right') return `${o} on your right. Move left.`;
        return `Move left or right to avoid ${o}`;
      },
      queryCenter: o => `${o} is in front`,
      queryLeft: o => `${o} is on your left`,
      queryRight: o => `${o} is on your right`,
      queryNotFound: o => `no ${o} detected`,
      langChanged: 'Language changed to English',
      nothingToRepeat: 'There is nothing to repeat yet',
      tapLocation: 'Tap to get location',
      locating: 'Finding your location …',
      locationIs: p => `Your current location is ${p}`,
      locationFail: 'Sorry, I could not get your location',
      noGeo: 'Location is not supported on this device',
      heard: t => `Heard: “${t}”`,
      notUnderstood: 'Command not recognised',
      speechUnsupported: 'Voice commands are not supported',
      micDenied: 'Microphone permission was denied',
      left: 'left', right: 'right', center: 'center',
      north: 'north', south: 'south', east: 'east', west: 'west',
      coords: (la, lo) => `latitude ${la}, longitude ${lo}`
    },
    ur: {
      holdToSpeak: 'صوتی احکامات سنے جا رہے ہیں...',
      listening: 'سن رہا ہوں ...',
      scanning: 'تلاش جاری ہے ...',
      loading: 'ماڈل لوڈ ہو رہا ہے…',
      cameraStarting: 'کیمرہ شروع ہو رہا ہے…',
      cameraError: 'کیمرہ دستیاب نہیں۔ براہ کرم اجازت دیں۔',
      detected: (o, p) => `${o} دریافت: ${p}%`,
      spokenDetected: (o, dir) => {
        if (dir === 'left') return `بائیں طرف ${o} ہے۔ دائیں مڑیں۔`;
        if (dir === 'right') return `دائیں طرف ${o} ہے۔ بائیں مڑیں۔`;
        return `${o} سے بچنے کے لیے دائیں یا بائیں مڑیں۔`;
      },
      queryCenter: o => `${o} سامنے ہے`,
      queryLeft: o => `${o} بائیں طرف ہے`,
      queryRight: o => `${o} دائیں طرف ہے`,
      queryNotFound: o => `${o} موجود نہیں ہے`,
      langChanged: 'زبان اردو میں تبدیل ہو گئی',
      nothingToRepeat: 'دہرانے کے لیے ابھی کچھ نہیں ہے',
      tapLocation: 'مقام جاننے کے لیے ٹیپ کریں',
      locating: 'آپ کا مقام تلاش کیا جا رہا ہے …',
      locationIs: p => `آپ کا موجودہ مقام ${p} ہے`,
      locationFail: 'معذرت، آپ کا مقام معلوم نہیں ہو سکا',
      noGeo: 'اس ڈیوائس پر مقام کی سہولت دستیاب نہیں',
      heard: t => `سنا: “${t}”`,
      notUnderstood: 'حکم سمجھ نہیں آیا',
      speechUnsupported: 'صوتی احکامات دستیاب نہیں',
      micDenied: 'مائیکروفون کی اجازت نہیں ملی',
      left: 'بائیں', right: 'دائیں', center: 'درمیان',
      north: 'شمال', south: 'جنوب', east: 'مشرق', west: 'مغرب',
      coords: (la, lo) => `عرض بلد ${la}، طول بلد ${lo}`
    }
  };

  // Urdu names for the 80 COCO classes
  const UR = {
    'person': 'شخص', 'bicycle': 'سائیکل', 'car': 'گاڑی', 'motorcycle': 'موٹر سائیکل',
    'airplane': 'ہوائی جہاز', 'bus': 'بس', 'train': 'ٹرین', 'truck': 'ٹرک', 'boat': 'کشتی',
    'traffic light': 'ٹریفک لائٹ', 'fire hydrant': 'فائر ہائیڈرنٹ', 'stop sign': 'اسٹاپ سائن',
    'parking meter': 'پارکنگ میٹر', 'bench': 'بینچ', 'bird': 'پرندہ', 'cat': 'بلی', 'dog': 'کتا',
    'horse': 'گھوڑا', 'sheep': 'بھیڑ', 'cow': 'گائے', 'elephant': 'ہاتھی', 'bear': 'ریچھ',
    'zebra': 'زیبرا', 'giraffe': 'زرافہ', 'backpack': 'بیگ', 'umbrella': 'چھتری',
    'handbag': 'ہینڈ بیگ', 'tie': 'ٹائی', 'suitcase': 'سوٹ کیس', 'frisbee': 'فریسبی',
    'skis': 'اسکیز', 'snowboard': 'اسنو بورڈ', 'sports ball': 'گیند', 'kite': 'پتنگ',
    'baseball bat': 'بیٹ', 'baseball glove': 'دستانہ', 'skateboard': 'اسکیٹ بورڈ',
    'surfboard': 'سرف بورڈ', 'tennis racket': 'ریکٹ', 'bottle': 'بوتل', 'wine glass': 'وائن گلاس',
    'cup': 'کپ', 'fork': 'کانٹا', 'knife': 'چاقو', 'spoon': 'چمچ', 'bowl': 'پیالہ',
    'banana': 'کیلا', 'apple': 'سیب', 'sandwich': 'سینڈوچ', 'orange': 'سنترہ',
    'broccoli': 'بروکلی', 'carrot': 'گاجر', 'hot dog': 'ہاٹ ڈاگ', 'pizza': 'پیزا',
    'donut': 'ڈونٹ', 'cake': 'کیک', 'chair': 'کرسی', 'couch': 'صوفہ',
    'potted plant': 'گملے کا پودا', 'bed': 'بستر', 'dining table': 'کھانے کی میز',
    'toilet': 'ٹوائلٹ', 'tv': 'ٹی وی', 'laptop': 'لیپ ٹاپ', 'mouse': 'ماؤس', 'remote': 'ریموٹ',
    'keyboard': 'کی بورڈ', 'cell phone': 'موبائل فون', 'microwave': 'مائیکروویو', 'oven': 'اوون',
    'toaster': 'ٹوسٹر', 'sink': 'سنک', 'refrigerator': 'فریج', 'book': 'کتاب', 'clock': 'گھڑی',
    'vase': 'گلدان', 'scissors': 'قینچی', 'teddy bear': 'ٹیڈی بیئر', 'hair drier': 'ہیئر ڈرائر',
    'toothbrush': 'ٹوتھ برش'
  };

  /* Voice command keywords (English words + common Urdu / Urdu-script spellings) */
  const KEYWORDS = {
    language: ['language', 'languages', 'لینگویج', 'لینگوئج', 'زبان'],
    english: ['english', 'انگلش', 'انگریزی', 'انگلِش'],
    urdu: ['urdu', 'اردو', 'اُردو', 'اردُو'],
    repeat: ['repeat', 'ریپیٹ', 'دوبارہ', 'دہرائیں', 'دہرائو', 'دہراؤ'],
    location: ['location', 'لوکیشن', 'مقام', 'جگہ']
  };

  /* ---------------- State ---------------- */
  let lang = 'en';
  try { const s = localStorage.getItem('vg-lang'); if (s === 'en' || s === 'ur') lang = s; } catch (_) {}
  let lastSpoken = '';
  let lastObject = null;          // { name, score }
  let lastSpokenObject = '';
  let lastSpokenAt = 0;
  let holding = false;
  let model = null;
  let locationState = null;       // { text } once known
  let currentDetections = [];
  let announcementQueue = [];

  /* ---------------- DOM ---------------- */
  const $ = id => document.getElementById(id);
  const video = $('video-feed'), canvas = $('detection-canvas'), ctx = canvas.getContext('2d');
  const placeholder = $('camera-placeholder');
  const objectText = $('object-text'), locationText = $('location-text'), languageText = $('language-text');
  const listeningBar = $('listening-bar'), listeningText = $('listening-text');
  const micBtn = $('mic-btn'), locationBar = $('location-bar'), languageBar = $('language-bar');
  const t = () => T[lang];

  /* ---------------- Wave bars ---------------- */
  (function buildWave() {
    const wave = $('wave');
    const pattern = [.25,.4,.3,.55,.35,.7,.45,.9,.55,1,.7,.95,.5,.8,.4,.6,.3,.5,.35,.45,.3,.4,.25,.3,.2];
    pattern.forEach((h, i) => {
      const b = document.createElement('i');
      b.style.setProperty('--h', h);
      b.style.setProperty('--max', Math.min(1, h + .35 + Math.random() * .25).toFixed(2));
      b.style.setProperty('--d', (0.35 + Math.random() * 0.5).toFixed(2) + 's');
      b.style.setProperty('--dl', (-Math.random() * 0.6).toFixed(2) + 's');
      wave.appendChild(b);
    });
  })();

  /* ---------------- Text-to-Speech (Android Bridge) ---------------- */
  function speak(text, opts = {}) {
    if (!text) return;
    if (!opts.noRemember) lastSpoken = text;
    lastSpokenAt = Date.now();

    // Call native Android eSpeak NG
    if (window.AndroidTTS) {
      window.AndroidTTS.speak(text, lang);
    } else {
      console.warn('AndroidTTS bridge not found');
    }
  }

  function isTTSSpeaking() {
    if (window.AndroidTTS && window.AndroidTTS.isSpeaking) {
      try {
        return window.AndroidTTS.isSpeaking();
      } catch (_) {}
    }
    return false;
  }

  /* ---------------- Language ---------------- */
  function applyLanguageUI() {
    languageText.textContent = LANGS[lang].label;
    languageText.classList.toggle('ur', lang === 'ur');
    document.body.classList.toggle('lang-ur', lang === 'ur');
    if (!holding) listeningText.textContent = t().holdToSpeak;
    listeningText.classList.toggle('ur', lang === 'ur');
    renderObject();
    renderLocation();
  }

  function setLanguage(next, announce = true) {
    lang = next;
    try { localStorage.setItem('vg-lang', lang); } catch (_) {}
    applyLanguageUI();
    if (announce) speak(t().langChanged);
  }
  const toggleLanguage = () => setLanguage(lang === 'en' ? 'ur' : 'en');

  /* ---------------- Object display ---------------- */
  function objName(cls) { return lang === 'ur' ? (UR[cls] || cls) : cls.replace(/^./, c => c.toUpperCase()); }

  function renderObject() {
    objectText.classList.toggle('ur', lang === 'ur');
    if (!model) { objectText.textContent = t().loading; return; }
    if (!lastObject) { objectText.textContent = t().scanning; return; }
    objectText.textContent = t().detected(objName(lastObject.name), Math.round(lastObject.score * 100));
  }

  /* ---------------- Detection loop & Queue ---------------- */
  async function loadModel() {
    renderObject();
    try {
      model = await cocoSsd.load({ modelUrl: LOCAL_MODEL_URL });
    } catch (_) {
      try { model = await cocoSsd.load(); } catch (e) { console.error('Model load failed', e); }
    }
    renderObject();
    if (model) detectLoop();
  }

  function drawBoxes(preds) {
    const w = video.clientWidth, h = video.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    if (!video.videoWidth) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    const scale = Math.max(w / vw, h / vh);
    const ox = (w - vw * scale) / 2, oy = (h - vh * scale) / 2;
    ctx.lineWidth = 3; ctx.strokeStyle = '#5dd0ff';
    preds.forEach(p => {
      const [x, y, bw, bh] = p.bbox;
      ctx.strokeRect(x * scale + ox, y * scale + oy, bw * scale, bh * scale);
    });
  }

  async function detectLoop() {
    try {
      if (video.readyState >= 2 && !video.paused) {
        const preds = (await model.detect(video)).filter(p => p.score >= MIN_SCORE);
        drawBoxes(preds);
        currentDetections = preds;

        if (preds.length) {
          preds.sort((a, b) => b.score - a.score);
          const top = preds[0];
          lastObject = { name: top.class, score: top.score };
          renderObject();

          const frameWidth = video.videoWidth || 640;

          // Queue new or cooldown-expired object announcements
          preds.forEach(p => {
            const centerX = p.bbox[0] + (p.bbox[2] / 2);
            let direction = 'center';
            if (centerX < frameWidth * 0.33) direction = 'left';
            else if (centerX > frameWidth * 0.66) direction = 'right';

            const objectKey = `${p.class}_${direction}`;
            const isNew = objectKey !== lastSpokenObject;
            const now = Date.now();

            if (isNew || now - lastSpokenAt > SAME_OBJECT_COOLDOWN_MS) {
              const alreadyQueued = announcementQueue.some(item => item.key === objectKey);
              if (!alreadyQueued) {
                announcementQueue.push({ cls: p.class, dir: direction, key: objectKey });
              }
            }
          });
        } else {
          lastObject = null;
          renderObject();
          currentDetections = [];
        }
      }
    } catch (e) { console.warn('detect error', e); }
    setTimeout(detectLoop, DETECT_INTERVAL_MS);
  }

  function processAnnouncementQueue() {
    if (holding) return;
    if (isTTSSpeaking()) return;

    if (announcementQueue.length > 0) {
      const item = announcementQueue.shift();
      const stillValid = currentDetections.some(p => p.class === item.cls);
      if (stillValid) {
        lastSpokenObject = item.key;
        speak(t().spokenDetected(objName(item.cls), item.dir));
      } else {
        processAnnouncementQueue();
      }
    }
  }

  // Poll announcement queue
  setInterval(() => {
    if (!isTTSSpeaking()) {
      processAnnouncementQueue();
    }
  }, 350);

  /* ---------------- Camera ---------------- */
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      placeholder.hidden = true;
    } catch (e) {
      console.error(e);
      placeholder.hidden = false;
      placeholder.classList.add('error');
      placeholder.textContent = t().cameraError;
    }
  }

  /* ---------------- Location ---------------- */
  function fmtCoord(v, pos, neg) {
    return `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
  }

  function renderLocation() {
    locationText.classList.toggle('ur', lang === 'ur');
    if (!locationState) { locationText.textContent = t().tapLocation; return; }
    if (locationState.error) { locationText.textContent = locationState.error(lang); return; }
    locationText.textContent = locationState.display(lang);
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('nogeo'));
      navigator.geolocation.getCurrentPosition(resolve, reject,
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    });
  }

  async function reverseGeocode(lat, lon, code) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lon}&accept-language=${code}`;
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) return null;
      const j = await r.json();
      const a = j.address || {};
      const parts = [a.road || a.pedestrian || a.neighbourhood, a.suburb || a.village || a.town,
                     a.city || a.county, a.state].filter(Boolean);
      return parts.length ? [...new Set(parts)].slice(0, 3).join(', ') : (j.display_name || null);
    } catch (_) { return null; } finally { clearTimeout(timer); }
  }

  async function refreshLocation() {
    if (window.AndroidTTS && window.AndroidTTS.stop) window.AndroidTTS.stop();
    announcementQueue = [];
    locationState = null;
    locationText.classList.toggle('ur', lang === 'ur');
    locationText.textContent = t().locating;
    try {
      const pos = await getPosition();
      const { latitude: la, longitude: lo } = pos.coords;
      const coordsFor = l => `${fmtCoord(la, T[l].north, T[l].south)}, ${fmtCoord(lo, T[l].east, T[l].west)}`;
      const names = {};
      const [en, ur] = await Promise.all([reverseGeocode(la, lo, 'en'), reverseGeocode(la, lo, 'ur')]);
      names.en = en; names.ur = ur;
      locationState = {
        display: l => names[l] || coordsFor(l),
        speakable: l => names[l] || T[l].coords(la.toFixed(3), lo.toFixed(3))
      };
      renderLocation();
      speak(t().locationIs(locationState.speakable(lang)));
    } catch (e) {
      const noGeo = e && e.message === 'nogeo';
      locationState = { error: l => noGeo ? T[l].noGeo : T[l].locationFail };
      renderLocation();
      speak(locationState.error(lang));
    }
  }

  /* ---------------- Voice commands & On-Demand Queries ---------------- */
  let transcript = '';

  function norm(s) { return s.toLowerCase().replace(/[.,!?؟،"“”']/g, ' ').replace(/\s+/g, ' ').trim(); }
  const has = (text, list) => list.some(k => text.includes(k.toLowerCase()));

  function handleQuery(cls) {
    // Interruption: immediately stop current announcement and clear pending queue
    if (window.AndroidTTS && window.AndroidTTS.stop) {
      window.AndroidTTS.stop();
    }
    announcementQueue = [];

    const matches = currentDetections.filter(p => p.class === cls);
    if (matches.length === 0) {
      speak(t().queryNotFound(objName(cls)), { noRemember: true });
      return;
    }

    // Multiple instances: pick nearest (largest bounding box area = width * height)
    let nearest = matches[0];
    let maxArea = nearest.bbox[2] * nearest.bbox[3];
    for (let i = 1; i < matches.length; i++) {
      const area = matches[i].bbox[2] * matches[i].bbox[3];
      if (area > maxArea) {
        maxArea = area;
        nearest = matches[i];
      }
    }

    const frameWidth = video.videoWidth || 640;
    const centerX = nearest.bbox[0] + (nearest.bbox[2] / 2);
    let dir = 'center';
    if (centerX < frameWidth * 0.33) dir = 'left';
    else if (centerX > frameWidth * 0.66) dir = 'right';

    let resp = '';
    if (dir === 'left') resp = t().queryLeft(objName(cls));
    else if (dir === 'right') resp = t().queryRight(objName(cls));
    else resp = t().queryCenter(objName(cls));

    speak(resp, { noRemember: true });
  }

  function handleCommand(raw) {
    const text = norm(raw);
    if (!text) { listeningText.textContent = t().holdToSpeak; return; }
    listeningText.textContent = t().heard(raw);

    // Check on-demand queries ("where is <object>")
    if (text.includes('where is') || text.includes('kahan hai') || text.includes('kidhar hai')) {
      const validClasses = Object.keys(UR);
      const foundClass = validClasses.find(c => text.includes(c));
      if (foundClass) {
        handleQuery(foundClass);
        return;
      }
    }

    // Order matters: explicit language names before the generic "language".
    if (has(text, KEYWORDS.english) && !has(text, KEYWORDS.urdu)) {
      setLanguage('en');
      lastSpokenObject = "";
      announcementQueue = [];
      return;
    }
    if (has(text, KEYWORDS.urdu) && !has(text, KEYWORDS.english)) {
      setLanguage('ur');
      lastSpokenObject = "";
      announcementQueue = [];
      return;
    }
    if (has(text, KEYWORDS.language)) {
      toggleLanguage();
      lastSpokenObject = "";
      announcementQueue = [];
      return;
    }
    if (has(text, KEYWORDS.repeat)) {
      if (window.AndroidTTS && window.AndroidTTS.stop) window.AndroidTTS.stop();
      announcementQueue = [];
      lastSpoken ? speak(lastSpoken, { noRemember: true }) : speak(t().nothingToRepeat, { noRemember: true });
      lastSpokenObject = "";
      return;
    }
    if (has(text, KEYWORDS.location)) {
      if (window.AndroidTTS && window.AndroidTTS.stop) window.AndroidTTS.stop();
      announcementQueue = [];
      refreshLocation();
      lastSpokenObject = "";
      return;
    }
    listeningText.textContent = t().notUnderstood;
  }

  // Native Android Vosk will call this function continuously when it recognizes commands
  window.onSpeechResult = function(recognizedText) {
    if (isTTSSpeaking()) return;
    transcript = recognizedText;
    handleCommand(transcript);
    transcript = '';
  };

  function beginListeningUI() {
    holding = true;
    micBtn.classList.add('holding'); micBtn.setAttribute('aria-pressed', 'true');
    listeningBar.classList.add('active');
    listeningText.classList.toggle('ur', lang === 'ur');
    listeningText.textContent = t().listening;
  }
  
  function endListeningUI() {
    holding = false;
    micBtn.classList.remove('holding'); micBtn.setAttribute('aria-pressed', 'false');
    listeningBar.classList.remove('active');
    listeningText.textContent = t().holdToSpeak;
  }

  // Optional manual mic button interactions
  micBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { micBtn.setPointerCapture(e.pointerId); } catch (_) {}
    beginListeningUI();
    if (window.AndroidSTT) {
      window.AndroidSTT.startListening(lang);
    } else {
      listeningText.textContent = t().speechUnsupported;
    }
  });

  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev =>
    micBtn.addEventListener(ev, () => {
      endListeningUI();
    })
  );
  
  micBtn.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => {
    endListeningUI();
  });

  // Keyboard: hold Space / Enter on the mic button
  micBtn.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { 
      e.preventDefault(); 
      beginListeningUI();
      if (window.AndroidSTT) window.AndroidSTT.startListening(lang);
    }
  });
  micBtn.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') { 
      e.preventDefault(); 
      endListeningUI();
    }
  });

  /* ---------------- Tap sections ---------------- */
  const activate = (el, fn) => {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    });
  };
  activate(languageBar, toggleLanguage);   // whole Language section toggles EN <-> UR
  activate(locationBar, refreshLocation);  // whole Location section announces location

  /* ---------------- Init ---------------- */
  applyLanguageUI();
  startCamera();
  loadModel();

  // Initialize background continuous speech recognition
  if (window.AndroidSTT) {
    window.AndroidSTT.startListening(lang);
  }
})();