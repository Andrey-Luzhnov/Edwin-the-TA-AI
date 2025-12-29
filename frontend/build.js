// Build script to concatenate modular frontend into single Tampermonkey userscript

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'edwin.user.js');

// Module load order (dependencies first)
const MODULES = [
    'config.js',
    'canvasDetect.js',
    'scrape.js',
    'api.js',
    'ui.js',
    'template.js',
    'features/autoSync.js',
    'features/explainThisPage.js',
    'main.js'
];

// Userscript metadata header
const METADATA = `// ==UserScript==
// @name         Edwin AI Canvas Chat (Modular Build)
// @namespace    http://tampermonkey.net/
// @version      11.0.0
// @description  AI Teaching Assistant for Canvas LMS - Modular build with auto-sync and explain features
// @author       Edwin Team
// @match        https://canvas.*.edu/courses/*
// @match        https://*.instructure.com/courses/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

`;

/**
 * Read and concatenate all modules
 */
function buildUserscript() {
    console.log('🔨 Building Edwin userscript...\n');

    // Ensure dist directory exists
    if (!fs.existsSync(DIST_DIR)) {
        fs.mkdirSync(DIST_DIR, { recursive: true });
        console.log('✓ Created dist directory\n');
    }

    let concatenated = METADATA;

    // Add wrapper start
    concatenated += `(function() {\n'use strict';\n\n`;

    // Concatenate modules
    for (const module of MODULES) {
        const modulePath = path.join(SRC_DIR, module);

        if (!fs.existsSync(modulePath)) {
            console.error(`❌ Module not found: ${module}`);
            process.exit(1);
        }

        const moduleContent = fs.readFileSync(modulePath, 'utf8');

        // Add module header comment
        concatenated += `\n// ========================================\n`;
        concatenated += `// Module: ${module}\n`;
        concatenated += `// ========================================\n\n`;

        // Add module content (strip any use strict as we have it in wrapper)
        const cleanContent = moduleContent.replace(/['"]use strict['"];?\s*/g, '');
        concatenated += cleanContent;

        concatenated += '\n\n';

        console.log(`✓ Added module: ${module}`);
    }

    // Add wrapper end
    concatenated += `})();\n`;

    // Write output file
    fs.writeFileSync(OUTPUT_FILE, concatenated, 'utf8');

    const stats = fs.statSync(OUTPUT_FILE);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`\n✅ Build complete!`);
    console.log(`📦 Output: ${OUTPUT_FILE}`);
    console.log(`📊 Size: ${sizeKB} KB`);
    console.log(`📝 Modules: ${MODULES.length}\n`);
}

/**
 * Watch mode - rebuild on file changes
 */
function watch() {
    console.log('👀 Watch mode enabled - will rebuild on changes...\n');

    buildUserscript();

    fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
            console.log(`\n📝 File changed: ${filename}`);
            buildUserscript();
        }
    });
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--watch') || args.includes('-w')) {
    watch();
} else {
    buildUserscript();
}
