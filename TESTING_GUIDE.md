# Edwin AI - Testing Guide

## Prerequisites

1. **Snowflake Database**: Ensure database is initialized
2. **Backend Running**: Flask server running on http://localhost:5000
3. **Tampermonkey**: Updated script installed in browser
4. **Canvas Course**: Navigate to a Canvas course page (e.g., canvas.asu.edu/courses/231849)

## Testing Authentication System

### Step 1: Start Backend Server

```bash
cd Backend
python !database.py
```

Expected output:
```
* Running on http://0.0.0.0:5000
* Restarting with stat
* Debugger is active!
```

### Step 2: Clear Browser Storage

Open browser console (F12) and run:
```javascript
localStorage.clear()
```

### Step 3: Test Registration

1. Navigate to any Canvas course page
2. Click "Edwin AI" button in sidebar
3. Login modal should appear automatically
4. Click "Register" link
5. Fill in registration form:
   - Canvas ID: `testuser1`
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `password123`
6. Click "Register" button

**Expected Result:**
- Green success message: "Registration successful! Please login."
- Form automatically switches to login after 2 seconds

**Troubleshooting:**
- If error "User already exists": Use different Canvas ID
- If error "Database connection error": Check backend logs
- If error "Missing required fields": All fields must be filled

### Step 4: Test Login

1. After registration, enter credentials:
   - Canvas ID: `testuser1`
   - Password: `password123`
2. Click "Login" button

**Expected Result:**
- Green success message: "Login successful!"
- Page reloads after 1 second
- Edwin panel opens automatically
- Session token stored in localStorage

**Verify Session Storage:**
```javascript
// Run in browser console
console.log(localStorage.getItem('edwin_session_token'));
console.log(localStorage.getItem('edwin_user_id'));
```

### Step 5: Test Chat Functionality

1. Click "Edwin AI" button again
2. Panel should open without showing login modal
3. Type a question: "What are the office hours?"
4. Click "Send"

**Expected Result:**
- Message appears in chat
- AI response appears after a few seconds
- No 401 errors in console

**Check Backend Logs:**
```
Successful message!
What are the office hours?
[AI response text]
```

### Step 6: Test Course ID Detection

1. Navigate to different Canvas course (change course number in URL)
2. Click "Edwin AI" button

**Expected Result:**
- Panel opens for the new course
- Questions are answered based on new course materials

**Verify Course ID:**
```javascript
// Run in browser console
const match = window.location.pathname.match(/\/courses\/(\d+)/);
console.log('Detected Course ID:', match ? match[1] : 'None');
```

### Step 7: Test Canvas Material Sync

1. Click settings button (⚙) in Edwin panel
2. Scroll to "Canvas API Token" section
3. Enter Canvas API token (see below for how to generate)
4. Click "Sync Course Materials"

**Expected Result:**
- Status shows: "Syncing materials..."
- After completion: "Success! Synced X/Y files"
- Backend logs show material ingestion

**Generate Canvas API Token:**
1. Go to https://canvas.asu.edu/profile/settings
2. Scroll to "Approved Integrations"
3. Click "+ New Access Token"
4. Purpose: "Edwin AI Sync"
5. Expiration: (optional)
6. Click "Generate Token"
7. Copy token immediately (only shown once!)

### Step 8: Test Logout

1. Open settings (⚙)
2. Click red "Logout" button
3. Confirm alert

**Expected Result:**
- Alert: "You have been logged out"
- Page reloads
- localStorage cleared
- Next click on "Edwin AI" shows login modal

**Verify Logout:**
```javascript
// Run in browser console after logout
console.log(localStorage.getItem('edwin_session_token')); // Should be null
```

### Step 9: Test Session Expiration

Sessions expire after 24 hours. To test expiration:

**Option 1: Manual Expiration**
1. Login successfully
2. Open browser console
3. Set invalid session token:
```javascript
localStorage.setItem('edwin_session_token', 'invalid_token');
```
4. Click "Edwin AI" button

**Expected Result:**
- Login modal appears
- Session validation fails gracefully

**Option 2: Backend Testing**
Use curl to test session expiration:
```bash
# Login first
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"canvasId":"testuser1","password":"password123"}'

# Save the sessionToken from response

# Validate session (should work)
curl -X POST http://localhost:5000/api/validateSession \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"YOUR_TOKEN_HERE"}'

# Test with invalid token (should fail)
curl -X POST http://localhost:5000/api/validateSession \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"invalid_token"}'
```

### Step 10: Test Multiple Users

1. Logout from testuser1
2. Register new user testuser2
3. Login as testuser2
4. Ask a question
5. Logout and login back as testuser1
6. Check conversation history

**Expected Result:**
- Each user has separate conversation history
- Users cannot access each other's conversations
- Session tokens are user-specific

## Testing Canvas API Integration

### Backend Testing with curl

```bash
# Register user
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "canvasId": "testuser1",
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "canvasId": "testuser1",
    "password": "password123"
  }'

# Save sessionToken and use it below

# Create new conversation
curl -X POST http://localhost:5000/newConversation \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "YOUR_SESSION_TOKEN",
    "courseID": 231849
  }'

# Send message
curl -X POST http://localhost:5000/sendMessage \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "YOUR_SESSION_TOKEN",
    "courseID": 231849,
    "question": "What are the office hours?"
  }'

# Sync Canvas materials
curl -X POST http://localhost:5000/api/syncMaterials \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "YOUR_SESSION_TOKEN",
    "courseID": 231849,
    "canvasToken": "YOUR_CANVAS_API_TOKEN"
  }'
```

## Common Issues and Solutions

### Issue: Login Modal Doesn't Appear
**Symptoms:** Clicking Edwin button does nothing
**Solutions:**
1. Check browser console for JavaScript errors
2. Verify Tampermonkey script is active
3. Check if on Canvas course page (URL should contain /courses/)
4. Reload page and try again

### Issue: 401 Unauthorized Errors
**Symptoms:** Errors in console when sending messages
**Solutions:**
1. Check if session token exists: `localStorage.getItem('edwin_session_token')`
2. Logout and login again
3. Check backend is running
4. Verify session hasn't expired

### Issue: Course ID Not Detected
**Symptoms:** Alert "Please navigate to a Canvas course page"
**Solutions:**
1. Ensure URL contains `/courses/NUMBER`
2. Navigate to course homepage
3. Check console: `window.location.pathname`

### Issue: Canvas Sync Fails
**Symptoms:** Error message during material sync
**Solutions:**
1. Verify Canvas API token is valid
2. Check token hasn't expired
3. Ensure you have access to the course
4. Check backend logs for detailed error
5. Verify Snowflake connection is active

### Issue: Backend Not Responding
**Symptoms:** Network errors in console
**Solutions:**
1. Check backend is running: `python !database.py`
2. Verify port 5000 is not in use
3. Check firewall isn't blocking localhost:5000
4. Test backend: `curl http://localhost:5000/api/validateSession`

### Issue: Database Connection Errors
**Symptoms:** "Database connection error" messages
**Solutions:**
1. Check Snowflake credentials in credentials.py
2. Verify Snowflake warehouse is running
3. Test connection: Run InitDatabase.py
4. Check Snowflake account status

## Success Criteria

All these should work:
- ✓ User can register new account
- ✓ User can login with credentials
- ✓ Session persists across page reloads
- ✓ Course ID auto-detected from URL
- ✓ Chat works with session authentication
- ✓ Canvas materials can be synced
- ✓ User can logout successfully
- ✓ Invalid sessions show login modal
- ✓ Multiple users can use system independently
- ✓ No hardcoded USER_ID or COURSE_ID in code

## Next Steps After Testing

Once authentication is working:

1. **Week 1 Complete**: Authentication ✓, Canvas API ✓
2. **Week 2**: Implement AI quiz generation
3. **Week 3**: Add progress dashboard
4. **Final**: Testing and polish

## Performance Benchmarks

Expected response times:
- Registration: < 1 second
- Login: < 1 second
- Session validation: < 500ms
- Send message: < 5 seconds
- Material sync: < 30 seconds (depends on file count)

## Security Notes

**Important:** This is MVP-level security. For production:
- [ ] Upgrade SHA-256 to bcrypt for password hashing
- [ ] Move sessions from memory to Redis/database
- [ ] Add rate limiting to prevent brute force
- [ ] Use HTTPS for all API calls
- [ ] Add CSRF protection
- [ ] Implement password strength requirements
- [ ] Add account verification via email
- [ ] Add password reset functionality
- [ ] Implement session rotation
- [ ] Add activity logging

## Debug Mode

To enable verbose logging, add to browser console:
```javascript
localStorage.setItem('edwin_debug', 'true');
```

This will show detailed logs for all API calls.

## Contact Support

If issues persist:
1. Check Backend/!database.py console logs
2. Check browser console for JavaScript errors
3. Verify all prerequisites are met
4. Review error messages carefully
5. Test with curl commands to isolate frontend vs backend issues
