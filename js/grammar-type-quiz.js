// Hàm chuẩn hóa văn bản (bỏ dấu cách thừa, phân biệt chữ hoa/thường)
function normalizeText(text) {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Hàm tải dữ liệu từ JSON
async function loadQuiz() {
    try {
        const response = await fetch("https://raw.githubusercontent.com/minhnguyen412/chinese60s/refs/heads/main/data/grammar-quiz.json");
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();

        // Duyệt qua tất cả các quiz-container
        document.querySelectorAll('[id^="quiz-container"]').forEach(quizContainer => {
            const startId = parseInt(quizContainer.dataset.startId, 10);
            const endId = parseInt(quizContainer.dataset.endId, 10);
            
            // Lọc câu hỏi theo ID
            const filteredQuestions = data.questions.filter(q => q.id >= startId && q.id <= endId);
            displayQuiz(filteredQuestions, quizContainer);
        });
    } catch (error) {
        console.error("Error loading quiz:", error);
        document.getElementById("quizContainer").innerHTML = "<p>Failed to load quiz.</p>";
    }
}

// Hàm hiển thị quiz
function displayQuiz(questions, quizContainer) {
    quizContainer.innerHTML = ""; // Xóa nội dung cũ

    questions.forEach((question, index) => {
        let sentenceHTML = String(question.sentence); // Đảm bảo là chuỗi
        question.blanks.forEach((blank, i) => {
            // Thay thế từng chỗ trống bằng một input
            sentenceHTML = sentenceHTML.replace("___", `<input type="text" id="answer${index}-${i}" placeholder="Type here">`);
        });

        const questionHTML = `
            <p>${sentenceHTML}</p>
            <button onclick="checkAnswers(${index}, ${question.blanks.length}, '${quizContainer.id}')">Check</button>
            <p class="result" id="result${index}"></p>
        `;

        quizContainer.innerHTML += questionHTML;
    });
}

// Hàm kiểm tra câu trả lời
function checkAnswers(questionIndex, numAnswers, containerId) {
    const quizContainer = document.getElementById(containerId);
    fetch("https://raw.githubusercontent.com/minhnguyen412/chinese60s/refs/heads/main/data/grammar-quiz.json")
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const correctAnswers = data.questions[questionIndex].blanks.map(blank => blank.answer);
            let isCorrect = true;

            for (let i = 0; i < numAnswers; i++) {
                const userAnswer = quizContainer.querySelector(`#answer${questionIndex}-${i}`).value;
                // Kiểm tra câu trả lời người dùng với câu trả lời đúng
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

// Tải quiz khi trang web mở lên
loadQuiz();
