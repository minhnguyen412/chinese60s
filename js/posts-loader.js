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
        writers.forEach(writer => {
            try { writer.destroy(); } catch (error) { console.error("Error destroying writer:", error); }
        });
        writers = [];

        characters.forEach(char => {
            const writerDiv = document.createElement('div');
            writerDiv.style.width = '100px';
            writerDiv.style.height = '100px';
            writerDiv.style.border = '1px solid #ccc';
            writerDiv.style.borderRadius = '5px';
            writerDiv.style.cursor = 'pointer';
            writerContainer.appendChild(writerDiv);

            try {
                const writer = HanziWriter.create(writerDiv, char, {
                    width: 100,
                    height: 100,
                    padding: 5,
                    showOutline: true,
                    strokeAnimationSpeed: 1.5,
                    delayBetweenStrokes: 250,
                });
                writers.push({ writer, writerDiv });
                writerDiv.addEventListener('click', () => writer.animateCharacter());
            } catch (error) {
                console.error(`Error creating HanziWriter for character "${char}":`, error);
            }
        });
    }

    const characters = imageData.character.split('').filter(char => /[\u4E00-\u9FFF]/.test(char));
    if (characters.length > 0) {
        initializeWriters(characters);
    } else {
        writerContainer.style.display = 'none';
    }
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
// GHI ÂM với Web Speech API - Fix cho Safari/Chrome mobile
// ============================================================

/**
 * Tạo một SpeechRecognition instance mới mỗi lần ghi âm
 * (Fix lỗi Safari/Chrome mobile chỉ cho dùng 1-2 lần)
 */
function createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN'; // Tiếng Trung, đổi nếu cần
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // Không dùng continuous để tránh lỗi mobile
    return recognition;
}

/**
 * Lưu kết quả vào Firestore
 */
async function saveRecordingToFirestore({ transcript, correctSentence, postId, uid }) {
    try {
        // Đảm bảo bạn đã import/init Firebase Firestore ở file HTML
        // import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
        const db = window.firestoreDb; // Gán db vào window từ file init Firebase của bạn
        if (!db) {
            console.error('Firestore chưa được khởi tạo. Gán window.firestoreDb = db sau khi init Firebase.');
            return;
        }
        const { collection, addDoc, serverTimestamp } = window.firestoreModules; // hoặc import trực tiếp
        await addDoc(collection(db, 'recordings'), {
            transcript,
            correctSentence,
            postId,
            uid: uid || 'anonymous',
            timestamp: serverTimestamp(),
        });
        console.log('Đã lưu Firestore:', { transcript, correctSentence, postId });
    } catch (e) {
        console.error('Lỗi lưu Firestore:', e);
    }
}

/**
 * Bắt đầu ghi âm cho một bài post
 * @param {HTMLElement} micBtn - nút mic để cập nhật UI
 * @param {string} correctSentence - câu đúng (từ JSON)
 * @param {number|string} postId
 * @param {string} uid
 */
function startRecording(micBtn, correctSentence, postId, uid) {
    const recognition = createRecognition();
    if (!recognition) {
        alert('Trình duyệt của bạn không hỗ trợ ghi âm (Web Speech API).');
        return;
    }

    // Trạng thái đang ghi
    micBtn.classList.add('recording');
    micBtn.title = 'Đang nghe... (nhấn để dừng)';

    let didEnd = false;

    recognition.onstart = () => {
        console.log('Bắt đầu ghi âm...');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Nhận được:', transcript);
        saveRecordingToFirestore({ transcript, correctSentence, postId, uid });

        // Hiển thị kết quả tạm thời cho user (tuỳ chọn)
        showTranscriptFeedback(micBtn, transcript, correctSentence);
    };

    recognition.onerror = (event) => {
        console.error('Lỗi ghi âm:', event.error);
        if (event.error === 'not-allowed') {
            alert('Vui lòng cấp quyền microphone cho trình duyệt.');
        }
        stopRecordingUI(micBtn);
    };

    recognition.onend = () => {
        if (!didEnd) {
            didEnd = true;
            stopRecordingUI(micBtn);
        }
    };

    // Cho phép nhấn lại để dừng sớm
    micBtn._stopRecording = () => {
        didEnd = true;
        try { recognition.stop(); } catch (e) {}
        stopRecordingUI(micBtn);
    };

    // Fix mobile: wrap trong setTimeout để tránh lỗi "already started"
    setTimeout(() => {
        try {
            recognition.start();
        } catch (e) {
            console.error('Không thể start recognition:', e);
            stopRecordingUI(micBtn);
        }
    }, 100);
}

function stopRecordingUI(micBtn) {
    micBtn.classList.remove('recording');
    micBtn.title = 'Nhấn để ghi âm';
    micBtn._stopRecording = null;
}

/**
 * Hiển thị feedback nhỏ bên cạnh nút sau khi nhận transcript
 */
function showTranscriptFeedback(micBtn, transcript, correctSentence) {
    // Xóa feedback cũ nếu có
    const old = micBtn.parentElement.querySelector('.transcript-feedback');
    if (old) old.remove();

    const feedback = document.createElement('span');
    feedback.className = 'transcript-feedback';
    const isCorrect = transcript.trim() === correctSentence.trim();
    feedback.textContent = isCorrect ? `✅ "${transcript}"` : `❌ "${transcript}"`;
    feedback.style.cssText = `
        font-size: 12px;
        margin-left: 6px;
        color: ${isCorrect ? '#22c55e' : '#ef4444'};
        background: ${isCorrect ? '#f0fdf4' : '#fef2f2'};
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
    `;

    // Tự xóa sau 5 giây
    setTimeout(() => feedback.remove(), 5000);
    micBtn.parentElement.appendChild(feedback);
}

// ============================================================
// HÀM CHÍNH loadPosts
// ============================================================
function loadPosts(startpId, endpId, listId) {
    const itemList = document.getElementById(listId);

    const filesToFetch = [
        '../data/imagesData.json',
        '../data/posts.json'
    ];

    Promise.all(filesToFetch.map(file => fetch(file).then(response => {
        if (!response.ok) throw new Error(`Failed to fetch ${file}`);
        return response.json();
    })))
    .then(allData => {
        const imagesData = allData.filter((_, index) => filesToFetch[index].includes('imagesData')).flat();
        const postsData = allData.filter((_, index) => filesToFetch[index].includes('posts')).flat();

        const filteredPosts = postsData.filter(post => post.id >= startpId && post.id <= endpId);

        filteredPosts.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'animate box';

            const row = document.createElement('div');
            row.className = 'row';

            const avatar = document.createElement('span');
            avatar.className = 'avatar-1';
            avatar.style.backgroundImage = `url(${item.avatar})`;

            const user = document.createElement('span');
            user.className = 'user';
            user.textContent = item.user;

            // --- Nút âm thanh bài viết ---
            const audio = document.createElement('span');
            audio.className = 'audio';
            audio.textContent = '☊';
            audio.style.cursor = 'pointer';
            audio.addEventListener('click', () => {
                const audioElement = new Audio(item.audioSrc);
                audioElement.play();
            });

            // --- Toggle description ---
            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-description';
            toggleButton.textContent = '⬇️';

            // --- 👁 Nút con mắt: toggle segments / cấu trúc câu ---
            const eyeBtn = document.createElement('button');
            eyeBtn.className = 'eye-btn';
            eyeBtn.title = 'Xem cấu trúc câu';
            eyeBtn.innerHTML = '👁';
            eyeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;';

            // --- 🎙 Nút ghi âm ---
            const micBtn = document.createElement('button');
            micBtn.className = 'mic-btn';
            micBtn.title = 'Nhấn để ghi âm';
            micBtn.innerHTML = '🎙';
            micBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;';

            // CSS cho trạng thái đang ghi
            const style = document.head.querySelector('#recording-style');
            if (!style) {
                const s = document.createElement('style');
                s.id = 'recording-style';
                s.textContent = `
                    .mic-btn.recording { animation: pulse-mic 0.8s ease-in-out infinite; filter: hue-rotate(0deg); }
                    @keyframes pulse-mic { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.3); opacity:0.7; } }
                `;
                document.head.appendChild(s);
            }

            micBtn.addEventListener('click', () => {
                if (micBtn._stopRecording) {
                    // Đang ghi → dừng
                    micBtn._stopRecording();
                } else {
                    // Lấy uid từ Firebase Auth nếu có
                    const uid = (window.firebaseAuth && window.firebaseAuth.currentUser)
                        ? window.firebaseAuth.currentUser.uid
                        : 'anonymous';
                    const correctSentence = item.segments ? item.segments.join('') : '';
                    startRecording(micBtn, correctSentence, item.id, uid);
                }
            });

            // --- h2 chứa segments ---
            const h2 = document.createElement('h2');
            h2.itemProp = 'name';
            item.segments.forEach(segment => {
                const span = document.createElement('span');
                span.innerHTML = segment;
                span.style.cursor = 'pointer';
                span.addEventListener('click', () => {
                    const imageData = imagesData.find(image => image.character === segment);
                    if (imageData) showImageCard(imageData);
                });
                h2.appendChild(span);
            });

            // --- Phần cấu trúc câu (ẩn mặc định) ---
            let structureDiv = null;
            if (item.structure) {
                structureDiv = document.createElement('div');
                structureDiv.className = 'structure-view';
                structureDiv.innerHTML = item.structure; // HTML hoặc text từ JSON
                structureDiv.style.display = 'none';
                structureDiv.style.cssText += `
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

            // Chỉ hiện nút mắt nếu có cấu trúc
            let eyeVisible = false;
            if (structureDiv) {
                eyeBtn.addEventListener('click', () => {
                    eyeVisible = !eyeVisible;
                    if (eyeVisible) {
                        h2.style.display = 'none';
                        structureDiv.style.display = 'block';
                        eyeBtn.innerHTML = '🙈';
                        eyeBtn.title = 'Ẩn cấu trúc câu';
                    } else {
                        h2.style.display = '';
                        structureDiv.style.display = 'none';
                        eyeBtn.innerHTML = '👁';
                        eyeBtn.title = 'Xem cấu trúc câu';
                    }
                });
            } else {
                eyeBtn.style.display = 'none'; // Ẩn nút mắt nếu không có cấu trúc
            }

            // --- Description ---
            const p = document.createElement('p');
            p.className = 'description';
            p.itemProp = 'description';
            p.innerHTML = item.description.replace(/\\n/g, '<br>');
            p.style.display = 'none';

            toggleButton.addEventListener('click', () => {
                if (p.style.display === 'block') {
                    p.style.display = 'none';
                    toggleButton.textContent = '⬇️';
                } else {
                    p.style.display = 'block';
                    toggleButton.textContent = '⬅️';
                }
            });

            // --- Ghép vào DOM ---
            row.appendChild(avatar);
            row.appendChild(user);
            row.appendChild(audio);
            row.appendChild(eyeBtn);   // 👁 con mắt
            row.appendChild(micBtn);   // 🎙 ghi âm
            row.appendChild(toggleButton);

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
    .catch(error => {
        console.error('Error fetching JSON files:', error);
    });
}
