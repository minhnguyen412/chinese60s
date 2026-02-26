/**
 * writing-quiz.js  —  Chinese60s Writing Practice v2
 * ═══════════════════════════════════════════════════════════════════════
 * Data source: imagesData.json  (id, imageSrc, character, meaning, pinyin, audioSrc)
 * Characters with multiple hanzi each get their own stroke-tile + reveal panel.
 *
 * Scoring per card:
 *   0 wrong attempts  → 1.0 pt
 *   1 wrong attempt   → 0.5 pt
 *   2+ wrong attempts → 0.0 pt
 *   (one "attempt" = one wrong tile click)
 *
 * Tracking: calls window.saveWritingAttempt(postId, score, total, wrongList)
 *   if that function is not defined, falls back to console.log
 *
 * Login guard: checks window.__currentUser; if null, calls window.openLoginModal()
 *
 * Public API:
 *   WritingQuiz.open({ startId, endId, dataUrl })
 * ═══════════════════════════════════════════════════════════════════════
 */
(function (global) {
  'use strict';

  /* ══════════════ CONSTANTS ══════════════ */
  const HW_CDN = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/';

  /* ══════════════ STYLES ══════════════ */
  function injectStyles() {
    if (document.getElementById('wq-style')) return;
    const s = document.createElement('style');
    s.id = 'wq-style';
    s.textContent = `
/* ── Overlay ── */
.wq-overlay{
  position:fixed;inset:0;z-index:900;
  background:rgba(0,0,0,.55);
  display:flex;align-items:center;justify-content:center;
  padding:12px;animation:wqFadeIn .18s ease;
}
@keyframes wqFadeIn{from{opacity:0}to{opacity:1}}

.wq-panel{
  background:#fffef5;border:3px solid #222;border-radius:26px;
  box-shadow:8px 8px 0 #222;
  width:100%;max-width:980px;max-height:94vh;overflow-y:auto;
  padding:26px 26px 34px;position:relative;
  animation:wqSlide .22s cubic-bezier(.4,0,.2,1);
}
@keyframes wqSlide{from{transform:translateY(22px);opacity:0}to{transform:translateY(0);opacity:1}}

.wq-x{
  position:absolute;top:14px;right:18px;
  background:none;border:none;font-size:1.55rem;line-height:1;
  cursor:pointer;color:#bbb;transition:color .12s;
}
.wq-x:hover{color:#222;}

/* ── Top bar ── */
.wq-topbar{
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:10px;margin-bottom:16px;
}
.wq-badge{
  display:inline-flex;align-items:center;gap:7px;
  background:#c5b0f8;border:2.5px solid #222;border-radius:50px;
  padding:7px 20px;font-family:'Fredoka',sans-serif;font-weight:700;
  font-size:1.05rem;box-shadow:3px 3px 0 #222;
}
.wq-counter{
  font-family:'Fredoka',sans-serif;font-weight:700;
  font-size:.88rem;color:#999;
}

/* ── Progress ── */
.wq-bar-wrap{
  height:8px;background:#eee;border:2px solid #222;
  border-radius:50px;overflow:hidden;margin-bottom:22px;
}
.wq-bar-fill{
  height:100%;background:#7cb83e;border-radius:50px;
  transition:width .4s ease;
}

/* ══════════════════════════════════════
   CARD LAYOUT
   Left col (info) | Right area (panels)
══════════════════════════════════════ */
.wq-card{
  display:grid;
  grid-template-columns:200px 1fr;
  gap:16px;align-items:start;
}
@media(max-width:680px){.wq-card{grid-template-columns:1fr;}}

/* ── Left: image + info ── */
.wq-col-info{
  background:#fff;border:2.5px solid #222;border-radius:20px;
  box-shadow:4px 4px 0 #222;padding:18px 14px 20px;
  text-align:center;display:flex;flex-direction:column;
  align-items:center;gap:9px;
}
.wq-word-img{
  width:100%;max-width:160px;height:auto;
  border:2px solid #222;border-radius:12px;
  box-shadow:3px 3px 0 #222;object-fit:cover;
}
.wq-char-display{
  font-size:2.6rem;font-weight:700;color:#222;
  line-height:1;letter-spacing:.05em;user-select:none;
}
.wq-pinyin{
  font-family:'Fredoka',sans-serif;font-weight:600;
  font-size:1.05rem;color:#7cb83e;letter-spacing:.03em;
}
.wq-meaning{
  font-family:'Quicksand',sans-serif;font-weight:600;
  font-size:.88rem;color:#666;line-height:1.5;
  max-width:160px;text-align:center;
}
.wq-audio-btn{
  background:#ffd84d;border:2px solid #222;border-radius:50px;
  padding:5px 14px;font-family:'Fredoka',sans-serif;
  font-weight:700;font-size:.85rem;cursor:pointer;
  box-shadow:2px 2px 0 #222;transition:transform .12s,box-shadow .12s;
  display:inline-flex;align-items:center;gap:5px;
}
.wq-audio-btn:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #222;}
.wq-nstroke{
  display:inline-block;background:#f2fde0;border:1.5px solid #222;
  border-radius:50px;padding:3px 13px;
  font-family:'Fredoka',sans-serif;font-weight:700;font-size:.78rem;
  box-shadow:2px 2px 0 #222;
}

/* ── Right: character panels ── */
.wq-col-panels{
  display:flex;flex-direction:column;gap:14px;
}

/* One panel per character in the word */
.wq-char-panel{
  background:#fff;border:2.5px solid #222;border-radius:20px;
  box-shadow:4px 4px 0 #222;padding:14px;
}
.wq-char-panel-title{
  font-family:'Fredoka',sans-serif;font-weight:700;
  font-size:1.05rem;margin-bottom:10px;
  display:inline-flex;align-items:center;gap:8px;
}
.wq-char-panel-title .chn{font-size:1.4rem;}
.wq-char-panel-title .pinyin-sm{
  font-size:.82rem;color:#7cb83e;font-weight:600;
}

/* two-col inside each panel: tiles | canvas */
.wq-panel-inner{
  display:grid;grid-template-columns:1fr 190px;gap:12px;align-items:start;
}
@media(max-width:480px){.wq-panel-inner{grid-template-columns:1fr;}}

/* ── Tiles ── */
.wq-col-label{
  font-family:'Fredoka',sans-serif;font-weight:700;
  font-size:.75rem;color:#bbb;text-transform:uppercase;
  letter-spacing:.07em;text-align:center;margin-bottom:8px;
}
.wq-tiles-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(58px,1fr));
  gap:7px;
}
.wq-tile{
  width:58px;height:58px;background:#ffadc5;
  border:2.5px solid #222;border-radius:12px;
  box-shadow:3px 3px 0 #222;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:#222;
  transition:transform .12s,box-shadow .12s,background .12s,opacity .2s;
  user-select:none;
}
.wq-tile:hover:not(.wq-used):not(.wq-disabled){
  transform:translate(-2px,-3px);box-shadow:5px 5px 0 #222;background:#ffb89a;
}
.wq-tile.wq-used{opacity:0;pointer-events:none;}
.wq-tile.wq-disabled{pointer-events:none;}
.wq-tile.wq-correct{background:#d8f0a0;}
.wq-tile.wq-wrong{
  background:#ffe0e0;animation:wqShake .38s ease;
}
@keyframes wqShake{
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-7px)}40%{transform:translateX(7px)}
  60%{transform:translateX(-4px)}80%{transform:translateX(4px)}
}

/* ── Canvas ── */
.wq-col-canvas{
  display:flex;flex-direction:column;align-items:center;gap:8px;
}
.wq-canvas-box{
  position:relative;width:170px;height:170px;
  border:2px dashed #ddd;border-radius:13px;overflow:hidden;flex-shrink:0;
}
.wq-canvas-box::before,.wq-canvas-box::after{
  content:'';position:absolute;background:rgba(0,0,0,.05);
  pointer-events:none;z-index:1;
}
.wq-canvas-box::before{width:1px;height:100%;left:50%;top:0;}
.wq-canvas-box::after{height:1px;width:100%;top:50%;left:0;}
.wq-ghost,.wq-reveal{
  position:absolute;inset:0;
  display:flex;align-items:center;justify-content:center;
}
.wq-reveal{z-index:2;}
.wq-fb{
  font-family:'Fredoka',sans-serif;font-weight:700;
  font-size:.88rem;text-align:center;min-height:1.2em;
  transition:color .15s;
}
.wq-fb.ok{color:#5a8f27;}
.wq-fb.err{color:#e53935;}

/* ── Attempt dots ── */
.wq-attempts{
  display:flex;gap:4px;align-items:center;
  font-family:'Fredoka',sans-serif;font-size:.75rem;color:#999;
}
.wq-dot{
  width:10px;height:10px;border-radius:50%;
  border:1.5px solid #ccc;background:#eee;
  transition:background .2s,border-color .2s;
}
.wq-dot.wrong{background:#ffadc5;border-color:#e53935;}

/* ── Bottom buttons ── */
.wq-btnrow{
  display:flex;gap:10px;justify-content:center;
  flex-wrap:wrap;margin-top:20px;
}
.wq-btn{
  font-family:'Fredoka',sans-serif;font-weight:700;font-size:1rem;
  padding:10px 28px;border:2.5px solid #222;border-radius:50px;
  box-shadow:3px 3px 0 #222;cursor:pointer;
  transition:transform .12s,box-shadow .12s;
}
.wq-btn:hover:not(:disabled){transform:translate(-2px,-2px);box-shadow:5px 5px 0 #222;}
.wq-btn:disabled{opacity:.35;cursor:default;transform:none;}
.wq-btn-next{background:#7cb83e;color:#fff;}
.wq-btn-hint{background:#eaf8ff;color:#222;font-size:.88rem;padding:8px 18px;}
.wq-btn-retry{background:#ffd84d;color:#222;}

/* ── Loading ── */
.wq-loading{
  text-align:center;padding:52px 0;
  font-family:'Fredoka',sans-serif;color:#bbb;font-size:1rem;
}
.wq-dots{display:inline-flex;gap:7px;margin-top:14px;}
.wq-dots span{
  width:11px;height:11px;border-radius:50%;background:#c5b0f8;
  animation:wqBounce .8s ease-in-out infinite;
}
.wq-dots span:nth-child(2){animation-delay:.15s;background:#ffd84d;}
.wq-dots span:nth-child(3){animation-delay:.3s;background:#ffadc5;}
@keyframes wqBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}

/* ── Summary ── */
.wq-summary{text-align:center;padding:28px 0 10px;}
.wq-score-ring{
  width:112px;height:112px;border-radius:50%;
  border:3px solid #222;margin:0 auto 18px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  box-shadow:6px 6px 0 #222;font-family:'Fredoka',sans-serif;font-weight:700;
}
.wq-score-ring .big{font-size:1.8rem;line-height:1;}
.wq-score-ring .sm{font-size:.78rem;color:#888;}
.wq-summary h2{font-family:'Fredoka',sans-serif;font-weight:700;font-size:1.45rem;margin-bottom:7px;}
.wq-summary p{font-size:.95rem;color:#666;margin-bottom:20px;}
.wq-wrong-list{
  text-align:left;margin:0 auto 20px;max-width:480px;
  background:#fff;border:2px solid #222;border-radius:14px;
  padding:14px 16px;font-family:'Quicksand',sans-serif;font-size:.88rem;line-height:1.7;
}
.wq-wrong-list h4{font-family:'Fredoka',sans-serif;font-size:.95rem;margin-bottom:6px;}
.wq-wrong-item{padding:3px 0;border-bottom:1px solid #eee;}
.wq-wrong-item:last-child{border-bottom:none;}

/* ── Start screen ── */
.wq-start{text-align:center;padding:26px 0 10px;}
.wq-start p{
  font-family:'Fredoka',sans-serif;color:#666;
  font-size:.97rem;margin-bottom:22px;line-height:1.65;
}
    `;
    document.head.appendChild(s);
  }

  /* ══════════════ SVG HELPERS ══════════════ */
  const NS = 'http://www.w3.org/2000/svg';
  const HW_T = 'scale(1,-1) translate(0,-900)';

  function makeTileSVG(pathD, size = 40) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1024');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.style.cssText = 'display:block;pointer-events:none;';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', HW_T);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', pathD); p.setAttribute('fill', 'currentColor');
    g.appendChild(p); svg.appendChild(g);
    return svg;
  }

  function makeGhostSVG(strokes, size = 170) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1024');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.style.display = 'block';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', HW_T);
    strokes.forEach(d => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('fill', 'rgba(0,0,0,0.07)');
      g.appendChild(p);
    });
    svg.appendChild(g);
    return svg;
  }

  function makeRevealSVG(strokes, revealN, size = 170) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1024');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.style.display = 'block';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', HW_T);
    strokes.forEach((d, i) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      if (i < revealN) {
        p.setAttribute('fill', i === revealN - 1 ? '#5a8f27' : '#2a2a2a');
        if (i === revealN - 1) {
          p.style.transition = 'fill 0.7s ease';
          setTimeout(() => p.setAttribute('fill', '#2a2a2a'), 40);
        }
      } else {
        p.setAttribute('fill', 'rgba(0,0,0,0.07)');
      }
      g.appendChild(p);
    });
    svg.appendChild(g);
    return svg;
  }

  /* ══════════════ FETCH HW DATA ══════════════ */
  async function fetchCharData(char) {
    const c = (char || '').trim().charAt(0);
    if (!c) return null;
    try {
      const r = await fetch(`${HW_CDN}${encodeURIComponent(c)}.json`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      console.warn('[WritingQuiz] No stroke data for:', c, e.message);
      return null;
    }
  }

  /* ══════════════ UTILS ══════════════ */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ══════════════ MODULE STATE ══════════════ */
  let _cards      = [];   // filtered from imagesData.json
  let _idx        = 0;
  let _totalScore = 0;    // accumulated float score
  let _overlay    = null;

  // Per-card char state: array of {charStr, strokes, shuffled, placed, wrongCount, complete}
  let _charStates = [];

  // Tracking
  let _wrongLog = [];     // [{character, wrongAttempts}]

  /* ══════════════ SAVE TRACKING ══════════════ */
  async function saveWritingAttempt(score, total, wrongList) {
    // Use page's saveQuizAttempt if available, otherwise define own
    if (typeof window.saveWritingAttempt_custom === 'function') {
      window.saveWritingAttempt_custom(score, total, wrongList);
      return;
    }
    // Save to Firestore if Firebase is loaded
    if (!window.__currentUser) return;
    try {
      const { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp, increment } =
        await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const db  = getFirestore();
      const uid = window.__currentUser.uid;
      const p   = new URLSearchParams(window.location.search);
      const postId = p.get('id') || 'unknown';

      await addDoc(collection(db, 'writing_attempts'), {
        uid,
        postId:         String(postId),
        score:          score,
        totalCards:     total,
        wrongAnswers:   wrongList || [],
        timestamp:      serverTimestamp()
      });
      await setDoc(doc(db, 'users', uid), {
        writingScore:    increment(score),
        writingAttempts: increment(1)
      }, { merge: true });

      console.log('[WritingQuiz] attempt saved ✓', { postId, score, total });
    } catch(e) {
      console.warn('[WritingQuiz] saveWritingAttempt failed:', e);
    }
  }

  /* ══════════════ OVERLAY DOM ══════════════ */
  function buildOverlay() {
    const old = document.getElementById('wq-overlay');
    if (old) old.remove();

    const ov = document.createElement('div');
    ov.className = 'wq-overlay';
    ov.id = 'wq-overlay';

    const panel = document.createElement('div');
    panel.className = 'wq-panel';
    panel.innerHTML = `
      <button class="wq-x" id="wq-x-btn">✕</button>
      <div class="wq-topbar">
        <span class="wq-badge">✏️ Writing Practice</span>
        <span class="wq-counter" id="wq-ctr"></span>
      </div>
      <div class="wq-bar-wrap"><div class="wq-bar-fill" id="wq-bar" style="width:0%"></div></div>
      <div id="wq-body"></div>
    `;

    ov.appendChild(panel);
    document.body.appendChild(ov);
    _overlay = ov;

    document.getElementById('wq-x-btn').onclick = closeOverlay;
    ov.addEventListener('click', e => { if (e.target === ov) closeOverlay(); });
  }

  function closeOverlay() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
  }

  function getBody() { return document.getElementById('wq-body'); }

  function setProgress(done, total) {
    const ctr = document.getElementById('wq-ctr');
    const bar = document.getElementById('wq-bar');
    if (ctr) ctr.textContent = total ? `${done} / ${total}` : '';
    if (bar) bar.style.width = total ? `${(done / total) * 100}%` : '0%';
  }

  /* ══════════════ START SCREEN ══════════════ */
  function showStart() {
    setProgress(0, _cards.length);
    getBody().innerHTML = `
      <div class="wq-start">
        <p>Practice writing <strong>${_cards.length}</strong> Chinese character${_cards.length !== 1 ? 's' : ''}.<br>
           Click each stroke in the correct order to complete each character!</p>
        <p style="font-size:.85rem;color:#aaa;margin-top:-10px;">
          ✅ No mistakes = 1 pt &nbsp;|&nbsp; 1 mistake = 0.5 pt &nbsp;|&nbsp; 2+ mistakes = 0 pt
        </p>
        <div class="wq-btnrow">
          <button class="wq-btn wq-btn-next" id="wq-start-btn">▶ Start</button>
        </div>
      </div>`;
    document.getElementById('wq-start-btn').onclick = () => loadCard(0);
  }

  /* ══════════════ LOADING SCREEN ══════════════ */
  function showLoading(chars) {
    getBody().innerHTML = `
      <div class="wq-loading">
        Loading stroke data for <strong style="font-size:1.4em">${chars}</strong>…
        <br><div class="wq-dots"><span></span><span></span><span></span></div>
      </div>`;
  }

  /* ══════════════ LOAD CARD ══════════════ */
  async function loadCard(idx) {
    if (idx >= _cards.length) { showSummary(); return; }
    _idx = idx;

    const card = _cards[idx];
    const chars = [...(card.character || '')];
    setProgress(idx, _cards.length);
    showLoading(card.character);

    // Fetch stroke data for every character in the word
    const dataArr = await Promise.all(chars.map(c => fetchCharData(c)));

    _charStates = chars.map((c, ci) => {
      const d = dataArr[ci];
      const strokes = (d && Array.isArray(d.strokes) && d.strokes.length > 0) ? d.strokes : null;
      const shuffled = strokes ? shuffle(strokes.map((path, origIdx) => ({ origIdx, path }))) : null;
      return {
        charStr:    c,
        strokes,
        shuffled,
        placed:     0,
        wrongCount: 0,   // wrong attempts for this character
        complete:   false
      };
    });

    renderCard(card);
  }

  /* ══════════════ RENDER CARD ══════════════ */
  function renderCard(card) {
    const chars = [...(card.character || '')];

    // Build right-side panels HTML (one per character)
    const panelsHTML = _charStates.map((cs, ci) => {
      if (!cs.strokes) {
        return `
          <div class="wq-char-panel" id="wq-panel-${ci}">
            <div class="wq-char-panel-title">
              <span class="chn">${cs.charStr}</span>
              <span style="font-family:'Fredoka',sans-serif;font-size:.82rem;color:#e53935;">No stroke data available</span>
            </div>
          </div>`;
      }
      return `
        <div class="wq-char-panel" id="wq-panel-${ci}">
          <div class="wq-char-panel-title">
            <span class="chn">${cs.charStr}</span>
            <span class="pinyin-sm">${getPinyinForChar(card, ci)}</span>
            <span class="wq-nstroke" style="margin-left:4px">${cs.strokes.length} strokes</span>
          </div>
          <div class="wq-panel-inner">
            <!-- TILES -->
            <div>
              <div class="wq-col-label">Click strokes in order</div>
              <div class="wq-tiles-grid" id="wq-tiles-${ci}"></div>
            </div>
            <!-- CANVAS -->
            <div class="wq-col-canvas">
              <div class="wq-col-label">Result</div>
              <div class="wq-canvas-box" id="wq-cbox-${ci}">
                <div class="wq-ghost"  id="wq-ghost-${ci}"></div>
                <div class="wq-reveal" id="wq-reveal-${ci}"></div>
              </div>
              <div class="wq-fb" id="wq-fb-${ci}"></div>
              <div class="wq-attempts" id="wq-att-${ci}">
                <span style="font-size:.72rem">Attempts:</span>
                <div class="wq-dot" id="wq-dot-${ci}-0"></div>
                <div class="wq-dot" id="wq-dot-${ci}-1"></div>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    getBody().innerHTML = `
      <div class="wq-card">
        <!-- LEFT: word info -->
        <div class="wq-col-info">
          ${card.imageSrc ? `<img class="wq-word-img" src="${card.imageSrc}" alt="${card.character}">` : ''}
          <div class="wq-char-display">${card.character}</div>
          <div class="wq-pinyin">${card.pinyin || ''}</div>
          <div class="wq-meaning">${card.meaning || ''}</div>
          ${card.audioSrc ? `<button class="wq-audio-btn" id="wq-audio-btn">🔊 Listen</button>` : ''}
        </div>
        <!-- RIGHT: per-character panels -->
        <div class="wq-col-panels">${panelsHTML}</div>
      </div>
      <div class="wq-btnrow">
        <button class="wq-btn wq-btn-hint" id="wq-hint-btn">💡 Hint</button>
        <button class="wq-btn wq-btn-next" id="wq-next-btn" disabled>Next →</button>
      </div>
    `;

    // Audio
    if (card.audioSrc) {
      const audioEl = new Audio(card.audioSrc);
      document.getElementById('wq-audio-btn').addEventListener('click', () => {
        audioEl.currentTime = 0; audioEl.play().catch(() => {});
      });
      // Auto-play once
      audioEl.play().catch(() => {});
    }

    // Build tiles and ghost SVG per character
    _charStates.forEach((cs, ci) => {
      if (!cs.strokes) return;

      // Ghost
      document.getElementById(`wq-ghost-${ci}`).appendChild(makeGhostSVG(cs.strokes, 170));
      updateReveal(ci);

      // Tiles
      const tilesEl = document.getElementById(`wq-tiles-${ci}`);
      cs.shuffled.forEach((item, ti) => {
        const tile = document.createElement('div');
        tile.className = 'wq-tile';
        tile.dataset.ti   = ti;
        tile.dataset.orig = item.origIdx;
        tile.appendChild(makeTileSVG(item.path, 38));
        tile.addEventListener('click', () => handleTileClick(tile, item.origIdx, ci));
        tilesEl.appendChild(tile);
      });
    });

    // Hint button: hint for first incomplete character
    document.getElementById('wq-hint-btn').addEventListener('click', () => {
      const ci = _charStates.findIndex(cs => !cs.complete && cs.strokes);
      if (ci !== -1) useHint(ci);
    });

    document.getElementById('wq-next-btn').addEventListener('click', () => {
      scoreCard();
      loadCard(_idx + 1);
    });
  }

  /* ══════════════ PINYIN HELPER ══════════════ */
  // For multi-char words, try to split pinyin by spaces, else show full pinyin for char 0 only
  function getPinyinForChar(card, ci) {
    if (!card.pinyin) return '';
    const parts = card.pinyin.split(/\s+/);
    return parts[ci] || (ci === 0 ? card.pinyin : '');
  }

  /* ══════════════ INTERACTION ══════════════ */
  function handleTileClick(tile, origIdx, ci) {
    if (tile.classList.contains('wq-used') || tile.classList.contains('wq-disabled')) return;
    const cs = _charStates[ci];
    if (cs.complete) return;

    if (origIdx === cs.placed) {
      // ✅ Correct
      tile.classList.add('wq-used', 'wq-correct');
      cs.placed++;
      updateReveal(ci);

      const fb = document.getElementById(`wq-fb-${ci}`);
      if (cs.placed === cs.strokes.length) {
        cs.complete = true;
        disableCharTiles(ci);
        fb.textContent = '🎉 Complete!';
        fb.className = 'wq-fb ok';
        checkAllComplete();
      } else {
        fb.textContent = `✓ Stroke ${cs.placed}/${cs.strokes.length}`;
        fb.className = 'wq-fb ok';
      }
    } else {
      // ❌ Wrong
      cs.wrongCount++;
      tile.classList.add('wq-wrong');

      // Update attempt dots
      const dotIdx = Math.min(cs.wrongCount - 1, 1);
      const dot = document.getElementById(`wq-dot-${ci}-${dotIdx}`);
      if (dot) dot.classList.add('wrong');

      const fb = document.getElementById(`wq-fb-${ci}`);
      fb.textContent = `✗ Wrong! Find stroke #${cs.placed + 1}`;
      fb.className = 'wq-fb err';
      setTimeout(() => tile.classList.remove('wq-wrong'), 400);
    }
  }

  function updateReveal(ci) {
    const el = document.getElementById(`wq-reveal-${ci}`);
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(makeRevealSVG(_charStates[ci].strokes, _charStates[ci].placed, 170));
  }

  function disableCharTiles(ci) {
    document.querySelectorAll(`#wq-tiles-${ci} .wq-tile`).forEach(t => t.classList.add('wq-disabled'));
  }

  function checkAllComplete() {
    const allDone = _charStates.every(cs => cs.complete || !cs.strokes);
    const nextBtn = document.getElementById('wq-next-btn');
    if (allDone && nextBtn) nextBtn.disabled = false;
  }

  function useHint(ci) {
    const cs = _charStates[ci];
    if (!cs || cs.complete || cs.placed >= cs.strokes.length) return;

    const expectedOrig = cs.placed;
    document.querySelectorAll(`#wq-tiles-${ci} .wq-tile`).forEach(tile => {
      if (parseInt(tile.dataset.orig) === expectedOrig && !tile.classList.contains('wq-used')) {
        tile.style.outline = '3px solid #7cb83e';
        setTimeout(() => { tile.style.outline = ''; tile.click(); }, 340);
      }
    });
  }

  /* ══════════════ SCORE CARD ══════════════ */
  function scoreCard() {
    const card = _cards[_idx];
    let cardScore = 0;

    _charStates.forEach(cs => {
      if (!cs.strokes) return; // skip chars with no data
      let pts;
      if (cs.wrongCount === 0)      pts = 1.0;
      else if (cs.wrongCount === 1)  pts = 0.5;
      else                           pts = 0.0;

      cardScore += pts;

      if (cs.wrongCount > 0) {
        _wrongLog.push({
          character:    cs.charStr,
          word:         card.character,
          wrongAttempts: cs.wrongCount,
          pointsEarned:  pts
        });
      }
    });

    // Normalise to 1 card = 1 unit by averaging across chars that had data
    const tracked = _charStates.filter(cs => cs.strokes).length;
    if (tracked > 0) _totalScore += cardScore / tracked;
  }

  /* ══════════════ SUMMARY ══════════════ */
  function showSummary() {
    const total = _cards.length;
    const score = Math.round(_totalScore * 10) / 10;
    const pct   = total ? Math.round((_totalScore / total) * 100) : 0;
    setProgress(total, total);

    // Save to Firestore
    saveWritingAttempt(score, total, _wrongLog);

    let bg, title, msg;
    if (pct >= 80) {
      bg = '#f2fde0'; title = '🎉 Excellent!';
      msg = `You scored ${score}/${total} (${pct}%). Amazing work!`;
    } else if (pct >= 50) {
      bg = '#fffbe6'; title = '👍 Good effort!';
      msg = `You scored ${score}/${total} (${pct}%). Keep practicing!`;
    } else {
      bg = '#fff2f6'; title = '💪 Keep going!';
      msg = `You scored ${score}/${total} (${pct}%). Try again!`;
    }

    // Build wrong-answer list
    let wrongHTML = '';
    if (_wrongLog.length > 0) {
      wrongHTML = `
        <div class="wq-wrong-list">
          <h4>📝 Characters to review:</h4>
          ${_wrongLog.map(w => `
            <div class="wq-wrong-item">
              <strong>${w.character}</strong> (in "${w.word}") — 
              ${w.wrongAttempts} mistake${w.wrongAttempts !== 1 ? 's' : ''} → 
              <strong>${w.pointsEarned} pt</strong>
            </div>`).join('')}
        </div>`;
    }

    getBody().innerHTML = `
      <div class="wq-summary">
        <div class="wq-score-ring" style="background:${bg}">
          <span class="big">${score}/${total}</span>
          <span class="sm">points</span>
        </div>
        <h2>${title}</h2>
        <p>${msg}</p>
        ${wrongHTML}
        <div class="wq-btnrow">
          <button class="wq-btn wq-btn-retry" id="wq-retry-btn">▶ Try Again</button>
          <button class="wq-btn" style="background:#eee" id="wq-close-final">✕ Close</button>
        </div>
      </div>`;

    document.getElementById('wq-retry-btn').onclick = () => {
      _idx = 0; _totalScore = 0; _wrongLog = [];
      loadCard(0);
    };
    document.getElementById('wq-close-final').onclick = closeOverlay;
  }

  /* ══════════════ PUBLIC API ══════════════ */
  const WritingQuiz = {
    /**
     * Open the Writing Quiz overlay.
     * @param {object} opts
     *   opts.startId  — inclusive start ID from imagesData.json
     *   opts.endId    — inclusive end ID
     *   opts.dataUrl  — path to imagesData.json (default: 'data/imagesData.json')
     */
    open: async function (opts) {
      opts = opts || {};

      // ── LOGIN GUARD ──
      if (!window.__currentUser) {
        if (typeof window.openLoginModal === 'function') window.openLoginModal();
        return;
      }

      injectStyles();

      const startId = opts.startId || 1;
      const endId   = opts.endId   || 9999;
      const url     = opts.dataUrl || 'data/imagesData.json';

      let all = [];
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        all = await r.json();
      } catch (e) {
        console.error('[WritingQuiz] Cannot load', url, e);
        alert('Could not load writing data.');
        return;
      }

      _cards = all.filter(c => {
        const id = parseInt(c.id);
        return id >= startId && id <= endId;
      });

      if (_cards.length === 0) {
        alert('No characters found in the selected ID range.');
        return;
      }

      _idx = 0; _totalScore = 0; _wrongLog = [];
      buildOverlay();
      showStart();
    }
  };

  global.WritingQuiz = WritingQuiz;

}(window));
