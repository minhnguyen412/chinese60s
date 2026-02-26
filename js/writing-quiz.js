/**
 * writing-quiz.js  —  Chinese60s Writing Practice
 * ═══════════════════════════════════════════════════════════════════════
 * Overlay 3 cột giống word-canvas:
 *   [LEFT]   Thông tin chữ: character lớn, pinyin, nghĩa, số nét
 *   [MIDDLE] Tile các nét riêng lẻ (SVG path từ HanziWriter CDN) xáo trộn
 *   [RIGHT]  Khung canvas: nét mờ overlay, click tile → nét xuất hiện
 *
 * Logic đúng/sai:
 *   - Click tile đúng thứ tự  → nét flash xanh rồi đen, tile ẩn đi
 *   - Click tile sai thứ tự   → tile rung đỏ, feedback báo sai
 *   - Đặt hết nét             → "Hoàn hảo!", nút Next sáng
 *   - Next                    → card tiếp, cards lấy từ writing-quiz.json
 *
 * Public API:
 *   WritingQuiz.open({ startId, endId, dataUrl })
 * ═══════════════════════════════════════════════════════════════════════
 */
(function (global) {
  'use strict';

  /* ═══════════════ CONSTANTS ════════════════ */
  const HW_CDN = 'https://raw.githubusercontent.com/chanind/hanzi-writer-data/master/';

  /* ═══════════════ STYLES ════════════════ */
  function injectStyles() {
    if (document.getElementById('wq-style')) return;
    const s = document.createElement('style');
    s.id = 'wq-style';
    s.textContent = `
/* Overlay backdrop */
.wq-overlay {
  position:fixed; inset:0; z-index:900;
  background:rgba(0,0,0,.52);
  display:flex; align-items:center; justify-content:center;
  padding:12px;
  animation:wqFadeIn .18s ease;
}
@keyframes wqFadeIn{from{opacity:0}to{opacity:1}}

/* Main panel */
.wq-panel {
  background:#fffef5;
  border:3px solid #222;
  border-radius:26px;
  box-shadow:8px 8px 0 #222;
  width:100%; max-width:900px;
  max-height:94vh; overflow-y:auto;
  padding:26px 26px 34px;
  position:relative;
  animation:wqSlide .22s cubic-bezier(.4,0,.2,1);
}
@keyframes wqSlide{from{transform:translateY(22px);opacity:0}to{transform:translateY(0);opacity:1}}

/* Close button */
.wq-x{
  position:absolute; top:14px; right:18px;
  background:none; border:none; font-size:1.55rem;
  line-height:1; cursor:pointer; color:#bbb; transition:color .12s;
}
.wq-x:hover{color:#222;}

/* Top bar */
.wq-topbar{
  display:flex; align-items:center;
  justify-content:space-between; flex-wrap:wrap;
  gap:10px; margin-bottom:16px;
}
.wq-badge{
  display:inline-flex; align-items:center; gap:7px;
  background:#c5b0f8; border:2.5px solid #222;
  border-radius:50px; padding:7px 20px;
  font-family:'Fredoka',sans-serif; font-weight:700; font-size:1.05rem;
  box-shadow:3px 3px 0 #222;
}
.wq-counter{
  font-family:'Fredoka',sans-serif; font-weight:700;
  font-size:.88rem; color:#999;
}

/* Progress bar */
.wq-bar-wrap{
  height:8px; background:#eee;
  border:2px solid #222; border-radius:50px;
  overflow:hidden; margin-bottom:22px;
}
.wq-bar-fill{
  height:100%; background:#7cb83e; border-radius:50px;
  transition:width .4s ease;
}

/* ── 3-column card layout (mirrors word-canvas style) ── */
.wq-card{
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  gap:16px; align-items:start;
}
@media(max-width:680px){.wq-card{grid-template-columns:1fr;}}

/* LEFT: character info */
.wq-col-info{
  background:#fff;
  border:2.5px solid #222; border-radius:20px;
  box-shadow:4px 4px 0 #222;
  padding:20px 16px 22px;
  text-align:center;
  display:flex; flex-direction:column; align-items:center; gap:9px;
}
.wq-char-big{
  font-size:5rem; line-height:1;
  font-weight:700; color:#222; user-select:none;
}
.wq-pinyin{
  font-family:'Fredoka',sans-serif; font-weight:600;
  font-size:1.15rem; color:#7cb83e; letter-spacing:.03em;
}
.wq-meaning{
  font-family:'Quicksand',sans-serif; font-weight:600;
  font-size:.9rem; color:#666; line-height:1.5;
  max-width:150px; text-align:center;
}
.wq-nstroke{
  display:inline-block;
  background:#f2fde0; border:1.5px solid #222; border-radius:50px;
  padding:3px 13px;
  font-family:'Fredoka',sans-serif; font-weight:700; font-size:.8rem;
  box-shadow:2px 2px 0 #222;
}

/* MIDDLE: shuffled stroke tiles */
.wq-col-tiles{
  background:#fff;
  border:2.5px solid #222; border-radius:20px;
  box-shadow:4px 4px 0 #222;
  padding:14px; min-height:200px;
}
.wq-col-label{
  font-family:'Fredoka',sans-serif; font-weight:700;
  font-size:.78rem; color:#bbb; text-transform:uppercase;
  letter-spacing:.07em; text-align:center; margin-bottom:10px;
}
.wq-tiles-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(62px,1fr));
  gap:8px;
}

/* Single stroke tile */
.wq-tile{
  width:62px; height:62px;
  background:#ffadc5;
  border:2.5px solid #222; border-radius:13px;
  box-shadow:3px 3px 0 #222;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:#222;
  transition:transform .12s, box-shadow .12s, background .12s, opacity .2s;
  user-select:none;
}
.wq-tile:hover:not(.wq-used):not(.wq-disabled){
  transform:translate(-2px,-3px);
  box-shadow:5px 5px 0 #222;
  background:#ffb89a;
}
.wq-tile.wq-used{opacity:0; pointer-events:none;}
.wq-tile.wq-disabled{pointer-events:none;}
.wq-tile.wq-correct{background:#d8f0a0;}
.wq-tile.wq-wrong{
  background:#ffe0e0;
  animation:wqShake .38s ease;
}
@keyframes wqShake{
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-7px)}
  40%{transform:translateX(7px)}
  60%{transform:translateX(-4px)}
  80%{transform:translateX(4px)}
}

/* RIGHT: canvas */
.wq-col-canvas{
  background:#fff;
  border:2.5px solid #222; border-radius:20px;
  box-shadow:4px 4px 0 #222;
  padding:14px;
  display:flex; flex-direction:column; align-items:center; gap:10px;
}
.wq-canvas-box{
  position:relative;
  width:180px; height:180px;
  border:2px dashed #ddd; border-radius:13px;
  overflow:hidden; flex-shrink:0;
}
/* crosshair guides */
.wq-canvas-box::before,.wq-canvas-box::after{
  content:''; position:absolute;
  background:rgba(0,0,0,.05); pointer-events:none; z-index:1;
}
.wq-canvas-box::before{width:1px;height:100%;left:50%;top:0;}
.wq-canvas-box::after{height:1px;width:100%;top:50%;left:0;}

.wq-ghost,.wq-reveal{
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
}
.wq-reveal{z-index:2;}

/* Feedback text */
.wq-fb{
  font-family:'Fredoka',sans-serif; font-weight:700;
  font-size:.95rem; text-align:center; min-height:1.35em;
  transition:color .15s;
}
.wq-fb.ok{color:#5a8f27;}
.wq-fb.err{color:#e53935;}

/* Bottom buttons */
.wq-btnrow{
  display:flex; gap:10px; justify-content:center;
  flex-wrap:wrap; margin-top:20px;
}
.wq-btn{
  font-family:'Fredoka',sans-serif; font-weight:700; font-size:1rem;
  padding:10px 28px; border:2.5px solid #222; border-radius:50px;
  box-shadow:3px 3px 0 #222; cursor:pointer;
  transition:transform .12s, box-shadow .12s;
}
.wq-btn:hover:not(:disabled){transform:translate(-2px,-2px);box-shadow:5px 5px 0 #222;}
.wq-btn:disabled{opacity:.35;cursor:default;transform:none;}
.wq-btn-next {background:#7cb83e;color:#fff;}
.wq-btn-hint {background:#eaf8ff;color:#222;font-size:.88rem;padding:8px 18px;}
.wq-btn-retry{background:#ffd84d;color:#222;}

/* Loading dots */
.wq-loading{
  text-align:center; padding:52px 0;
  font-family:'Fredoka',sans-serif; color:#bbb; font-size:1rem;
}
.wq-dots{display:inline-flex;gap:7px;margin-top:14px;}
.wq-dots span{
  width:11px;height:11px;border-radius:50%;background:#c5b0f8;
  animation:wqBounce .8s ease-in-out infinite;
}
.wq-dots span:nth-child(2){animation-delay:.15s;background:#ffd84d;}
.wq-dots span:nth-child(3){animation-delay:.3s;background:#ffadc5;}
@keyframes wqBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}

/* Summary */
.wq-summary{text-align:center;padding:28px 0 10px;}
.wq-score-ring{
  width:112px;height:112px;border-radius:50%;
  border:3px solid #222;margin:0 auto 18px;
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  box-shadow:6px 6px 0 #222;
  font-family:'Fredoka',sans-serif;font-weight:700;
}
.wq-score-ring .big{font-size:2rem;line-height:1;}
.wq-score-ring .sm{font-size:.8rem;color:#888;}
.wq-summary h2{
  font-family:'Fredoka',sans-serif;font-weight:700;
  font-size:1.45rem;margin-bottom:7px;
}
.wq-summary p{font-size:.95rem;color:#666;margin-bottom:20px;}

/* Start screen */
.wq-start{text-align:center;padding:26px 0 10px;}
.wq-start p{
  font-family:'Fredoka',sans-serif;color:#666;
  font-size:.97rem;margin-bottom:22px;line-height:1.65;
}
    `;
    document.head.appendChild(s);
  }

  /* ═══════════════ SVG HELPERS ════════════════ */
  const NS = 'http://www.w3.org/2000/svg';
  const HW_TRANSFORM = 'scale(1,-1) translate(0,-900)'; // HanziWriter coord flip

  /** <svg> 1 nét duy nhất (cho tile) */
  function makeTileSVG(pathD, size = 44) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1024');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.cssText = 'display:block;pointer-events:none;';

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', HW_TRANSFORM);

    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', pathD);
    p.setAttribute('fill', 'currentColor');
    g.appendChild(p);
    svg.appendChild(g);
    return svg;
  }

  /** <svg> toàn bộ chữ mờ (ghost overlay) */
  function makeGhostSVG(strokes, size = 180) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1024');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.display = 'block';

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', HW_TRANSFORM);
    strokes.forEach(d => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'rgba(0,0,0,0.07)');
      g.appendChild(p);
    });
    svg.appendChild(g);
    return svg;
  }

  /** <svg> với n nét đầu được tô đen, còn lại mờ. nét cuối flash xanh */
  function makeRevealSVG(strokes, revealN, size = 180) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1024');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.display = 'block';

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', HW_TRANSFORM);

    strokes.forEach((d, i) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      if (i < revealN) {
        if (i === revealN - 1) {
          // nét vừa đặt → flash xanh rồi fade về đen
          p.setAttribute('fill', '#5a8f27');
          p.style.transition = 'fill 0.7s ease';
          setTimeout(() => p.setAttribute('fill', '#2a2a2a'), 40);
        } else {
          p.setAttribute('fill', '#2a2a2a');
        }
      } else {
        p.setAttribute('fill', 'rgba(0,0,0,0.07)');
      }
      g.appendChild(p);
    });
    svg.appendChild(g);
    return svg;
  }

  /* ═══════════════ FETCH HANZIWRITER DATA ════════════════ */
  async function fetchCharData(char) {
    const code = char.codePointAt(0).toString(16).toLowerCase();
    try {
      const r = await fetch(`${HW_CDN}${code}.json`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      console.warn('[WritingQuiz] No stroke data for', char, e.message);
      return null;
    }
  }

  /* ═══════════════ SHUFFLE ════════════════ */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ═══════════════ MODULE STATE ════════════════ */
  let _chars    = [];   // danh sách character objects từ JSON
  let _idx      = 0;    // index card hiện tại
  let _score    = 0;    // số card hoàn thành không dùng hint
  let _overlay  = null;
  let _strokes  = [];   // mảng path strings theo thứ tự đúng
  let _shuffled = [];   // [{origIdx, path}] đã xáo
  let _placed   = 0;    // số nét đã click đúng
  let _usedHint = false;

  /* ═══════════════ OVERLAY DOM ════════════════ */
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
        <span class="wq-badge">✏️ Luyện Viết</span>
        <span class="wq-counter" id="wq-ctr"></span>
      </div>
      <div class="wq-bar-wrap">
        <div class="wq-bar-fill" id="wq-bar" style="width:0%"></div>
      </div>
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

  /* ═══════════════ HELPER: body element ════════════════ */
  function getBody() { return document.getElementById('wq-body'); }

  function setProgress(done, total) {
    const ctr = document.getElementById('wq-ctr');
    const bar = document.getElementById('wq-bar');
    if (ctr) ctr.textContent = total ? `${done} / ${total}` : '';
    if (bar) bar.style.width = total ? `${(done / total) * 100}%` : '0%';
  }

  /* ═══════════════ SCREENS ════════════════ */

  /* Start screen */
  function showStart() {
    setProgress(0, _chars.length);
    getBody().innerHTML = `
      <div class="wq-start">
        <p>Luyện viết <strong>${_chars.length}</strong> chữ Hán.<br>
           Click vào các nét theo đúng thứ tự để hoàn thành từng chữ!</p>
        <div class="wq-btnrow">
          <button class="wq-btn wq-btn-next" id="wq-start-btn">▶ Bắt đầu</button>
        </div>
      </div>`;
    document.getElementById('wq-start-btn').onclick = () => loadCard(0);
  }

  /* Loading placeholder */
  function showLoading(char) {
    getBody().innerHTML = `
      <div class="wq-loading">
        Đang tải nét chữ <strong style="font-size:1.4em">${char}</strong>…
        <br><div class="wq-dots"><span></span><span></span><span></span></div>
      </div>`;
  }

  /* Load & render a card */
  async function loadCard(idx) {
    if (idx >= _chars.length) { showSummary(); return; }

    _idx      = idx;
    _placed   = 0;
    _usedHint = false;

    const ch = _chars[idx];
    setProgress(idx, _chars.length);
    showLoading(ch.character);

    const data = await fetchCharData(ch.character);

    // Validate stroke data
    if (!data || !Array.isArray(data.strokes) || data.strokes.length === 0) {
      getBody().innerHTML = `
        <div class="wq-loading">
          ⚠️ Không có dữ liệu nét cho "<strong>${ch.character}</strong>"
          <div class="wq-btnrow" style="margin-top:18px">
            <button class="wq-btn wq-btn-next" id="wq-skip-btn">Bỏ qua →</button>
          </div>
        </div>`;
      document.getElementById('wq-skip-btn').onclick = () => loadCard(idx + 1);
      return;
    }

    _strokes  = data.strokes;
    _shuffled = _strokes.map((path, origIdx) => ({ origIdx, path }));
    shuffle(_shuffled);

    renderCard(ch);
  }

  /* Render 3-col card */
  function renderCard(ch) {
    const n = _strokes.length;

    getBody().innerHTML = `
      <div class="wq-card">

        <!-- LEFT: char info -->
        <div class="wq-col-info">
          <div class="wq-char-big">${ch.character}</div>
          <div class="wq-pinyin">${ch.pinyin || ''}</div>
          <div class="wq-meaning">${ch.meaning || ''}</div>
          <span class="wq-nstroke">${n} nét</span>
        </div>

        <!-- MIDDLE: shuffled tiles -->
        <div class="wq-col-tiles">
          <div class="wq-col-label">Click nét theo thứ tự</div>
          <div class="wq-tiles-grid" id="wq-tiles"></div>
        </div>

        <!-- RIGHT: canvas -->
        <div class="wq-col-canvas">
          <div class="wq-col-label">Kết quả</div>
          <div class="wq-canvas-box" id="wq-cbox">
            <div class="wq-ghost"  id="wq-ghost"></div>
            <div class="wq-reveal" id="wq-reveal"></div>
          </div>
          <div class="wq-fb" id="wq-fb"></div>
        </div>

      </div>

      <div class="wq-btnrow">
        <button class="wq-btn wq-btn-hint" id="wq-hint-btn">💡 Gợi ý</button>
        <button class="wq-btn wq-btn-next" id="wq-next-btn" disabled>Tiếp theo →</button>
      </div>
    `;

    // Ghost SVG (full char faint)
    document.getElementById('wq-ghost').appendChild(makeGhostSVG(_strokes, 180));

    // Initial reveal SVG (0 strokes shown)
    updateReveal();

    // Build shuffled tile buttons
    const tilesEl = document.getElementById('wq-tiles');
    _shuffled.forEach((item, ti) => {
      const tile = document.createElement('div');
      tile.className    = 'wq-tile';
      tile.dataset.ti   = ti;
      tile.dataset.orig = item.origIdx;
      tile.appendChild(makeTileSVG(item.path, 42));
      tile.addEventListener('click', () => handleTileClick(tile, item.origIdx));
      tilesEl.appendChild(tile);
    });

    // Button handlers
    document.getElementById('wq-hint-btn').addEventListener('click', useHint);
    document.getElementById('wq-next-btn').addEventListener('click', () => loadCard(_idx + 1));
  }

  /* ═══════════════ INTERACTION ════════════════ */

  function handleTileClick(tile, origIdx) {
    if (tile.classList.contains('wq-used') || tile.classList.contains('wq-disabled')) return;

    if (origIdx === _placed) {
      // ✅ ĐÚNG thứ tự
      tile.classList.add('wq-used', 'wq-correct');
      _placed++;
      updateReveal();

      const fb = document.getElementById('wq-fb');
      if (_placed === _strokes.length) {
        // Hoàn thành toàn bộ nét!
        disableAllTiles();
        fb.textContent = '🎉 Hoàn hảo!';
        fb.className   = 'wq-fb ok';
        if (!_usedHint) _score++;
        const nextBtn = document.getElementById('wq-next-btn');
        if (nextBtn) nextBtn.disabled = false;
      } else {
        fb.textContent = `✓ Nét ${_placed}/${_strokes.length}`;
        fb.className   = 'wq-fb ok';
      }
    } else {
      // ❌ SAI thứ tự
      tile.classList.add('wq-wrong');
      const fb = document.getElementById('wq-fb');
      fb.textContent = `✗ Sai! Hãy tìm nét số ${_placed + 1}`;
      fb.className   = 'wq-fb err';
      setTimeout(() => tile.classList.remove('wq-wrong'), 400);
    }
  }

  /** Cập nhật SVG canvas phải: thêm nét vừa đặt */
  function updateReveal() {
    const el = document.getElementById('wq-reveal');
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(makeRevealSVG(_strokes, _placed, 180));
  }

  /** Hint: tự động highlight & click tile đúng tiếp theo */
  function useHint() {
    if (_placed >= _strokes.length) return;
    _usedHint = true;

    const expectedOrig = _placed;
    const tiles = document.querySelectorAll('#wq-tiles .wq-tile');
    tiles.forEach(tile => {
      if (parseInt(tile.dataset.orig) === expectedOrig && !tile.classList.contains('wq-used')) {
        // Flash outline trước khi tự click
        tile.style.outline = '3px solid #7cb83e';
        setTimeout(() => {
          tile.style.outline = '';
          tile.click();
        }, 340);
      }
    });
  }

  function disableAllTiles() {
    document.querySelectorAll('#wq-tiles .wq-tile').forEach(t => t.classList.add('wq-disabled'));
  }

  /* ═══════════════ SUMMARY ════════════════ */
  function showSummary() {
    const total = _chars.length;
    const pct   = total ? Math.round(_score / total * 100) : 0;
    setProgress(total, total);

    let bg, title, msg;
    if (pct >= 80) {
      bg = '#f2fde0'; title = '🎉 Xuất sắc!';
      msg = `Bạn viết đúng ${_score}/${total} chữ (${pct}%). Tuyệt vời!`;
    } else if (pct >= 50) {
      bg = '#fffbe6'; title = '👍 Cố gắng tốt!';
      msg = `Bạn viết đúng ${_score}/${total} chữ (${pct}%). Tiếp tục luyện nhé!`;
    } else {
      bg = '#fff2f6'; title = '💪 Tiếp tục nào!';
      msg = `Bạn viết đúng ${_score}/${total} chữ (${pct}%). Luyện thêm nhé!`;
    }

    getBody().innerHTML = `
      <div class="wq-summary">
        <div class="wq-score-ring" style="background:${bg}">
          <span class="big">${_score}/${total}</span>
          <span class="sm">đúng</span>
        </div>
        <h2>${title}</h2>
        <p>${msg}</p>
        <div class="wq-btnrow">
          <button class="wq-btn wq-btn-retry" id="wq-retry-btn">▶ Làm lại</button>
          <button class="wq-btn" style="background:#eee" id="wq-close-final">✕ Đóng</button>
        </div>
      </div>`;

    document.getElementById('wq-retry-btn').onclick = () => { _idx = 0; _score = 0; loadCard(0); };
    document.getElementById('wq-close-final').onclick = closeOverlay;
  }

  /* ═══════════════ PUBLIC API ════════════════ */
  const WritingQuiz = {
    /**
     * Mở Writing Quiz overlay
     * @param {object} opts
     *   opts.startId  — ID bắt đầu trong writing-quiz.json (inclusive)
     *   opts.endId    — ID kết thúc (inclusive)
     *   opts.dataUrl  — đường dẫn tới JSON (default: '../data/writing-quiz.json')
     */
    open: async function (opts) {
      opts = opts || {};
      injectStyles();

      const startId = opts.startId || 1;
      const endId   = opts.endId   || 9999;
      const url     = opts.dataUrl || 'data/writing-quiz.json';

      let all = [];
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        all = await r.json();
      } catch (e) {
        console.error('[WritingQuiz] Cannot load', url, e);
        alert('Không tải được dữ liệu luyện viết.');
        return;
      }

      _chars = all.filter(c => c.id >= startId && c.id <= endId);
      if (_chars.length === 0) {
        alert('Không có chữ nào trong khoảng ID đã chọn.');
        return;
      }

      _idx = 0; _score = 0;
      buildOverlay();
      showStart();
    }
  };

  global.WritingQuiz = WritingQuiz;

}(window));
