// Hàm kiểm tra phần tử có nằm trong viewport không
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom >= 0;
}
let activeImageCard = null;
let isOpeningCard = false; // Cờ để theo dõi trạng thái mở card

function showImageCard(imageData) {
    isOpeningCard = true; // Đánh dấu đang mở card
    setTimeout(() => isOpeningCard = false, 100); // Reset cờ sau 100ms

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
    // Lấy container để chứa các writer
    const writerContainer = card.querySelector('#writer-container');

    // Biến để giữ danh sách writers
    let writers = [];

    // Hàm khởi tạo writer
    function initializeWriters(characters) {
        // Xóa tất cả writer cũ nếu có
        writers.forEach(writer => {
            try {
                writer.destroy();
            } catch (error) {
                console.error("Error destroying writer:", error);
            }
        });
        writers = []; // Reset danh sách writer

        // Tạo writer cho từng ký tự
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
                    strokeAnimationSpeed: 1,
                    delayBetweenStrokes: 300,
                });

                writers.push({ writer, writerDiv });

                // Thêm sự kiện click vào writerDiv
                writerDiv.addEventListener('click', () => {
                    writer.animateCharacter();
                });
            } catch (error) {
                console.error(`Error creating HanziWriter for character "${char}":`, error);
            }
        });
    }

    // Tách các ký tự từ chuỗi character
    const characters = imageData.character.split('');

    // Khởi tạo writer cho từng ký tự
    initializeWriters(characters);
}

    
function closeImageCard() {
    if (activeImageCard) {
        activeImageCard.style.display = 'none'; // Đóng card
        activeImageCard = null; // Reset activeImageCard
    }
}

// Thêm sự kiện click cho toàn bộ tài liệu
document.addEventListener('click', (event) => {
    if (!isOpeningCard && activeImageCard && !activeImageCard.contains(event.target)) {
        closeImageCard();
    }
});
    
// Hàm chính để load posts với các tham số có thể thay đổi
function loadPosts(startpId, endpId, listId) {
     const itemList = document.getElementById(listId);

    // Danh sách các file JSON cần tải
    const filesToFetch = [
        '../data/imagesData.json',
        '../data/posts.json'
        
    ];

    // Dùng Promise.all để tải nhiều file cùng lúc
    Promise.all(filesToFetch.map(file => fetch(file).then(response => {
        if (!response.ok) {
            throw new Error(`Failed to fetch ${file}`);
        }
        return response.json();
    })))
    .then(allData => {
        // Gộp dữ liệu từ các file cùng loại
        const imagesData = allData.filter((_, index) => filesToFetch[index].includes('imagesData')).flat();
        const postsData = allData.filter((_, index) => filesToFetch[index].includes('posts')).flat();

        console.log('Images Data:', imagesData);
        console.log('Posts Data:', postsData);

        // Lọc bài viết theo ID từ startpId đến endpId
        const filteredPosts = postsData.filter(post => post.id >= startpId && post.id <= endpId);

        filteredPosts.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'animate box'; // Thêm class box cho hiệu ứng

            const row = document.createElement('div');
            row.className = 'row';
                    
            const avatar = document.createElement('span');
            avatar.className = 'avatar-1';
            avatar.style.backgroundImage = `url(${item.avatar})`;

            const user = document.createElement('span');
            user.className = 'user';
            user.textContent = item.user; // Thêm tên người dùng
            const audio = document.createElement('span');
            audio.className = 'audio';
            audio.textContent = '☊'; // Biểu tượng âm thanh
            audio.style.cursor = 'pointer'; // Thay đổi con trỏ khi hover

            // Thêm sự kiện click để phát âm thanh
            audio.addEventListener('click', () => {
                const audioElement = new Audio(item.audioSrc); // Tạo đối tượng Audio với đường dẫn
                audioElement.play(); // Phát âm thanh
            });

            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-description';
            toggleButton.textContent = '⬇️';

            const p = document.createElement('p');
            p.className = 'description';
            p.itemProp = 'description';
            p.innerHTML = item.description.replace(/\\n/g, '<br>'); // Sử dụng innerHTML để hiển thị mô tả
            p.style.display = 'none';
            // Xử lý sự kiện click vào nút toggle
            toggleButton.addEventListener('click', () => {
                if (p.style.display === 'block') {
                    p.style.display = 'none';
                    toggleButton.textContent = '⬇️';
                } else {
                    p.style.display = 'block';
                    toggleButton.textContent = '⬅️';
                }
            });

            // Thêm avatar và user vào thẻ row
            row.appendChild(avatar);
            row.appendChild(user);
            li.appendChild(audio);
            li.appendChild(toggleButton);

            const h2 = document.createElement('h2');
            h2.itemProp = 'name';
                        
            // Tạo các phần tử từ segments
            item.segments.forEach(segment => {
                const span = document.createElement('span');
                span.textContent = segment;
                span.style.cursor = 'pointer';

                // Thêm sự kiện click vào từng cụm từ
                span.addEventListener('click', () => {
                    const imageData = imagesData.find(image => image.character === segment);
                    if (imageData) {
                        showImageCard(imageData);
                    }
                });

                h2.appendChild(span); // Thêm ký tự vào h2
            });

            li.appendChild(row);
            li.appendChild(h2);
            li.appendChild(p);
            itemList.appendChild(li);

            // Kiểm tra ngay khi tải trang với khoảng delay
            if (isInViewport(li)) {
                setTimeout(() => {
                    li.classList.add('visible');
                }, 100 * index); // Thêm khoảng delay dựa trên chỉ số của item
            }
             // Thêm sự kiện cuộn
            window.addEventListener('scroll', () => {
                if (isInViewport(li)) {
                    li.classList.add('visible');
                }
            });
        });
    })
    .catch(error => {
        console.error('Error fetching JSON files:', error);
    });
}
