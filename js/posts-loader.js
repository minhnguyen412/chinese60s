// ============================================================
// ✅ FIXED: Global Single Audio Player - ONE player for ALL audio
// KHÔNG tạo new Audio() ở bất kỳ đâu - gây conflict trên iOS
// ============================================================
let _globalAudioPlayer = null;

function getGlobalAudioPlayer() {
    if (!_globalAudioPlayer) {
        _globalAudioPlayer = new Audio();
        _globalAudioPlayer.preload = 'auto';
        _globalAudioPlayer.volume = 1.0; // Luôn ở max volume
        _globalAudioPlayer.setAttribute('playsinline', '');
    }
    return _globalAudioPlayer;
}

// Hàm play audio DUY NHẤT - KHÔNG tạo Audio mới
async function playGlobalAudio(audioSrc) {
    if (_isIOS) {
        await forceResetAudioSession();
    }

    const player = getGlobalAudioPlayer();
    player.pause();
    player.currentTime = 0;
    player.src = audioSrc;
    player.volume = 1.0;

    try {
        await player.play();
        _lastAudioPlayTime = Date.now();
    } catch (err) {
        console.warn('[GlobalAudio] Play failed:', err);
    }
}

// Hàm stop audio DUY NHẤT
function stopGlobalAudio() {
    if (_globalAudioPlayer) {
        _globalAudioPlayer.pause();
        _globalAudioPlayer.currentTime = 0;
    }
}

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
        <div id="audio-player-container" style="margin: 12px 0;"></div>
        <div id="writer-container" style="display: flex; gap: 10px;"></div>
    `;
    document.body.appendChild(card);
    activeImageCard = card;

    // ✅ Chỉ có audio player thôi
    const audioPlayerContainer = card.querySelector('#audio-player-container');
    const audioPlayer = document.createElement('audio');
    audioPlayer.controls = true;
    audioPlayer.src = imageData.audioSrc;
    audioPlayer.style.cssText = `width: 100%; height: 32px;`;
    audioPlayerContainer.appendChild(audioPlayer);

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
                    showOutline: true, strokeAnimationSpeed: 1.5, delayABetweenStrokes: 250,
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
        stopGlobalAudio(); // ✅ Stop audio when closing card
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
// INJECT CSS (once)
// ============================================================
(function injectStyles() {
    if (document.getElementById('posts-extra-styles')) return;
    const s = document.createElement('style');
    s.id = 'posts-extra-styles';
    s.textContent = `
        @keyframes pulse-mic {
            0%,100% { transform: scale(1); opacity: 1; }
            50%      { transform: scale(1.35); opacity: 0.6; }
        }
        .mic-btn.recording { animation: pulse-mic 0.75s ease-in-out infinite; }
        .mic-btn[title="Sign in to record"]:hover::after {
            content: 'Sign in to record';
            position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%);
            background: #1a1a2e; color: #fff; font-size: 11px; font-weight: 600;
            padding: 4px 8px; border-radius: 6px; white-space: nowrap; pointer-events: none;
            z-index: 999;
        }
        .mic-btn { position: relative; }

        .rec-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,.5);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999;
            animation: recFadeIn .2s ease;
        }
        @keyframes recFadeIn { from { opacity:0 } to { opacity:1 } }

        .rec-popup {
            background: #fff;
            border-radius: 20px;
            padding: 28px 24px 22px;
            width: min(92vw, 440px);
            box-shadow: 0 24px 64px rgba(0,0,0,.28);
            display: flex;
            flex-direction: column;
            gap: 14px;
            animation: recSlideUp .25s ease;
        }
        @keyframes recSlideUp {
            from { transform: translateY(28px); opacity:0 }
            to   { transform: translateY(0);    opacity:1 }
        }

        .rec-title {
            font-size: 12px;
            font-weight: 700;
            color: #aaa;
            text-transform: uppercase;
            letter-spacing: .1em;
            margin: 0;
        }

        .rec-audio-wrap {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #f5f5ff;
            border-radius: 12px;
            padding: 10px 14px;
        }
        .rec-play-btn {
            width: 40px; height: 40px;
            border-radius: 50%;
            background: #6366f1;
            border: none;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            transition: transform .15s, background .15s;
        }
        .rec-play-btn:active { transform: scale(.92); }
        .rec-play-btn svg { fill: #fff; width: 16px; height: 16px; }
        .rec-play-btn.playing { background: #4f46e5; }
        .rec-audio-label {
            font-size: 13px;
            color: #6366f1;
            font-weight: 600;
        }

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
            color: #aaa;
            text-align: center;
            min-height: 18px;
            margin: 0;
        }
        .rec-status.listening { color: #6366f1; font-weight: 600; }
        .rec-status.done      { color: #16a34a; font-weight: 600; }
        .rec-status.error     { color: #dc2626; }

        .rec-result {
            border-radius: 12px;
            padding: 12px 14px;
            font-size: 16px;
            line-height: 1.7;
            word-break: break-all;
            display: none;
            flex-direction: column;
            gap: 8px;
        }
        .rec-result.correct {
            background: #f0fdf4;
            border: 1.5px solid #86efac;
        }
        .rec-result.wrong {
            background: #fef2f2;
            border: 1.5px solid #fca5a5;
        }
        .rec-result-row {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .rec-result-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .1em;
            opacity: .55;
        }
        .rec-result.correct .rec-result-label { color: #15803d; }
        .rec-result.wrong   .rec-result-label { color: #991b1b; }
        .rec-result-text { font-size: 17px; font-weight: 600; }
        .rec-result.correct .rec-result-text { color: #15803d; }
        .rec-result.wrong   .rec-result-text { color: #1a1a2e; }
        .rec-original-text { color: #6366f1; }
        .char-wrong {
            background: #fecaca;
            border-radius: 3px;
            padding: 0 2px;
            color: #b91c1c;
        }

        .rec-actions {
            display: flex;
            gap: 10px;
        }
        .rec-btn {
            flex: 1;
            padding: 12px 0;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: opacity .15s, transform .1s;
        }
        .rec-btn:active   { transform: scale(.96); }
        .rec-btn.start    { background: #6366f1; color: #fff; }
        .rec-btn.stop     { background: #ef4444; color: #fff; display: none; }
        .rec-btn.cls      { background: #f1f5f9; color: #64748b; }
        .rec-btn:disabled { opacity: .4; cursor: default; }

        /* iOS Audio Session Reset Overlay */
        .ios-reset-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,.7);
            display: flex; align-items: center; justify-content: center;
            z-index: 99999;
            cursor: pointer;
        }
        .ios-reset-popup {
            background: #fff;
            border-radius: 20px;
            padding: 32px 28px;
            text-align: center;
            max-width: 320px;
            box-shadow: 0 20px 60px rgba(0,0,0,.3);
        }
        .ios-reset-popup h3 {
            font-size: 1.2rem;
            margin: 0 0 12px;
            color: #1a1a2e;
        }
        .ios-reset-popup p {
            font-size: 0.95rem;
            color: #666;
            margin: 0 0 20px;
            line-height: 1.5;
        }
        .ios-reset-popup .tap-hint {
            font-size: 2rem;
            animation: pulse-tap 1s ease-in-out infinite;
        }
        @keyframes pulse-tap {
            0%,100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
    `;
    document.head.appendChild(s);
})();

// ============================================================
// Normalize: strip punctuation + spaces for comparison
// ============================================================
function normalize(str) {
    return str
        .replace(/[\s\u0020\u3000]+/g, '')
        .replace(/[.,!?;:'"()\-–—…，。！？；：、''""「」【】《》]/g, '')
        .replace(/[\u2018\u2019\u201C\u201D]/g, '')
        .toLowerCase();
}

// ============================================================
// SAVE RECORDING — dùng window.saveRecording từ post.html
// ============================================================
function saveRecordingToFirestore({ transcript, correctSentence, postId }) {
    // window.saveRecording được định nghĩa trong post.html
    // có sẵn Firebase import và __currentUser check bên trong
    if (typeof window.saveRecording === 'function') {
        window.saveRecording(String(postId), transcript, correctSentence);
        console.log('[posts-loader] saveRecording called:', { postId, transcript });
    } else {
        console.warn('[posts-loader] window.saveRecording chưa được định nghĩa trong post.html');
    }
}

// ============================================================
// iOS AUDIO SESSION MANAGER (FIXED - Bi-directional)
// ============================================================
let _iosAudioContext = null;
let _isIOS = false;
let _pendingAudioReset = false;
let _lastAudioPlayTime = 0;
let _audioSessionLocked = false;

// Detect iOS
(function detectIOS() {
    _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
             (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
})();
// ============================================================
// AUDIO PHASE MANAGER (2-phase system)
// ============================================================
let _currentPhase = 'IDLE';  // 'IDLE', 'PLAYBACK', 'RECORDING'
let _isRecording = false;

async function switchToPlaybackPhase() {
    console.log('[Phase] Switching to PLAYBACK...');
    if (_isRecording) {
        document.dispatchEvent(new CustomEvent('force-stop-recording'));
        _isRecording = false;
    }
    _currentPhase = 'PLAYBACK';
    if (_isIOS) await forceResetAudioSession();
}

async function switchToRecordingPhase() {
    console.log('[Phase] Switching to RECORDING...');
    if (_currentPhase === 'PLAYBACK') await stopAllAudioPlayback();
    _currentPhase = 'RECORDING';
    _isRecording = true;
    if (_isIOS) await resetToRecordMode();
}

async function stopAllAudioPlayback() {
    console.log('[Audio] Stopping all playback...');

    // ✅ FIXED: Stop Global Audio Player
    stopGlobalAudio();

    // Stop all other audio elements (legacy support)
    document.querySelectorAll('audio').forEach(audio => {
        try { audio.pause(); audio.currentTime = 0; } catch(e) {}
    });
    if (window.qAudio) {
        try { window.qAudio.pause(); window.qAudio.currentTime = 0; } catch(e) {}
    }
    document.querySelectorAll('.replay-btn').forEach(btn => {
        btn.disabled = true; btn.style.opacity = '0.5';
    });
    await new Promise(resolve => setTimeout(resolve, 100));
}

async function endRecordingPhase() {
    console.log('[Phase] Ending RECORDING...');
    _isRecording = false;
    _currentPhase = 'IDLE';
    if (_isIOS) setTimeout(() => forceResetAudioSession(), 100);
}

document.addEventListener('force-stop-recording', () => {
    const recognition = window._currentRecognition;
    if (recognition) try { recognition.stop(); } catch(e) {}
});
// Get or create Web Audio Context
function getAudioContext() {
    if (!_iosAudioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            _iosAudioContext = new AudioContext();
        }
    }
    return _iosAudioContext;
}

// Force reset audio session to PLAYBACK mode (for playing audio)
// This is critical for iOS - must be called after any recording ends
async function forceResetAudioSession() {
    if (!_isIOS) return;
    console.log('[iOS Audio] Force resetting audio session...');

    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        // Create and play a silent buffer to force session switch
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        // Create a very short click sound
        for (let i = 0; i < bufferSize; i++) {
            const t = i / bufferSize;
            data[i] = Math.sin(440 * Math.PI * 2 * i / ctx.sampleRate) * Math.sin(Math.PI * t) * 0.05;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        // Resume context first
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        source.start();

        // Wait for sound to complete
        await new Promise(resolve => {
            source.onended = resolve;
            setTimeout(resolve, 150);
        });

        _audioSessionLocked = false;
        _pendingAudioReset = false;
        console.log('[iOS Audio] ✓ Audio session reset complete');
    } catch (err) {
        console.warn('[iOS Audio] Force reset failed:', err);
    }
}

// Legacy function name for compatibility
async function resetToPlaybackMode() {
    await forceResetAudioSession();
}

// Legacy function name for compatibility
async function resetToRecordMode() {
    if (!_isIOS) return;
    console.log('[iOS Audio] Resetting to RECORD mode...');

    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        // Test microphone access to force session switch
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('[iOS Audio] ✓ Microphone access ready');
        } catch(e) {
            console.warn('[iOS Audio] Mic test failed, will retry:', e.message);
        }

    } catch (err) {
        console.warn('[iOS Audio] Record reset failed:', err);
    }
}

// ============================================================
// ✅ FIXED: AUDIO PLAYBACK - Dùng Global Player thay vì new Audio()
// ============================================================
// Lưu Ý: playAudioWithSessionFix ĐÃ BỊ DEPRECATED - dùng playGlobalAudio() thay thế
async function playAudioWithSessionFix(audioSrc) {
    console.warn('[Audio] playAudioWithSessionFix is deprecated. Use playGlobalAudio() instead.');
    return await playGlobalAudio(audioSrc);
}

// ============================================================
// TRACK AUDIO PLAYBACK (for iOS session management)
// ============================================================
(function setupAudioTracking() {
    if (!_isIOS) return;

    // Track when recording ends (need to reset to playback mode)
    document.addEventListener('recording-off', async () => {
        setTimeout(async () => {
            await forceResetAudioSession();
        }, 200);
    });
})();

// ============================================================
// RECORDING POPUP
// ============================================================
function showRecordingPopup(correctSentence, audioSrc, postId) {
    const old = document.getElementById('rec-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rec-overlay';
    overlay.id = 'rec-overlay';
    overlay.innerHTML = `
        <div class="rec-popup" id="rec-popup">
            <p class="rec-title">Pronunciation Practice</p>

            <div class="rec-wave idle" id="rec-wave">
                <span></span><span></span><span></span><span></span><span></span>
            </div>
            <p class="rec-status" id="rec-status">Press 🎙 to start recording</p>

            <div class="rec-result" id="rec-result"></div>

            <div class="rec-actions">
                <button class="rec-btn start" id="rec-btn-start">🎙 Record</button>
                <button class="rec-btn stop"  id="rec-btn-stop">⏹ Stop</button>
                <button class="rec-btn cls"   id="rec-btn-close">✕ Close</button>
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
        btnStart.disabled = on;
        if (on) {
            status.textContent = '🔴 Listening...';
            status.className   = 'rec-status listening';
        } else {
            if (status.className.includes('listening')) {
                status.textContent = 'Stopped. Press Record to try again.';
                status.className   = 'rec-status';
            }
        }
    }

    function showResult(transcript) {
        const said = transcript.trim() || '<em style="opacity:.4">— nothing detected —</em>';

        resultBox.className     = 'rec-result neutral';
        resultBox.style.display = 'flex';
        resultBox.innerHTML = `
            <div class="rec-result-row">
                <span class="rec-result-label">You said</span>
                <span class="rec-result-text">${said}</span>
            </div>
            <div class="rec-result-row">
                <span class="rec-result-label">Original</span>
                <span class="rec-result-text rec-original-text">${correctSentence}</span>
            </div>
        `;

        status.textContent = '✅ Done! Try again or close.';
        status.className   = 'rec-status done';

        
    }

    async function stopAllAudio() {
    console.log('🔇 Stopping recording...');
    
    // Stop all audio playback
    await stopAllAudioPlayback();

    if (_isIOS) {
        await resetToRecordMode();
    }

    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('✓ Ready to record');
}

    function startRec() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            status.textContent = 'Your browser does not support speech recognition.';
            status.className   = 'rec-status error';
            return;
        }

        if (recognition) {
            try { recognition.abort(); } catch(e) {}
            recognition = null;
        }

        recognition = new SR();
        window._currentRecognition = recognition;
        recognition.lang            = 'zh-CN';
        recognition.interimResults  = true;
        recognition.maxAlternatives = 1;
        recognition.continuous      = true;

        resultBox.style.display = 'none';
        let finalTranscript = '';

        recognition.onresult = (e) => {
            finalTranscript = '';
            for (let i = 0; i < e.results.length; i++) {
                if (e.results[i].isFinal) {
                    finalTranscript += e.results[i][0].transcript;
                }
            }
            const interim = Array.from(e.results)
                .filter(r => !r.isFinal)
                .map(r => r[0].transcript).join('');
            status.textContent = (finalTranscript + (interim ? ' ' + interim : '')) || '🔴 Listening...';
            status.className   = 'rec-status listening';
        };

        recognition.onerror = (e) => {
            if (e.error === 'aborted') return;
            setListening(false);

            if (_isIOS && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) {
                _pendingAudioReset = true;
                showIOSResetOverlay('Tap to retry recording.', () => startRec());
                return;
            }

            const msgs = {
                'not-allowed'         : 'Microphone permission denied.',
                'no-speech'           : 'No speech detected. Try again.',
                'network'             : 'Network error. Try again.',
                'service-not-allowed' : 'Speech service not allowed.',
            };
            status.textContent = msgs[e.error] || `Error: ${e.error}`;
            status.className   = 'rec-status error';
        };

        recognition.onend = () => {
            setListening(false);
            if (finalTranscript.trim()) {
                showResult(finalTranscript.trim());
                saveRecordingToFirestore({
                    transcript:      finalTranscript.trim(),
                    correctSentence: correctSentence,
                    postId:          postId,
                });
            } else if (!status.className.includes('error')) {
                status.textContent = 'No speech detected. Try again.';
                status.className   = 'rec-status error';
            }
        };

        try {
            recognition.start();
            setListening(true);
        } catch (e) {
            setListening(false);
            status.textContent = 'Could not start recording. Try again.';
            status.className   = 'rec-status error';
        }
    }

    async function startRecWithAudioStop() {
        await stopAllAudio();
        startRec();
    }

    function stopRec() {
        if (recognition) { try { recognition.stop(); } catch (e) {} }
    }

    function closePopup() {
    stopRec();

    // End recording phase and return to IDLE
    endRecordingPhase();

    overlay.remove();
}

    btnStart.addEventListener('click', startRecWithAudioStop);
    btnStop.addEventListener('click', stopRec);
    btnClose.addEventListener('click', closePopup);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });
}

// ============================================================
// MAIN: loadPosts
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

            const audioBtn = document.createElement('span');
            audioBtn.className = 'audio';
            audioBtn.textContent = '☊';
            audioBtn.style.cursor = 'pointer';

            // ✅ FIXED: Dùng Global Audio Player - KHÔNG tạo Audio mới
            audioBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await switchToPlaybackPhase();
                await playGlobalAudio(item.audioSrc);
            });

            const eyeBtn = document.createElement('button');
            eyeBtn.className = 'eye-btn';
            eyeBtn.innerHTML = '👁️';
            eyeBtn.title = item.structure ? 'View sentence structure' : 'Hide sentence';
            eyeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;';

            const micBtn = document.createElement('button');
            micBtn.className = 'mic-btn';
            micBtn.innerHTML = '🎙️';
            micBtn.title = 'Record pronunciation';
            micBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;';

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

            // --- Cấu trúc câu ---
            let structureDiv = null;
            if(item.structure) {
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

            let eyeOpen = true;
            eyeBtn.addEventListener('click', () => {
                eyeOpen = !eyeOpen;
                if (eyeOpen) {
                    h2.style.display = '';
                    if (structureDiv) structureDiv.style.display = 'none';
                    eyeBtn.innerHTML = '👁️';
                    eyeBtn.title = item.structure ? 'View sentence structure' : 'Hide sentence';
                } else {
                    h2.style.display = 'none';
                    if (structureDiv) {
                        structureDiv.style.display = 'block';
                        eyeBtn.innerHTML = '🔒';
                        eyeBtn.title = 'Hide structure';
                    } else {
                        eyeBtn.innerHTML = '🔑';
                        eyeBtn.title = 'Show sentence';
                    }
                }
            });

            // ✅ Recording button
            micBtn.addEventListener('click', async () => {
    if (!window.__currentUser) {
        if (typeof window.openLoginModal === 'function') window.openLoginModal();
        return;
    }
    await switchToRecordingPhase();
    const correct = item.segments ? item.segments.join('') : '';
    showRecordingPopup(correct, item.audioSrc, item.id);
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
