import { auth } from "/auth.js";

let score = 0;

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

document.addEventListener('DOMContentLoaded', () => {

    const startId = parseInt(getQueryParam('quizStartId')) || 1;
    const endId = parseInt(getQueryParam('quizEndId')) || 10;

    const filesToFetch = [
        '../data/quiz.json'
        // thêm file khác ở đây nếu cần
    ];

    Promise.all(filesToFetch.map(url => fetch(url).then(res => res.json())))
        .then(allData => {

            const allQuestions = allData.flatMap(data => data.questions);
            const filteredQuestions = allQuestions.filter(q =>
                q.id >= startId && q.id <= endId
            );

            if (filteredQuestions.length === 0) {
                console.error('No questions found');
                return;
            }

            let currentQuestionIndex = 0;

            const sentenceDiv = document.getElementById('sentence');
            const optionsDiv = document.getElementById('options');
            const resultDiv = document.querySelector('.result');
            const buttonsDiv = document.getElementById('buttons');
            const startContainer = document.getElementById('start-container');
            const startButton = document.getElementById('start-button');

            // Ẩn quiz ban đầu
            sentenceDiv.style.display = 'none';
            optionsDiv.style.display = 'none';
            resultDiv.style.display = 'none';
            buttonsDiv.style.display = 'none';

            const initialAudio = new Audio();
            const clickAudio = new Audio('../assets/click.mp3');
            const correctAudio = new Audio('../assets/correct.mp3');
            const incorrectAudio = new Audio('../assets/incorrect.mp3');
            const completionAudio = new Audio('../assets/victory.mp3');

            // START BUTTON
            startButton.addEventListener('click', () => {

                if (!auth.currentUser) {
                    alert("Please login to start the quiz.");
                    return;
                }

                score = 0;
                currentQuestionIndex = 0;

                startContainer.style.display = 'none';
                sentenceDiv.style.display = 'block';
                optionsDiv.style.display = 'block';
                buttonsDiv.style.display = 'block';
                resultDiv.style.display = 'block';

                displayQuestion();
            });

            function displayQuestion() {

                const question = filteredQuestions[currentQuestionIndex];
                if (!question) return;

                resultDiv.textContent = '';
                resultDiv.className = 'result';

                optionsDiv.innerHTML = '';
                buttonsDiv.innerHTML = '';

                if (question.audio) {
                    initialAudio.src = question.audio;
                    initialAudio.play().catch(() => {});
                }

                let sentenceHTML = '';

                if (Array.isArray(question.sentence)) {
                    sentenceHTML = question.sentence.map(renderMixedContent).join('');
                } else {
                    sentenceHTML = renderMixedContent(question.sentence);
                }

                question.blanks.forEach(() => {
                    sentenceHTML = sentenceHTML.replace('___', `<span class="blank"></span>`);
                });

                sentenceDiv.innerHTML = sentenceHTML;

                question.words.forEach(word => {
                    const button = document.createElement('button');
                    button.classList.add('word');
                    button.innerHTML = renderMixedContent(word);
                    button.addEventListener('click', () => handleWordClick(button));
                    optionsDiv.appendChild(button);
                });

                // Check button
                const checkBtn = document.createElement('button');
                checkBtn.textContent = 'Check';
                checkBtn.classList.add('check');
                checkBtn.addEventListener('click', checkAnswers);
                buttonsDiv.appendChild(checkBtn);

                // Replay audio
                if (question.audio) {
                    const replayButton = document.createElement('button');
                    replayButton.textContent = '☊';
                    replayButton.classList.add('replay');
                    replayButton.addEventListener('click', () => {
                        initialAudio.currentTime = 0;
                        initialAudio.play();
                    });
                    buttonsDiv.appendChild(replayButton);
                }
            }

            function handleWordClick(button) {

                clickAudio.play();

                const blanks = document.querySelectorAll('.blank');
                const empty = Array.from(blanks).find(b => b.textContent === '');

                if (!empty) return;

                empty.innerHTML = button.innerHTML;
                empty.dataset.value = button.textContent;

                button.disabled = true;

                empty.addEventListener('click', () => {
                    button.disabled = false;
                    empty.innerHTML = '';
                    empty.dataset.value = '';
                }, { once: true });
            }

            function checkAnswers() {

                const blanks = document.querySelectorAll('.blank');
                const answers = filteredQuestions[currentQuestionIndex].blanks;

                let correct = true;

                blanks.forEach((blank, index) => {
                    if (blank.dataset.value !== answers[index].answer) {
                        correct = false;
                    }
                });

                if (correct) {
                    resultDiv.textContent = 'Correct!';
                    resultDiv.classList.add('correct');
                    correctAudio.play();
                    score++;
                } else {
                    resultDiv.textContent = 'Incorrect!';
                    resultDiv.classList.add('incorrect');
                    incorrectAudio.play();
                }

                showNextButton();
            }

            function showNextButton() {

                buttonsDiv.innerHTML = '';

                const nextBtn = document.createElement('button');
                nextBtn.textContent = 'Next';
                nextBtn.classList.add('next');

                nextBtn.addEventListener('click', () => {

                    currentQuestionIndex++;

                    if (currentQuestionIndex < filteredQuestions.length) {
                        displayQuestion();
                    } else {
                        showFinalResult();
                    }
                });

                buttonsDiv.appendChild(nextBtn);
            }

            function showFinalResult() {

                sentenceDiv.style.display = "none";
                optionsDiv.style.display = "none";
                buttonsDiv.style.display = "none";

                resultDiv.textContent =
                    `Quiz Completed! You scored ${score} / ${filteredQuestions.length}`;

                completionAudio.play();
            }

            function isImagePath(path) {
                return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(path);
            }

            function renderMixedContent(content) {
                if (isImagePath(content)) {
                    return `
                        <div class="image-wrapper">
                            <img src="${content}" class="content-image">
                        </div>`;
                }
                return content;
            }

        })
        .catch(error => {
            console.error('Error loading JSON:', error);
        });

});
