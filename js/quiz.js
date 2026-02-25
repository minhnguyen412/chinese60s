import { auth } from "./auth.js";

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
    ];

    Promise.all(filesToFetch.map(url => fetch(url).then(res => res.json())))
        .then(allData => {

            const allQuestions = allData.flatMap(data => data.questions);
            const filteredQuestions = allQuestions.filter(question =>
                question.id >= startId && question.id <= endId
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

            sentenceDiv.style.display = 'none';
            optionsDiv.style.display = 'none';
            resultDiv.style.display = 'none';
            buttonsDiv.style.display = 'none';

            document.getElementById('start-button').addEventListener('click', () => {

                if (!auth.currentUser) {
                    alert("Please login first.");
                    return;
                }

                score = 0;
                currentQuestionIndex = 0;

                startContainer.style.display = 'none';
                sentenceDiv.style.display = 'block';
                optionsDiv.style.display = 'block';
                buttonsDiv.style.display = 'block';
                resultDiv.style.display = 'block';

                displayQuestion(currentQuestionIndex);
            });

            const initialAudio = new Audio();
            const clickAudio = new Audio('../assets/click.mp3');
            const correctAudio = new Audio('../assets/correct.mp3');
            const incorrectAudio = new Audio('../assets/incorrect.mp3');
            const completionAudio = new Audio('../assets/victory.mp3');

            function displayQuestion(questionIndex) {

                const question = filteredQuestions[questionIndex];
                const blanks = question.blanks;
                const words = question.words;

                if (question.audio) {
                    initialAudio.src = question.audio;
                    initialAudio.play().catch(() => {});
                }

                let sentenceHTML = '';

                if (Array.isArray(question.sentence)) {
                    sentenceHTML = question.sentence.map(item => renderMixedContent(item)).join('');
                } else {
                    sentenceHTML = renderMixedContent(question.sentence);
                }

                blanks.forEach(() => {
                    sentenceHTML = sentenceHTML.replace('___', `<span class="blank"></span>`);
                });

                sentenceDiv.innerHTML = sentenceHTML;

                optionsDiv.innerHTML = '';
                words.forEach(word => {

                    const button = document.createElement('button');
                    button.classList.add('word');
                    button.innerHTML = renderMixedContent(word);

                    button.addEventListener('click', () => handleWordClick(button));

                    optionsDiv.appendChild(button);
                });

                resultDiv.textContent = '';
                resultDiv.classList.remove('correct', 'incorrect');
                buttonsDiv.innerHTML = '';

                const replayButton = document.createElement('button');
                replayButton.textContent = '☊';
                replayButton.classList.add('replay');
                replayButton.addEventListener('click', () => {
                    initialAudio.currentTime = 0;
                    initialAudio.play();
                });
                buttonsDiv.appendChild(replayButton);
            }

            function handleWordClick(button) {

                clickAudio.play();

                const blanksArray = document.querySelectorAll('.blank');
                const emptyBlankIndex = Array.from(blanksArray).findIndex(b => b.textContent === '');

                if (emptyBlankIndex === -1) return;

                const blank = blanksArray[emptyBlankIndex];

                blank.innerHTML = button.innerHTML;
                blank.dataset.value = button.textContent;
                blank.classList.add('filled');

                button.disabled = true;

                // Cho bỏ chọn
                blank.addEventListener('click', () => {
                    button.disabled = false;
                    blank.innerHTML = '';
                    blank.dataset.value = '';
                }, { once: true });

                if (Array.from(blanksArray).every(b => b.textContent !== '')) {
                    checkAnswers();
                }
            }

            function checkAnswers() {

                const blanksArray = document.querySelectorAll('.blank');
                const currentQuestion = filteredQuestions[currentQuestionIndex];

                let correct = true;

                blanksArray.forEach((blank, index) => {
                    if (blank.dataset.value !== currentQuestion.blanks[index].answer) {
                        correct = false;
                    }
                });

                if (correct) {
                    resultDiv.textContent = 'Correct! Great job!';
                    resultDiv.classList.add('correct');
                    correctAudio.play();
                    score++; // tính điểm
                    showNextButton();
                } else {
                    resultDiv.textContent = 'Incorrect.';
                    resultDiv.classList.add('incorrect');
                    incorrectAudio.play();
                    showNextButton(); // không retry nữa
                }
            }

            function showNextButton() {

                const nextButton = document.createElement('button');
                nextButton.textContent = 'Next';
                nextButton.classList.add('next');

                nextButton.addEventListener('click', () => {

                    currentQuestionIndex++;

                    if (currentQuestionIndex < filteredQuestions.length) {
                        displayQuestion(currentQuestionIndex);
                    } else {
                        showFinalResult();
                    }
                });

                buttonsDiv.innerHTML = '';
                buttonsDiv.appendChild(nextButton);
            }

            function showFinalResult() {

                sentenceDiv.style.display = 'none';
                optionsDiv.style.display = 'none';
                buttonsDiv.style.display = 'none';

                resultDiv.textContent =
                    `You completed the quiz! Score: ${score} / ${filteredQuestions.length}`;

                resultDiv.classList.add('correct');
                completionAudio.play();

                showReplayButton();
            }

            function showReplayButton() {

                const replayButton = document.createElement('button');
                replayButton.textContent = 'Replay';
                replayButton.classList.add('replay');

                replayButton.addEventListener('click', () => {
                    score = 0;
                    currentQuestionIndex = 0;
                    displayQuestion(currentQuestionIndex);
                });

                buttonsDiv.innerHTML = '';
                buttonsDiv.appendChild(replayButton);
            }

            function isImagePath(path) {
                return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(path);
            }

            function renderMixedContent(content) {
                if (isImagePath(content)) {
                    return `
                        <div class="image-wrapper">
                            <img src="${content}" alt="Image" class="content-image">
                        </div>`;
                }
                return content;
            }

        })
        .catch(error => {
            console.error('Error loading JSON:', error);
        });

});
