// ==UserScript==
// @name         Edwin AI Canvas Chat (Enhanced UI) - Full Panel v11.0
// @namespace    http://tampermonkey.net/
// @version      11.0.0
// @description  Edwin AI panel with modern UI, smooth animations, and enhanced UX
// @match        https://canvas.asu.edu/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // BACKEND CONFIGURATION
    const BACKEND_BASE_URL = 'http://localhost:5000';
    const USER_ID = 1;  // Hardcoded for now

    // Extract course ID from Canvas URL
    function getCourseIdFromURL() {
        const match = window.location.pathname.match(/\/courses\/(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    const COURSE_ID = getCourseIdFromURL();

    // CONFIGURATION
    const customSentence = "Hello, what is the grade breakdown for this class?";
    const wordDelay = 200;
    const wordDelayVariance = 100;
    const initialTypingDelay = 2000;
    const panelMarginLeft = 0;
    const panelMarginRight = 0;
    const rainbowSpeed = 8;
    const rainbowColors = ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080'];
    const quizzesPanelSpeed = 8;
    const quizzesPanelColors = ['#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#f1f3f5', '#e0e0e0', '#f8f9fa'];

    // PROGRESS BAR CONFIGURATION
    let quizProgressStage = 0;
    const progressBarWidth = 200;
    const progressBarHeight = 18;
    const progressBarSpacing = 4;
    const progressBarFilledColor = '#ff6b35';
    const progressBarEmptyColor = '#555';

    let streakProgress = 6;
    const streakBarTotal = 10;
    const streakBarWidth = 600;
    const streakBarHeight = 24;
    const streakBarFilledColor = '#ff6b35';
    const streakBarEmptyColor = '#555';

    let isTypingMode = false, isCurrentlyTyping = false, startTimeoutID = null;

    // Quizzes tab configuration
    const quizzesTabExtensionClosed = '51';
    const quizzesTabExtensionOpen = '-1790';
    const quizzesTabAnimationSpeed = 0.39;

    // BACKEND API FUNCTIONS
    async function createNewConversation() {
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/newConversation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userID: USER_ID,
                    courseID: COURSE_ID
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('New conversation created:', data.message);
                return true;
            } else {
                console.error('Failed to create new conversation:', data.message);
                return false;
            }
        } catch (error) {
            console.error('Network error creating new conversation:', error);
            return false;
        }
    }

    async function sendMessageToBackend(question) {
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userID: USER_ID,
                    courseID: COURSE_ID,
                    question: question
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return {
                    success: true,
                    answer: data.answer,
                    message: data.message
                };
            } else {
                return {
                    success: false,
                    answer: "I'm having trouble connecting to my knowledge base. Please try again in a moment.",
                    message: data.message || "Unknown error"
                };
            }
        } catch (error) {
            console.error('Network error sending message:', error);
            return {
                success: false,
                answer: "I'm currently offline. Please check your connection and try again.",
                message: error.message
            };
        }
    }

    // Kill Canvas floating scroll buttons if they exist
    const killScrollBtns = setInterval(() => {
        const btns = document.querySelectorAll('.ui-scroll-to-top, .ui-scroll-to-bottom');
        if (btns.length) {
            btns.forEach(b => b.remove());
            clearInterval(killScrollBtns);
        }
    }, 500);

    // ---------- INIT ----------
    const checkSidebar = setInterval(() => {
        const nav = document.querySelector('#section-tabs');
        if (nav && !document.querySelector('#edwin-btn')) {
            clearInterval(checkSidebar);

            // ---------- BUTTON ----------
            const li = document.createElement('li');
            li.className = 'section';
            const a = document.createElement('a');
            a.id = 'edwin-btn';
            a.href = '#';
            a.innerHTML = '<span>Edwin AI</span>';
            a.setAttribute('role', 'button');
            a.setAttribute('aria-label', 'Open Edwin AI Assistant');

            // Enhanced button styling
            Object.assign(a.style, {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundSize: '200% 200%',
                animation: 'edwinButtonGlow 4s ease infinite',
                borderRadius: '16px',
                display: 'block',
                padding: '18px 16px',
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: '600',
                fontSize: '17px',
                letterSpacing: '0.5px',
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)'
            });

            a.onmouseover = () => {
                a.style.transform = 'translateY(-2px) scale(1.02)';
                a.style.boxShadow = '0 12px 48px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                a.style.filter = 'brightness(1.1)';
            };

            a.onmouseout = () => {
                a.style.transform = 'none';
                a.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                a.style.filter = 'none';
            };

            a.onmousedown = () => {
                a.style.transform = 'translateY(0) scale(0.98)';
            };

            // Add click handler directly to button
            a.onclick = (e) => {
                e.preventDefault();
                console.log('Edwin AI: Button clicked!');

                // Check if course ID is detected
                if (!COURSE_ID) {
                    alert('Please navigate to a Canvas course page to use Edwin AI');
                    return;
                }

                const panel = document.getElementById('edwin-panel');
                if (panel) {
                    panel.classList.add('open');

                    // Auto-focus input for better UX
                    setTimeout(() => {
                        document.getElementById('edwin-input').focus();
                    }, 500);
                } else {
                    console.log('Edwin AI: Panel not found, need to initialize');
                }
            };

            li.appendChild(a);
            nav.appendChild(li);

            // Initialize panel
            initializePanel();
        }
    }, 500);

    function initializePanel() {
        // ---------- PANEL (ENTIRE HTML) ----------
        const panel = document.createElement('div');
        panel.id = 'edwin-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Edwin AI Assistant');
        panel.innerHTML = `
            <div class="edwin-header">
                <span>Edwin AI</span>
                <div class="edwin-header-controls">
                    <button id="edwin-settings" aria-label="Settings">⚙</button>
                    <button id="edwin-clear" aria-label="Clear chat">🗑</button>
                    <button id="edwin-close" aria-label="Close panel">✕</button>
                </div>
            </div>

            <div class="edwin-section" id="edwin-main-section">
                <div class="edwin-body">
                    <div id="edwin-greeting" class="edwin-greeting-card">
                        <div class="greeting-avatar">🤖</div>
                        <h1>Hello, Andrey.</h1>
                        <p>What questions do you have regarding CSE 434?</p>
                        <p id="edwin-subtext">I have access to every lecture, assignment, and presentation.</p>
                    </div>
                    <div id="edwin-chat"></div>
                </div>

                <div class="edwin-footer">
                    <div class="input-wrapper">
                        <input type="text" id="edwin-input" placeholder="Ask Edwin anything..." aria-label="Message input">
                        <div class="input-glow"></div>
                    </div>
                    <button id="edwin-send" aria-label="Send message">
                        <span>Send</span>
                        <div class="send-glow"></div>
                    </button>
                </div>
            </div>

            <!-- QUIZZES SECTION -->
            <div class="edwin-section" id="edwin-quizzes-section">
                <div class="edwin-quizzes-header">
                    <span>Quizzes</span>
                    <div>
                        <button id="edwin-quizzes-back" aria-label="Back to main">← Back</button>
                    </div>
                </div>

                <div class="edwin-quizzes-body">
                    <div class="edwin-quizzes-title-wrapper">
                        <h2>CSE 434 Quizzes</h2>
                        <div id="edwin-progress-bar" class="enhanced-progress"></div>
                        <img id="edwin-fire-gif" src="https://i.imgur.com/K2xOtlf.gif" alt="Achievement fire effect" class="fire-effect">
                    </div>
                    <p class="section-description">View and practice course quizzes below.</p>
                    <div id="edwin-quizzes-list"></div>
                </div>

                <!-- QUIZ PLAY MODE -->
                <div id="edwin-quiz-play-section" style="display:none;">
                    <div class="edwin-quizzes-header">
                        <span id="edwin-quiz-title">Quiz</span>
                        <div>
                            <button id="edwin-quiz-exit" class="quiz-return-btn">← Back to Quizzes</button>
                        </div>
                    </div>
                    <div class="edwin-quizzes-body" id="edwin-quiz-body"></div>
                </div>
            </div>

            <!-- STREAKS SECTION -->
            <div id="edwin-streaks-section" style="display:none;" class="streaks-container">
                <div class="edwin-quizzes-header">
                    <span id="edwin-streaks-title">Streaks</span>
                    <div>
                        <button id="edwin-streaks-back">← Back</button>
                    </div>
                </div>

                <div class="edwin-quizzes-body streaks-body">
                    <div id="edwin-streaks-bar" class="edwin-streaks-bar"></div>

                    <!-- Hardcoded images -->
                    <img id="edwin-streaks-img" src="https://i.imgur.com/3v9ZWrQ.png" class="streak-decoration left">
                    <img id="edwin-streaks-img" src="https://i.imgur.com/tTYZ28Y.png" class="streak-decoration right">

                    <!-- Fire and Number Display -->
                    <div class="streak-display">
                        <img id="edwin-streak-fire-gif" src="https://i.imgur.com/K2xOtlf.gif" alt="Streak fire" class="streak-fire">
                        <div class="streak-number" id="streak-counter">6</div>
                    </div>

                    <div class="streak-label">Days</div>
                </div>
            </div>

            <!-- Enhanced Settings Modal -->
            <div id="edwin-settings-modal" class="settings-modal">
                <div class="settings-content">
                    <h2>Settings</h2>
                    <div class="settings-group">
                        <label class="setting-item">
                            <input type="checkbox" id="colorblind-mode">
                            <span class="checkmark"></span>
                            Colorblind Mode
                        </label>
                        <label class="setting-item">
                            <input type="checkbox" id="highcontrast-mode">
                            <span class="checkmark"></span>
                            High Contrast Mode
                        </label>
                        <div class="setting-item">
                            <label>Text Size:</label>
                            <select id="text-size" class="setting-select">
                                <option value="16">Normal</option>
                                <option value="20">Large</option>
                                <option value="24">Extra Large</option>
                            </select>
                        </div>
                    </div>
                    <button id="close-settings" class="settings-close">Close</button>
                </div>
            </div>

            <!-- QUIZZES TAB -->
            <div id="edwin-quizzes-tab" role="button" aria-pressed="false" tabindex="0" class="quizzes-tab">
                <span>Quizzes</span>
                <div class="tab-glow"></div>
            </div>
        `;

        document.body.appendChild(panel);

        // Initialize functionality
        initializeQuizzes();
            document.getElementById('edwin-quiz-exit').addEventListener('click', () => {
            document.getElementById('edwin-quiz-play-section').style.display = 'none';
            document.querySelector('.edwin-quizzes-body').style.display = 'flex';
        });

        initializeInteractions();
        initializeStyles();

        // Create new conversation when panel opens
        const edwinBtn = document.getElementById('edwin-btn');
        const originalOnClick = edwinBtn.onclick;
        edwinBtn.onclick = async (e) => {
            originalOnClick(e);

            // Create new conversation if panel was opened
            if (COURSE_ID) {
                await createNewConversation();
            }
        };
    }

    function initializeQuizzes() {
        // Quiz data
        const quizzes = [
            {
                id: 1,
                title: "Chapter 1: Computer Networks and the Internet",
                description: "Covers OSI model, basic protocols, IPv4, and IP addressing.",
                completed: localStorage.getItem('edwin_quiz_1') === 'true',
                difficulty: "Beginner"
            },
            {
                id: 2,
                title: "Chapter 2: Application Layer",
                description: "Focuses on static/dynamic routing, subnetting, routing tables.",
                completed: localStorage.getItem('edwin_quiz_2') === 'true',
                difficulty: "Intermediate"
            },
            {
                id: 3,
                title: "Chapter 3: Transport Layer",
                description: "Application layer protocols, socket programming, TCP vs UDP.",
                completed: localStorage.getItem('edwin_quiz_3') === 'true',
                difficulty: "Advanced"
            }
        ];

        // ---------- QUIZZES QUESTIONS DATA ---------- //
            const quizQuestions = {
                1: [
                    {
                        question: "Which layer is responsible for routing in the OSI model?",
                        options: ["Application", "Network", "Transport", "Physical"],
                        correct: 1,
                        explanation: "The Network layer handles routing of packets between devices."
                    },
                    {
                        question: "IPv4 addresses are how many bits?",
                        options: ["32", "64", "128", "16"],
                        correct: 0,
                        explanation: "IPv4 uses 32-bit addresses (4 bytes)."
                    },
                    {
                        "question": "Which protocol is used to reliably deliver data across the internet?",
                        "options": ["TCP", "UDP", "IP", "ICMP"],
                        "correct": 0,
                        "explanation": "TCP ensures reliable, ordered, and error-checked delivery of data streams."
                    },
                    {
                        "question": "What is the default port number for HTTP?",
                        "options": ["21", "25", "80", "443"],
                        "correct": 2,
                        "explanation": "HTTP typically operates over port 80, while HTTPS uses port 443."
                    },
                    {
                        "question": "Which method is used in Ethernet to avoid collisions?",
                        "options": ["TDMA", "FDMA", "CSMA/CD", "ALOHA"],
                        "correct": 2,
                        "explanation": "Ethernet uses Carrier Sense Multiple Access with Collision Detection (CSMA/CD)."
                    },
                    {
                        "question": "What is the maximum length of a MAC address?",
                        "options": ["32 bits", "48 bits", "64 bits", "128 bits"],
                        "correct": 1,
                        "explanation": "A MAC address is 48 bits long, usually shown as 12 hexadecimal digits."
                    },
                    {
                        question: "Which protocol is used for sending email?",
                        options: ["SMTP", "FTP", "SNMP", "IMAP"],
                        correct: 0,
                        explanation: "SMTP (Simple Mail Transfer Protocol) is used to send outgoing emails."
                    },
                  {
                      question: "In networking, what does DNS primarily resolve?",
                      options: ["IP to MAC", "Domain names to IP addresses", "Ports to services", "Protocols to layers"],
                      correct: 1,
                      explanation: "DNS translates human-readable domain names into IP addresses for routing."
                  }
                ],
                2: [
                    {
                        question: "Which protocol is used by web browsers?",
                        options: ["SMTP", "FTP", "HTTP", "DNS"],
                        correct: 2,
                        explanation: "HTTP is the protocol used by web browsers."
                    }
                ],
                3: [
                    {
                        question: "Which protocol provides reliable transport?",
                        options: ["UDP", "IP", "TCP", "ICMP"],
                        correct: 2,
                        explanation: "TCP provides reliable, ordered, and error-checked delivery."
                    }
                ]
            };


        // Enhanced quiz rendering
        function renderQuizzesList() {
            const list = document.getElementById('edwin-quizzes-list');
            list.innerHTML = '';

            quizzes.forEach((q, index) => {
                const item = document.createElement('div');
                item.className = 'edwin-quiz-item';
                item.innerHTML = `
                    <div class="quiz-card-header">
                        <div class="quiz-title">${q.title}</div>
                        <div class="quiz-difficulty ${q.difficulty.toLowerCase()}">${q.difficulty}</div>
                    </div>
                    <div class="quiz-desc">${q.description}</div>
                    <div class="quiz-card-footer">
                        <button class="quiz-action ${q.completed ? 'completed' : ''}" data-quiz-id="${q.id}">
                            ${q.completed ? '✓ Retake Quiz' : 'Take Quiz'}
                            <div class="button-glow"></div>
                        </button>
                        ${q.completed ? '<div class="completion-badge">Completed!</div>' : ''}
                    </div>
                `;

                // Add stagger animation
                item.style.animationDelay = `${index * 0.1}s`;

                const actionBtn = item.querySelector('.quiz-action');
                actionBtn.addEventListener('click', () => startQuiz(q.id, q.title));

                list.appendChild(item);
            });
        }

function startQuiz(quizId, title) {
    const quizPlay = document.getElementById('edwin-quiz-play-section');
    const quizBody = document.getElementById('edwin-quiz-body');
    const quizTitle = document.getElementById('edwin-quiz-title');

    // Show quiz play section
    quizPlay.style.display = 'block';
    quizTitle.textContent = title;
    quizBody.innerHTML = '';

    // Load quiz questions
    const questions = quizQuestions[quizId] || [];
    let currentQuestionIndex = 0;

    // Function to display one question at a time
    function displayNextQuestion() {
            if (currentQuestionIndex >= questions.length) {
                // Quiz completed
                quizBody.innerHTML = '<div class="quiz-completed">Quiz Completed! 🎉</div>';
                return;
            }

            const q = questions[currentQuestionIndex];
            const qEl = document.createElement('div');
            qEl.className = 'quiz-question';
            qEl.style.opacity = '0';
            qEl.style.transform = 'translateY(20px)';
            qEl.innerHTML = `
                <div class="quiz-q-text">${currentQuestionIndex + 1}. ${q.question}</div>
                <div class="quiz-options">
                    ${q.options.map((opt, i) => `
                        <button class="quiz-option" data-correct="${i === q.correct}" data-explanation="${q.explanation}">
                            ${opt}
                        </button>
                    `).join('')}
                </div>
            `;

            // Clear previous question and add new one
            quizBody.innerHTML = '';
            quizBody.appendChild(qEl);

            // Animate in the question
            setTimeout(() => {
                qEl.style.opacity = '1';
                qEl.style.transform = 'translateY(0)';
                qEl.style.transition = 'all 0.3s ease-out';
            }, 100);

            // Add click handlers for options
            qEl.querySelectorAll('.quiz-option').forEach(btn => {
                btn.addEventListener('click', e => {
                    const isCorrect = btn.dataset.correct === 'true';
                    const explanationText = btn.dataset.explanation;

                    // 1. Style selected button
                    if (isCorrect) {
                        btn.style.background = 'linear-gradient(135deg, #4caf50, #2e7d32)';
                    } else {
                        btn.style.background = 'linear-gradient(135deg, #f44336, #b71c1c)';
                    }

                    // 2. Disable all options
                    qEl.querySelectorAll('.quiz-option').forEach(option => {
                        option.disabled = true;
                        option.style.cursor = 'not-allowed';
                        option.style.opacity = '0.6';
                    });

                    // 3. Insert explanation below the question
                    let explanationEl = document.createElement('div');
                    explanationEl.className = 'quiz-explanation';
                    explanationEl.textContent = explanationText;
                    explanationEl.style.marginTop = '12px';
                    explanationEl.style.padding = '10px';
                    explanationEl.style.background = 'rgba(0,0,0,0.1)';
                    explanationEl.style.borderRadius = '8px';
                    qEl.appendChild(explanationEl);

                    // 4. Proceed to next question after delay
                    setTimeout(() => {
                        currentQuestionIndex++;
                        displayNextQuestion();
                    }, 3000);
                    });
            });
        }

        // Start with the first question
        displayNextQuestion();

        // Hide quiz list section while playing
        document.querySelector('.edwin-quizzes-body').style.display = 'none';
    }


        // Initialize quiz functionality
        renderQuizzesList();
        updateProgressBar();
        updateStreaksBar();
    }

    function updateProgressBar() {
        const progressBar = document.getElementById('edwin-progress-bar');
        const segments = 5;
        const filled = quizProgressStage;

        progressBar.innerHTML = '';

        for (let i = 0; i < segments; i++) {
            const segment = document.createElement('div');
            segment.className = `progress-segment ${i < filled ? 'filled' : ''}`;
            segment.style.animationDelay = `${i * 0.2}s`;
            progressBar.appendChild(segment);
        }

        // Show fire effect if fully completed
        const fireGif = document.getElementById('edwin-fire-gif');
        if (filled === segments) {
            fireGif.style.display = 'block';
            fireGif.style.animation = 'fireGlow 2s ease-in-out infinite alternate';
        }
    }

    function updateStreaksBar() {
        const streaksBar = document.getElementById('edwin-streaks-bar');
        const segments = streakBarTotal;
        const filled = streakProgress;

        streaksBar.innerHTML = '';

        for (let i = 0; i < segments; i++) {
            const segment = document.createElement('div');
            segment.className = `streak-segment ${i < filled ? 'filled' : ''}`;
            segment.style.animationDelay = `${i * 0.1}s`;
            streaksBar.appendChild(segment);
        }

        // Animate streak counter
        animateNumber('streak-counter', filled);
    }

    function animateNumber(elementId, targetNumber) {
        const element = document.getElementById(elementId);
        let current = 0;
        const increment = targetNumber > 20 ? Math.ceil(targetNumber / 20) : 1;
        const timer = setInterval(() => {
            current += increment;
            if (current >= targetNumber) {
                current = targetNumber;
                clearInterval(timer);
            }
            element.textContent = current;
        }, 50);
    }

    function initializeInteractions() {
        // Enhanced message handling with backend integration
        async function getResponse(input) {
            const response = await sendMessageToBackend(input);
            return response.answer;
        }

        async function sendMessage() {
            const inputBox = document.getElementById('edwin-input');
            const text = inputBox.value.trim();
            if (!text) return;

            const greeting = document.getElementById('edwin-greeting');
            if (greeting) {
                greeting.style.transform = 'translateY(-20px)';
                greeting.style.opacity = '0';
                setTimeout(() => greeting.style.display = 'none', 300);
            }

            addMessage('user', text);
            inputBox.value = '';

            const chat = document.getElementById('edwin-chat');
            const thinkingMsg = document.createElement('div');
            thinkingMsg.className = 'edwin-msg edwin thinking';
            thinkingMsg.innerHTML = `
                <div class="message-avatar thinking-avatar">🤔</div>
                <div class="message-content">
                    <div class="message-bubble thinking-bubble">
                        <span class="spinner">⟳</span>
                        <span class="thinking-text">Thinking...</span>
                        <div class="thinking-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            `;
            chat.appendChild(thinkingMsg);

            // Animate thinking message
            setTimeout(() => thinkingMsg.classList.add('show'), 50);
            chat.scrollTop = chat.scrollHeight;

            try {
                // Get AI response from backend
                const aiResponse = await getResponse(text);

                // Remove thinking message with animation
                thinkingMsg.classList.add('fade-out');
                setTimeout(() => chat.removeChild(thinkingMsg), 300);

                // Add AI response with delay for better UX
                setTimeout(() => addMessage('edwin', aiResponse), 400);
            } catch (error) {
                console.error('Error getting response:', error);
                thinkingMsg.classList.add('fade-out');
                setTimeout(() => chat.removeChild(thinkingMsg), 300);
                setTimeout(() => addMessage('edwin', "I'm having trouble processing your request. Please try again."), 400);
            }
        }

        function addMessage(sender, text) {
            const chat = document.getElementById('edwin-chat');
            const msg = document.createElement('div');
            const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            msg.className = `edwin-msg ${sender}`;
            msg.innerHTML = `
                <div class="message-avatar ${sender}-avatar">
                    ${sender === 'user' ? '👤' : '🤖'}
                </div>
                <div class="message-content">
                    <div class="message-bubble ${sender}-bubble">
                        <span class="message-text"></span>
                        <div class="message-timestamp">${timestamp}</div>
                    </div>
                </div>
            `;

            chat.appendChild(msg);

            const textSpan = msg.querySelector('.message-text');

            if (sender === 'edwin') {
                // Typing animation for Edwin
                let i = 0;
                const typeInterval = setInterval(() => {
                    textSpan.textContent += text[i];
                    if (++i >= text.length) {
                        clearInterval(typeInterval);
                        chat.scrollTop = chat.scrollHeight;
                    }
                }, 30);

                // Show message with slide animation
                setTimeout(() => msg.classList.add('show'), 100);
            } else {
                // Instant display for user messages
                textSpan.textContent = text;
                setTimeout(() => msg.classList.add('show'), 50);
            }

            // Auto-scroll with smooth behavior
            setTimeout(() => {
                chat.scrollTo({
                    top: chat.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100);
        }

        // Event listeners
        document.getElementById('edwin-send').addEventListener('click', sendMessage);
        document.getElementById('edwin-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Enhanced clear functionality
        document.getElementById('edwin-clear').addEventListener('click', async () => {
            const chat = document.getElementById('edwin-chat');
            const messages = chat.querySelectorAll('.edwin-msg');

            // Animate messages out
            messages.forEach((msg, index) => {
                setTimeout(() => {
                    msg.style.transform = 'translateX(-100%)';
                    msg.style.opacity = '0';
                }, index * 50);
            });

            setTimeout(() => {
                chat.innerHTML = '';
                const greeting = document.getElementById('edwin-greeting');
                if (greeting) {
                    greeting.style.display = 'block';
                    greeting.style.transform = 'translateY(20px)';
                    greeting.style.opacity = '0';
                    setTimeout(() => {
                        greeting.style.transform = 'none';
                        greeting.style.opacity = '1';
                    }, 100);
                }
            }, messages.length * 50 + 200);

            // Create new conversation when clearing chat
            await createNewConversation();
        });

        // Close panel with animation
        document.addEventListener('click', (e) => {
            if (e.target.id === 'edwin-close') {
                const panel = document.getElementById('edwin-panel');
                panel.style.transform = 'translateY(20px)';
                panel.style.opacity = '0.8';

                setTimeout(() => {
                    panel.classList.remove('open', 'quizzes-open', 'quizzes-visible');
                    panel.style.transform = '';
                    panel.style.opacity = '';
                    const quizzesTab = panel.querySelector('#edwin-quizzes-tab');
                    quizzesTab.setAttribute('aria-pressed', 'false');
                }, 200);
            }
        });

        // Enhanced quizzes tab interaction
        const quizzesTab = document.getElementById('edwin-quizzes-tab');
        quizzesTab.addEventListener('click', () => {
            const panel = document.getElementById('edwin-panel');
            const isOpen = panel.classList.contains('quizzes-open');

            if (!isOpen) {
                panel.classList.add('quizzes-visible');
                setTimeout(() => panel.classList.add('quizzes-open'), 50);
                quizzesTab.setAttribute('aria-pressed', 'true');
            } else {
                panel.classList.remove('quizzes-open');
                setTimeout(() => panel.classList.remove('quizzes-visible'), 450);
                quizzesTab.setAttribute('aria-pressed', 'false');
            }
        });

        // Back button functionality
        document.getElementById('edwin-quizzes-back').addEventListener('click', () => {
            const panel = document.getElementById('edwin-panel');
            panel.classList.remove('quizzes-open');
            setTimeout(() => panel.classList.remove('quizzes-visible'), 450);
            quizzesTab.setAttribute('aria-pressed', 'false');
        });

        initializeOtherInteractions();
    }

    function initializeOtherInteractions() {
        // Enhanced settings functionality
        const settingsModal = document.getElementById('edwin-settings-modal');
        document.getElementById('edwin-settings').addEventListener('click', () => {
            settingsModal.classList.add('show');
        });

        document.getElementById('close-settings').addEventListener('click', () => {
            settingsModal.classList.remove('show');
        });

        // Settings options with enhanced feedback
        document.getElementById('colorblind-mode').addEventListener('change', (e) => {
            document.documentElement.style.setProperty('--colorblind-filter',
                e.target.checked ? 'grayscale(0.3) contrast(1.3)' : 'none');
        });

        document.getElementById('highcontrast-mode').addEventListener('change', (e) => {
            document.documentElement.classList.toggle('high-contrast', e.target.checked);
        });

        document.getElementById('text-size').addEventListener('change', (e) => {
            document.documentElement.style.setProperty('--base-font-size', e.target.value + 'px');
        });
    }

    function initializeStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            :root {
                --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                --success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                --panel-bg: linear-gradient(135deg, rgba(10, 13, 17, 0.95) 0%, rgba(13, 17, 23, 0.95) 100%);
                --glass-bg: rgba(255, 255, 255, 0.05);
                --glass-border: rgba(255, 255, 255, 0.1);
                --text-primary: #ffffff;
                --text-secondary: rgba(255, 255, 255, 0.8);
                --text-muted: rgba(255, 255, 255, 0.6);
                --border-radius: 16px;
                --border-radius-sm: 12px;
                --border-radius-lg: 24px;
                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 16px;
                --spacing-lg: 24px;
                --spacing-xl: 32px;
                --animation-fast: 0.2s;
                --animation-normal: 0.3s;
                --animation-slow: 0.5s;
                --shadow-sm: 0 4px 16px rgba(0, 0, 0, 0.1);
                --shadow-md: 0 8px 32px rgba(0, 0, 0, 0.2);
                --shadow-lg: 0 16px 64px rgba(0, 0, 0, 0.3);
                --base-font-size: 16px;
                --colorblind-filter: none;
            }

            .high-contrast {
                --panel-bg: linear-gradient(135deg, #000000 0%, #111111 100%);
                --text-primary: #ffffff;
                --text-secondary: #ffffff;
                --glass-bg: rgba(255, 255, 255, 0.1);
            }

            @keyframes edwinButtonGlow {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }

            @keyframes slideInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes slideInLeft {
                from {
                    opacity: 0;
                    transform: translateX(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            @keyframes pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes glow {
                0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.3); }
                50% { box-shadow: 0 0 40px rgba(102, 126, 234, 0.6); }
            }

            @keyframes fireGlow {
                0%, 100% { filter: brightness(1) saturate(1); }
                50% { filter: brightness(1.3) saturate(1.5); }
            }

            @keyframes progressFill {
                from { width: 0%; }
                to { width: 100%; }
            }

            @keyframes bounceIn {
                0% { opacity: 0; transform: scale(0.3); }
                50% { opacity: 1; transform: scale(1.05); }
                70% { transform: scale(0.9); }
                100% { opacity: 1; transform: scale(1); }
            }

            @keyframes thinkingDots {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }

            /* Base Panel Styles */
            #edwin-panel {
                position: fixed;
                left: ${panelMarginLeft}px;
                right: ${panelMarginRight}px;
                bottom: -100%;
                height: 100vh;
                background: var(--panel-bg);
                backdrop-filter: blur(20px);
                color: var(--text-primary);
                display: flex;
                flex-direction: column;
                transition: all var(--animation-slow) cubic-bezier(0.4, 0, 0.2, 1);
                border-radius: 0;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                box-shadow: var(--shadow-lg);
                opacity: 0;
                z-index: 9999;
                overflow: visible;
                border: 1px solid var(--glass-border);
                filter: var(--colorblind-filter);
            }

            #edwin-panel.open {
                bottom: 0;
                opacity: 1;
                animation: slideInUp var(--animation-slow) cubic-bezier(0.4, 0, 0.2, 1);
            }

            /* Header */
            .edwin-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-md) var(--spacing-lg);
                font-size: 18px;
                font-weight: 600;
                background: var(--glass-bg);
                backdrop-filter: blur(12px);
                border-radius: 0;
                border-bottom: 1px solid var(--glass-border);
                position: relative;
                z-index: 5;
            }

            .edwin-header-controls {
                display: flex;
                gap: var(--spacing-sm);
            }

            .edwin-header button {
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius-sm);
                font-size: 18px;
                color: var(--text-secondary);
                cursor: pointer;
                padding: var(--spacing-sm) var(--spacing-md);
                transition: all var(--animation-fast);
                backdrop-filter: blur(8px);
            }

            .edwin-header button:hover {
                color: var(--text-primary);
                background: rgba(255, 255, 255, 0.1);
                transform: scale(1.1);
            }

            /* Main Body */
            .edwin-body {
                padding: var(--spacing-lg);
                padding-bottom: 120px;
                flex-grow: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
                scroll-behavior: smooth;
            }

            .edwin-body::-webkit-scrollbar {
                width: 6px;
            }

            .edwin-body::-webkit-scrollbar-track {
                background: transparent;
            }

            .edwin-body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }

            /* Enhanced Greeting Card */
            .edwin-greeting-card {
                text-align: center;
                padding: var(--spacing-xl);
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius-lg);
                backdrop-filter: blur(12px);
                transition: all var(--animation-normal);
                animation: slideInUp var(--animation-slow) ease-out;
            }

            .greeting-avatar {
                font-size: 48px;
                margin-bottom: var(--spacing-md);
                animation: bounceIn 1s ease-out 0.5s both;
            }

            .edwin-greeting-card h1 {
                font-size: 2.5em;
                font-weight: 700;
                margin-bottom: 0.5em;
                background: var(--primary-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .edwin-greeting-card p {
                font-size: 1.2em;
                color: var(--text-secondary);
                margin-bottom: var(--spacing-md);
            }

            #edwin-subtext {
                font-size: 1em;
                color: var(--text-muted);
            }

            /* Enhanced Footer */
            .edwin-footer {
                display: flex;
                padding: var(--spacing-md) var(--spacing-lg);
                background: var(--glass-bg);
                backdrop-filter: blur(12px);
                border-top: 1px solid var(--glass-border);
                gap: var(--spacing-md);
                align-items: center;
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 4;
            }

            /* Enhanced Input */
            .input-wrapper {
                position: relative;
                flex-grow: 1;
                flex-basis: 0;      /* 🔥 allows input to stretch */
                display: flex;
            }


            .input-glow {
                position: absolute;
                inset: 0;
                border-radius: var(--border-radius);
                background: var(--primary-gradient);
                opacity: 0;
                z-index: -1;
                transition: opacity var(--animation-normal);
            }

            .edwin-footer input {
                flex: 1;            /* 🔥 fully stretch inside wrapper */
                min-width: 200px;   /* ensures input doesn’t collapse */
                padding: var(--spacing-md) var(--spacing-lg);
                border-radius: var(--border-radius);
                border: 1px solid var(--glass-border);
                background: var(--glass-bg);
                backdrop-filter: blur(8px);
                color: var(--text-primary);
                font-size: var(--base-font-size);
                transition: all var(--animation-normal);
                position: relative;
                z-index: 1;
            }




            .edwin-footer input:focus {
                outline: none;
                border-color: rgba(102, 126, 234, 0.5);
            }

            .edwin-footer input:focus + .input-glow {
                opacity: 0.1;
            }

            .edwin-footer input::placeholder {
                color: var(--text-muted);
            }

            /* Enhanced Send Button */
            .edwin-footer #edwin-send {
                position: relative;
                min-width: 120px;   /* 👈 force button width */
                padding: var(--spacing-md) var(--spacing-xl);
                border: none;
                border-radius: var(--border-radius);
                background: var(--primary-gradient);
                color: white;
                font-weight: 600;
                font-size: var(--base-font-size);
                cursor: pointer;
                transition: all var(--animation-normal);
                overflow: hidden;
                text-align: center;
            }


            .send-glow {
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%);
                opacity: 0;
                transition: opacity var(--animation-fast);
            }

            .edwin-footer #edwin-send:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }

            .edwin-footer #edwin-send:hover .send-glow {
                opacity: 1;
            }

            .edwin-footer #edwin-send:active {
                transform: translateY(0) scale(0.98);
            }

            /* Chat Messages */
            #edwin-chat {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
            }

            .edwin-msg {
                display: flex;
                gap: var(--spacing-sm);
                opacity: 0;
                transform: translateY(20px);
                transition: all var(--animation-normal);
                animation: slideInUp var(--animation-normal) ease-out forwards;
            }

            .edwin-msg.show {
                opacity: 1;
                transform: translateY(0);
            }

            .edwin-msg.fade-out {
                opacity: 0;
                transform: translateX(-30px);
            }

            .edwin-msg.user {
                flex-direction: row-reverse;
            }

            .message-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                flex-shrink: 0;
                border: 2px solid var(--glass-border);
                backdrop-filter: blur(8px);
            }

            .user-avatar {
                background: var(--secondary-gradient);
            }

            .edwin-avatar {
                background: var(--primary-gradient);
            }

            .thinking-avatar {
                background: var(--success-gradient);
                animation: pulse 2s infinite;
            }

            .message-content {
                display: flex;
                flex-direction: column;
                max-width: 70%;
            }

            .message-bubble {
                padding: var(--spacing-md) var(--spacing-lg);
                border-radius: var(--border-radius-lg);
                backdrop-filter: blur(8px);
                border: 1px solid var(--glass-border);
                position: relative;
                word-wrap: break-word;
                line-height: 1.5;
            }

            .user-bubble {
                background: var(--glass-bg);
                color: var(--text-primary);
                border-bottom-right-radius: var(--spacing-sm);
            }

            .edwin-bubble {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
                color: var(--text-primary);
                border-bottom-left-radius: var(--spacing-sm);
            }

            .thinking-bubble {
                background: linear-gradient(135deg, rgba(79, 172, 254, 0.2) 0%, rgba(0, 242, 254, 0.2) 100%);
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
            }

            .message-timestamp {
                font-size: 12px;
                color: var(--text-muted);
                margin-top: var(--spacing-xs);
                text-align: right;
            }

            .edwin-msg.user .message-timestamp {
                text-align: left;
            }

            .spinner {
                display: inline-block;
                animation: spin 1s linear infinite;
            }

            .thinking-dots {
                display: flex;
                gap: 4px;
            }

            .thinking-dots span {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: currentColor;
                animation: thinkingDots 1.4s ease-in-out infinite both;
            }

            .thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
            .thinking-dots span:nth-child(2) { animation-delay: -0.16s; }

            .quiz-explanation {
                font-size: 1em;
                color: var(--text-secondary);
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius-sm);
                padding: var(--spacing-sm) var(--spacing-md);
                backdrop-filter: blur(8px);
                }


            /* Enhanced Quizzes Tab */
            .quizzes-tab {
                position: absolute;
                top: 50%;
                left: calc(-1 * ${quizzesTabExtensionClosed}px);
                transform: translateY(-50%) rotate(90deg);
                background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 100%);
                color: white;
                padding: var(--spacing-lg) var(--spacing-xl);
                font-weight: 700;
                font-size: 18px;
                border-top-left-radius: var(--border-radius);
                border-top-right-radius: var(--border-radius);
                cursor: pointer;
                box-shadow: var(--shadow-md);
                transition: all ${quizzesTabAnimationSpeed}s cubic-bezier(0.25, 0.8, 0.25, 1);
                letter-spacing: 1px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                z-index: 12;
                user-select: none;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                border: 1px solid var(--glass-border);
            }

            .tab-glow {
                position: absolute;
                inset: 0;
                background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%);
                transform: translateX(-100%);
                transition: transform 0.6s ease;
            }

            .quizzes-tab:hover {
                transform: translateY(-50%) rotate(90deg) scale(1.1);
                box-shadow: var(--shadow-lg);
                filter: brightness(1.2);
            }

            .quizzes-tab:hover .tab-glow {
                transform: translateX(100%);
            }

            #edwin-panel.quizzes-open .quizzes-tab {
                left: calc(-1 * ${Math.abs(parseInt(quizzesTabExtensionOpen))}px);
            }

            /* Enhanced Quizzes Section */
            #edwin-quizzes-section {
                position: absolute;
                top: 60px;
                left: 4px;
                height: 85%;
                width: 90%;
                display: flex;
                flex-direction: column;
                background: linear-gradient(135deg,
                    rgba(13, 17, 23, 0.95) 0%,
                    rgba(15, 42, 68, 0.95) 25%,
                    rgba(18, 49, 42, 0.95) 50%,
                    rgba(20, 88, 58, 0.95) 75%,
                    rgba(27, 63, 115, 0.95) 100%);
                backdrop-filter: blur(20px);
                border-top-left-radius: var(--border-radius-lg);
                border-top-right-radius: var(--border-radius-lg);
                border: 1px solid var(--glass-border);
                box-shadow: var(--shadow-lg);
                transform: translateX(-100%);
                transition: transform 0.45s cubic-bezier(0.22, 0.9, 0.35, 1), opacity 0.2s linear;
                z-index: 10;
                pointer-events: none;
                opacity: 0;
                visibility: hidden;
            }

            #edwin-panel.quizzes-visible #edwin-quizzes-section {
                visibility: visible;
                opacity: 1;
            }

            #edwin-panel.quizzes-open #edwin-quizzes-section {
                transform: translateX(0);
                pointer-events: auto;
            }

            .edwin-quizzes-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-md) var(--spacing-lg);
                font-size: 18px;
                font-weight: 600;
                background: var(--glass-bg);
                backdrop-filter: blur(12px);
                border-top-left-radius: var(--border-radius-lg);
                border-top-right-radius: var(--border-radius-lg);
                border-bottom: 1px solid var(--glass-border);
                z-index: 11;
            }

            .edwin-quizzes-header button {
                padding: var(--spacing-sm) var(--spacing-md);
                border: none;
                border-radius: var(--border-radius-sm);
                background: var(--primary-gradient);
                color: white;
                font-weight: 600;
                font-size: var(--base-font-size);
                cursor: pointer;
                z-index: 11;
                transition: all var(--animation-normal);
            }

            .edwin-quizzes-header button:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }

            .edwin-quizzes-body {
                flex: 1;
                overflow-y: auto;
                padding: var(--spacing-xl);
                display: flex;
                flex-direction: column;
                gap: var(--spacing-lg);
            }

            .edwin-quizzes-title-wrapper {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-md);
            }

            .edwin-quizzes-title-wrapper h2 {
                margin: 0;
                font-size: 1.8em;
                font-weight: 700;
                background: var(--primary-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .section-description {
                color: var(--text-secondary);
                font-size: 1.1em;
                margin-bottom: var(--spacing-lg);
            }

            /* Enhanced Progress Bar */
            .enhanced-progress {
                position: relative;
                width: 300px;
                height: 32px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: var(--border-radius);
                overflow: hidden;
                display: flex;
                border: 1px solid var(--glass-border);
            }

            .progress-segment {
                flex: 1;
                margin: 2px;
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.1);
                transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            }

            .progress-segment.filled {
                background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
                box-shadow: 0 0 20px rgba(255, 107, 53, 0.5);
                animation: progressFill 0.8s ease-out;
            }

            .progress-segment.filled::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                animation: shimmer 2s infinite;
            }

            /* Quiz Option Buttons */
            .quiz-option {
                display: block;
                width: 100%;
                margin: 10px 0;
                padding: 14px;
                border-radius: 12px;
                border: none;
                background: #1b1f27;
                color: white;
                font-size: 16px;
                text-align: left;
                cursor: pointer;
                transition: all 0.2s;
            }
            .quiz-option:hover {
                background: #2c2c34;
            }


            @keyframes shimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }

            .fire-effect {
                position: absolute;
                left: 320px;
                top: -10px;
                width: 50px;
                height: 50px;
                display: none;
                object-fit: contain;
                pointer-events: none;
                filter: drop-shadow(0 0 10px rgba(255, 107, 53, 0.7));
            }

            /* Enhanced Quiz Items */
            #edwin-quizzes-list {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-lg);
            }

            .edwin-quiz-item {
                background: var(--glass-bg);
                backdrop-filter: blur(12px);
                padding: var(--spacing-xl);
                border-radius: var(--border-radius-lg);
                border: 1px solid var(--glass-border);
                box-shadow: var(--shadow-sm);
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
                transition: all var(--animation-normal);
                cursor: pointer;
                animation: slideInUp var(--animation-normal) ease-out;
                position: relative;
                overflow: hidden;
            }

            .edwin-quiz-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                transition: left 0.5s ease;
            }

            .edwin-quiz-item:hover {
                transform: translateY(-4px);
                box-shadow: var(--shadow-md);
                border-color: rgba(102, 126, 234, 0.3);
            }

            .edwin-quiz-item:hover::before {
                left: 100%;
            }

            .quiz-card-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: var(--spacing-md);
            }

            .quiz-title {
                font-weight: 700;
                font-size: 1.3em;
                color: var(--text-primary);
                line-height: 1.3;
            }

            .quiz-difficulty {
                padding: var(--spacing-xs) var(--spacing-sm);
                border-radius: 20px;
                font-size: 0.8em;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                white-space: nowrap;
            }

            .quiz-difficulty.beginner {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                color: white;
            }

            .quiz-difficulty.intermediate {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
            }

            .quiz-difficulty.advanced {
                background: linear-gradient(135deg, #ff8a80 0%, #ff5722 100%);
                color: white;
            }

            .quiz-desc {
                font-size: 1.1em;
                color: var(--text-secondary);
                line-height: 1.5;
            }

            .quiz-card-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: var(--spacing-sm);
            }

            .quiz-action {
                position: relative;
                padding: var(--spacing-md) var(--spacing-xl);
                border: none;
                border-radius: var(--border-radius);
                cursor: pointer;
                font-weight: 600;
                font-size: 1em;
                transition: all var(--animation-normal);
                overflow: hidden;
                background: var(--primary-gradient);
                color: white;
            }

            .quiz-action.completed {
                background: var(--success-gradient);
            }

            .button-glow {
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 100%);
                opacity: 0;
                transition: opacity var(--animation-fast);
            }

            .quiz-action:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }

            .quiz-action:hover .button-glow {
                opacity: 1;
            }

            .quiz-action:active {
                transform: translateY(0) scale(0.98);
            }

            .completion-badge {
                background: var(--success-gradient);
                color: white;
                padding: var(--spacing-xs) var(--spacing-md);
                border-radius: 20px;
                font-size: 0.9em;
                font-weight: 600;
                animation: bounceIn 0.6s ease-out;
            }

            /* Enhanced Streaks Section */
            .streaks-container {
                background: linear-gradient(180deg,
                    rgba(255, 140, 0, 0.8) 0%,
                    rgba(255, 69, 0, 0.8) 15%,
                    rgba(255, 0, 0, 0.8) 30%,
                    rgba(28, 46, 45, 0.95) 31%,
                    rgba(28, 46, 45, 0.95) 100%) !important;
                backdrop-filter: blur(20px) !important;
            }

            .streaks-body {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100%;
                position: relative;
            }

            .edwin-streaks-bar {
                display: flex;
                gap: var(--spacing-sm);
                margin: var(--spacing-xl) auto;
                padding: var(--spacing-md);
                background: rgba(0, 0, 0, 0.3);
                border-radius: var(--border-radius);
                border: 1px solid var(--glass-border);
                backdrop-filter: blur(8px);
            }

            .streak-segment {
                width: 40px;
                height: 20px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.2);
                transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            }

            .streak-segment.filled {
                background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
                box-shadow: 0 0 20px rgba(255, 107, 53, 0.6);
                animation: progressFill 1s ease-out;
            }

            .streak-segment.filled::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 100%);
                animation: shimmer 3s infinite;
            }

            .streak-decoration {
                position: absolute;
                width: 120px;
                height: 120px;
                pointer-events: none;
                user-select: none;
                filter: drop-shadow(0 0 20px rgba(255, 107, 53, 0.3));
                animation: float 3s ease-in-out infinite;
            }

            .streak-decoration.left {
                top: 190px;
                left: 200px;
            }

            .streak-decoration.right {
                top: 185px;
                right: 200px;
                animation-delay: -1.5s;
            }

            @keyframes float {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-10px) rotate(2deg); }
            }

            .streak-display {
                position: relative;
                width: 700px;
                height: 400px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: var(--spacing-xl) 0;
            }

            .streak-fire {
                position: absolute;
                left: -200px;
                top: -300px;
                width: 700px;
                height: 1000px;
                object-fit: contain;
                pointer-events: none;
                filter: drop-shadow(0 0 40px rgba(255, 107, 53, 0.8));
                animation: fireGlow 3s ease-in-out infinite alternate;
            }

            .streak-number {
                position: absolute;
                font-size: 200px;
                font-weight: 900;
                background: linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #ffd700 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                text-shadow: 0 0 40px rgba(255, 107, 53, 0.5);
                animation: glow 2s ease-in-out infinite alternate;
                z-index: 10;
            }

            .streak-label {
                font-size: 32px;
                font-weight: 700;
                background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: var(--spacing-xl);
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            /* Enhanced Settings Modal */
            .settings-modal {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(12px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                visibility: hidden;
                transition: all var(--animation-normal);
            }

            .settings-modal.show {
                opacity: 1;
                visibility: visible;
            }

            .settings-content {
                background: var(--panel-bg);
                backdrop-filter: blur(20px);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius-lg);
                padding: var(--spacing-xl);
                width: 400px;
                max-width: 90vw;
                animation: slideInUp var(--animation-normal) ease-out;
            }

            .settings-content h2 {
                margin: 0 0 var(--spacing-lg) 0;
                font-size: 1.8em;
                font-weight: 700;
                background: var(--primary-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .settings-group {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-lg);
                margin-bottom: var(--spacing-xl);
            }

            .setting-item {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
                font-size: var(--base-font-size);
                color: var(--text-primary);
                cursor: pointer;
                padding: var(--spacing-md);
                border-radius: var(--border-radius-sm);
                transition: background var(--animation-fast);
            }

            .setting-item:hover {
                background: var(--glass-bg);
            }

            .setting-item input[type="checkbox"] {
                display: none;
            }

            .checkmark {
                width: 20px;
                height: 20px;
                border: 2px solid var(--glass-border);
                border-radius: 4px;
                position: relative;
                transition: all var(--animation-fast);
            }

            .setting-item input[type="checkbox"]:checked + .checkmark {
                background: var(--primary-gradient);
                border-color: transparent;
            }

            .setting-item input[type="checkbox"]:checked + .checkmark::after {
                content: '✓';
                position: absolute;
                color: white;
                font-size: 14px;
                font-weight: bold;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .setting-select {
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius-sm);
                color: var(--text-primary);
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: var(--base-font-size);
                cursor: pointer;
                transition: all var(--animation-fast);
            }

            .setting-select:focus {
                outline: none;
                border-color: rgba(102, 126, 234, 0.5);
            }

            .settings-close {
                width: 100%;
                padding: var(--spacing-md);
                border: none;
                border-radius: var(--border-radius);
                background: var(--primary-gradient);
                color: white;
                font-weight: 600;
                font-size: var(--base-font-size);
                cursor: pointer;
                transition: all var(--animation-normal);
            }

            .settings-close:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }

            /* Responsive Design */
            @media (max-width: 1200px) {
                #edwin-panel {
                    left: 40px;
                    right: 40px;
                }
            }

            @media (max-width: 768px) {
                #edwin-panel {
                    left: 10px;
                    right: 10px;
                    height: 70%;
                }

                .edwin-quizzes-title-wrapper {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .enhanced-progress {
                    width: 250px;
                }

                .streak-display {
                    width: 300px;
                    height: 300px;
                }

                .streak-number {
                    font-size: 120px;
                }

                .streak-fire {
                    width: 400px;
                    height: 600px;
                    left: -100px;
                    top: -200px;
                }
            }

            /* Accessibility Improvements */
            @media (prefers-reduced-motion: reduce) {
                * {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }

            @media (prefers-contrast: high) {
                :root {
                    --glass-bg: rgba(255, 255, 255, 0.15);
                    --glass-border: rgba(255, 255, 255, 0.3);
                    --text-secondary: rgba(255, 255, 255, 0.9);
                }
            }

            /* Focus states for keyboard navigation */
            button:focus-visible,
            input:focus-visible,
            [tabindex]:focus-visible {
                outline: 2px solid rgba(102, 126, 234, 0.8);
                outline-offset: 2px;
            }

            .quiz-completed {
                text-align: center;
                padding: 40px 20px;
                font-size: 24px;
                font-weight: 700;
                background: var(--success-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                border: 2px solid var(--glass-border);
                border-radius: var(--border-radius-lg);
                background-color: var(--glass-bg);
                backdrop-filter: blur(12px);
            }

            .quiz-option:disabled {
                pointer-events: none;
            }

        `;

        document.head.appendChild(style);

        // Add Google Fonts for better typography
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }
})();
