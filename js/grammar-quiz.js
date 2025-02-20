// ---------------------- GRAMMAR QUIZ (Chọn từ) ----------------------

// Hàm tải dữ liệu JSON và hiển thị quiz
async function loadGrammarQuiz() {
    try {
        const response = await fetch("https://raw.githubusercontent.com/minhnguyen412/chinese60s/refs/heads/main/data/grammar-quiz.json");
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        document.querySelectorAll('[id^="quiz-container"]').forEach(quizContainer => {
            if (quizContainer.classList.contains('grammar-quiz')) {
                const startId = parseInt(quizContainer.dataset.startId, 10);
                const endId = parseInt(quizContainer.dataset.endId, 10);
                const filteredQuestions = data.questions.filter(q => q.id >= startId && q.id <= endId);

                quizContainer.dataset.quizData = JSON.stringify(filteredQuestions);
                displayGrammarQuiz(filteredQuestions, quizContainer);
            }
        });
    } catch (error) {
        console.error("Error loading grammar quiz:", error);
    }
}

// Hàm hiển thị câu hỏi
function displayGrammarQuiz(questions, quizContainer) {
    quizContainer.innerHTML = "";

    questions.forEach((question, questionIndex) => {
        const questionDiv = document.createElement('div');
        questionDiv.classList.add('quiz-question');

        const sentenceContainer = document.createElement('div');
        sentenceContainer.classList.add('sentence-container');

        let sentenceHTML = question.sentence;
        question.blanks.forEach(() => {
            sentenceHTML = sentenceHTML.replace('___', `<span class="blank"></span>`);
        });

        sentenceContainer.innerHTML = `<p class="sentence">${sentenceHTML}</p>`;
        const resultDiv = document.createElement('span');
        resultDiv.classList.add('result');
        sentenceContainer.appendChild(resultDiv);

        const optionsDiv = document.createElement('div');
        optionsDiv.classList.add('options');

        question.words.forEach(word => {
            const button = document.createElement('button');
            button.classList.add('word');
            button.textContent = word;
            button.dataset.word = word;
            button.dataset.questionIndex = questionIndex;
            button.addEventListener('click', () => handleWordClick(button, quizContainer));
            optionsDiv.appendChild(button);
        });

        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry';
        retryButton.classList.add('retry-button');
        retryButton.addEventListener('click', () => resetQuestion(retryButton, quizContainer, questionIndex));

        const checkButton = document.createElement('button');
        checkButton.textContent = 'Check';
        checkButton.classList.add('check-button');
        checkButton.addEventListener('click', () => checkAnswers1(checkButton, quizContainer, questionIndex));

        questionDiv.appendChild(sentenceContainer);
        questionDiv.appendChild(optionsDiv);
        questionDiv.appendChild(retryButton);
        questionDiv.appendChild(checkButton);
        quizContainer.appendChild(questionDiv);
    });
}

// Hàm xử lý chọn từ
function handleWordClick(button, quizContainer) {
    const word = button.dataset.word;
    const questionIndex = button.dataset.questionIndex;
    const questionDiv = quizContainer.querySelectorAll('.quiz-question')[questionIndex];
    const blanks = questionDiv.querySelectorAll('.blank');
    const emptyBlank = Array.from(blanks).find(blank => !blank.dataset.word);

    if (emptyBlank) {
        emptyBlank.textContent = word;
        emptyBlank.dataset.word = word;
        button.style.display = 'none';
        button.dataset.selected = "true";
    }
}

// Hàm kiểm tra đáp án
function checkAnswers1(button, quizContainer, questionIndex) {
    const questions = JSON.parse(quizContainer.dataset.quizData);
    const question = questions[questionIndex];
    const questionDiv = quizContainer.querySelectorAll('.quiz-question')[questionIndex];
    const blanks = questionDiv.querySelectorAll('.blank');
    const resultDiv = questionDiv.querySelector('.result');

    let correct = true;
    blanks.forEach((blank, index) => {
        if (blank.dataset.word !== question.blanks[index].answer) correct = false;
    });

    resultDiv.innerHTML = correct ? '<span class="correct">✔ Correct</span>' : '<span class="incorrect">✘ Incorrect</span>';
}

// Hàm reset câu hỏi
function resetQuestion(button, quizContainer, questionIndex) {
    const questionDiv = quizContainer.querySelectorAll('.quiz-question')[questionIndex];
    const blanks = questionDiv.querySelectorAll('.blank');
    const optionsDiv = questionDiv.querySelector('.options');
    const resultDiv = questionDiv.querySelector('.result');

    blanks.forEach(blank => {
        blank.textContent = '';
        blank.removeAttribute('data-word');
    });

    optionsDiv.querySelectorAll('.word').forEach(button => {
        button.style.display = 'inline-block';
    });

    resultDiv.innerHTML = '';
}

loadGrammarQuiz(); // Tải quiz khi trang web mở lên
