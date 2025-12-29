# Edwin AI - Complete Demo Flow Guide

**Date:** December 21, 2025
**Version:** v12.0 (Sprint Complete)
**Status:** Ready for Demo

---

## Pre-Demo Checklist

### Backend Setup
- [ ] Backend running: `cd Backend && python !database.py`
- [ ] Health check passing: `curl http://localhost:5000/api/health`
- [ ] Database initialized with sample data
- [ ] Snowflake credentials configured

### Frontend Setup
- [ ] Userscript installed in Tampermonkey
- [ ] Canvas course page accessible
- [ ] Edwin AI button visible in sidebar
- [ ] No red offline banner showing

### Test Data Preparation
- [ ] Course materials synced (syllabus, assignments, modules)
- [ ] Sample quiz attempts logged (for mastery dashboard)
- [ ] Assignment page with due date available

---

## Demo Script (20 minutes)

### Introduction (2 minutes)

**Opening Statement:**
> "Edwin AI is a student-focused teaching assistant that works directly inside Canvas LMS. Unlike traditional chatbots, Edwin is grounded in your actual course materials, can generate personalized quizzes, and helps students break down complex assignments. Let me show you what makes Edwin different."

**Key Points to Highlight:**
- Works entirely within Canvas (no separate app to download)
- Grounded responses backed by course materials
- AI-powered quiz generation and progress tracking
- Assignment breakdown and study planning

---

## Feature 1: Highlight-to-Explain (3 minutes)

### Setup
1. Navigate to course Syllabus page
2. Ensure Edwin panel is closed (to show it opens automatically)

### Demo Steps
1. **Highlight text** (25+ characters):
   - Select a complex paragraph from the syllabus
   - Example: Grading policy, late work policy, exam schedule

2. **Show tooltip**:
   - Purple "💡 Explain selection" button appears above selection
   - Point out smooth hover effect and gradient styling

3. **Click tooltip**:
   - Edwin panel opens automatically
   - Explanation appears with typing animation
   - **Grounded badge** shows "✅ Grounded"
   - **Citations** display below with source links

4. **Toggle feature**:
   - Click ⚙️ Settings
   - Show "Enable Highlight-to-Explain" toggle
   - Demonstrate on/off behavior

### Key Talking Points
- "Students can instantly get explanations for confusing text"
- "Grounded badge confirms the answer comes from course materials"
- "Citations show exactly where the information came from"
- "Feature can be toggled on/off based on preference"

---

## Feature 2: Assignment Helper (4 minutes)

### Setup
1. Navigate to an assignment page (`/courses/XXXXX/assignments/XXXXX`)
2. Ensure assignment has:
   - Clear description
   - Due date visible
   - Instructions/rubric

### Demo Steps
1. **Show auto-detection**:
   - Open Edwin panel
   - Point out "📋 Assignment Helper" section appears
   - Explain it only shows on assignment pages

2. **Summarize What To Do**:
   - Click "📋 Summarize What To Do" button
   - Wait 5-10 seconds for generation
   - Show AI-generated summary with key requirements
   - Point out grounded badge

3. **Make a Checklist**:
   - Click "✅ Make a Checklist" button
   - Show actionable checklist items
   - Point out how it breaks down complex assignments

4. **Generate Study Plan**:
   - Click "📅 Generate Study Plan" button
   - Show day-by-day breakdown until due date
   - Point out time estimates and task prioritization

### Key Talking Points
- "Automatically detects assignment pages - no manual input needed"
- "Breaks down complex assignments into actionable steps"
- "Study plan considers the due date and creates realistic timeline"
- "All responses grounded in assignment instructions and rubric"

---

## Feature 3: Grounded Chat (3 minutes)

### Setup
1. Return to main Edwin panel (click Edwin AI button)
2. Ensure course materials are synced

### Demo Steps
1. **Ask grounded question**:
   - Type: "When is the final exam?"
   - Press Enter
   - Show "✅ Grounded" badge
   - Point out citation from syllabus

2. **Ask ungrounded question**:
   - Type: "What's the capital of France?"
   - Press Enter
   - Show "⚠️ Ungrounded" badge
   - Point out suggestion to sync course materials

3. **Show auto-sync status**:
   - Click ⚙️ Settings
   - Show "Synced X pages • Last sync: Y mins ago"
   - Explain 12-hour cooldown period

### Key Talking Points
- "Edwin tells you when answers are backed by course materials"
- "Ungrounded answers clearly marked - prevents hallucinations"
- "Auto-sync runs in background on supported pages"
- "Students always know the source of information"

---

## Feature 4: Exam Mode (4 minutes)

### Setup
1. Click "Quizzes" tab on left edge
2. Ensure backend has enough synced content for questions

### Demo Steps
1. **Show Exam Mode card**:
   - Point out "🔥 Exam Mode" as first item in quiz list
   - Highlight "COMPREHENSIVE" difficulty badge
   - Explain 20-30 question format

2. **Configure exam**:
   - Click "Start Exam Mode" → modal opens
   - Set number of questions: 25
   - Select difficulty: Mixed
   - Toggle "Enable Timer" on
   - Click "Start Exam"

3. **Take exam**:
   - Show countdown timer (if enabled)
   - Answer 2-3 questions
   - Point out progress indicator (3 of 25)
   - Show question navigation (prev/next)
   - Get one question wrong intentionally

4. **Review screen**:
   - Complete exam (or skip to end for demo)
   - Show wrong answers highlighted in red
   - Point out "Redo Wrong Questions" button
   - Show full explanations with citations

### Key Talking Points
- "Full-length practice exams with 20-30 questions"
- "Optional timer creates realistic test-taking environment"
- "Wrong answers tracked for focused review"
- "Explanations grounded in course materials"

---

## Feature 5: Topic Mastery Dashboard (3 minutes)

### Setup
1. Ensure user has completed some quizzes/exams (for demo data)
2. Click "Progress" tab on left edge

### Demo Steps
1. **Show overall stats**:
   - Point out streak days (e.g., "6 day streak")
   - Show total attempts (e.g., "45 questions answered")
   - Display last active timestamp

2. **Topic cards**:
   - Show topic mastery cards with progress bars
   - Point out color-coded accuracy:
     - **Green** (≥80%): High mastery
     - **Orange** (60-79%): Medium mastery
     - **Red** (<60%): Needs improvement
   - Show number of attempts per topic

3. **Weakest topics section**:
   - Scroll to "Weakest Topics"
   - Show bottom 3 topics by accuracy
   - Click "Practice" button on weak topic
   - Show how it launches targeted quiz

4. **Return to main view**:
   - Click "← Back" button
   - Return to chat interface

### Key Talking Points
- "Students see exactly where they stand on each topic"
- "Color-coded system makes weaknesses obvious"
- "One-click practice on weak areas"
- "Gamification with streak tracking"

---

## Feature 6: Explain This Page (2 minutes)

### Setup
1. Navigate to course Modules page or Announcements
2. Open Edwin panel

### Demo Steps
1. **Explain This Page**:
   - Click ⚙️ Settings
   - Click "📖 Explain This Page"
   - Wait 10-15 seconds for generation
   - Show AI-generated explanation with:
     - Summary
     - Key points
     - Common mistakes/tips

2. **Generate Practice Questions**:
   - Click ⚙️ Settings again
   - Click "❓ Generate Practice Questions"
   - Show practice questions based on current page
   - Point out how questions are contextual

### Key Talking Points
- "Works on any Canvas page - modules, announcements, syllabus"
- "Generates contextual explanations and practice questions"
- "Helps students review before exams"
- "Grounded in actual page content"

---

## Closing: Offline Detection (1 minute)

### Demo Steps
1. **Stop backend**:
   - Press Ctrl+C in backend terminal
   - Wait 2-3 seconds

2. **Show offline banner**:
   - Refresh Canvas page
   - Red banner appears at top:
     > "⚠️ Edwin AI Backend is offline - Please start the backend server"

3. **Restart backend**:
   - Run `python !database.py` again
   - Refresh Canvas page
   - Banner disappears

### Key Talking Points
- "Built-in health monitoring"
- "Clear error messages for students"
- "Graceful degradation when backend is down"

---

## Q&A Talking Points

### Technical Architecture
- **Frontend**: Tampermonkey userscript (vanilla JavaScript)
- **Backend**: Flask REST API with Snowflake Cortex
- **Database**: Snowflake Cloud (stores conversations, quizzes, progress)
- **AI Model**: llama3-70b via Snowflake Cortex
- **Deployment**: Self-hosted backend, browser extension frontend

### Key Features Summary
1. ✅ Highlight-to-Explain - instant explanations
2. ✅ Assignment Helper - break down complex tasks
3. ✅ Grounded Chat - citations and source tracking
4. ✅ Exam Mode - comprehensive practice exams
5. ✅ Topic Mastery - progress tracking and weak area identification
6. ✅ Explain This Page - contextual AI explanations

### Security & Privacy
- User identification via UUID tokens (not real names)
- All data stored in Snowflake (HIPAA/SOC2 compliant)
- No Canvas API access required (DOM scraping only)
- Backend runs locally (full control over data)

### Scalability
- Backend handles concurrent requests
- Auto-sync with 12-hour cooldown prevents API abuse
- Timeouts prevent long-running requests
- Modular frontend architecture

### Future Enhancements
- Vector embeddings for better RAG
- Real-time collaboration
- Mobile responsive design
- Export progress reports
- Integration with Canvas Calendar

---

## Demo Tips

### Do's
✅ Show typing animations (don't skip them)
✅ Point out grounded badges every time
✅ Highlight color-coded UI elements
✅ Explain why features matter to students
✅ Show error handling (offline banner)

### Don'ts
❌ Don't rush through explanations
❌ Don't skip showing citations
❌ Don't forget to highlight auto-detection
❌ Don't use test data that looks fake
❌ Don't ignore loading states

### Recovery from Errors
- **Backend timeout**: Restart backend, refresh page
- **No grounded badge**: Sync page first, then retry
- **Empty mastery dashboard**: Generate sample quiz attempts
- **Assignment helper not showing**: Verify URL contains `/assignments/`

---

## Time Breakdown

| Feature | Time | Priority |
|---------|------|----------|
| Introduction | 2 min | High |
| Highlight-to-Explain | 3 min | High |
| Assignment Helper | 4 min | High |
| Grounded Chat | 3 min | Medium |
| Exam Mode | 4 min | High |
| Topic Mastery | 3 min | Medium |
| Explain This Page | 2 min | Low |
| Offline Detection | 1 min | Low |

**Total: 20 minutes** (adjust based on Q&A)

---

## Success Metrics to Highlight

### Student Benefits
- **Reduced confusion**: Instant explanations for complex text
- **Better preparation**: Comprehensive practice exams
- **Focused studying**: Topic mastery identifies weak areas
- **Time savings**: Assignment breakdown prevents wasted effort

### Instructor Benefits
- **Reduced office hours**: Students get answers 24/7
- **Better engagement**: Gamification with streaks and progress
- **Data insights**: Topic mastery shows class-wide weaknesses
- **No extra work**: Auto-syncs course materials

---

## Post-Demo Checklist

- [ ] Answer questions about deployment
- [ ] Share GitHub repository link
- [ ] Discuss integration timeline
- [ ] Provide testing documentation
- [ ] Schedule follow-up meeting

---

**Status:** READY FOR DEMO 🚀
**Confidence Level:** High
**Estimated Demo Time:** 20 minutes + Q&A

**Good luck with your demo! 🎓🤖**
