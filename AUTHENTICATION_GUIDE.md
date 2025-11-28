# Edwin AI - Authentication System Guide

## Overview

The authentication system has been implemented with session-based authentication. Users must now register and login before using Edwin AI.

## Backend Changes

### New Endpoints

1. **POST /api/register**
   - Register a new user
   - Request body:
     ```json
     {
       "canvasId": "string",
       "name": "string",
       "email": "string",
       "password": "string"
     }
     ```
   - Response:
     ```json
     {
       "success": true,
       "message": "Registration successful",
       "userId": 123
     }
     ```

2. **POST /api/login**
   - Login with credentials
   - Request body:
     ```json
     {
       "canvasId": "string",
       "password": "string"
     }
     ```
   - Response:
     ```json
     {
       "success": true,
       "message": "Login successful",
       "userId": 123,
       "sessionToken": "abc123..."
     }
     ```

3. **POST /api/logout**
   - Logout (invalidate session)
   - Request body:
     ```json
     {
       "sessionToken": "abc123..."
     }
     ```

4. **POST /api/validateSession**
   - Check if session is still valid
   - Request body:
     ```json
     {
       "sessionToken": "abc123..."
     }
     ```

### Updated Endpoints

- **POST /newConversation** - Now requires `sessionToken` instead of `userID`
- **POST /sendMessage** - Now requires `sessionToken` instead of `userID`

Both endpoints automatically extract `userID` from the session token.

## Testing with curl

### 1. Register a new user

```bash
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "canvasId": "testuser1",
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "canvasId": "testuser1",
    "password": "password123"
  }'
```

Save the `sessionToken` from the response!

### 3. Create a new conversation (with session)

```bash
curl -X POST http://localhost:5000/newConversation \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "YOUR_SESSION_TOKEN_HERE",
    "courseID": 231849
  }'
```

### 4. Send a message (with session)

```bash
curl -X POST http://localhost:5000/sendMessage \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "YOUR_SESSION_TOKEN_HERE",
    "courseID": 231849,
    "question": "What are the office hours?"
  }'
```

### 5. Logout

```bash
curl -X POST http://localhost:5000/api/logout \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "YOUR_SESSION_TOKEN_HERE"
  }'
```

## Frontend Integration (To Do)

The frontend (Tampermonkey script) needs to be updated to:

1. **Add Login UI**
   - Login form when user first opens Edwin
   - Store sessionToken in localStorage
   - Auto-login if sessionToken exists and is valid

2. **Detect Course ID from URL**
   - Parse `canvas.asu.edu/courses/{courseId}` from browser URL
   - Pass courseID dynamically to API calls

3. **Update API Calls**
   - Add `sessionToken` to all requests
   - Handle 401 errors (redirect to login)
   - Remove hardcoded USER_ID and COURSE_ID

4. **Add Logout Button**
   - Clear localStorage
   - Call /api/logout
   - Show login screen

## Security Notes

- Passwords are hashed with SHA-256 (for production, use bcrypt or Argon2)
- Sessions expire after 24 hours
- Sessions are stored in memory (for production, use Redis or database)
- In production, use HTTPS to encrypt session tokens in transit

## Next Steps

- [ ] Create frontend login UI
- [ ] Update Tampermonkey script to use sessions
- [ ] Add password reset functionality
- [ ] Implement proper password hashing (bcrypt)
- [ ] Move sessions to database or Redis
- [ ] Add rate limiting to prevent brute force attacks
