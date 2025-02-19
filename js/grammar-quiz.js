// Duyệt qua tất cả các quiz-container
document.querySelectorAll('[id^="quiz-container"]').forEach(quizContainer => {
    if (quizContainer.classList.contains('grammar-quiz')) {
        const startId = parseInt(quizContainer.dataset.startId, 10);
        const endId = parseInt(quizContainer.dataset.endId, 10);

        fetch('https://raw.githubusercontent.com/minhnguyen412/chinese60s/refs/heads/main/data/grammar-quiz.json')
            .then(response => response.json())
            .then(data => {
                const filteredQuestions = data.questions.filter(q => q.id >= startId && q.id <= endId);

                if (filteredQuestions.length === 0) {
                    console.error('No questions found in the specified ID range');
                    return;
                }

                quizContainer.innerHTML = ''; // Xóa nội dung cũ nếu có

                filteredQuestions.forEach((question, questionIndex) => {
                    const questionDiv = document.createElement('div');
                    questionDiv.classList.add('quiz-question');

                    // Tạo vùng chứa câu hỏi + kết quả
                    const sentenceContainer = document.createElement('div');
                    sentenceContainer.classList.add('sentence-container');

                    // Hiển thị câu với chỗ trống
                    let sentenceHTML = question.sentence;
                    question.blanks.forEach(() => {
                        sentenceHTML = sentenceHTML.replace('___', `<span class="blank"></span>`);
                    });

                    sentenceContainer.innerHTML = `<p class="sentence">${sentenceHTML}</p>`;

                    // Thêm khu vực hiển thị kết quả bên phải câu hỏi
                    const resultDiv = document.createElement('span');
                    resultDiv.classList.add('result');
                    sentenceContainer.appendChild(resultDiv);

                    // Tạo danh sách lựa chọn
                    const optionsDiv = document.createElement('div');
                    optionsDiv.classList.add('options');

                    question.words.forEach(word => {
                        const button = document.createElement('button');
                        button.classList.add('word');
                        button.textContent = word;
                        button.dataset.word = word;
                        button.dataset.questionIndex = questionIndex;
                        button.addEventListener('click', function () {
                            handleWordClick(this, quizContainer);
                        });
                        optionsDiv.appendChild(button);
                    });

                    // Thêm nút Retry
                    const retryButton = document.createElement('button');
                    retryButton.textContent = 'Retry';
                    retryButton.classList.add('retry-button');
                    retryButton.addEventListener('click', function () {
                        resetQuestion(this, quizContainer, questionIndex);
                    });

                    // Thêm nút Check
                    const checkButton = document.createElement('button');
                    checkButton.textContent = 'Check';
                    checkButton.classList.add('check-button');
                    checkButton.addEventListener('click', function () {
                checkAnswers(this, quizContainer, questionIndex, question);
                    });

                    // Thêm mọi thứ vào giao diện
                    questionDiv.appendChild(sentenceContainer);
                    questionDiv.appendChild(optionsDiv);
                    questionDiv.appendChild(retryButton);
                    questionDiv.appendChild(checkButton);
                    quizContainer.appendChild(questionDiv);
                });
            })
            .catch(error => {
                console.error('Error loading the JSON file:', error);
            });
    }
});

// Hàm xử lý khi chọn một từ
function handleWordClick(button, quizContainer) {
    const word = button.dataset.word;
    const questionIndex = button.dataset.questionIndex;
    const questionDiv = quizContainer.querySelectorAll('.quiz-question')[questionIndex];
    const blanks = questionDiv.querySelectorAll('.blank');

    // Tìm chỗ trống đầu tiên chưa có từ
    const emptyBlank = Array.from(blanks).find(blank => !blank.dataset.word);
    
    if (emptyBlank) {
        emptyBlank.textContent = word;
        emptyBlank.dataset.word = word;

        // Ẩn nút thay vì xóa hoàn toàn (để có thể khôi phục)
        button.style.display = 'none';
        button.dataset.selected = "true"; // Đánh dấu đã chọn
    }
}

// Hàm kiểm tra đáp án
// Hàm kiểm tra đáp án
function checkAnswers(button, quizContainer, questionIndex, question) {
    const questionDiv = quizContainer.querySelectorAll('.quiz-question')[questionIndex];
    const blanks = questionDiv.querySelectorAll('.blank');
    const resultDiv = questionDiv.querySelector('.result');

    let correct = true;

    blanks.forEach((blank, index) => {
        if (blank.dataset.word !== question.blanks[index].answer) {
            correct = false;
        }
    });

    resultDiv.innerHTML = correct
        ? '<span class="correct">✔ Correct</span>'
        : '<span class="incorrect">✘ Incorrect</span>';
}

function resetQuestion(button, quizContainer, questionIndex, questionData) {
    const questionDiv = quizContainer.querySelectorAll('.quiz-question')[questionIndex];
    const blanks = questionDiv.querySelectorAll('.blank');
    const optionsDiv = questionDiv.querySelector('.options'); // Lấy danh sách chọn từ
    const resultDiv = questionDiv.querySelector('.result');

    // Xóa từ khỏi chỗ trống
    blanks.forEach(blank => {
        blank.textContent = '';
        blank.removeAttribute('data-word');
    });

    // Hiện lại tất cả các từ đã bị ẩn
    const buttons = optionsDiv.querySelectorAll('.word');
    buttons.forEach(button => {
        button.style.display = 'inline-block'; // Hiển thị lại từ đã chọn
    });

    // Xóa kết quả
    resultDiv.innerHTML = '';
}
