// grammar-type-quiz.js

document.querySelectorAll('[id^="quiz-container"]').forEach(quizContainer => {
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

            const quizContainerElement = document.getElementById('quizContainer');
            quizContainerElement.innerHTML = ''; // Xóa nội dung cũ nếu có

            filteredQuestions.forEach((question, index) => {
                let sentenceHTML = String(question.sentence);
                question.blanks.forEach((blank, i) => {
                    sentenceHTML = sentenceHTML.replace("___", `<input type="text" id="answer${index}-${i}" placeholder="Type here">`);
                });

                const questionHTML = `
                    <p>${sentenceHTML}</p>
                    <button onclick="checkAnswers(${index}, ${question.blanks.length})">Check</button>
                    <p class="result" id="result${index}"></p>
                `;

                quizContainerElement.innerHTML += questionHTML;
            });
        })
        .catch(error => {
            console.error("Error loading quiz:", error);
            document.getElementById("quizContainer").innerHTML = "<p>Failed to load quiz.</p>";
        });
});

// Hàm kiểm tra câu trả lời
function checkAnswers(questionIndex, numAnswers) {
    fetch("https://raw.githubusercontent.com/minhnguyen412/chinese60s/refs/heads/main/data/grammar-quiz.json")
        .then(response => response.json())
        .then(data => {
            const correctAnswers = data.questions[questionIndex].blanks.map(blank => blank.answer);
            let isCorrect = true;

            for (let i = 0; i < numAnswers; i++) {
                const userAnswer = document.getElementById(`answer${questionIndex}-${i}`).value;
                if (normalizeText(userAnswer) !== normalizeText(correctAnswers[i])) {
                    isCorrect = false;
                }
            }

            document.getElementById(`result${questionIndex}`).textContent = isCorrect
                ? "✅ Correct! Well done!"
                : "❌ Incorrect! Try again.";
        })
        .catch(error => console.error("Error checking answers:", error));
}

// Hàm chuẩn hóa văn bản
function normalizeText(text) {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Tải quiz khi trang web mở lên
loadQuiz();
