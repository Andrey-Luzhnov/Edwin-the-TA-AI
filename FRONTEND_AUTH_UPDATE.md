# Frontend Authentication Update Guide

This document outlines the required changes to the Tampermonkey script to implement authentication and dynamic course detection.

## Changes Required

### 1. Update Configuration Section (Lines 13-16)

**Remove:**
```javascript
const BACKEND_BASE_URL = 'http://localhost:5000';
const USER_ID = 1;
const COURSE_ID = 231849;
```

**Replace with:**
```javascript
const BACKEND_BASE_URL = 'http://localhost:5000';

// Session management
function getSessionToken() {
    return localStorage.getItem('edwin_session_token');
}

function setSessionToken(token) {
    localStorage.setItem('edwin_session_token', token);
}

function clearSession() {
    localStorage.removeItem('edwin_session_token');
    localStorage.removeItem('edwin_user_id');
}

function getUserId() {
    return localStorage.getItem('edwin_user_id');
}

function setUserId(userId) {
    localStorage.setItem('edwin_user_id', userId);
}

// Extract course ID from Canvas URL
function getCourseIdFromURL() {
    const match = window.location.pathname.match(/\/courses\/(\d+)/);
    return match ? parseInt(match[1]) : null;
}

const COURSE_ID = getCourseIdFromURL();
```

### 2. Add Authentication API Functions (After line 118)

```javascript
// Authentication API Functions
async function loginUser(canvasId, password) {
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canvasId, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            setSessionToken(data.sessionToken);
            setUserId(data.userId);
            return { success: true, userId: data.userId };
        } else {
            return { success: false, message: data.message };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Network error during login' };
    }
}

async function registerUser(canvasId, name, email, password) {
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canvasId, name, email, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return { success: true, userId: data.userId };
        } else {
            return { success: false, message: data.message };
        }
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: 'Network error during registration' };
    }
}

async function validateSession() {
    const sessionToken = getSessionToken();
    if (!sessionToken) return false;

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/validateSession`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            setUserId(data.userId);
            return true;
        } else {
            clearSession();
            return false;
        }
    } catch (error) {
        console.error('Session validation error:', error);
        return false;
    }
}

async function logoutUser() {
    const sessionToken = getSessionToken();
    if (sessionToken) {
        try {
            await fetch(`${BACKEND_BASE_URL}/api/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken })
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    clearSession();
}

async function syncCanvasMaterials(canvasToken) {
    const sessionToken = getSessionToken();
    if (!sessionToken || !COURSE_ID) {
        return { success: false, message: 'Not logged in or no course detected' };
    }

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/syncMaterials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionToken,
                courseID: COURSE_ID,
                canvasToken
            })
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Sync error:', error);
        return { success: false, message: 'Network error during sync' };
    }
}
```

### 3. Update createNewConversation() (Lines 53-79)

**Replace:**
```javascript
body: JSON.stringify({
    userID: USER_ID,
    courseID: COURSE_ID
})
```

**With:**
```javascript
body: JSON.stringify({
    sessionToken: getSessionToken(),
    courseID: COURSE_ID
})
```

### 4. Update sendMessageToBackend() (Lines 81-118)

**Replace:**
```javascript
body: JSON.stringify({
    userID: USER_ID,
    courseID: COURSE_ID,
    question: question
})
```

**With:**
```javascript
body: JSON.stringify({
    sessionToken: getSessionToken(),
    courseID: COURSE_ID,
    question: question
})
```

### 5. Add Login/Register Modal HTML (In initializePanel(), after settings modal ~line 289)

Add this before the closing of panel.innerHTML:

```html
<!-- Login Modal -->
<div id="edwin-login-modal" class="login-modal" style="display:none;">
    <div class="login-content">
        <h2 id="login-modal-title">Welcome to Edwin AI</h2>
        <div id="login-form-container">
            <!-- Login Form -->
            <div id="login-form">
                <input type="text" id="login-canvas-id" placeholder="Canvas ID" required>
                <input type="password" id="login-password" placeholder="Password" required>
                <button id="login-submit-btn">Login</button>
                <p class="auth-toggle">
                    Don't have an account? <a href="#" id="show-register">Register</a>
                </p>
            </div>

            <!-- Registration Form -->
            <div id="register-form" style="display:none;">
                <input type="text" id="register-canvas-id" placeholder="Canvas ID" required>
                <input type="text" id="register-name" placeholder="Full Name" required>
                <input type="email" id="register-email" placeholder="Email" required>
                <input type="password" id="register-password" placeholder="Password" required>
                <button id="register-submit-btn">Register</button>
                <p class="auth-toggle">
                    Already have an account? <a href="#" id="show-login">Login</a>
                </p>
            </div>

            <div id="auth-message" class="auth-message"></div>
        </div>
    </div>
</div>
```

### 6. Add CSS for Login Modal (In styles section)

```css
.login-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100000;
    backdrop-filter: blur(5px);
}

.login-content {
    background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
    padding: 40px;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    min-width: 400px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.login-content h2 {
    color: white;
    margin-bottom: 30px;
    text-align: center;
    font-size: 28px;
}

.login-content input {
    width: 100%;
    padding: 15px;
    margin-bottom: 15px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
    color: white;
    font-size: 16px;
    box-sizing: border-box;
}

.login-content input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.login-content button {
    width: 100%;
    padding: 15px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-bottom: 15px;
}

.login-content button:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
}

.auth-toggle {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
}

.auth-toggle a {
    color: #667eea;
    text-decoration: none;
    font-weight: 600;
}

.auth-toggle a:hover {
    text-decoration: underline;
}

.auth-message {
    margin-top: 15px;
    padding: 12px;
    border-radius: 8px;
    text-align: center;
    font-size: 14px;
    display: none;
}

.auth-message.success {
    background: rgba(76, 175, 80, 0.2);
    color: #4caf50;
    border: 1px solid rgba(76, 175, 80, 0.3);
    display: block;
}

.auth-message.error {
    background: rgba(244, 67, 54, 0.2);
    color: #f44336;
    border: 1px solid rgba(244, 67, 54, 0.3);
    display: block;
}
```

### 7. Add Authentication Event Handlers (After panel initialization)

Add this function after `initializePanel()`:

```javascript
function setupAuthHandlers() {
    const loginModal = document.getElementById('edwin-login-modal');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authMessage = document.getElementById('auth-message');

    // Toggle between login and register
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        document.getElementById('login-modal-title').textContent = 'Create Account';
        authMessage.style.display = 'none';
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        document.getElementById('login-modal-title').textContent = 'Welcome to Edwin AI';
        authMessage.style.display = 'none';
    });

    // Login submit
    document.getElementById('login-submit-btn').addEventListener('click', async () => {
        const canvasId = document.getElementById('login-canvas-id').value;
        const password = document.getElementById('login-password').value;

        if (!canvasId || !password) {
            authMessage.className = 'auth-message error';
            authMessage.textContent = 'Please fill in all fields';
            authMessage.style.display = 'block';
            return;
        }

        const result = await loginUser(canvasId, password);

        if (result.success) {
            authMessage.className = 'auth-message success';
            authMessage.textContent = 'Login successful!';
            authMessage.style.display = 'block';
            setTimeout(() => {
                loginModal.style.display = 'none';
                location.reload(); // Refresh to initialize with session
            }, 1000);
        } else {
            authMessage.className = 'auth-message error';
            authMessage.textContent = result.message || 'Login failed';
            authMessage.style.display = 'block';
        }
    });

    // Register submit
    document.getElementById('register-submit-btn').addEventListener('click', async () => {
        const canvasId = document.getElementById('register-canvas-id').value;
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        if (!canvasId || !name || !email || !password) {
            authMessage.className = 'auth-message error';
            authMessage.textContent = 'Please fill in all fields';
            authMessage.style.display = 'block';
            return;
        }

        const result = await registerUser(canvasId, name, email, password);

        if (result.success) {
            authMessage.className = 'auth-message success';
            authMessage.textContent = 'Registration successful! Please login.';
            authMessage.style.display = 'block';
            setTimeout(() => {
                registerForm.style.display = 'none';
                loginForm.style.display = 'block';
                document.getElementById('login-modal-title').textContent = 'Welcome to Edwin AI';
                authMessage.style.display = 'none';
            }, 2000);
        } else {
            authMessage.className = 'auth-message error';
            authMessage.textContent = result.message || 'Registration failed';
            authMessage.style.display = 'block';
        }
    });

    // Handle Enter key in forms
    ['login-canvas-id', 'login-password'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('login-submit-btn').click();
            }
        });
    });

    ['register-canvas-id', 'register-name', 'register-email', 'register-password'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('register-submit-btn').click();
            }
        });
    });
}
```

### 8. Add Session Check on Panel Open

Modify the Edwin button click handler to check session:

```javascript
a.onclick = async (e) => {
    e.preventDefault();

    // Check if user is logged in
    const isValid = await validateSession();

    if (!isValid) {
        // Show login modal
        document.getElementById('edwin-login-modal').style.display = 'flex';
        return;
    }

    // Check if course ID is detected
    if (!COURSE_ID) {
        alert('Please navigate to a Canvas course page to use Edwin AI');
        return;
    }

    // Normal panel opening logic...
    // (existing code)
};
```

### 9. Add Logout to Settings

In the settings modal, add a logout button and handler:

```javascript
// In settings modal HTML
<button id="edwin-logout-btn" style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);">
    Logout
</button>

// In settings event handlers
document.getElementById('edwin-logout-btn').addEventListener('click', async () => {
    await logoutUser();
    alert('You have been logged out');
    location.reload();
});
```

### 10. Add Canvas Sync Button to Settings

```javascript
// In settings modal HTML
<div class="setting-item">
    <label>Canvas API Token:</label>
    <input type="password" id="canvas-token-input" placeholder="Enter Canvas API token">
    <button id="sync-materials-btn">Sync Course Materials</button>
    <div id="sync-status"></div>
</div>

// In settings event handlers
document.getElementById('sync-materials-btn').addEventListener('click', async () => {
    const canvasToken = document.getElementById('canvas-token-input').value;
    const statusDiv = document.getElementById('sync-status');

    if (!canvasToken) {
        statusDiv.textContent = 'Please enter Canvas API token';
        statusDiv.style.color = '#f44336';
        return;
    }

    statusDiv.textContent = 'Syncing materials...';
    statusDiv.style.color = '#ff9800';

    const result = await syncCanvasMaterials(canvasToken);

    if (result.success) {
        statusDiv.textContent = `Success! ${result.message}`;
        statusDiv.style.color = '#4caf50';
    } else {
        statusDiv.textContent = `Error: ${result.message}`;
        statusDiv.style.color = '#f44336';
    }
});
```

## Testing Instructions

1. Clear localStorage: `localStorage.clear()`
2. Reload Canvas page
3. Click "Edwin AI" button - should show login modal
4. Register a new account
5. Login with credentials
6. Verify chat works with session token
7. Test Canvas material sync in settings
8. Test logout and re-login

## Important Notes

- Session tokens expire after 24 hours
- Course ID is auto-detected from URL
- Canvas API token can be generated at: canvas.asu.edu/profile/settings → "+ New Access Token"
- All API calls now require valid session token
- Materials are synced per course
