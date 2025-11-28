// ==UserScript==
// @name         Edwin AI DEBUG
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Debug version
// @match        https://canvas.asu.edu/*
// @grant        none
// ==/UserScript==

console.log('🚀 EDWIN DEBUG: Script started!');

setTimeout(() => {
    console.log('🚀 EDWIN DEBUG: Looking for sidebar...');
    const nav = document.querySelector('#section-tabs');
    console.log('🚀 EDWIN DEBUG: Sidebar found?', nav);

    if (nav) {
        console.log('🚀 EDWIN DEBUG: Creating button...');
        const li = document.createElement('li');
        li.className = 'section';
        const a = document.createElement('a');
        a.id = 'edwin-btn-debug';
        a.href = '#';
        a.textContent = 'EDWIN DEBUG';
        a.style.cssText = 'background: red; color: white; padding: 10px; display: block; margin: 5px;';

        a.onclick = function(e) {
            e.preventDefault();
            alert('EDWIN BUTTON CLICKED!');
            console.log('🚀 EDWIN DEBUG: Button was clicked!');
        };

        li.appendChild(a);
        nav.appendChild(li);
        console.log('🚀 EDWIN DEBUG: Button created!');
    } else {
        console.log('🚀 EDWIN DEBUG: No sidebar found!');
    }
}, 2000);
