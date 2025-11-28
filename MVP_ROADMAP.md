# Edwin AI - MVP Roadmap (2-3 Weeks)

## Current State Analysis

**Overall Completion**: ~30% of vision implemented
- ✅ Basic Q&A works (Snowflake Cortex)
- ✅ Beautiful UI/UX in Canvas
- ✅ Database schema complete
- ❌ No Canvas API integration (95% gap)
- ❌ No AI quiz generation (95% gap)
- ❌ No progress tracking (90% gap)
- ❌ No personalization (100% gap)

---

## MVP Goal Definition

**Minimum Viable Product means**:
1. Students can ask questions and get accurate answers from their course materials
2. Course materials are automatically fetched from Canvas (at least PDFs/slides)
3. AI generates quizzes from course materials automatically
4. Basic progress tracking shows what quizzes completed and score
5. Multi-user, multi-course support (not hardcoded)

**NOT in MVP** (Future features):
- Advanced personalization
- Adaptive difficulty
- Spaced repetition
- Mastery level calculation
- Exam readiness prediction
- Streak tracking

---

## 3-Week Sprint Plan

### **Week 1: Foundation & Canvas Integration (Days 1-7)**

#### **Day 1-2: Authentication & Multi-User Support**
**Goal**: Remove hardcoded USER_ID and COURSE_ID

**Tasks**:
- [ ] Add user login/session management
  - Simple username/password or Canvas OAuth
  - Store session tokens
  - Frontend detects logged-in user
- [ ] Detect current Canvas course from URL
  - Parse course ID from canvas.asu.edu/courses/{id}
  - Pass courseID dynamically to backend
- [ ] Update frontend to use dynamic user/course IDs
- [ ] Add `/login` and `/logout` endpoints
- [ ] Test with 2+ users and 2+ courses

**Acceptance Criteria**:
- ✓ Multiple students can use Edwin in different courses
- ✓ No hardcoded IDs anywhere in code

---

#### **Day 3-5: Canvas API Integration - Material Fetching**
**Goal**: Auto-fetch course materials from Canvas

**Tasks**:
- [ ] Get Canvas API access token (from Canvas settings)
- [ ] Implement Canvas API client in Python
  - List course files endpoint
  - Download file endpoint
  - Get modules/pages endpoint
- [ ] Create `/syncCourseMaterials` backend endpoint
  - Fetches all PDFs, slides, documents from Canvas
  - Downloads files to temp directory
  - Runs `ingest_pdf_to_snowflake()` and `ingest_pptx_to_snowflake()`
  - Stores materials in database
  - Returns sync status
- [ ] Add "Sync Materials" button in frontend settings
- [ ] Handle file deduplication (don't re-ingest same files)
- [ ] Test with real Canvas course

**Acceptance Criteria**:
- ✓ Click "Sync Materials" fetches all course PDFs/slides
- ✓ Materials appear in database
- ✓ AI can answer questions using synced materials
- ✓ Works for any Canvas course

**Resources Needed**:
- Canvas API documentation: https://canvas.instructure.com/doc/api/
- Canvas access token (generate in Canvas profile settings)

---

#### **Day 6-7: Improve Q&A Quality**
**Goal**: Make answers more accurate and attributed

**Tasks**:
- [ ] Implement source attribution
  - Track which material snippet was used in answer
  - Return source reference with answer (e.g., "From Lecture 3 Slide 5")
- [ ] Add answer verification
  - Prompt LLM to cite sources
  - Format: "According to [Material Name]: [Answer]"
- [ ] Improve context retrieval
  - Retrieve most relevant materials instead of all
  - Basic keyword matching for material selection
- [ ] Add "Rate Answer" feedback in UI
  - Thumbs up/down buttons
  - Store feedback in new `message_feedback` table
- [ ] Test answer quality with real course questions

**Acceptance Criteria**:
- ✓ Answers cite which material they came from
- ✓ Students can rate answer quality
- ✓ Responses are accurate to course content

---

### **Week 2: AI Quiz Generation & Backend Quiz System (Days 8-14)**

#### **Day 8-9: AI Quiz Question Generation**
**Goal**: Auto-generate quiz questions from course materials

**Tasks**:
- [ ] Create `generateQuizQuestions()` function
  - Input: course_id, topic/material_id, num_questions
  - Retrieves course material content from database
  - Builds prompt for Snowflake Cortex:
    ```
    Generate {num_questions} multiple choice questions from this content:
    {material_content}

    Format each question as:
    Question: [question text]
    A) [option A]
    B) [option B]
    C) [option C]
    D) [option D]
    Correct: [A/B/C/D]
    Explanation: [why this is correct]
    ```
  - Parses LLM response into structured questions
  - Inserts questions into `quiz_questions` table
  - Returns generated question IDs
- [ ] Create `/generateQuiz` POST endpoint
  - Parameters: courseID, materialID, numQuestions
  - Calls generateQuizQuestions()
  - Creates quiz in `quizzes` table
  - Links questions to quiz
  - Returns quiz_id
- [ ] Test quiz generation with different materials

**Acceptance Criteria**:
- ✓ POST /generateQuiz creates quiz with AI-generated questions
- ✓ Questions are relevant to the material
- ✓ Multiple choice format is valid
- ✓ Explanations are helpful

---

#### **Day 10-11: Quiz API Endpoints**
**Goal**: Complete backend quiz functionality

**Tasks**:
- [ ] Implement `/getQuizzes` GET endpoint
  - Parameters: courseID
  - Returns list of quizzes for course
  - Includes: quiz_id, unit_name, total_questions, user_completed (true/false)
- [ ] Implement `/getQuizQuestions` GET endpoint
  - Parameters: quizID
  - Returns questions for quiz (without correct answers)
  - Randomizes question order
  - Excludes questions user already attempted
- [ ] Implement `/submitQuizAnswer` POST endpoint
  - Parameters: userID, questionID, selectedOption
  - Checks if answer is correct
  - Calls `recordQuizAttempt()` to log attempt
  - Returns: is_correct, explanation, correct_option
- [ ] Implement `/getQuizProgress` GET endpoint
  - Parameters: userID, courseID
  - Returns: completed quizzes, total quizzes, overall score %
- [ ] Update frontend to call real endpoints (not hardcoded questions)

**Acceptance Criteria**:
- ✓ Frontend fetches quizzes from backend
- ✓ Quiz questions loaded dynamically
- ✓ Answers submitted and recorded in database
- ✓ Progress updates after each quiz

---

#### **Day 12-14: Frontend Quiz Integration**
**Goal**: Connect frontend quiz UI to backend

**Tasks**:
- [ ] Remove hardcoded quiz questions from Tampermonkey script
- [ ] Call `/getQuizzes` on Quizzes tab open
  - Display quiz list from backend data
  - Show quiz completion status from backend
- [ ] Call `/getQuizQuestions` when quiz selected
  - Load questions dynamically
  - Display in existing quiz UI
- [ ] Call `/submitQuizAnswer` on answer selection
  - Send user answer to backend
  - Show correct/incorrect immediately
  - Display explanation from backend
- [ ] Update quiz progress bar from `/getQuizProgress`
  - Real completion percentage
  - Real quiz count
- [ ] Add "Generate New Quiz" button
  - Calls `/generateQuiz` for selected material
  - Adds quiz to list
- [ ] Test full quiz flow end-to-end

**Acceptance Criteria**:
- ✓ All quizzes fetched from backend
- ✓ Questions loaded dynamically per quiz
- ✓ Answers submitted and saved
- ✓ Progress bar shows real data
- ✓ Instructors/students can generate new quizzes

---

### **Week 3: Progress Tracking & Polish (Days 15-21)**

#### **Day 15-16: Progress Dashboard Backend**
**Goal**: Build API for student progress data

**Tasks**:
- [ ] Create `/getDashboard` GET endpoint
  - Parameters: userID, courseID
  - Returns dashboard data:
    ```json
    {
      "totalQuizzes": 10,
      "completedQuizzes": 6,
      "averageScore": 78.5,
      "quizScores": [
        {"quizName": "Chapter 1", "score": 80, "date": "2025-11-20"},
        ...
      ],
      "messagesAsked": 45,
      "weakTopics": ["Topic X", "Topic Y"],
      "strongTopics": ["Topic A", "Topic B"]
    }
    ```
  - Queries `user_quiz_attempts` for scores
  - Calculates quiz completion %
  - Identifies weak topics (low quiz scores)
- [ ] Create database view/query for topic performance
  - Group quiz questions by topic (use material_id)
  - Calculate % correct per topic
- [ ] Test dashboard endpoint with sample data

**Acceptance Criteria**:
- ✓ `/getDashboard` returns comprehensive progress data
- ✓ Calculations are accurate
- ✓ Weak/strong topics identified correctly

---

#### **Day 17-18: Progress Dashboard Frontend**
**Goal**: Display real progress in UI

**Tasks**:
- [ ] Add "Progress" tab to Edwin panel
- [ ] Call `/getDashboard` when Progress tab opened
- [ ] Display quiz completion metrics
  - Progress bar with real completion %
  - Total quizzes vs completed
  - Average quiz score
- [ ] Show quiz score history
  - List of completed quizzes with scores
  - Line chart showing score trend over time (optional)
- [ ] Display weak/strong topics
  - "Topics to Review" section (weak topics)
  - "Topics You've Mastered" section (strong topics)
- [ ] Update hardcoded "streak" to show actual quiz activity
  - Count days with quiz activity from database
  - Show real streak number
- [ ] Style progress dashboard

**Acceptance Criteria**:
- ✓ Progress tab shows real data from backend
- ✓ Quiz completion % is accurate
- ✓ Weak/strong topics displayed
- ✓ No hardcoded mock data

---

#### **Day 19-20: Testing & Bug Fixes**
**Goal**: End-to-end testing and critical bug fixes

**Tasks**:
- [ ] Test full user flow:
  1. Student logs in
  2. Opens Edwin in Canvas course
  3. Syncs course materials
  4. Asks questions about materials
  5. Takes AI-generated quiz
  6. Views progress dashboard
- [ ] Test with multiple users and courses
- [ ] Test error cases:
  - No materials synced yet
  - Empty quiz
  - Invalid answers
  - Network failures
- [ ] Fix critical bugs found during testing
- [ ] Performance testing
  - Quiz generation speed
  - Material sync time
  - Q&A response time
- [ ] Add loading states in UI for all API calls
- [ ] Add error messages in UI

**Acceptance Criteria**:
- ✓ All core features work end-to-end
- ✓ No crashes or critical errors
- ✓ Reasonable performance (<5s for most operations)

---

#### **Day 21: Polish & Documentation**
**Goal**: Prepare for MVP demo

**Tasks**:
- [ ] Write user guide (README.md)
  - How to install Tampermonkey script
  - How to set up backend
  - How to sync materials
  - How to use Edwin
- [ ] Write instructor guide
  - How to generate quizzes for course
  - How to view student progress
- [ ] Clean up code comments
- [ ] Remove debug console.logs
- [ ] Polish UI
  - Fix alignment issues
  - Improve error messages
  - Add helpful tooltips
- [ ] Create demo video (3-5 minutes)
  - Show material sync
  - Show Q&A
  - Show quiz generation
  - Show progress tracking
- [ ] Deploy backend to cloud (optional)
  - Heroku, AWS, or DigitalOcean
  - Update frontend with production URL

**Acceptance Criteria**:
- ✓ Documentation is clear and complete
- ✓ UI is polished
- ✓ Demo video showcases all features

---

## MVP Feature Checklist

### Core Features (Must Have)
- [ ] Multi-user authentication
- [ ] Auto-sync Canvas materials (PDFs, slides)
- [ ] AI answers questions from synced materials
- [ ] AI generates quiz questions from materials
- [ ] Students take quizzes with real-time feedback
- [ ] Progress dashboard shows quiz completion & scores
- [ ] Works with any Canvas course

### Secondary Features (Should Have)
- [ ] Source attribution in answers
- [ ] Answer quality feedback (thumbs up/down)
- [ ] Generate quizzes on-demand
- [ ] Weak/strong topic identification
- [ ] Quiz history view

### Nice to Have (If Time Permits)
- [ ] Sync Canvas assignments/discussions
- [ ] Export quiz results
- [ ] Share quizzes between students
- [ ] Dark mode

---

## Success Metrics for MVP

1. **Functionality**: All 7 core features work without errors
2. **Performance**: Material sync <30s, Quiz generation <10s, Q&A <5s
3. **Usability**: New user can set up and use Edwin in <5 minutes
4. **Accuracy**: AI answers are relevant 90%+ of the time
5. **Quiz Quality**: Generated questions match course content

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas API access denied | High | Test with personal Canvas account first, get instructor permission |
| Quiz generation quality low | Medium | Iterate prompts, add question validation |
| Snowflake Cortex rate limits | Medium | Implement caching, use smaller model (llama3-8b) |
| Frontend-backend CORS issues | Low | Already configured, test thoroughly |
| Material sync timeout | Medium | Async processing, show progress bar |

---

## Post-MVP Roadmap (Future)

### Phase 2 (Week 4-6): Personalization
- Adaptive quiz difficulty
- Spaced repetition scheduling
- Learning style detection
- Personalized study plans

### Phase 3 (Week 7-9): Advanced Features
- Exam readiness prediction
- Concept mastery tracking
- Collaborative study groups
- Integration with Canvas grades

### Phase 4 (Week 10+): Scale & Polish
- Multi-university support
- Analytics dashboard for instructors
- Mobile app
- A/B testing for pedagogy effectiveness

---

## Team Responsibilities (If Working with Others)

**Backend Developer**:
- Canvas API integration (Day 3-5)
- Quiz generation (Day 8-9)
- Quiz endpoints (Day 10-11)
- Dashboard endpoint (Day 15-16)

**Frontend Developer**:
- Auth UI (Day 1-2)
- Quiz UI integration (Day 12-14)
- Progress dashboard UI (Day 17-18)
- Polish (Day 21)

**Full-Stack (Solo)**:
- Do in order as listed
- Focus on backend first (more critical)
- Frontend last (already mostly built)

---

## Daily Stand-up Questions

1. What did I complete yesterday?
2. What am I working on today?
3. Am I blocked on anything?
4. Am I on track for the 3-week timeline?

---

## Definition of Done

A feature is "done" when:
- [ ] Code is written and tested
- [ ] Backend endpoint works (test with curl/Postman)
- [ ] Frontend calls endpoint and displays data
- [ ] No console errors
- [ ] Works with real Canvas course data
- [ ] Edge cases handled (empty data, errors)

---

## Go-Live Checklist (End of Week 3)

- [ ] All MVP features tested and working
- [ ] Documentation complete
- [ ] Demo video created
- [ ] Backend deployed (optional)
- [ ] Tampermonkey script published (or shared)
- [ ] At least 2 beta testers try it
- [ ] Critical bugs fixed
- [ ] Performance acceptable

---

## Resources Needed

### APIs & Services
- Canvas API token (get from Canvas account settings)
- Snowflake account (already have)
- Snowflake Cortex enabled (already working)

### Development Tools
- Python 3.11 (already set up)
- Tampermonkey browser extension (already have)
- Postman or curl for API testing
- Git for version control

### Documentation
- Canvas API docs: https://canvas.instructure.com/doc/api/
- Snowflake Cortex docs: https://docs.snowflake.com/en/user-guide/snowflake-cortex
- OpenAI prompt engineering (for quiz generation): https://platform.openai.com/docs/guides/prompt-engineering

---

## Contact & Support

**Stuck on something?**
1. Check documentation first
2. Search Stack Overflow / GitHub issues
3. Ask for help (instructor, peers, forums)
4. Take a break and come back fresh

**Falling behind schedule?**
- Cut scope (remove "nice to have" features)
- Ask for help
- Extend timeline if needed (better to ship late than broken)

---

Good luck building Edwin AI MVP! 🚀
