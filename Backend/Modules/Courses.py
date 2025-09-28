
def newCourse(courseID, name, connection):
    if not connection:
        return False, "Database connection error", 500
    cursor = connection.cursor()
    
    try:
        cursor.execute("INSERT INTO courses (id, name) VALUES (%s, %s)",
                       (courseID, name))
        connection.commit()
        return True, "Course created successfully", 201
    except Exception as e:
        connection.rollback()
        return False, f"ERROR Creating course. {e}", 500
    
    
    cursor.execute("""
            CREATE TABLE IF NOT EXISTS courses (
                id INT UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                current_template_id INT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
    
    cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_courses (
                user_id INT NOT NULL,
                course_id INT NOT NULL,
                role ENUM('admin', 'instructor', 'ta', 'student') DEFAULT 'student',
                PRIMARY KEY (user_id, course_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            );
        """)
    
def registerUserForCourse(userID, courseID, role, connection):
    if not connection:
        return False, "Database connection error", 500
    cursor = connection.cursor()
    
    try:
        cursor.execute("INSERT INTO user_courses (user_id, course_id, role) VALUES (%s, %s, %s)",
                       (userID, courseID, role))
        connection.commit()
        return True, "User registered for course successfully", 201
    except Exception as e:
        connection.rollback()
        return False, f"ERROR Registering User for Course. {e}", 500