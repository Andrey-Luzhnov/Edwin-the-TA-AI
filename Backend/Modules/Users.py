
def register(canvasID, name, email, password, connection):
    if not connection:
        return False, "Database connection error", 500
    cursor = connection.cursor()
    
    try:
        cursor.execute("INSERT INTO users (canvas_id, name, email, password_hash, openAI_key) VALUES (%s, %s, %s, %s, %s)",
                       (canvasID, name, email, password, None))
        connection.commit()
        return True, "User registered successfully", 201
    except Exception as e:
        connection.rollback()
        return False, f"ERROR Registering User. {e}", 500
        
        
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                canvas_id VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                used_tokens INT DEFAULT 0,
                openAI_key VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        """)
    