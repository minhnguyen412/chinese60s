let data = []; // Khai báo biến data toàn cục
let idToLesson = {}; // Map ID → Bài học

// ── Load lesson data from thumbnail.json ──────────────────────────────────
async function loadLessonMapping() {
    try {
        const response = await fetch('../data/thumbnail.json');
        if (!response.ok) throw new Error('Failed to load thumbnail.json');
        
        const lessons = await response.json();
        
        // Tạo map: ID => Bài học
        lessons.forEach(lesson => {
            // Parse htmlLink để lấy writeStartId và writeEndId
            const htmlLink = lesson.htmlLink || '';
            const params = new URLSearchParams(htmlLink.split('?')[1] || '');
            
            const writeStart = parseInt(params.get('writeStartId')) || 0;
            const writeEnd = parseInt(params.get('writeEndId')) || 0;
            
            // Ánh xạ tất cả ID trong khoảng
            for (let id = writeStart; id <= writeEnd; id++) {
                idToLesson[id] = {
                    title: lesson.title,
                    description: lesson.description,
                    topic: lesson.topic,
                    plan: lesson.plan
                };
            }
        });
        
        console.log('Lesson mapping loaded:', idToLesson);
        return idToLesson;
    } catch (error) {
        console.error('Error loading lesson mapping:', error);
        return {};
    }
}

// Fetch data from GitHub JSON file and display
const filesToFetch = [
    '../data/imagesData.json'
];

// Load lessons trước, sau đó load images
loadLessonMapping().then(() => {
    Promise.all(filesToFetch.map(url => fetch(url).then(res => res.json())))
        .then(dataArrays => {
            data = dataArrays.flat();
            
            // Thêm thông tin bài học vào mỗi item
            data.forEach(item => {
                const lessonInfo = idToLesson[item.id] || idToLesson[parseInt(item.id)];
                if (lessonInfo) {
                    item.lesson = lessonInfo;
                }
            });
            
            const imageGrid = document.getElementById('imageGrid');
            const countInput = document.getElementById('countInput');
            const sortSelect = document.getElementById('sortSelect');
            const okButton = document.getElementById('okButton');

            // ── Render cards ──────────────────────────────────────────────────────
            function renderImages(images) {
                imageGrid.innerHTML = '';
                images.forEach(item => {
                    const card = document.createElement('div');
                    card.classList.add('card');
                    card.setAttribute('data-id', item.id);

                    // ── COL 1: Image ──────────────────────────────────────────────
                    const imageCol = document.createElement('div');
                    imageCol.classList.add('card-image-col');

                    const img = document.createElement('img');
                    img.src = item.imageSrc;
                    img.alt = `Từ mới ${item.character}`;
                    img.loading = 'lazy';

                    const audioButton = document.createElement('button');
                    audioButton.textContent = '☊';
                    audioButton.classList.add('audio-button');
                    audioButton.title = 'Nghe phát âm';
                    audioButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const audio = new Audio(item.audioSrc);
                        audio.play().catch(err => console.error('Audio error:', err));
                    });

                    imageCol.appendChild(img);
                    imageCol.appendChild(audioButton);

                    // ── COL 2: Info ───────────────────────────────────────────────
                    const infoCol = document.createElement('div');
                    infoCol.classList.add('card-info-col');

                    // Lesson info badge (nếu có)
                    if (item.lesson) {
                        const lessonBadge = document.createElement('div');
                        lessonBadge.classList.add('card-lesson-badge');
                        lessonBadge.innerHTML = `
                            <span class="lesson-title">${item.lesson.title}</span>
                            <span class="lesson-topic">${item.lesson.topic}</span>
                        `;
                        infoCol.appendChild(lessonBadge);
                    }

                    // Pinyin
                    const pinyinEl = document.createElement('p');
                    pinyinEl.classList.add('card-pinyin');
                    pinyinEl.textContent = item.pinyin;

                    // Character (clickable per glyph)
                    const charEl = document.createElement('div');
                    charEl.classList.add('card-character');
                    charEl.innerHTML = item.character.split('').map(c =>
                        `<span class="character">${c}</span>`).join('');

                    // Meaning
                    const meaningEl = document.createElement('p');
                    meaningEl.classList.add('card-meaning');
                    meaningEl.innerHTML = item.meaning;

                    // Stroke order container
                    const strokeArea = document.createElement('div');
                    strokeArea.classList.add('card-stroke-area');
                    const strokeContainer = document.createElement('div');
                    strokeContainer.classList.add('stroke-order-container');
                    strokeContainer.id = `stroke-order-${item.id}`;
                    strokeArea.appendChild(strokeContainer);

                    infoCol.appendChild(pinyinEl);
                    infoCol.appendChild(charEl);
                    infoCol.appendChild(meaningEl);
                    infoCol.appendChild(strokeArea);

                    // Click character → show stroke animation
                    const characterSpans = charEl.querySelectorAll('.character');
                    characterSpans.forEach((span, index) => {
                        span.addEventListener('click', (e) => {
                            e.stopPropagation();
                            // Reset all highlights
                            characterSpans.forEach(s => s.classList.remove('clicked'));
                            span.classList.add('clicked');

                            // Reset & re-render stroke container
                            strokeContainer.innerHTML = '';
                            const writerDiv = document.createElement('div');
                            writerDiv.id = `writer-${item.id}-${index}`;
                            strokeContainer.appendChild(writerDiv);

                            HanziWriter.create(writerDiv.id, item.character[index], {
                                width: 80,
                                height: 80,
                                padding: 4,
                                showOutline: true,
                            }).animateCharacter();
                        });
                    });

                    // ── COL 3: Practice canvas ────────────────────────────────────
                    const practiceCol = document.createElement('div');
                    practiceCol.classList.add('card-practice-col');

                    const canvasSize = 180;
                    const canvas = document.createElement('canvas');
                    canvas.width = canvasSize;
                    canvas.height = canvasSize;
                    canvas.style.width = canvasSize + 'px';
                    canvas.style.height = canvasSize + 'px';
                    canvas.title = 'Practice writing characters';

                    // Draw guide lines
                    const ctx = canvas.getContext('2d');
                    drawGuideLines(ctx, canvasSize);

                    // Drawing logic
                    let drawing = false;
                    let lastX = 0, lastY = 0;

                    function getPos(e, canvas) {
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        if (e.touches) {
                            return {
                                x: (e.touches[0].clientX - rect.left) * scaleX,
                                y: (e.touches[0].clientY - rect.top) * scaleY
                            };
                        }
                        return {
                            x: (e.clientX - rect.left) * scaleX,
                            y: (e.clientY - rect.top) * scaleY
                        };
                    }

                    canvas.addEventListener('mousedown', (e) => {
                        drawing = true;
                        const pos = getPos(e, canvas);
                        lastX = pos.x; lastY = pos.y;
                    });
                    canvas.addEventListener('mousemove', (e) => {
                        if (!drawing) return;
                        const pos = getPos(e, canvas);
                        ctx.beginPath();
                        ctx.strokeStyle = '#222';
                        ctx.lineWidth = 3;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.moveTo(lastX, lastY);
                        ctx.lineTo(pos.x, pos.y);
                        ctx.stroke();
                        lastX = pos.x; lastY = pos.y;
                    });
                    canvas.addEventListener('mouseup', () => { drawing = false; });
                    canvas.addEventListener('mouseleave', () => { drawing = false; });

                    // Touch support
                    canvas.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        drawing = true;
                        const pos = getPos(e, canvas);
                        lastX = pos.x; lastY = pos.y;
                    }, { passive: false });
                    canvas.addEventListener('touchmove', (e) => {
                        e.preventDefault();
                        if (!drawing) return;
                        const pos = getPos(e, canvas);
                        ctx.beginPath();
                        ctx.strokeStyle = '#222';
                        ctx.lineWidth = 3;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.moveTo(lastX, lastY);
                        ctx.lineTo(pos.x, pos.y);
                        ctx.stroke();
                        lastX = pos.x; lastY = pos.y;
                    }, { passive: false });
                    canvas.addEventListener('touchend', () => { drawing = false; });

                    // Controls
                    const controls = document.createElement('div');
                    controls.classList.add('practice-controls');

                    const clearBtn = document.createElement('button');
                    clearBtn.textContent = '🗑 Clear';
                    clearBtn.classList.add('practice-btn', 'clear-btn');
                    clearBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        drawGuideLines(ctx, canvasSize);
                    });

                    controls.appendChild(clearBtn);
                    practiceCol.appendChild(canvas);
                    practiceCol.appendChild(controls);

                    // ── Assemble card ─────────────────────────────────────────────
                    card.appendChild(imageCol);
                    card.appendChild(infoCol);
                    card.appendChild(practiceCol);
                    imageGrid.appendChild(card);
                });
            }

            // ── Guide lines helper ────────────────────────────────────────────────
            function drawGuideLines(ctx, size) {
                ctx.strokeStyle = '#e0e0e0';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                // Horizontal centre
                ctx.beginPath();
                ctx.moveTo(0, size / 2);
                ctx.lineTo(size, size / 2);
                ctx.stroke();
                // Vertical centre
                ctx.beginPath();
                ctx.moveTo(size / 2, 0);
                ctx.lineTo(size / 2, size);
                ctx.stroke();
                // Diagonal 1
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(size, size);
                ctx.stroke();
                // Diagonal 2
                ctx.beginPath();
                ctx.moveTo(size, 0);
                ctx.lineTo(0, size);
                ctx.stroke();
                ctx.setLineDash([]);
                // Border
                ctx.strokeStyle = '#ccc';
                ctx.lineWidth = 1;
                ctx.strokeRect(0, 0, size, size);
            }

            // ── Pagination state ──────────────────────────────────────────────────
            const CARDS_PER_PAGE = 10;
            let currentPage = 1;
            let currentDataset = []; // dataset đang hiển thị (sau sort/filter)

            // Render đúng trang từ currentDataset
            function renderPage(page) {
                currentPage = page;
                const start = (page - 1) * CARDS_PER_PAGE;
                const end = start + CARDS_PER_PAGE;
                renderImages(currentDataset.slice(start, end));
                renderPagination();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // Render thanh pagination
            function renderPagination() {
                const existing = document.getElementById('pagination');
                if (existing) existing.remove();

                const totalPages = Math.ceil(currentDataset.length / CARDS_PER_PAGE);
                if (totalPages <= 1) return;

                const nav = document.createElement('div');
                nav.id = 'pagination';
                nav.classList.add('pagination');

                // Nút Trước
                const prevBtn = document.createElement('button');
                prevBtn.textContent = '← Previous';
                prevBtn.disabled = currentPage === 1;
                prevBtn.addEventListener('click', () => renderPage(currentPage - 1));
                nav.appendChild(prevBtn);

                // Các số trang
                for (let i = 1; i <= totalPages; i++) {
                    // Hiện trang đầu, trang cuối, và các trang xung quanh trang hiện tại
                    if (
                        i === 1 || i === totalPages ||
                        (i >= currentPage - 2 && i <= currentPage + 2)
                    ) {
                        const btn = document.createElement('button');
                        btn.textContent = i;
                        btn.classList.toggle('active', i === currentPage);
                        btn.addEventListener('click', () => renderPage(i));
                        nav.appendChild(btn);
                    } else if (
                        i === currentPage - 3 || i === currentPage + 3
                    ) {
                        const dots = document.createElement('span');
                        dots.textContent = '…';
                        dots.classList.add('pagination-dots');
                        nav.appendChild(dots);
                    }
                }

                // Nút Sau
                const nextBtn = document.createElement('button');
                nextBtn.textContent = 'Next →';
                nextBtn.disabled = currentPage === totalPages;
                nextBtn.addEventListener('click', () => renderPage(currentPage + 1));
                nav.appendChild(nextBtn);

                // Chèn sau imageGrid
                imageGrid.insertAdjacentElement('afterend', nav);
            }

            // Hàm set dataset mới và về trang 1
            function setDataset(newData) {
                currentDataset = newData;
                renderPage(1);
            }

            // ── Initial render ────────────────────────────────────────────────────
            setDataset(data.slice().reverse());

            // ── OK button ─────────────────────────────────────────────────────────
            okButton.addEventListener('click', () => {
                const count = parseInt(countInput.value) || data.length;
                let sortedData;
                switch (sortSelect.value) {
                    case 'newest':  sortedData = data.slice().reverse(); break;
                    case 'oldest':  sortedData = data.slice(); break;
                    case 'shuffle': sortedData = data.slice().sort(() => Math.random() - 0.5); break;
                    default:        sortedData = data;
                }
                setDataset(sortedData.slice(0, count));
            });

            // ── Search ────────────────────────────────────────────────────────────
            const searchInput = document.getElementById('searchInput');
            const searchButton = document.getElementById('searchButton');

            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') searchButton.click();
            });
            searchButton.addEventListener('click', () => {
                const val = searchInput.value.trim().toLowerCase();
                if (val) {
                    const matched = data.filter(item =>
                        item.character.includes(val) ||
                        item.meaning.toLowerCase().includes(val) ||
                        item.pinyin.toLowerCase().includes(val) ||
                        (item.lesson && item.lesson.title.toLowerCase().includes(val))
                    );
                    setDataset(matched);
                } else {
                    setDataset(data.slice().reverse());
                }
            });

            // ── Enter in countInput ───────────────────────────────────────────────
            countInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') okButton.click();
            });
        })

        .catch(error => console.error('Error fetching JSON:', error));
});
