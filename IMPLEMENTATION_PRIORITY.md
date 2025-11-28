# Edwin AI - Implementation Priority Guide

## Current Status
✅ **Day 1-2 Complete**: Authentication backend is ready
- Login/Register/Logout endpoints working
- Session management implemented
- `/newConversation` and `/sendMessage` updated to use sessions

## Critical Path to Working MVP

### PHASE 1: Make Current Features Work with Auth (Priority: HIGHEST)
**Goal**: Get the existing Q&A feature working with authentication

**Tasks**:
1. ✅ Backend authentication (DONE)
2. ⏳ Frontend authentication UI (IN PROGRESS)
   - Add login modal to Tampermonkey script
   - Store sessionToken in localStorage
   - Parse courseID from Canvas URL
   - Update all API calls to include sessionToken

**Time**: 2-3 hours
**Benefit**: Existing users can actually use the system

---

### PHASE 2: Canvas API Integration (Priority: HIGH)
**Goal**: Auto-fetch course materials from Canvas

**What's Needed**:
1. Canvas API token (get from Canvas account settings)
2. Backend endpoint `/api/syncMaterials`
3. Canvas API client in Python
4. "Sync Materials" button in UI

**Time**: 1 day
**Benefit**: Removes manual PDF upload requirement - huge usability improvement

---

### PHASE 3: AI Quiz Generation (Priority: HIGH)
**Goal**: Generate quizzes from course materials automatically

**What's Needed**:
1. `generateQuizQuestions()` function using Snowflake Cortex
2. `/api/generateQuiz` endpoint
3. `/api/getQuizzes`, `/api/getQuizQuestions`, `/api/submitQuizAnswer` endpoints
4. Update frontend to fetch quizzes from backend

**Time**: 2 days
**Benefit**: Core value proposition - personalized quizzes

---

### PHASE 4: Progress Dashboard (Priority: MEDIUM)
**Goal**: Show student progress

**What's Needed**:
1. `/api/getDashboard` endpoint
2. Progress tab in UI
3. Analytics calculations

**Time**: 1 day
**Benefit**: Students see their learning progress

---

## Quick Win Implementation Order

### Step 1: Frontend Auth (Do This First)
**File**: `Edwin AI Canvas Chat (Quizzes Section) - Full Panel v10.0-10.0.0.user.js`

**Changes needed**:
```javascript
// Add at top
const BACKEND_URL = 'http://localhost:5000';
let sessionToken = localStorage.getItem('edwinSessionToken');
let currentUserId = localStorage.getItem('edwinUserId');
let currentCourseId = null;

// Detect course from URL
function getCurrentCourseId() {
    const match = window.location.pathname.match(/\/courses\/(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Show login modal if not authenticated
function checkAuth() {
    if (!sessionToken) {
        showLoginModal();
    } else {
        // Validate session
        validateSession();
    }
}

// Add login modal HTML
function showLoginModal() {
    // Create modal with login/register form
}

// Update sendMessage function
async function sendMessage(question) {
    const response = await fetch(`${BACKEND_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionToken: sessionToken,
            courseID: currentCourseId,
            question: question
        })
    });
    // Handle 401 errors -> show login
}
```

**Testing**:
1. Reload Canvas
2. Should see login modal
3. Register/login
4. Try asking a question
5. Should work!

---

### Step 2: Canvas API Integration

**Backend** (`Backend/Modules/CanvasAPI.py`):
```python
import requests

def get_canvas_files(course_id, access_token):
    """Fetch all files from Canvas course"""
    url = f"https://canvas.asu.edu/api/v1/courses/{course_id}/files"
    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(url, headers=headers)
    return response.json()

def download_canvas_file(file_url, access_token):
    """Download file from Canvas"""
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(file_url, headers=headers)
    return response.content
```

**Endpoint** (in `!database.py`):
```python
@app.route('/api/syncMaterials', methods=['POST'])
@cross_origin()
def sync_materials():
    data = request.get_json()
    session_token = data.get("sessionToken")
    course_id = data.get("courseID")
    canvas_token = data.get("canvasToken")

    user_id = validate_session(session_token)
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    # Fetch files from Canvas
    files = get_canvas_files(course_id, canvas_token)

    # Download and ingest PDFs/PPTX
    connection = get_db_connection()
    for file in files:
        if file['mime_type'] == 'application/pdf':
            # Download and ingest
            pass

    return jsonify({"success": True, "filesIngested": len(files)})
```

---

### Step 3: Quiz Generation

**Function** (`Backend/Modules/QuizGenerator.py`):
```python
def generate_quiz_questions(material_id, num_questions, connection):
    """Generate quiz questions using Snowflake Cortex"""

    # Get material content
    cursor = connection.cursor()
    cursor.execute("SELECT content FROM course_materials WHERE id = %s", (material_id,))
    content = cursor.fetchone()[0]

    # Build prompt
    prompt = f"""Generate {num_questions} multiple choice questions from this content:

{content[:3000]}

Format:
Question: [question]
A) [option]
B) [option]
C) [option]
D) [option]
Correct: [A/B/C/D]
Explanation: [explanation]
"""

    # Call Cortex
    cursor.execute("SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3-70b', %s)", (prompt,))
    result = cursor.fetchone()[0]

    # Parse questions
    questions = parse_quiz_response(result)

    # Insert into database
    for q in questions:
        cursor.execute("""
            INSERT INTO quiz_questions
            (question, option_a, option_b, option_c, option_d, correct_option, explanation)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (q['question'], q['A'], q['B'], q['C'], q['D'], q['correct'], q['explanation']))

    connection.commit()
    cursor.close()

    return questions
```

---

## Minimal Viable Path (If Short on Time)

### Must Have (3-4 hours work):
1. ✅ Auth backend (done)
2. Frontend auth (2 hours)
3. Parse courseID from URL (15 min)

### Should Have (1-2 days work):
4. Canvas API sync (1 day)
5. Quiz generation backend (4 hours)
6. Quiz endpoints (2 hours)

### Nice to Have (2-3 days work):
7. Progress dashboard
8. Polish UI
9. Testing

---

## Where to Get Help

### Canvas API Token
1. Go to https://canvas.asu.edu/profile/settings
2. Scroll to "Approved Integrations"
3. Click "+ New Access Token"
4. Purpose: "Edwin AI Development"
5. Expiry: (optional)
6. Click "Generate Token"
7. **COPY THE TOKEN** (you can't see it again!)

### Snowflake Cortex Models
- `llama3-70b` - Best quality, slower
- `llama3-8b` - Fast, good quality
- `mistral-large` - Balanced
- `mixtral-8x7b` - Very fast

### Testing Endpoints
Use Postman or curl:
```bash
# Test login
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"canvasId":"test","password":"test"}'

# Test with session
curl -X POST http://localhost:5000/sendMessage \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"TOKEN","courseID":231849,"question":"test"}'
```

---

## Next Immediate Steps (Do In Order)

1. **Test backend auth with curl** (5 min)
   - Register user
   - Login
   - Get session token
   - Test /sendMessage with token

2. **Update Tampermonkey script** (2 hours)
   - Add login modal
   - Add localStorage for session
   - Parse courseID from URL
   - Update API calls

3. **Test full flow** (30 min)
   - Open Canvas
   - Login through Edwin
   - Ask a question
   - Get answer

4. **Canvas API integration** (1 day)
   - Get Canvas token
   - Create `/api/syncMaterials`
   - Test syncing files

5. **Quiz generation** (1 day)
   - Create quiz generator
   - Add quiz endpoints
   - Update frontend

---

## Success Metrics

After completing minimal viable path:
- [ ] Users can login
- [ ] Users can ask questions in any course
- [ ] System uses Snowflake Cortex for answers
- [ ] No hardcoded user/course IDs

After completing should-have features:
- [ ] Course materials auto-sync from Canvas
- [ ] Quizzes generate automatically
- [ ] Students can take quizzes and see results

---

## Files to Modify

### Backend
1. ✅ `Backend/Modules/Auth.py` (done)
2. ✅ `Backend/!database.py` (auth endpoints done)
3. ⏳ `Backend/Modules/CanvasAPI.py` (create new)
4. ⏳ `Backend/Modules/QuizGenerator.py` (create new)
5. ⏳ Add quiz endpoints to `!database.py`

### Frontend
1. ⏳ `Edwin AI Canvas Chat...user.js` (major updates)

---

Good luck! Start with frontend auth, then Canvas API, then quizzes. Test each step before moving on.
