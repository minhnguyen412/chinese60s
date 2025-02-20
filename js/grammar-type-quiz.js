// ---------------------- GRAMMAR TYPE QUIZ (Nhập từ) ----------------------

function normalizeText(text) {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Tải dữ liệu JSON và hiển thị quiz
async function loadGrammarTypeQuiz() {
    try {
        const response = await fetch("https://raw.githubusercontent.com/minhnguyen412/chinese60s/refs/heads/main/data/grammar-quiz.json");
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        document.querySelectorAll('[id^="quiz-container"]').forEach(quizContainer => {
            if (quizContainer.classList.contains('grammar-type-quiz')) {
                const startId = parseInt(quizContainer.dataset.startId, 10);
                const endId = parseInt(quizContainer.dataset.endId, 10);
                const filteredQuestions = data.questions.filter(q => q.id >= startId && q.id <= endId);

                quizContainer.dataset.quizData = JSON.stringify(filteredQuestions);
                displayGrammarTypeQuiz(filteredQuestions, quizContainer);
            }
        });
    } catch (error) {
        console.error("Error loading grammar-type quiz:", error);
    }
}

// Hiển thị quiz
function displayGrammarTypeQuiz(questions, quizContainer) {
    quizContainer.innerHTML = "";

    questions.forEach((question, index) => {
        let sentenceHTML = String(question.sentence);
        question.blanks.forEach((_, i) => {
            sentenceHTML = sentenceHTML.replace("___", `<input type="text" id="answer-${quizContainer.id}-${index}-${i}" placeholder="Type here">`);
        });

        const questionHTML = `
            <p>${sentenceHTML}</p>
            <button onclick="checkGrammarTypeQuizAnswers(${index}, ${question.blanks.length}, '${quizContainer.id}')">Check</button>
            <p class="result" id="result-${quizContainer.id}-${index}"></p>
        `;

        quizContainer.innerHTML += questionHTML;
    });
}

// Kiểm tra đáp án
function checkGrammarTypeQuizAnswers(questionIndex, numAnswers, containerId) {
    const quizContainer = document.getElementById(containerId);
    const questions = JSON.parse(quizContainer.dataset.quizData);
    const question = questions[questionIndex];

    let isCorrect = true;
    for (let i = 0; i < numAnswers; i++) {
        const userAnswer = quizContainer.querySelector(`#answer-${containerId}-${questionIndex}-${i}`).value;
        if (normalizeText(userAnswer) !== normalizeText(question.blanks[i].answer)) {
            isCorrect = false;
        }
    }

    const resultDiv = quizContainer.querySelector(`#result-${containerId}-${questionIndex}`);
    resultDiv.textContent = isCorrect ? "✅ Correct! Well done!" : "❌ Incorrect! Try again.";
}

loadGrammarTypeQuiz(); // Tải quiz khi trang web mở lên