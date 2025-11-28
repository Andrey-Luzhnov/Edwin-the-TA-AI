// ==UserScript==
// @name         Edwin AI Canvas Chat - Simple Version
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Simple Edwin AI without authentication - for testing
// @match        https://canvas.asu.edu/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // BACKEND CONFIGURATION
    const BACKEND_BASE_URL = 'http://localhost:5000';
    const USER_ID = 1;
    const COURSE_ID = 231425; // Your current course

    console.log('Edwin AI: Script loaded!');

    // Wait for sidebar to load
    const checkSidebar = setInterval(() => {
        const nav = document.querySelector('#section-tabs');
        if (nav && !document.querySelector('#edwin-btn')) {
            clearInterval(checkSidebar);
            console.log('Edwin AI: Sidebar found, creating button...');

            // Create button
            const li = document.createElement('li');
            li.className = 'section';
            const a = document.createElement('a');
            a.id = 'edwin-btn';
            a.href = '#';
            a.innerHTML = '<span>Edwin AI</span>';
            a.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 8px;
                display: block;
                padding: 12px;
                text-align: center;
                color: white;
                font-weight: 600;
                margin: 8px;
            `;

            // Add click handler DIRECTLY to button
            a.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Edwin AI: Button clicked!');
                openPanel();
            });

            li.appendChild(a);
            nav.appendChild(li);
            console.log('Edwin AI: Button created!');
        }
    }, 500);

    // Create panel
    function openPanel() {
        console.log('Edwin AI: Opening panel...');

        // Check if panel already exists
        let panel = document.getElementById('edwin-panel');
        if (panel) {
            panel.style.display = 'flex';
            return;
        }

        // Create new panel
        panel = document.createElement('div');
        panel.id = 'edwin-panel';
        panel.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 400px;
            height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            box-shadow: -5px 0 20px rgba(0,0,0,0.5);
        `;

        panel.innerHTML = `
            <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0;">Edwin AI</h2>
                <button id="edwin-close" style="background: #f44336; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>

            <div id="edwin-chat" style="flex: 1; padding: 20px; overflow-y: auto;">
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🤖</div>
                    <h3>Hello! I'm Edwin AI</h3>
                    <p>Ask me anything about your course!</p>
                </div>
            </div>

            <div style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                <input type="text" id="edwin-input" placeholder="Ask Edwin anything..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #ccc; box-sizing: border-box; margin-bottom: 10px;">
                <button id="edwin-send" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: 600;">Send</button>
            </div>
        `;

        document.body.appendChild(panel);
        console.log('Edwin AI: Panel created!');

        // Add event listeners
        document.getElementById('edwin-close').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        document.getElementById('edwin-send').addEventListener('click', sendMessage);

        document.getElementById('edwin-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    async function sendMessage() {
        const input = document.getElementById('edwin-input');
        const chat = document.getElementById('edwin-chat');
        const question = input.value.trim();

        if (!question) return;

        console.log('Edwin AI: Sending message:', question);

        // Add user message
        const userMsg = document.createElement('div');
        userMsg.style.cssText = 'margin-bottom: 15px; text-align: right;';
        userMsg.innerHTML = `<div style="display: inline-block; background: #667eea; padding: 10px 15px; border-radius: 12px; max-width: 80%;">${question}</div>`;
        chat.appendChild(userMsg);

        input.value = '';

        // Add thinking message
        const thinkingMsg = document.createElement('div');
        thinkingMsg.style.cssText = 'margin-bottom: 15px;';
        thinkingMsg.innerHTML = `<div style="display: inline-block; background: rgba(255,255,255,0.1); padding: 10px 15px; border-radius: 12px;">Thinking...</div>`;
        chat.appendChild(thinkingMsg);

        chat.scrollTop = chat.scrollHeight;

        try {
            // Call backend
            const response = await fetch(`${BACKEND_BASE_URL}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userID: USER_ID,
                    courseID: COURSE_ID,
                    question: question
                })
            });

            const data = await response.json();
            console.log('Edwin AI: Response:', data);

            // Remove thinking message
            chat.removeChild(thinkingMsg);

            // Add AI response
            const aiMsg = document.createElement('div');
            aiMsg.style.cssText = 'margin-bottom: 15px;';
            aiMsg.innerHTML = `<div style="display: inline-block; background: rgba(255,255,255,0.1); padding: 10px 15px; border-radius: 12px; max-width: 80%;">${data.answer || 'Sorry, I had trouble answering that.'}</div>`;
            chat.appendChild(aiMsg);

            chat.scrollTop = chat.scrollHeight;

        } catch (error) {
            console.error('Edwin AI: Error:', error);
            chat.removeChild(thinkingMsg);

            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = 'margin-bottom: 15px;';
            errorMsg.innerHTML = `<div style="display: inline-block; background: #f44336; padding: 10px 15px; border-radius: 12px;">Error: Could not connect to backend. Make sure the server is running!</div>`;
            chat.appendChild(errorMsg);

            chat.scrollTop = chat.scrollHeight;
        }
    }

    console.log('Edwin AI: Script initialized!');
})();
