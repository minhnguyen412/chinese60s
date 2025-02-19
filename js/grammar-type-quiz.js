// Hàm chuẩn hóa văn bản (bỏ dấu cách thừa, phân biệt chữ hoa/thường)
function normalizeText(text) {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Hàm tải dữ liệu từ JSON và xử lý từng container có class 'grammar-type-quiz'
async function loadQuiz() {
    try {
        const response = await fetch("https://raw.githubusercontent.com/minhnguyen412/chinese60s/refs/heads/main/data/grammar-quiz.json");
        if (!response.ok) {
            throw new Error("Network response was not ok");
        }
        const data = await response.json();

        // Duyệt qua tất cả các quiz-container
        document.querySelectorAll('[id^="quiz-container"]').forEach(quizContainer => {
            // Kiểm tra nếu container có class 'grammar-type-quiz'
            if (quizContainer.classList.contains('grammar-type-quiz')) {
                const startId = parseInt(quizContainer.dataset.startId, 10);
                const endId = parseInt(quizContainer.dataset.endId, 10);

                // Lọc câu hỏi theo ID
                const filteredQuestions = data.questions.filter(q => q.id >= startId && q.id <= endId);

                // Hiển thị quiz cho container hiện tại
                displayQuiz(filteredQuestions, quizContainer);

                // Lưu dữ liệu JSON vào dataset của container để tránh tải lại nhiều lần
                quizContainer.dataset.quizData = JSON.stringify(filteredQuestions);
            }
        });
    } catch (error) {
        console.error("Error loading quiz:", error);
    }
}

// Hàm hiển thị quiz trong container cụ thể
function displayQuiz(questions, quizContainer) {
    quizContainer.innerHTML = ""; // Xóa nội dung cũ

    questions.forEach((question, index) => {
        let sentenceHTML = String(question.sentence); // Đảm bảo là chuỗi
        question.blanks.forEach((blank, i) => {
            // Thay thế từng chỗ trống bằng một input
            sentenceHTML = sentenceHTML.replace("___", `<input type="text" id="answer-${quizContainer.id}-${index}-${i}" placeholder="Type here">`);
        });

        const questionHTML = `
            <p>${sentenceHTML}</p>
            <button onclick="checkAnswers(${index}, ${question.blanks.length}, '${quizContainer.id}')">Check</button>
            <p class="result" id="result-${quizContainer.id}-${index}"></p>
        `;

        quizContainer.innerHTML += questionHTML;
    });
}

// Hàm kiểm tra câu trả lời, chỉ hoạt động trong container có class 'grammar-type-quiz'
function checkAnswers(questionIndex, numAnswers, containerId) {
    const quizContainer = document.getElementById(containerId);

    // Đảm bảo chỉ chạy trong container có class 'grammar-type-quiz'
    if (!quizContainer || !quizContainer.classList.contains("grammar-type-quiz")) return;

    // Lấy dữ liệu từ dataset đã lưu trước đó
    const quizData = JSON.parse(quizContainer.dataset.quizData);
    const correctAnswers = quizData[questionIndex].blanks.map(blank => blank.answer);

    let isCorrect = true;
    for (let i = 0; i < numAnswers; i++) {
        const userAnswer = quizContainer.querySelector(`#answer-${containerId}-${questionIndex}-${i}`).value;
        if (normalizeText(userAnswer) !== normalizeText(correctAnswers[i])) {
            isCorrect = false;
        }
    }

    document.getElementById(`result-${containerId}-${questionIndex}`).textContent = isCorrect
        ? "✅ Correct! Well done!"
        : "❌ Incorrect! Try again.";
}

// Tải quiz khi trang web mở lên
loadQuiz();