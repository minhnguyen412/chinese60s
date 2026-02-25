import { auth } from "./auth.js";

let score = 0;

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

document.addEventListener("DOMContentLoaded", () => {

    const startId = parseInt(getQueryParam("quizStartId")) || 1;
    const endId = parseInt(getQueryParam("quizEndId")) || 10;

    const filesToFetch = [
        "../data/quiz.json"
        // thêm file khác nếu cần
    ];

    Promise.all(filesToFetch.map(url => fetch(url).then(res => res.json())))
        .then(allData => {

            const allQuestions = allData.flatMap(data => data.questions);
            const filteredQuestions = allQuestions.filter(q =>
                q.id >= startId && q.id <= endId
            );

            if (filteredQuestions.length === 0) {
                console.error("No questions found");
                return;
            }

            let currentQuestionIndex = 0;

            const sentenceDiv = document.getElementById("sentence");
            const optionsDiv = document.getElementById("options");
            const resultDiv = document.querySelector(".result");
            const buttonsDiv = document.getElementById("buttons");
            const startContainer = document.getElementById("start-container");
            const startButton = document.getElementById("start-button");

            // Ẩn quiz ban đầu
            sentenceDiv.style.display = "none";
            optionsDiv.style.display = "none";
            resultDiv.style.display = "none";
            buttonsDiv.style.display = "none";

            // START BUTTON
            startButton.addEventListener("click", () => {

                if (!auth.currentUser) {
                    alert("Please login to start the quiz.");
                    return;
                }

                score = 0;
                currentQuestionIndex = 0;

                startContainer.style.display = "none";
                sentenceDiv.style.display = "block";
                optionsDiv.style.display = "block";
                buttonsDiv.style.display = "block";
                resultDiv.style.display = "block";
                resultDiv.textContent = "";

                displayQuestion();
            });

            function displayQuestion() {

                const question = filteredQuestions[currentQuestionIndex];
                if (!question) return;

                optionsDiv.innerHTML = "";
                buttonsDiv.innerHTML = "";

                // Render câu hỏi
                let sentenceHTML = "";

                if (Array.isArray(question.sentence)) {
                    sentenceHTML = question.sentence.join("");
                } else {
                    sentenceHTML = question.sentence;
                }

                question.blanks.forEach(() => {
                    sentenceHTML = sentenceHTML.replace("___", `<span class="blank"></span>`);
                });

                sentenceDiv.innerHTML = sentenceHTML;

                // Render đáp án
                question.words.forEach(word => {
                    const btn = document.createElement("button");
                    btn.classList.add("word");
                    btn.textContent = word;

                    btn.addEventListener("click", () => handleWordClick(btn));

                    optionsDiv.appendChild(btn);
                });

                // Nút Next (chấm điểm khi bấm)
                const nextBtn = document.createElement("button");
                nextBtn.textContent = "Next";
                nextBtn.classList.add("next");

                nextBtn.addEventListener("click", () => {

                    gradeCurrentQuestion();

                    currentQuestionIndex++;

                    if (currentQuestionIndex < filteredQuestions.length) {
                        displayQuestion();
                    } else {
                        showFinalResult();
                    }
                });

                buttonsDiv.appendChild(nextBtn);
            }

            function handleWordClick(button) {

                const blanks = document.querySelectorAll(".blank");
                const emptyBlank = Array.from(blanks).find(b => b.textContent === "");

                if (!emptyBlank) return;

                emptyBlank.textContent = button.textContent;
                emptyBlank.dataset.value = button.textContent;

                button.disabled = true;

                // Cho phép bỏ chọn
                emptyBlank.addEventListener("click", () => {
                    button.disabled = false;
                    emptyBlank.textContent = "";
                    emptyBlank.dataset.value = "";
                }, { once: true });
            }

            function gradeCurrentQuestion() {

                const blanks = document.querySelectorAll(".blank");
                const correctAnswers = filteredQuestions[currentQuestionIndex].blanks;

                let correct = true;

                blanks.forEach((blank, index) => {
                    if (blank.dataset.value !== correctAnswers[index].answer) {
                        correct = false;
                    }
                });

                if (correct) {
                    score++;
                }
            }

            function showFinalResult() {

                sentenceDiv.style.display = "none";
                optionsDiv.style.display = "none";
                buttonsDiv.style.display = "none";

                resultDiv.style.display = "block";
                resultDiv.textContent =
                    `Quiz Completed! You scored ${score} / ${filteredQuestions.length}`;
            }

        })
        .catch(error => {
            console.error("Error loading JSON:", error);
        });

});
