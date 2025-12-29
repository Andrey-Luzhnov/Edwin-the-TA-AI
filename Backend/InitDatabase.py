from credentials import get_db_connection


def initialize_database():
    """
    Creates all required tables in Snowflake if they do not already exist.
    """
    connection = get_db_connection()
    if not connection:
        print("ERROR: Could not get Snowflake connection in initialize_database().")
        return False, "Could not connect to Snowflake.", 500

    cursor = connection.cursor()

    # Create tables

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS edwin_messages (
            conv_id VARCHAR(255) NOT NULL,
            user_id VARCHAR(255),
            userorAI BOOLEAN,
            message STRING,
            created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTOINCREMENT PRIMARY KEY,
            canvas_id VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255),
            email VARCHAR(255) UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP,
            used_tokens INT DEFAULT 0,
            openAI_key VARCHAR(255),
            updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS courses (
            id INT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            current_template_id INT,
            updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_courses (
            user_id VARCHAR(255) NOT NULL,
            course_id INT NOT NULL,
            role STRING DEFAULT 'student',
            PRIMARY KEY (user_id, course_id)
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INT AUTOINCREMENT PRIMARY KEY,
            course_id INT NOT NULL,
            user_id VARCHAR(255) NULL, -- allow NULL for unassigned conversations
            conv_id VARCHAR(255) NOT NULL, -- store OpenAI conversation id
            created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP,
            is_assigned BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS course_materials (
            material_id INT AUTOINCREMENT PRIMARY KEY,
            course_id INT NOT NULL,
            title VARCHAR(255),
            content STRING,         -- raw text (syllabus, notes, extracted PDFs, etc.)
            file_url VARCHAR(500),  -- optional link to storage
            source_url VARCHAR(500),  -- URL of scraped Canvas page
            created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quizzes (
            quiz_id INT AUTOINCREMENT PRIMARY KEY,
            course_id INT NOT NULL,
            unit_name VARCHAR(255) NOT NULL,
            material_id INT,
            created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (material_id) REFERENCES course_materials(material_id) ON DELETE SET NULL
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quiz_questions (
            question_id INT AUTOINCREMENT PRIMARY KEY,
            quiz_id INT NOT NULL,
            question_text STRING NOT NULL,
            option_a VARCHAR(500) NOT NULL,
            option_b VARCHAR(500) NOT NULL,
            option_c VARCHAR(500) NOT NULL,
            option_d VARCHAR(500) NOT NULL,
            correct_option CHAR(1) NOT NULL,
            explanation VARCHAR(500),
            created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_quiz_attempts (
            attempt_id INT AUTOINCREMENT PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            course_id INT,
            question_id INT,
            question_text STRING,
            quiz_title STRING,
            selected_option INT,
            correct_option INT,
            is_correct BOOLEAN,
            created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.close()
    connection.close()
    print("SUCCESS: Database initialized successfully.")
    return True, "Database initialized successfully.", 200


def clean_database():
    """
    Drops all tables (if they exist) and then re-initializes the database.
    Returns (status: bool, message: str, http_code: int)
    """
    try:
        connection = get_db_connection()
        if not connection:
            print("ERROR: Could not get Snowflake connection in clean_database().")
            return False, "Could not connect to Snowflake.", 500

        cursor = connection.cursor()

        # Drop tables in order from most dependent to least dependent
        cursor.execute("DROP TABLE IF EXISTS conversation_templates;")
        cursor.execute("DROP TABLE IF EXISTS course_materials;")
        cursor.execute("DROP TABLE IF EXISTS conversations;")
        cursor.execute("DROP TABLE IF EXISTS user_courses;")
        cursor.execute("DROP TABLE IF EXISTS user_quiz_attempts;")
        cursor.execute("DROP TABLE IF EXISTS quiz_questions;")
        cursor.execute("DROP TABLE IF EXISTS quizzes;")
        cursor.execute("DROP TABLE IF EXISTS courses;")
        cursor.execute("DROP TABLE IF EXISTS users;")
        cursor.execute("DROP TABLE IF EXISTS edwin_messages;")

        cursor.close()
        connection.close()

        print("SUCCESS: Database cleaned successfully.")

        # Recreate tables
        status, msg, code = initialize_database()
        if status:
            return True, "Database cleaned and re-initialized successfully.", 200
        else:
            return False, "Database cleaned but re-initialization failed.", 500

    except Exception as e:
        print(f"ERROR: {e}")
        return False, f"ERROR Cleaning Database. {e}", 500


if __name__ == "__main__":
    # If you only want to create tables (no dropping), call:
    # initialize_database()

    # If you want to drop everything and recreate:
    status, message, errorCode = clean_database()
    print(message)
