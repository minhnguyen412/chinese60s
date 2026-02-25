let score = 0;
// Hàm lấy tham số từ URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Đợi DOMContentLoaded để chắc chắn HTML đã tải xong
document.addEventListener('DOMContentLoaded', () => {
    // Lấy các tham số từ URL
    const startId = parseInt(getQueryParam('quizStartId')) || 1; // Giá trị mặc định là 1
    const endId = parseInt(getQueryParam('quizEndId')) || 10;   // Giá trị mặc định là 10

    // Load file JSON và xử lý
    const filesToFetch = [
        '../data/quiz.json'
        
    ];
    Promise.all(filesToFetch.map(url => fetch(url).then(res => res.json())))
        .then(allData => {
            // Gộp tất cả các câu hỏi từ các file lại thành một mảng duy nhất
            const allQuestions = allData.flatMap(data => data.questions);
            // Lọc câu hỏi trong khoảng ID
            const filteredQuestions = allQuestions.filter(question =>
                question.id >= startId && question.id <= endId
            );

            // Kiểm tra nếu không có câu hỏi nào trong khoảng ID
            if (filteredQuestions.length === 0) {
                console.error('No questions found in the specified ID range');
                return;
            }

            let currentQuestionIndex = 0;

            // Hide the questions and buttons initially
            const sentenceDiv = document.getElementById('sentence');
            const optionsDiv = document.getElementById('options');
            const resultDiv = document.querySelector('.result');
            const buttonsDiv = document.getElementById('buttons');
            const startContainer = document.getElementById('start-container');

            // Hide question elements at the beginning
            sentenceDiv.style.display = 'none';
            optionsDiv.style.display = 'none';
            resultDiv.style.display = 'none';
            buttonsDiv.style.display = 'none';
            
            
            // Add event listener for the start button
            import { auth } from "./auth.js";

            document.getElementById('start-button').addEventListener('click', () => {

                if (!auth.currentUser) {
                    alert("Please login to start the quiz.");
                    return;
                }

                startContainer.style.display = 'none';
                sentenceDiv.style.display = 'block';
                optionsDiv.style.display = 'block';
                buttonsDiv.style.display = 'block';

                displayQuestion(currentQuestionIndex);
            });
                // Hide the start button and show the question elements
                startContainer.style.display = 'none';
                sentenceDiv.style.display = 'block';
                optionsDiv.style.display = 'block';
                buttonsDiv.style.display = 'block';
                
                
                // Call displayQuestion to show the first question
                displayQuestion(currentQuestionIndex);
            });

            const initialAudio = new Audio();
            const clickAudio = new Audio('../assets/click.mp3');
            const correctAudio = new Audio('../assets/correct.mp3');
            const incorrectAudio = new Audio('../assets/incorrect.mp3');
            const completionAudio = new Audio('../assets/victory.mp3');

            // Hiển thị câu hỏi
            function displayQuestion(questionIndex) {
                const question = filteredQuestions[questionIndex];
                const blanks = question.blanks;
                const words = question.words;

                // Kiểm tra tồn tại của trường `audio` trong JSON
                if (question.audio) {
                    initialAudio.src = question.audio; // Đảm bảo `audio` tồn tại trong JSON
                    initialAudio.play().catch(error => console.error('Audio playback error:', error));
                }

                // Hiển thị câu với các chỗ trống
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

                // Hiển thị các lựa chọn từ vựng
                optionsDiv.innerHTML = '';
                words.forEach(word => {
                    const button = document.createElement('button');
                    button.classList.add('word');
                    button.innerHTML = renderMixedContent(word); // Hiển thị nội dung trộn lẫn trong các nút
                    button.addEventListener('click', () => handleWordClick(button, blanks));
                    optionsDiv.appendChild(button);
                });

                resultDiv.textContent = '';
                resultDiv.classList.remove('correct', 'incorrect');
                buttonsDiv.innerHTML = '';

                // Thêm nút phát lại audio
                const replayButton = document.createElement('button');
                replayButton.textContent = '☊';
                replayButton.classList.add('replay');
                replayButton.addEventListener('click', () => {
                    initialAudio.currentTime = 0; // Đặt lại thời gian phát audio
                    initialAudio.play();
                });
                buttonsDiv.appendChild(replayButton);
                
            }

            // Hàm kiểm tra nếu một chuỗi là đường dẫn hình ảnh
            function isImagePath(path) {
                return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(path);
            }

            // Hàm hiển thị nội dung trộn lẫn (văn bản hoặc hình ảnh)
            function renderMixedContent(content) {
                if (isImagePath(content)) {
                    return `
                        <div class="image-wrapper">
                            <img src="${content}" alt="Image" class="content-image">
                        </div>`;
                } else {
                    return content; // Hiển thị như văn bản nếu không phải hình ảnh
                }
            }

            function handleWordClick(button) {
                clickAudio.play();

                const blanksArray = document.querySelectorAll('.blank');
                const emptyBlank = Array.from(blanksArray).find(b => b.textContent === "");

                if (!emptyBlank) return;

                emptyBlank.innerHTML = button.innerHTML;
                emptyBlank.dataset.value = button.textContent;

                button.disabled = true;

                emptyBlank.addEventListener("click", () => {
                    button.disabled = false;
                    emptyBlank.innerHTML = "";
                    emptyBlank.dataset.value = "";
                });
            }

            function checkAnswers() {
                const blanksArray = document.querySelectorAll('.blank');
                const currentQuestion = filteredQuestions[currentQuestionIndex];
                let correct = true;

                blanksArray.forEach((blank, index) => {
                    if (blank.innerHTML !== renderMixedContent(currentQuestion.blanks[index].answer)) {
                        correct = false;
                    }
                });

                if (correct) {
                    resultDiv.textContent = 'Correct! Great job!';
                    resultDiv.classList.add('correct');
                    correctAudio.play();
                    showNextButton();
                } else {
                    resultDiv.textContent = 'Incorrect';
                    resultDiv.classList.add('incorrect');
                    incorrectAudio.play();
                    
                }
            }

            function showNextButton() {
                const nextButton = document.createElement('button');
                nextButton.textContent = 'Next';
                nextButton.classList.add('next');

                nextButton.addEventListener('click', () => {

                    const blanksArray = document.querySelectorAll('.blank');
                    const currentQuestion = filteredQuestions[currentQuestionIndex];

                    let correct = true;

                    blanksArray.forEach((blank, index) => {
                        if (blank.dataset.value !== currentQuestion.blanks[index].answer) {
                            correct = false;
                        }
                    });

                    if (correct) {
                        correctAudio.play();
                        score++;
                    } else {
                        incorrectAudio.play();
                    }

                    currentQuestionIndex++;

                    if (currentQuestionIndex < filteredQuestions.length) {
                        displayQuestion(currentQuestionIndex);
                    } else {
                        showFinalResult();
                    }
            });

            buttonsDiv.innerHTML = "";
            buttonsDiv.appendChild(nextButton);
        }
            

            

            function showReplayButton() {
                const replayButton = document.createElement('button');
                replayButton.textContent = 'Replay';
                replayButton.classList.add('replay');
                replayButton.addEventListener('click', () => {
                    currentQuestionIndex = 0; // Đặt lại chỉ số câu hỏi về 0
                    displayQuestion(currentQuestionIndex); // Hiển thị câu hỏi đầu tiên
                });
                buttonsDiv.innerHTML = ''; // Xóa các nút hiện tại
                buttonsDiv.appendChild(replayButton); // Thêm nút Replay
            }
            function showFinalResult() {
                sentenceDiv.style.display = "none";
                optionsDiv.style.display = "none";
                buttonsDiv.style.display = "none";

                resultDiv.style.display = "block";
                resultDiv.textContent = `Quiz Completed! You scored ${score} / ${filteredQuestions.length}`;
            }
            // Hiển thị câu hỏi đầu tiên
            displayQuestion(currentQuestionIndex);
        })
        .catch(error => {
            console.error('Error loading the JSON file:', error);
        });
});
