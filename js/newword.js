let data = []; // Khai báo biến data toàn cục

// Fetch data from GitHub JSON file and display
const filesToFetch = [
    '../data/imagesData.json'
];

Promise.all(filesToFetch.map(url => fetch(url).then(res => res.json())))
    .then(dataArrays => {
        // Gộp tất cả các mảng dữ liệu thành một mảng duy nhất
        data = dataArrays.flat(); 
        const imageGrid = document.getElementById('imageGrid');
        const countInput = document.getElementById('countInput');
        const sortSelect = document.getElementById('sortSelect');
        const okButton = document.getElementById('okButton');

        // Function to render the images
        function renderImages(images) {
            imageGrid.innerHTML = ''; // Clear previous images
            images.forEach(item => {
                const card = document.createElement('div');
                card.classList.add('card');
                card.setAttribute('data-id', item.id);

                // Card front with image and audio button
                const cardFront = document.createElement('div');
                cardFront.classList.add('card-front');
                const img = document.createElement('img');
                img.src = item.imageSrc;
                img.alt = `Từ mới ${item.character}`;

                // Add audio button to the front of the card
                const audioButton = document.createElement('button');
                audioButton.textContent = "☊";
                audioButton.classList.add('audio-button');
                audioButton.addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent card flipping
                    const audio = new Audio(item.audioSrc);
                    audio.play().catch(error => {
                        console.error("Error playing audio:", error);
                    });
                });

                cardFront.appendChild(audioButton);
                cardFront.appendChild(img);

                // Card back with details
                const cardBack = document.createElement('div');
                cardBack.classList.add('card-back');
                const characterTitle = document.createElement('h2');
                characterTitle.innerHTML = item.character.split('').map(c =>
                    `<span class="character">${c}</span>`).join('');

                const meaningText = document.createElement('p');
                meaningText.innerHTML = item.meaning;

                const pinyinText = document.createElement('p');
                pinyinText.textContent = `${item.pinyin}`;

                const strokeOrderDiv = document.createElement('div');
                strokeOrderDiv.id = `stroke-order-${item.id}`;

                cardBack.appendChild(pinyinText);
                cardBack.appendChild(characterTitle);
                cardBack.appendChild(meaningText);
                cardBack.appendChild(strokeOrderDiv);

                card.appendChild(cardFront);
                card.appendChild(cardBack);
                imageGrid.appendChild(card);

                // Initialize stroke order and character interaction
                let writer = null;
                const characterElements = cardBack.querySelectorAll('.character');
                characterElements.forEach((char, index) => {
                    char.addEventListener('click', (event) => {
                        event.stopPropagation();
                        resetClickedCharacters(cardBack);
                        resetStrokeOrder(item.id, `stroke-order-${item.id}`);
                        char.classList.add('clicked');

                        // Initialize stroke order animation
                        writer = HanziWriter.create(`stroke-order-${item.id}`, item.character[index], {
                            width: 100,
                            height: 100,
                            padding: 5,
                            showOutline: true
                        });
                        writer.animateCharacter();
                    });
                });

                // Add card flipping logic
                card.addEventListener('click', (event) => {
                    if (!event.target.classList.contains('audio-button') && 
                        !event.target.classList.contains('character') &&
                        event.target.tagName !== 'A') 
                    { 
                        card.classList.toggle('flipped');
                        resetClickedCharacters(cardBack);
                        resetStrokeOrder(item.id, `stroke-order-${item.id}`);
                    }
                });
            });
        }

        // Initial render
        console.log('Data before reverse:', data);
        const initialData = data.slice().reverse(); // Đảo ngược thứ tự
        console.log('Data after reverse:', initialData);
        renderImages(initialData); // Gọi renderImages mà không cần slice

        // Handle OK button click
        okButton.addEventListener('click', () => {
            const count = parseInt(countInput.value) || data.length;
            console.log('Sort option selected:', sortSelect.value);
            let sortedData;

            switch (sortSelect.value) {
                case 'newest':
                    sortedData = data.slice().reverse(); // Newest first
                    break;
                case 'oldest':
                    sortedData = data.slice(); // Oldest first
                    break;
                case 'shuffle':
                    sortedData = data.slice().sort(() => Math.random() - 0.5); // Shuffle
                    break;
                default:
                    sortedData = data;
            }
            renderImages(sortedData.slice(0, count));
        });

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');

        // Tìm kiếm khi nhấn Enter
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                searchButton.click(); // Kích hoạt sự kiện click của nút tìm kiếm
            }
        });

        searchButton.addEventListener('click', () => {
            const searchValue = searchInput.value.trim().toLowerCase();
            if (searchValue) {
                const matchedImages = data.filter(item => 
                    item.character.includes(searchValue) || 
                    item.meaning.toLowerCase().includes(searchValue) || 
                    item.pinyin.toLowerCase().includes(searchValue)
                );
                renderImages(matchedImages);
            } else {
                renderImages(data);
            }
        });

        // Nhấn Enter trong ô nhập số lượng
        countInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                okButton.click(); // Kích hoạt sự kiện click của nút OK
            }
        });
        
    })
    .catch(error => console.error('Error fetching JSON:', error));

// Reset stroke order display
function resetStrokeOrder(cardId, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
}

// Reset clicked character highlight
function resetClickedCharacters(cardBack) {
    const allCharacters = cardBack.querySelectorAll('.character');
    allCharacters.forEach(char => {
        char.classList.remove('clicked');
    });
}
