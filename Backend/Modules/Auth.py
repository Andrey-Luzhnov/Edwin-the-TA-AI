import secrets
import hashlib
from datetime import datetime, timedelta

# Simple session store (in production, use Redis or database)
active_sessions = {}

def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_session(user_id):
    """Create a new session for user"""
    session_token = secrets.token_urlsafe(32)
    expiry = datetime.now() + timedelta(hours=24)

    active_sessions[session_token] = {
        'user_id': user_id,
        'expiry': expiry
    }

    return session_token

def validate_session(session_token):
    """Check if session is valid and not expired"""
    if session_token not in active_sessions:
        return None

    session = active_sessions[session_token]

    # Check if expired
    if datetime.now() > session['expiry']:
        del active_sessions[session_token]
        return None

    return session['user_id']

def delete_session(session_token):
    """Logout - remove session"""
    if session_token in active_sessions:
        del active_sessions[session_token]
        return True
    return False

def login_user(canvas_id, password, connection):
    """
    Authenticate user with canvas_id and password.
    Returns (success, message, user_id, session_token)
    """
    cursor = connection.cursor()

    # Get user from database
    cursor.execute(
        "SELECT id, password_hash FROM users WHERE canvas_id = %s",
        (canvas_id,)
    )

    row = cursor.fetchone()
    cursor.close()

    if not row:
        return False, "User not found", None, None

    user_id, stored_hash = row

    # Check password
    if stored_hash != hash_password(password):
        return False, "Invalid password", None, None

    # Create session
    session_token = create_session(user_id)

    return True, "Login successful", user_id, session_token

def register_user(canvas_id, name, email, password, connection):
    """
    Register a new user.
    Returns (success, message, user_id)
    """
    cursor = connection.cursor()

    # Check if user already exists
    cursor.execute(
        "SELECT id FROM users WHERE canvas_id = %s",
        (canvas_id,)
    )

    if cursor.fetchone():
        cursor.close()
        return False, "User already exists", None

    # Hash password
    password_hash = hash_password(password)

    # Insert user
    cursor.execute("""
        INSERT INTO users (canvas_id, name, email, password_hash)
        VALUES (%s, %s, %s, %s)
    """, (canvas_id, name, email, password_hash))

    connection.commit()

    # Get user ID (Snowflake uses RESULT_SCAN for last insert ID)
    cursor.execute("SELECT id FROM users WHERE canvas_id = %s", (canvas_id,))
    user_id = cursor.fetchone()[0]

    cursor.close()

    return True, "Registration successful", user_id
