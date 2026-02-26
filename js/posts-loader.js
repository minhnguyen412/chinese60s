// Hàm kiểm tra phần tử có nằm trong viewport không
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom >= 0;
}
let activeImageCard = null;
let isOpeningCard = false;

function showImageCard(imageData) {
    isOpeningCard = true;
    setTimeout(() => isOpeningCard = false, 100);

    if (activeImageCard) {
        closeImageCard();
    }
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `
        <img src="${imageData.imageSrc}" alt="${imageData.character}">
        <h3>${imageData.character}</h3>
        <p>Meaning: ${imageData.meaning}</p>
        <p>Pinyin: ${imageData.pinyin}</p>
        <audio controls>
            <source src="${imageData.audioSrc}" type="audio/mpeg">
            Your browser does not support the audio tag.
        </audio>
        <div id="writer-container" style="display: flex; gap: 10px;"></div>
    `;
    document.body.appendChild(card);
    activeImageCard = card;

    const writerContainer = card.querySelector('#writer-container');
    let writers = [];

    function initializeWriters(characters) {
        writers.forEach(w => { try { w.destroy(); } catch (e) {} });
        writers = [];
        characters.forEach(char => {
            const writerDiv = document.createElement('div');
            writerDiv.style.cssText = 'width:100px;height:100px;border:1px solid #ccc;border-radius:5px;cursor:pointer;';
            writerContainer.appendChild(writerDiv);
            try {
                const writer = HanziWriter.create(writerDiv, char, {
                    width: 100, height: 100, padding: 5,
                    showOutline: true, strokeAnimationSpeed: 1.5, delayBetweenStrokes: 250,
                });
                writers.push({ writer, writerDiv });
                writerDiv.addEventListener('click', () => writer.animateCharacter());
            } catch (error) {
                console.error(`Error creating HanziWriter for "${char}":`, error);
            }
        });
    }

    const characters = imageData.character.split('').filter(c => /[\u4E00-\u9FFF]/.test(c));
    if (characters.length > 0) initializeWriters(characters);
    else writerContainer.style.display = 'none';
}

function closeImageCard() {
    if (activeImageCard) {
        activeImageCard.style.display = 'none';
        activeImageCard = null;
    }
}

document.addEventListener('click', (event) => {
    if (!isOpeningCard && activeImageCard && !activeImageCard.contains(event.target)) {
        closeImageCard();
    }
});

// ============================================================
// INJECT CSS một lần duy nhất
// ============================================================
(function injectStyles() {
    if (document.getElementById('posts-extra-styles')) return;
    const s = document.createElement('style');
    s.id = 'posts-extra-styles';
    s.textContent = `
        /* Mic pulse khi đang ghi */
        @keyframes pulse-mic {
            0%,100% { transform: scale(1); opacity: 1; }
            50%      { transform: scale(1.35); opacity: 0.6; }
        }
        .mic-btn.recording { animation: pulse-mic 0.75s ease-in-out infinite; }

        /* === POPUP GHI ÂM === */
        .rec-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,.45);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
            animation: recFadeIn .2s ease;
        }
        @keyframes recFadeIn { from { opacity:0 } to { opacity:1 } }

        .rec-popup {
            background: #fff;
            border-radius: 18px;
            padding: 28px 24px 22px;
            width: min(92vw, 420px);
            box-shadow: 0 20px 60px rgba(0,0,0,.25);
            display: flex;
            flex-direction: column;
            gap: 16px;
            animation: recSlideUp .25s ease;
        }
        @keyframes recSlideUp {
            from { transform: translateY(30px); opacity:0 }
            to   { transform: translateY(0);    opacity:1 }
        }

        .rec-popup .rec-title {
            font-size: 13px;
            font-weight: 600;
            color: #888;
            text-transform: uppercase;
            letter-spacing: .08em;
            margin: 0;
        }

        .rec-popup .rec-correct {
            font-size: 22px;
            font-weight: 700;
            color: #1a1a2e;
            background: #f0f0ff;
            padding: 10px 14px;
            border-radius: 10px;
            line-height: 1.5;
            word-break: break-all;
        }

        /* Sóng âm */
        .rec-wave {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            height: 44px;
        }
        .rec-wave span {
            display: inline-block;
            width: 4px;
            border-radius: 3px;
            background: #6366f1;
            height: 4px;
            transition: height .1s;
            animation: recWavebar .65s ease-in-out infinite;
        }
        .rec-wave span:nth-child(2) { animation-delay: .1s; }
        .rec-wave span:nth-child(3) { animation-delay: .2s; }
        .rec-wave span:nth-child(4) { animation-delay: .3s; }
        .rec-wave span:nth-child(5) { animation-delay: .4s; }
        .rec-wave.idle span { animation: none; height: 4px; }
        @keyframes recWavebar {
            0%,100% { height: 5px  }
            50%      { height: 32px }
        }

        .rec-status {
            font-size: 13px;
            color: #999;
            text-align: center;
            min-height: 18px;
            margin: 0;
        }
        .rec-status.listening { color: #6366f1; font-weight: 600; }
        .rec-status.done      { color: #16a34a; font-weight: 600; }
        .rec-status.error     { color: #dc2626; }

        /* Kết quả */
        .rec-result {
            border-radius: 10px;
            padding: 12px 14px;
            font-size: 16px;
            line-height: 1.6;
            word-break: break-all;
            display: none;
        }
        .rec-result.correct {
            background: #f0fdf4;
            border: 1.5px solid #86efac;
            color: #15803d;
        }
        .rec-result.wrong {
            background: #fef2f2;
            border: 1.5px solid #fca5a5;
            color: #991b1b;
        }
        .rec-result .rec-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .08em;
            opacity: .7;
            margin-bottom: 4px;
        }
        .rec-result .char-wrong {
            background: #fecaca;
            border-radius: 3px;
            padding: 0 2px;
        }

        /* Nút */
        .rec-actions {
            display: flex;
            gap: 10px;
        }
        .rec-btn {
            flex: 1;
            padding: 11px 0;
            border: none;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity .15s, transform .1s;
        }
        .rec-btn:active  { transform: scale(.96); }
        .rec-btn.start   { background: #6366f1; color: #fff; }
        .rec-btn.stop    { background: #ef4444; color: #fff; display: none; }
        .rec-btn.cls     { background: #f1f5f9; color: #475569; }
        .rec-btn:disabled { opacity: .4; cursor: default; }
    `;
    document.head.appendChild(s);
})();

// ============================================================
// POPUP GHI ÂM
// ============================================================
function showRecordingPopup(correctSentence, postId) {
    const old = document.getElementById('rec-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rec-overlay';
    overlay.id = 'rec-overlay';
    overlay.innerHTML = `
        <div class="rec-popup" id="rec-popup">
            <p class="rec-title">Luyện phát âm</p>
            <div class="rec-correct">${correctSentence}</div>
            <div class="rec-wave idle" id="rec-wave">
                <span></span><span></span><span></span><span></span><span></span>
            </div>
            <p class="rec-status" id="rec-status">Nhấn 🎙 để bắt đầu</p>
            <div class="rec-result" id="rec-result"></div>
            <div class="rec-actions">
                <button class="rec-btn start" id="rec-btn-start">🎙 Ghi âm</button>
                <button class="rec-btn stop"  id="rec-btn-stop">⏹ Dừng</button>
                <button class="rec-btn cls"   id="rec-btn-close">✕ Đóng</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const wave      = overlay.querySelector('#rec-wave');
    const status    = overlay.querySelector('#rec-status');
    const resultBox = overlay.querySelector('#rec-result');
    const btnStart  = overlay.querySelector('#rec-btn-start');
    const btnStop   = overlay.querySelector('#rec-btn-stop');
    const btnClose  = overlay.querySelector('#rec-btn-close');

    let recognition = null;

    function setListening(on) {
        wave.classList.toggle('idle', !on);
        btnStart.style.display = on ? 'none' : 'flex';
        btnStop.style.display  = on ? 'flex'  : 'none';
        btnStart.disabled      = on;
        if (on) {
            status.textContent  = '🔴 Đang nghe...';
            status.className    = 'rec-status listening';
        } else {
            if (status.className.includes('listening')) {
                status.textContent = 'Đã dừng. Nhấn lại để thử.';
                status.className   = 'rec-status';
            }
        }
    }

    function showResult(transcript) {
        const correct = correctSentence.trim();
        const said    = transcript.trim();
        const isMatch = said === correct;

        // Highlight từng ký tự khác nhau
        let highlighted = '';
        for (let i = 0; i < said.length; i++) {
            const ch = said[i];
            if (i < correct.length && ch === correct[i]) {
                highlighted += ch;
            } else {
                highlighted += `<span class="char-wrong">${ch}</span>`;
            }
        }
        if (!highlighted) highlighted = '<em style="opacity:.5">(không nghe được)</em>';

        resultBox.className   = `rec-result ${isMatch ? 'correct' : 'wrong'}`;
        resultBox.style.display = 'block';
        resultBox.innerHTML   = `
            <div class="rec-label">${isMatch ? '✅ Chính xác!' : '❌ Bạn đã nói:'}</div>
            <div>${highlighted}</div>
        `;

        status.textContent = isMatch ? 'Tuyệt vời! Phát âm chuẩn 🎉' : 'Chưa khớp — thử lại nhé!';
        status.className   = `rec-status ${isMatch ? 'done' : 'error'}`;
    }

    function startRec() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            status.textContent = 'Trình duyệt không hỗ trợ ghi âm.';
            status.className   = 'rec-status error';
            return;
        }

        // Instance MỚI mỗi lần — fix Safari / Chrome mobile im lặng sau vài lần
        recognition = new SR();
        recognition.lang            = 'zh-CN';
        recognition.interimResults  = false;
        recognition.maxAlternatives = 1;
        recognition.continuous      = false;

        resultBox.style.display = 'none';
        setListening(true);

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            showResult(transcript);
            saveRecordingToFirestore({ transcript, correctSentence, postId });
        };

        recognition.onerror = (e) => {
            setListening(false);
            const msgs = {
                'not-allowed' : 'Cần cấp quyền microphone!',
                'no-speech'   : 'Không nghe thấy gì. Thử lại.',
                'network'     : 'Lỗi mạng, thử lại.',
            };
            status.textContent = msgs[e.error] || `Lỗi: ${e.error}`;
            status.className   = 'rec-status error';
        };

        recognition.onend = () => setListening(false);

        // setTimeout 80ms — fix "already started" trên mobile
        setTimeout(() => {
            try { recognition.start(); }
            catch (e) {
                setListening(false);
                status.textContent = 'Không thể bắt đầu ghi âm.';
                status.className   = 'rec-status error';
            }
        }, 80);
    }

    function stopRec() {
        if (recognition) { try { recognition.stop(); } catch (e) {} }
        setListening(false);
    }

    function closePopup() {
        stopRec();
        overlay.remove();
    }

    btnStart.addEventListener('click', startRec);
    btnStop.addEventListener('click', stopRec);
    btnClose.addEventListener('click', closePopup);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });
}

// ============================================================
// LƯU FIRESTORE
// ============================================================
async function saveRecordingToFirestore({ transcript, correctSentence, postId }) {
    try {
        const db = window.firestoreDb;
        if (!db) { console.warn('window.firestoreDb chưa được gán.'); return; }
        const { collection, addDoc, serverTimestamp } = window.firestoreModules;
        const uid = (window.firebaseAuth && window.firebaseAuth.currentUser)
            ? window.firebaseAuth.currentUser.uid : 'anonymous';
        await addDoc(collection(db, 'recordings'), {
            transcript, correctSentence, postId,
            uid, timestamp: serverTimestamp(),
        });
        console.log('✅ Firestore saved:', { transcript, postId, uid });
    } catch (e) {
        console.error('Firestore error:', e);
    }
}

// ============================================================
// HÀM CHÍNH loadPosts
// ============================================================
function loadPosts(startpId, endpId, listId) {
    const itemList = document.getElementById(listId);

    Promise.all([
        fetch('../data/imagesData.json').then(r => { if (!r.ok) throw new Error('imagesData'); return r.json(); }),
        fetch('../data/posts.json').then(r => { if (!r.ok) throw new Error('posts'); return r.json(); }),
    ])
    .then(([imagesData, postsData]) => {
        const filteredPosts = postsData.filter(p => p.id >= startpId && p.id <= endpId);

        filteredPosts.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'animate box';

            // --- ROW ---
            const row = document.createElement('div');
            row.className = 'row';

            const avatar = document.createElement('span');
            avatar.className = 'avatar-1';
            avatar.style.backgroundImage = `url(${item.avatar})`;

            const user = document.createElement('span');
            user.className = 'user';
            user.textContent = item.user;

            // Phát âm thanh
            const audioBtn = document.createElement('span');
            audioBtn.className = 'audio';
            audioBtn.textContent = '☊';
            audioBtn.style.cursor = 'pointer';
            audioBtn.addEventListener('click', () => new Audio(item.audioSrc).play());

            // 👁 Nút mắt — LUÔN hiện
            const eyeBtn = document.createElement('button');
            eyeBtn.className = 'eye-btn';
            eyeBtn.innerHTML = '👁';
            eyeBtn.title = item.structure ? 'Xem cấu trúc câu' : 'Ẩn câu';
            eyeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;';

            // 🎙 Nút ghi âm — LUÔN hiện
            const micBtn = document.createElement('button');
            micBtn.className = 'mic-btn';
            micBtn.innerHTML = '🎙';
            micBtn.title = 'Ghi âm luyện tập';
            micBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;';

            // Toggle description
            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-description';
            toggleButton.textContent = '⬇️';

            row.appendChild(avatar);
            row.appendChild(user);
            row.appendChild(audioBtn);
            row.appendChild(eyeBtn);
            row.appendChild(micBtn);
            row.appendChild(toggleButton);

            // --- H2 segments ---
            const h2 = document.createElement('h2');
            h2.itemProp = 'name';
            item.segments.forEach(segment => {
                const span = document.createElement('span');
                span.innerHTML = segment;
                span.style.cursor = 'pointer';
                span.addEventListener('click', () => {
                    const img = imagesData.find(d => d.character === segment);
                    if (img) showImageCard(img);
                });
                h2.appendChild(span);
            });

            // --- Cấu trúc câu (chỉ tạo nếu có JSON field "structure") ---
            let structureDiv = null;
            if (item.structure) {
                structureDiv = document.createElement('div');
                structureDiv.className = 'structure-view';
                structureDiv.innerHTML = item.structure;
                structureDiv.style.cssText = `
                    display: none;
                    padding: 8px 12px;
                    background: #f8f9fa;
                    border-left: 3px solid #6366f1;
                    border-radius: 4px;
                    margin-top: 6px;
                    font-size: 14px;
                    line-height: 1.6;
                `;
            }

            // Logic nút mắt:
            //   Không có structure → toggle ẩn/hiện h2
            //   Có structure       → nhấn 1: ẩn h2 + hiện structure
            //                        nhấn 2: hiện h2 + ẩn structure
            let eyeOpen = true; // true = đang hiện h2
            eyeBtn.addEventListener('click', () => {
                eyeOpen = !eyeOpen;
                if (eyeOpen) {
                    // Hiện h2, ẩn structure
                    h2.style.display = '';
                    if (structureDiv) structureDiv.style.display = 'none';
                    eyeBtn.innerHTML = '👁';
                    eyeBtn.title = item.structure ? 'Xem cấu trúc câu' : 'Ẩn câu';
                } else {
                    // Ẩn h2
                    h2.style.display = 'none';
                    if (structureDiv) {
                        // Có structure → hiện cấu trúc
                        structureDiv.style.display = 'block';
                        eyeBtn.innerHTML = '🙈';
                        eyeBtn.title = 'Ẩn cấu trúc';
                    } else {
                        // Không có structure → chỉ ẩn câu
                        eyeBtn.innerHTML = '🙈';
                        eyeBtn.title = 'Hiện câu';
                    }
                }
            });

            // Nút ghi âm → mở popup
            micBtn.addEventListener('click', () => {
                const correct = item.segments ? item.segments.join('') : '';
                showRecordingPopup(correct, item.id);
            });

            // --- Description ---
            const p = document.createElement('p');
            p.className = 'description';
            p.itemProp = 'description';
            p.innerHTML = item.description.replace(/\\n/g, '<br>');
            p.style.display = 'none';

            toggleButton.addEventListener('click', () => {
                const open = p.style.display === 'block';
                p.style.display = open ? 'none' : 'block';
                toggleButton.textContent = open ? '⬇️' : '⬅️';
            });

            // --- Ghép DOM ---
            li.appendChild(row);
            li.appendChild(h2);
            if (structureDiv) li.appendChild(structureDiv);
            li.appendChild(p);
            itemList.appendChild(li);

            if (isInViewport(li)) {
                setTimeout(() => li.classList.add('visible'), 100 * index);
            }
            window.addEventListener('scroll', () => {
                if (isInViewport(li)) li.classList.add('visible');
            });
        });
    })
    .catch(err => console.error('Error fetching JSON:', err));
}
