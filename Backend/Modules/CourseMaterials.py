

def uploadCourseMaterial(course_id, title, content, file_url, connection):
    """
    Uploads a course material to the specified course.

    :param course_id: ID of the course to which the material will be uploaded
    :param material: The material file to be uploaded
    :return: Confirmation message or error
    """
    if not connection:
        return False, "Database connection error", 500  
    cursor = connection.cursor()
    
    try:
        cursor.execute("INSERT INTO course_materials (course_id, title, content, file_url) VALUES (%s, %s, %s, %s)",(course_id, title, content, file_url))
        connection.commit()
        return True, "Course material uploaded successfully", 201
    except Exception as e:
        connection.rollback()
        return False, f"ERROR Uploading Course Material. {e}", 500


'''
cursor.execute("""
            CREATE TABLE IF NOT EXISTS course_materials (
                material_id INT AUTO_INCREMENT PRIMARY KEY,
                course_id INT NOT NULL,
                title VARCHAR(255),
                content LONGTEXT,     -- store raw text (syllabus, notes, extracted PDFs, etc.)
                file_url VARCHAR(500), -- optional link to storage (S3, GCP bucket, etc.)
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            );
        """)
'''