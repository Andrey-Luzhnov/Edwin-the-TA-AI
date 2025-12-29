from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import snowflake.connector

from Modules.CourseMaterials import uploadCourseMaterial
from credentials import get_db_connection

TESTING = False

from Modules.Users import register
from Modules.Courses import newCourse
from Modules.Courses import registerUserForCourse
from Modules.ChatGPT import create_blank_conversation, get_user_conversation, ingest_pdf_to_snowflake, ingest_pptx_to_snowflake, start_new_thread
from Modules.ChatGPT import ask_question, generate_quiz
from Modules.Auth import login_user, register_user, validate_session, delete_session
from Modules.CanvasAPI import sync_course_materials
from InitDatabase import clean_database

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Authentication Endpoints
@app.route('/api/register', methods=['POST'])
@cross_origin()
def register_endpoint():
    data = request.get_json()
    canvas_id = data.get("canvasId")
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not all([canvas_id, name, email, password]):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    success, message, user_id = register_user(canvas_id, name, email, password, connection)
    connection.close()

    if success:
        return jsonify({"success": True, "message": message, "userId": user_id}), 201
    else:
        return jsonify({"success": False, "message": message}), 400

@app.route('/api/login', methods=['POST'])
@cross_origin()
def login_endpoint():
    data = request.get_json()
    canvas_id = data.get("canvasId")
    password = data.get("password")

    if not canvas_id or not password:
        return jsonify({"success": False, "message": "Missing canvasId or password"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    success, message, user_id, session_token = login_user(canvas_id, password, connection)
    connection.close()

    if success:
        return jsonify({
            "success": True,
            "message": message,
            "userId": user_id,
            "sessionToken": session_token
        }), 200
    else:
        return jsonify({"success": False, "message": message}), 401

@app.route('/api/logout', methods=['POST'])
@cross_origin()
def logout_endpoint():
    data = request.get_json()
    session_token = data.get("sessionToken")

    if not session_token:
        return jsonify({"success": False, "message": "Missing session token"}), 400

    success = delete_session(session_token)

    if success:
        return jsonify({"success": True, "message": "Logged out successfully"}), 200
    else:
        return jsonify({"success": False, "message": "Invalid session"}), 400

@app.route('/api/validateSession', methods=['POST'])
@cross_origin()
def validate_session_endpoint():
    data = request.get_json()
    session_token = data.get("sessionToken")

    if not session_token:
        return jsonify({"success": False, "message": "Missing session token"}), 400

    user_id = validate_session(session_token)

    if user_id:
        return jsonify({"success": True, "userId": user_id}), 200
    else:
        return jsonify({"success": False, "message": "Invalid or expired session"}), 401

# Canvas Integration Endpoints
@app.route('/api/syncMaterials', methods=['POST'])
@cross_origin()
def sync_materials_endpoint():
    data = request.get_json()
    session_token = data.get("sessionToken")
    course_id = data.get("courseID")
    canvas_token = data.get("canvasToken")

    # Validate session
    user_id = validate_session(session_token)
    if not user_id:
        return jsonify({"success": False, "message": "Invalid or expired session"}), 401

    if not course_id or not canvas_token:
        return jsonify({"success": False, "message": "Missing courseID or canvasToken"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    # Define material ingestion functions
    material_funcs = {
        'pdf': ingest_pdf_to_snowflake,
        'pptx': ingest_pptx_to_snowflake
    }

    success, message, stats = sync_course_materials(
        course_id,
        canvas_token,
        connection,
        material_funcs
    )
    connection.close()

    if success:
        return jsonify({
            "success": True,
            "message": message,
            "stats": stats
        }), 200
    else:
        return jsonify({
            "success": False,
            "message": message
        }), 500

@app.route('/api/syncPageContent', methods=['POST'])
@cross_origin()
def sync_page_content_endpoint():
    """Store DOM-scraped page content from Canvas as course material"""
    data = request.get_json()
    user_id = data.get("userID")
    course_id = data.get("courseID")
    page_title = data.get("pageTitle")
    page_url = data.get("pageURL")
    content = data.get("content")

    if not all([user_id, course_id, page_title, content]):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    if len(content) < 50:
        return jsonify({"success": False, "message": "Content too short to be meaningful"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    try:
        cursor = connection.cursor()

        # Store scraped content as course material
        cursor.execute("""
            INSERT INTO course_materials (course_id, title, content, source_url)
            VALUES (%s, %s, %s, %s)
        """, (course_id, page_title, content, page_url))

        connection.commit()
        cursor.close()
        connection.close()

        return jsonify({
            "success": True,
            "message": f"Page '{page_title}' synced successfully",
            "contentLength": len(content)
        }), 200

    except Exception as e:
        connection.close()
        return jsonify({
            "success": False,
            "message": f"Database error: {str(e)}"
        }), 500

@app.route('/api/getMaterials', methods=['GET'])
@cross_origin()
def get_materials_endpoint():
    """Fetch all course materials for a specific course (OPTIMIZED)"""
    try:
        course_id = request.args.get('courseID')

        if not course_id:
            return jsonify({"success": False, "message": "Course ID is required"}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({"success": False, "message": "Database connection error"}), 500

        cursor = connection.cursor()
        # OPTIMIZATION: Limit to 100 most recent materials for faster loading
        cursor.execute("""
            SELECT material_id, title, created_at
            FROM course_materials
            WHERE course_id = %s
            ORDER BY created_at DESC
            LIMIT 100
        """, (course_id,))

        materials = cursor.fetchall()
        cursor.close()
        connection.close()

        # OPTIMIZATION: Use list comprehension for faster processing
        materials_list = [
            {
                "id": mat[0],
                "title": mat[1],
                "uploadedAt": mat[2].strftime("%Y-%m-%d %H:%M") if mat[2] else "Unknown"
            }
            for mat in materials
        ]

        return jsonify({
            "success": True,
            "materials": materials_list,
            "count": len(materials_list)
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error fetching materials: {str(e)}"
        }), 500

@app.route('/api/deleteMaterial', methods=['DELETE'])
@cross_origin()
def delete_material_endpoint():
    """Delete a course material and its associated content from the database"""
    try:
        data = request.get_json()
        material_id = data.get('materialId')

        if not material_id:
            return jsonify({"success": False, "message": "Material ID is required"}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({"success": False, "message": "Database connection error"}), 500

        cursor = connection.cursor()

        # Delete material from course_materials table
        cursor.execute("""
            DELETE FROM course_materials
            WHERE material_id = %s
        """, (material_id,))

        connection.commit()
        deleted_count = cursor.rowcount

        cursor.close()
        connection.close()

        if deleted_count > 0:
            return jsonify({
                "success": True,
                "message": "Material deleted successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "Material not found"
            }), 404

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error deleting material: {str(e)}"
        }), 500

@app.route('/api/deleteAllMaterials', methods=['DELETE'])
@cross_origin()
def delete_all_materials_endpoint():
    """Delete all course materials for a specific course"""
    try:
        data = request.get_json()
        course_id = data.get('courseID')

        if not course_id:
            return jsonify({"success": False, "message": "Course ID is required"}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({"success": False, "message": "Database connection error"}), 500

        cursor = connection.cursor()

        # Delete all materials for this course
        cursor.execute("""
            DELETE FROM course_materials
            WHERE course_id = %s
        """, (course_id,))

        connection.commit()
        deleted_count = cursor.rowcount

        cursor.close()
        connection.close()

        return jsonify({
            "success": True,
            "message": f"Deleted {deleted_count} material(s) successfully",
            "deletedCount": deleted_count
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error deleting materials: {str(e)}"
        }), 500

@app.route('/api/uploadPDF', methods=['POST'])
@cross_origin()
def upload_pdf_endpoint():
    """Upload and process PDF lecture files"""
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({"success": False, "message": "No file provided"}), 400

        file = request.files['file']

        # Check if filename is empty
        if file.filename == '':
            return jsonify({"success": False, "message": "No file selected"}), 400

        # Check if file is PDF
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({"success": False, "message": "Only PDF files are allowed"}), 400

        # Get form data
        course_id = request.form.get('courseID')
        user_id = request.form.get('userID')

        if not course_id:
            return jsonify({"success": False, "message": "Course ID is required"}), 400

        # Save file temporarily
        import os
        import tempfile

        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, file.filename)
        file.save(temp_path)

        # Get database connection
        connection = get_db_connection()
        if not connection:
            os.remove(temp_path)
            return jsonify({"success": False, "message": "Database connection error"}), 500

        # Ingest PDF to Snowflake
        try:
            success, message, error = ingest_pdf_to_snowflake(temp_path, course_id, connection)

            # Clean up temp file
            os.remove(temp_path)
            connection.close()

            if success:
                return jsonify({
                    "success": True,
                    "message": f"PDF '{file.filename}' uploaded and processed successfully",
                    "filename": file.filename
                }), 200
            else:
                return jsonify({
                    "success": False,
                    "message": message or "Failed to process PDF",
                    "error": error
                }), 500

        except Exception as e:
            os.remove(temp_path)
            connection.close()
            return jsonify({
                "success": False,
                "message": f"Error processing PDF: {str(e)}"
            }), 500

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Upload error: {str(e)}"
        }), 500

@app.route('/register', methods=['POST'])
@cross_origin()
def register2():
    connection = get_db_connection()
    if not connection:
        print("Database connection error")
        return False, "Database connection error", 500
    status, message, error = register(1, "John Doe","email", "password", connection)
    print(message)
    
@app.route('/newCourse', methods=['POST'])
@cross_origin()
def newCourse2():
    connection = get_db_connection()
    if not connection:
        print("Database connection error")
        return False, "Database connection error", 500
    status, message, error = newCourse(231849, "434: Computer Networks", connection)
    print(message)
    
# New conversation endpoint (API prefix)
@app.route('/api/newConversation', methods=['POST'])
@cross_origin()
def new_conversation_api():
    data = request.get_json()
    userID = data.get("userID")
    courseID = data.get("courseID")

    if not userID or not courseID:
        return jsonify({"success": False, "message": "Missing userID or courseID"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    convID = create_blank_conversation(courseID, connection)
    status, message, convID = start_new_thread(userID, courseID, connection)
    connection.close()

    print(message)
    print("Assigned conversation ID:", convID)

    return jsonify({
        "success": status,
        "message": message,
        "conversationID": convID
    }), 200 if status else 500

# OLD ROUTE - Deprecated (kept for backwards compatibility)
@app.route('/newConversation', methods=['POST'])
@cross_origin()
def newConversation():
    print("⚠️ DEPRECATED: Use /api/newConversation instead")
    return new_conversation_api()

def grab_quiz_question():
    data = request.get_json()
    userID = data.get("userID")
    quizID = data.get("quizID")
    
    connection = get_db_connection()
    
# Send message endpoint (API prefix)
@app.route('/api/sendMessage', methods=['POST'])
@cross_origin()
def send_message_api():
    data = request.get_json()

    # Extract values from frontend request
    userID = data.get("userID")
    courseID = data.get("courseID")
    question = data.get("question")

    if not userID or not question or not courseID:
        return jsonify({"success": False, "message": "Missing userID, question, or courseID"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    status, message, response_data = ask_question(
        userID,
        courseID,
        question,
        connection
    )
    connection.close()

    print(message)
    print(question)

    # Check if grounded (has citations)
    grounded = False
    if status and isinstance(response_data, dict):
        citations = response_data.get("citations", [])
        grounded = len(citations) > 0

        print("Answer:", response_data.get("answer"))
        print("Citations:", citations)
        print("Grounded:", grounded)

        return jsonify({
            "success": status,
            "message": message,
            "answer": response_data.get("answer"),
            "citations": citations,
            "grounded": grounded
        }), 200
    else:
        # Fallback for error cases
        return jsonify({
            "success": status,
            "message": message,
            "answer": response_data if isinstance(response_data, str) else "",
            "grounded": False
        }), 200

# OLD ROUTE - Deprecated (kept for backwards compatibility)
@app.route('/sendMessage', methods=['POST'])
@cross_origin()
def sendMessage():
    print("⚠️ DEPRECATED: Use /api/sendMessage instead")
    return send_message_api()

# Generate quiz endpoint (API prefix)
@app.route('/api/generateQuiz', methods=['POST'])
@cross_origin()
def generate_quiz_api():
    data = request.get_json()

    # Extract values from frontend request
    courseID = data.get("courseID")
    topic = data.get("topic", "General Course Review")
    difficulty = data.get("difficulty", "Intermediate")
    num_questions = data.get("numQuestions", 5)  # Default to 5 for faster generation
    material_id = data.get("materialId")  # NEW: Get specific material ID

    print(f"DEBUG API: courseID={courseID}, topic={topic}, material_id={material_id}, num_questions={num_questions}")

    if not courseID:
        return jsonify({"success": False, "message": "Missing courseID"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    status, message, quiz_data = generate_quiz(
        courseID,
        topic,
        difficulty,
        num_questions,
        connection,
        None,        # model - use default
        material_id  # NEW: Pass material ID to generate_quiz from specific material
    )
    connection.close()

    print(message)
    if status:
        print(f"Generated quiz: {quiz_data['title']}")

    return jsonify({
        "success": status,
        "message": message,
        "quiz": quiz_data
    }), 200 if status else 500

# OLD ROUTE - Deprecated (kept for backwards compatibility)
@app.route('/generateQuiz', methods=['POST'])
@cross_origin()
def generateQuiz():
    print("⚠️ DEPRECATED: Use /api/generateQuiz instead")
    return generate_quiz_api()

@app.route('/api/quizAttempt', methods=['POST'])
@cross_origin()
def log_quiz_attempt():
    """Log a quiz question attempt"""
    data = request.get_json()
    user_id = data.get("userID")
    course_id = data.get("courseID")
    question_text = data.get("question")
    selected_option = data.get("selectedOption")
    correct_option = data.get("correctOption")
    is_correct = data.get("isCorrect")
    quiz_title = data.get("quizTitle", "Unknown Quiz")

    if not all([user_id, question_text, selected_option is not None, is_correct is not None]):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    try:
        cursor = connection.cursor()

        # Store quiz attempt with course_id
        cursor.execute("""
            INSERT INTO user_quiz_attempts
            (user_id, course_id, question_text, quiz_title, selected_option, correct_option, is_correct)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_id, course_id, question_text, quiz_title, selected_option, correct_option, is_correct))

        connection.commit()
        cursor.close()
        connection.close()

        return jsonify({
            "success": True,
            "message": "Quiz attempt logged"
        }), 200

    except Exception as e:
        connection.close()
        return jsonify({
            "success": False,
            "message": f"Database error: {str(e)}"
        }), 500

@app.route('/api/progress', methods=['GET'])
@cross_origin()
def get_progress():
    """Get user progress (quiz completion, streak, etc.)"""
    user_id = request.args.get("userID")
    course_id = request.args.get("courseID")

    if not user_id:
        return jsonify({"success": False, "message": "Missing userID"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    try:
        cursor = connection.cursor()

        # Get total quiz attempts (with error handling for missing table)
        try:
            cursor.execute("""
                SELECT COUNT(*) FROM user_quiz_attempts WHERE user_id = %s
            """, (user_id,))
            total_attempts = cursor.fetchone()[0] or 0
        except:
            total_attempts = 0

        # Get correct answers
        try:
            cursor.execute("""
                SELECT COUNT(*) FROM user_quiz_attempts
                WHERE user_id = %s AND is_correct = TRUE
            """, (user_id,))
            correct_answers = cursor.fetchone()[0] or 0
        except:
            correct_answers = 0

        # Calculate accuracy
        accuracy = (correct_answers / total_attempts * 100) if total_attempts > 0 else 0

        # Calculate streak (consecutive days with quiz activity)
        streak = 0
        quiz_stats = []

        try:
            cursor.execute("""
                SELECT DISTINCT DATE(created_at) as quiz_date
                FROM user_quiz_attempts
                WHERE user_id = %s
                ORDER BY quiz_date DESC
                LIMIT 30
            """, (user_id,))
            quiz_dates = cursor.fetchall()

            if quiz_dates:
                from datetime import datetime, timedelta
                today = datetime.now().date()
                current_date = today

                for (quiz_date,) in quiz_dates:
                    if quiz_date == current_date or quiz_date == current_date - timedelta(days=1):
                        streak += 1
                        current_date = quiz_date - timedelta(days=1)
                    else:
                        break
        except:
            pass

        # Get quiz completion by title
        try:
            cursor.execute("""
                SELECT quiz_title, COUNT(*) as questions_answered,
                       SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count
                FROM user_quiz_attempts
                WHERE user_id = %s
                GROUP BY quiz_title
            """, (user_id,))
            quiz_stats = cursor.fetchall()
        except:
            quiz_stats = []

        quizzes_completed = len(quiz_stats)

        cursor.close()
        connection.close()

        return jsonify({
            "success": True,
            "progress": {
                "totalAttempts": total_attempts,
                "correctAnswers": correct_answers,
                "accuracy": round(accuracy, 1),
                "streak": streak,
                "quizzesCompleted": quizzes_completed,
                "quizStats": [
                    {
                        "title": title,
                        "questionsAnswered": questions,
                        "correctCount": correct
                    }
                    for title, questions, correct in quiz_stats
                ]
            }
        }), 200

    except Exception as e:
        connection.close()
        return jsonify({
            "success": False,
            "message": f"Database error: {str(e)}"
        }), 500

@app.route('/syncCanvasMaterials', methods=['POST'])
@cross_origin()
def syncCanvasMaterials():
    data = request.get_json()

    # Extract values from frontend request
    courseID = data.get("courseID")
    canvasToken = data.get("canvasToken")

    if not courseID or not canvasToken:
        return jsonify({"success": False, "message": "Missing courseID or canvasToken"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    # Provide material ingestion functions
    material_funcs = {
        'pdf': ingest_pdf_to_snowflake,
        'pptx': ingest_pptx_to_snowflake
    }

    status, message, stats = sync_course_materials(
        courseID,
        canvasToken,
        connection,
        material_funcs
    )
    connection.close()

    print(message)
    if status and stats:
        print(f"Sync complete: {stats['ingested']} ingested, {stats['skipped']} skipped")

    return jsonify({
        "success": status,
        "message": message,
        "stats": stats
    }), 200 if status else 500


@app.route('/api/insights', methods=['GET'])
@cross_origin()
def get_insights():
    """
    Instructor insights endpoint - read-only analytics for demo purposes.
    Returns aggregated data about course activity, quiz performance, and common topics.
    """
    course_id = request.args.get("courseID")

    if not course_id:
        return jsonify({"success": False, "message": "Missing courseID"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    try:
        cursor = connection.cursor()

        # 1. Active users in last 7 days (from quiz attempts or messages)
        active_users_7d = 0
        try:
            cursor.execute("""
                SELECT COUNT(DISTINCT user_id)
                FROM user_quiz_attempts
                WHERE created_at >= DATEADD(day, -7, CURRENT_TIMESTAMP())
            """)
            active_users_7d = cursor.fetchone()[0] or 0
        except:
            pass

        # 2. Top topics (from course materials titles and synced pages)
        top_topics = []
        try:
            cursor.execute("""
                SELECT title, COUNT(*) as freq
                FROM course_materials
                WHERE course_id = %s
                GROUP BY title
                ORDER BY freq DESC
                LIMIT 5
            """, (course_id,))
            top_topics = [{"topic": title, "frequency": freq} for title, freq in cursor.fetchall()]
        except:
            pass

        # 3. Most missed questions (questions with lowest accuracy)
        most_missed_questions = []
        try:
            cursor.execute("""
                SELECT
                    question_text,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_attempts,
                    ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy
                FROM user_quiz_attempts
                WHERE question_text IS NOT NULL
                GROUP BY question_text
                HAVING COUNT(*) >= 3
                ORDER BY accuracy ASC
                LIMIT 5
            """)
            most_missed_questions = [
                {
                    "question": q_text,
                    "totalAttempts": total,
                    "correctAttempts": correct,
                    "accuracy": acc
                }
                for q_text, total, correct, acc in cursor.fetchall()
            ]
        except:
            pass

        # 4. Quiz accuracy by quiz title
        quiz_accuracy = []
        try:
            cursor.execute("""
                SELECT
                    quiz_title,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_attempts,
                    ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy
                FROM user_quiz_attempts
                WHERE quiz_title IS NOT NULL
                GROUP BY quiz_title
                ORDER BY quiz_title
            """)
            quiz_accuracy = [
                {
                    "quizTitle": title,
                    "totalAttempts": total,
                    "correctAttempts": correct,
                    "accuracy": acc
                }
                for title, total, correct, acc in cursor.fetchall()
            ]
        except:
            pass

        # 5. Recent student questions (from edwin_messages where userorAI = FALSE)
        recent_questions = []
        try:
            cursor.execute("""
                SELECT message, created_at
                FROM edwin_messages
                WHERE userorAI = FALSE
                ORDER BY created_at DESC
                LIMIT 10
            """)
            recent_questions = [
                {"question": msg, "timestamp": str(ts)}
                for msg, ts in cursor.fetchall()
            ]
        except:
            pass

        cursor.close()
        connection.close()

        return jsonify({
            "success": True,
            "insights": {
                "activeUsers7d": active_users_7d,
                "topTopics": top_topics,
                "mostMissedQuestions": most_missed_questions,
                "quizAccuracy": quiz_accuracy,
                "recentQuestions": recent_questions
            }
        }), 200

    except Exception as e:
        connection.close()
        return jsonify({
            "success": False,
            "message": f"Error fetching insights: {str(e)}"
        }), 500

# Health check endpoint
@app.route('/api/health', methods=['GET'])
@cross_origin()
def health_check():
    """Health check endpoint for frontend to verify backend is online"""
    try:
        # Quick database connectivity check
        connection = get_db_connection()
        if connection:
            connection.close()
            return jsonify({
                "success": True,
                "status": "online",
                "message": "Backend is running and database is connected"
            }), 200
        else:
            return jsonify({
                "success": False,
                "status": "degraded",
                "message": "Backend is running but database connection failed"
            }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "status": "error",
            "message": f"Health check failed: {str(e)}"
        }), 500

# Explain page endpoint
@app.route('/api/explainPage', methods=['POST'])
@cross_origin()
def explain_page():
    """Generate explanation or practice questions from page content"""
    data = request.get_json()
    userID = data.get("userID")
    courseID = data.get("courseID")
    pageTitle = data.get("pageTitle")
    content = data.get("content")
    mode = data.get("mode", "explain")  # 'explain' or 'practice'

    if not all([userID, courseID, pageTitle, content]):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    if mode not in ['explain', 'practice']:
        return jsonify({"success": False, "message": "Mode must be 'explain' or 'practice'"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    try:
        cursor = connection.cursor()

        # Limit content to avoid token overflow
        content_preview = content[:3000]

        if mode == 'explain':
            # Generate explanation using Snowflake Cortex
            prompt = f"""You are an educational AI assistant. Analyze the following course page and provide:

1. A brief summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Common mistakes students make with this topic (2-3 points)

Page Title: {pageTitle}
Content:
{content_preview}

Respond in JSON format:
{{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "commonMistakes": ["...", "..."]
}}"""

            cursor.execute(f"""
                SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3-70b', '{prompt.replace("'", "''")}')
            """)
            result = cursor.fetchone()[0]

            # Parse JSON response
            import json
            try:
                explanation_data = json.loads(result)
            except:
                explanation_data = {
                    "summary": result,
                    "keyPoints": [],
                    "commonMistakes": []
                }

            cursor.close()
            connection.close()

            return jsonify({
                "success": True,
                "data": explanation_data
            }), 200

        elif mode == 'practice':
            # Generate practice questions using quiz generation logic
            status, message, quiz_data = generate_quiz(
                courseID,
                f"{pageTitle} Practice",
                "Intermediate",
                5,
                connection,
                None,  # model
                None   # material_id - use all course materials
            )

            connection.close()

            if status:
                return jsonify({
                    "success": True,
                    "data": {
                        "quiz": quiz_data,
                        "message": f"Generated {len(quiz_data.get('questions', []))} practice questions"
                    }
                }), 200
            else:
                return jsonify({
                    "success": False,
                    "message": "Failed to generate practice questions"
                }), 500

    except Exception as e:
        connection.close()
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}"
        }), 500


@app.route('/api/assignmentHelper', methods=['POST'])
@cross_origin()
def assignment_helper():
    """Generate assignment summaries, checklists, or study plans"""
    data = request.get_json()
    userID = data.get("userID")
    courseID = data.get("courseID")
    assignmentText = data.get("assignmentText")
    dueDate = data.get("dueDate")  # Optional
    mode = data.get("mode", "summary")  # 'summary', 'checklist', 'plan'

    if not all([userID, courseID, assignmentText, mode]):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    if mode not in ['summary', 'checklist', 'plan']:
        return jsonify({"success": False, "message": "Mode must be 'summary', 'checklist', or 'plan'"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    try:
        cursor = connection.cursor()

        # Limit content to avoid token overflow
        content_preview = assignmentText[:4000]

        if mode == 'summary':
            prompt = f"""You are an educational AI assistant helping a student understand their assignment.

Assignment:
{content_preview}

Provide a clear, concise summary of what the student needs to do. Include:
1. Main objective (1-2 sentences)
2. Key requirements (3-5 bullet points)
3. Important notes or warnings

Respond in JSON format:
{{
  "summary": "Main objective...",
  "requirements": ["req1", "req2", "req3"],
  "notes": ["note1", "note2"]
}}"""

        elif mode == 'checklist':
            prompt = f"""You are an educational AI assistant creating an actionable checklist for a student.

Assignment:
{content_preview}
{f"Due Date: {dueDate}" if dueDate else ""}

Create a step-by-step checklist of tasks the student should complete. Be specific and actionable.
Include time estimates if the due date is provided.

Respond in JSON format:
{{
  "checklist": [
    {{"task": "Step 1 description", "estimated_hours": 2}},
    {{"task": "Step 2 description", "estimated_hours": 1}}
  ],
  "totalHours": 8,
  "tips": ["tip1", "tip2"]
}}"""

        elif mode == 'plan':
            due_date_info = f"Due Date: {dueDate}\n\n" if dueDate else ""
            prompt = f"""You are an educational AI assistant creating a study plan for a student.

Assignment:
{content_preview}

{due_date_info}Create a day-by-day study plan. Break down the work into manageable daily tasks.
If no due date is provided, create a 7-day plan.

Respond in JSON format:
{{
  "studyPlan": [
    {{"day": 1, "dayLabel": "Today", "tasks": ["task1", "task2"], "hours": 2}},
    {{"day": 2, "dayLabel": "Tomorrow", "tasks": ["task3"], "hours": 1}}
  ],
  "totalDays": 7,
  "advice": ["advice1", "advice2"]
}}"""

        # Execute Snowflake Cortex query
        cursor.execute(f"""
            SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3-70b', '{prompt.replace("'", "''")}')
        """)
        result = cursor.fetchone()[0]

        # Parse JSON response
        import json
        try:
            response_data = json.loads(result)
        except:
            response_data = {
                "summary": result if mode == 'summary' else "",
                "checklist": [] if mode == 'checklist' else None,
                "studyPlan": [] if mode == 'plan' else None
            }

        # Check if response is grounded (has course materials)
        cursor.execute(f"""
            SELECT COUNT(*) FROM COURSE_MATERIALS
            WHERE COURSE_ID = {courseID}
        """)
        materials_count = cursor.fetchone()[0]
        grounded = materials_count > 0

        cursor.close()
        connection.close()

        return jsonify({
            "success": True,
            "mode": mode,
            "data": response_data,
            "grounded": grounded,
            "message": f"Generated {mode} for assignment"
        }), 200

    except Exception as e:
        if connection:
            connection.close()
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}"
        }), 500


@app.route('/api/generateExam', methods=['POST'])
@cross_origin()
def generate_exam():
    """Generate a comprehensive exam with 20-30 questions"""
    data = request.get_json()
    userID = data.get("userID")
    courseID = data.get("courseID")
    topic = data.get("topic", "all")  # Optional topic filter
    numQuestions = data.get("numQuestions", 25)
    difficulty = data.get("difficulty", "mixed")  # 'beginner', 'intermediate', 'advanced', 'mixed'

    if not all([userID, courseID]):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    if numQuestions < 20 or numQuestions > 30:
        return jsonify({"success": False, "message": "Number of questions must be between 20 and 30"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    try:
        # Generate exam using quiz generation logic with higher question count
        topic_str = topic if topic != "all" else "Comprehensive Exam"
        status, message, quiz_data = generate_quiz(
            courseID,
            topic_str,
            difficulty,
            numQuestions,
            connection,
            None,  # model
            None   # material_id - use all course materials
        )

        connection.close()

        if status:
            # Add exam ID for tracking
            import uuid
            exam_id = str(uuid.uuid4())

            return jsonify({
                "success": True,
                "examID": exam_id,
                "topic": topic_str,
                "numQuestions": len(quiz_data.get('questions', [])),
                "questions": quiz_data.get('questions', []),
                "message": f"Generated exam with {len(quiz_data.get('questions', []))} questions"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "Failed to generate exam"
            }), 500

    except Exception as e:
        if connection:
            connection.close()
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}"
        }), 500


@app.route('/api/mastery', methods=['GET'])
@cross_origin()
def get_mastery():
    """Get topic mastery analytics for a user"""
    userID = request.args.get("userID")
    courseID = request.args.get("courseID")

    if not all([userID, courseID]):
        return jsonify({"success": False, "message": "Missing required parameters"}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({"success": False, "message": "Database connection error"}), 500

    try:
        cursor = connection.cursor()

        # Get all quiz attempts grouped by topic
        cursor.execute(f"""
            SELECT
                quiz_title,
                COUNT(*) as attempts,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
                COUNT(*) as total
            FROM user_quiz_attempts
            WHERE user_id = '{userID}' AND course_id = {courseID}
            GROUP BY quiz_title
        """)

        quiz_data = cursor.fetchall()

        topics = []
        for row in quiz_data:
            quiz_title, attempts, correct, total = row
            accuracy = correct / total if total > 0 else 0
            topics.append({
                "topic": quiz_title,
                "attempts": attempts,
                "accuracy": round(accuracy, 2),
                "correct": correct,
                "total": total
            })

        # Sort by accuracy to find weakest topics
        topics_sorted = sorted(topics, key=lambda x: x['accuracy'])
        weakest_topics = topics_sorted[:3] if len(topics_sorted) >= 3 else topics_sorted

        # Calculate overall stats
        cursor.execute(f"""
            SELECT
                COUNT(DISTINCT DATE(created_at)) as streak_days,
                COUNT(*) as total_attempts,
                MAX(created_at) as last_active
            FROM user_quiz_attempts
            WHERE user_id = '{userID}' AND course_id = {courseID}
        """)

        stats = cursor.fetchone()
        streak_days = stats[0] if stats[0] else 0
        total_attempts = stats[1] if stats[1] else 0
        last_active = str(stats[2]) if stats[2] else "Never"

        cursor.close()
        connection.close()

        return jsonify({
            "success": True,
            "topics": topics,
            "weakestTopics": weakest_topics,
            "streakDays": streak_days,
            "totalAttempts": total_attempts,
            "lastActive": last_active
        }), 200

    except Exception as e:
        if connection:
            connection.close()
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}"
        }), 500


if __name__ == "__main__":
    #connection = get_db_connection()
    #status, message, error = ingest_pdf_to_snowflake("Lab1CSE434-2.pdf", 231849, connection)
    #print("Lab 1:",message)
    app.run(debug=True, port=5000, host='0.0.0.0')
    
    if TESTING:
        clean_database()
        connection = get_db_connection()
        status, message, error = register(1, "Andrey","email", "password", connection)
        print(message)
        status, message, error = newCourse(231849, "434: Computer Networks", connection)
        print(message)
        status, message, error = registerUserForCourse(1, 231849, "admin", connection)
        print(message)
        status, message, error = uploadCourseMaterial(231849,"Syllabus","Syllabus: CSE 434 Computer Networks Fall 2025 Syllabus Summary Course Details CSE 434 Computer Networks (SLN 60419), Fall 2025 In-person lectures MW 9:00-10:15am, SCOB 252 Instructor: Dr. Violet R. Syrotiuk (syrotiuk@asu.edu, BYENG 434) TA: Erin Ozcan; UGTAs: Roen Wainscoat, Ashmit Arya Prerequisites & Requirements CSE BSE or CS BS student; CSE 230/EEE 230 + CSE 310 (grade ≥C); Linux/C++/Python competence required Grading Breakdown Lab Assignments: 16% (4 equal weight, using CloudLab/BYENG 217 racks) Homework Sets: 15% (5 equal weight, PrairieLearn) Socket Project: 10% (milestone 3%, full 7%) Quizzes: 9% (best 9 of 10, weekly in-class) Midterm Exams: 24% (2 equal weight, 9/24 & 10/29) Final Exam: 26% (12/10, 7:30-9:20am, comprehensive) Key Dates Labs: L1 out 8/31→due 9/14; L2 out 10/19→due 11/2; L3 out 11/2→due 11/16; L4 out 11/16→due 11/30 Homework: HW1-5 spanning 8/24→12/7 Socket Project: Out 9/14, milestone 9/28, full due 10/19 Quizzes: 10 total from 9/3→12/3 Course Content Fast-paced top-down computer networks covering TCP/IP stack: Ch1: Internet fundamentals (1 week) Ch2: Application layer (1 week) Ch3: Transport layer - UDP/TCP (3.5 weeks) Ch4: Network data plane - routers/IP (2.5 weeks) Ch5: Network control plane - routing/BGP (2 weeks) Ch6: Link layer/LANs (2 weeks) Ch7: Wireless/mobile networks (1 week) Required Text Computer Networking: A Top Down Approach, 8th Edition by Kurose & Ross Key Policies No generative AI allowed - violates academic integrity No late work except excused absences (medical, religious, university events) Mandatory final exam - missing = automatic E grade Appeals: Quiz/HW to TA within 1 week; labs/project to instructor within 1 week Plus/minus grading; class average typically B grade Technology Requirements Laptop required for quizzes/exams (lockdown browser) PrairieLearn system for assessments CloudLab testbed access required early Ed Discussion for Q&A Office Hours Instructor: Mon 10:30-11:30am (BYENG 434), Thu 9-10am (Zoom) TA/UGTA hours TBA on Canvas by 8/31 Important Notes Lectures not recorded; attendance expected Course content copyrighted - no sharing/distribution Two CSE 434 sections share assignments but separate quizzes/exams 15-minute wait time for late instructor","https://drive.google.com/file/d/15Xf4YzZgUFAWxcosnmebkFl038EKBd9n/view?usp=sharing",connection)
        print("Syllabus:",message)
        
        status, message, error = ingest_pdf_to_snowflake("Lab1CSE434.pdf", 231849, connection)
        print("Lab 1:",message)
        status, message, error = ingest_pptx_to_snowflake("Chapter_2_v8.0-2.pptx", 231849, connection)
        print("Chapter 2:",message)
        #status, message, error = uploadCourseMaterial(231849,"Lecture 2 Powerpoint", "", "https://docs.google.com/presentation/d/1GshSHd6uYyXK85D_kh6o2HBUCOeeXQL4/edit?usp=sharing&ouid=115121668957451179940&rtpof=true&sd=true",connection)
        #print("Lecture 2:",message)
        #status, message, error = uploadCourseMaterial(231849,"Lecture 3 Powerpoint", "", "https://docs.google.com/presentation/d/1fPKwpX8gnSI1ynELM2trwAiAuk0nljIY/edit?usp=sharing&ouid=115121668957451179940&rtpof=true&sd=true",connection)
        #print("Lecture 3:",message)
        print("\n--- Conversation Tests ---")

        # Preload 2 blank conversations for this course
        for _ in range(2):
            convID = create_blank_conversation(231849, connection)
            print("Preloaded blank conversation:", convID)

        # Start a new thread for the user (assigns one of the preloaded blanks)
        status, message, convID = start_new_thread(1, 231849, connection)
        print(message)
        print("Assigned conversation ID:", convID)

        # Verify latest assigned conversation for the user
        convID = get_user_conversation(1, 231849, connection)
        print("Latest user conversation ID:", convID)

        # Ask a question inside that conversation
        status, message, answer = ask_question(
            1,
            231849,
            "When are the midterm and final?",
            connection
        )
        print(message)
        print("AI Answer:", answer)
