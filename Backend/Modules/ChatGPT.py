from flask import json
import fitz  # PyMuPDF (for PDF text/images)
from pptx import Presentation
import io
import base64
import uuid

# Snowflake Cortex Configuration
CORTEX_MODEL = "llama3-70b"  # Options: llama3-70b, llama3-8b, mistral-large, mixtral-8x7b

# -----------------------------
# Helper: Build baseline context
# -----------------------------
def get_baseline_context(courseID, connection, limit_chars=4000):
    """
    Fetch course materials from DB and build system baseline context.
    """
    cursor = connection.cursor()
    cursor.execute(
        "SELECT title, content FROM course_materials WHERE course_id = %s",
        (courseID,)
    )
    materials = cursor.fetchall()
    cursor.close()

    baseline = f"""You are Edwin, the TA AI for course {courseID}.

Always give concise, helpful answers. Reference course materials when relevant. Give longer answers if you believe it will benefit the student. Add extra details about questions they are asking. Anything for them to get an A. It is okay to go into full depth, extra extra detail about absolutely everything. Paragraphs are great. GO INTO AS SPECIFIC AS POSSIBLE. EVERYTHING YOU KNOW.

COURSE MATERIALS:
"""

    for m in materials:
        title, content = m
        if content:
            baseline += f"\n--- {title} ---\n{content[:limit_chars]}\n"

    return baseline


def ingest_pdf_to_snowflake(file_path, courseID, connection):
    """Extract text + images from PDF and insert into course_materials."""
    doc = fitz.open(file_path)
    full_text = ""
    cursor = connection.cursor()

    for page_num, page in enumerate(doc):
        text = page.get_text()
        full_text += text + "\n"

        # store images as base64 (optional)
        for img_index, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            b64_img = base64.b64encode(image_bytes).decode("utf-8")

            cursor.execute(
                "INSERT INTO course_materials (course_id, title, content) VALUES (%s, %s, %s)",
                (courseID, f"PDF Page {page_num+1} Image {img_index+1}", f"[IMAGE]{b64_img}")
            )

    # store combined text
    cursor.execute(
        "INSERT INTO course_materials (course_id, title, content) VALUES (%s, %s, %s)",
        (courseID, "PDF Full Text", full_text)
    )
    connection.commit()
    cursor.close()
    return True, "PDF ingested successfully", None


def ingest_pptx_to_snowflake(file_path, courseID, connection):
    """Extract text from PPTX and insert into course_materials."""
    prs = Presentation(file_path)
    cursor = connection.cursor()

    for i, slide in enumerate(prs.slides):
        texts = []
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                texts.append(shape.text)
        slide_text = "\n".join(texts)
        print("Ready#")
        cursor.execute(
            "INSERT INTO course_materials (course_id, title, content) VALUES (%s, %s, %s)",
            (courseID, f"Slide {i+1}", slide_text)
        )

    connection.commit()
    cursor.close()
    return True, "PPTX ingested successfully", None


# ---------------------------------------
# Create a blank conversation (no user yet)
# ---------------------------------------
def create_blank_conversation(courseID, connection, model=None):
    """
    Create a blank conversation with preloaded baseline course materials.
    Stored in DB without a user_id (unassigned).
    With Cortex, we just generate a unique conversation ID and store context.
    """
    # Generate unique conversation ID
    conv_id = f"conv_{uuid.uuid4().hex}"
    print("NEW BLANK CONVERSATION:", conv_id)

    # Get baseline context (course materials)
    baseline_context = get_baseline_context(courseID, connection)

    # Store conversation in DB with baseline context
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO conversations (course_id, user_id, conv_id, is_assigned) VALUES (%s, NULL, %s, FALSE)",
        (courseID, conv_id)
    )
    connection.commit()

    # Store baseline context as first system message
    cursor.execute(
        "INSERT INTO edwin_messages (conv_id, user_id, userorAI, message) VALUES (%s, NULL, TRUE, %s)",
        (conv_id, baseline_context)
    )
    connection.commit()
    cursor.close()

    return conv_id


# ------------------------------------
# Start a new thread (assign to a user)
# ------------------------------------
def start_new_thread(user_id, courseID, connection):
    """
    Assigns a user to the next available blank conversation for this course.
    """
    cursor = connection.cursor()

    # find the first unassigned conversation
    cursor.execute("""
        SELECT id, conv_id FROM conversations
        WHERE course_id = %s AND is_assigned = FALSE
        LIMIT 1
    """, (courseID,))
    row = cursor.fetchone()

    if not row:
        cursor.close()
        return False, "No blank conversations available. Pre-generate more.", None

    conv_id = row[1]  # conv_id

    # assign to user
    cursor.execute("""
        UPDATE conversations
        SET user_id = %s, is_assigned = TRUE
        WHERE id = %s
    """, (user_id, row[0]))
    connection.commit()
    cursor.close()

    return True, "New thread started", conv_id


# -------------------------------
# Get the user's active conversation
# -------------------------------
def get_user_conversation(user_id, courseID, connection):
    cursor = connection.cursor()
    cursor.execute("""
        SELECT conv_id FROM conversations
        WHERE course_id = %s AND user_id = %s AND is_assigned = TRUE
        ORDER BY created_at DESC LIMIT 1
    """, (courseID, user_id))
    row = cursor.fetchone()
    cursor.close()
    if row:
        return row[0]
    return None


# -------------------------------
# SNOWFLAKE logging
# -------------------------------
def log_to_snowflake(conv_id, user_id, userorai, message, connection):
    # IF USER SENT MESSAGE, userorai is False. Else True for Edwin.
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO edwin_messages (conv_id, user_id, userorAI, message) VALUES (%s, %s, %s, %s)",
        (conv_id, user_id, userorai, message)
    )
    connection.commit()
    cursor.close()


# -------------------------------
# Get conversation history
# -------------------------------
def get_conversation_history(conv_id, connection, limit=20):
    """
    Retrieve the last N messages from a conversation.
    Returns formatted string for context.
    """
    cursor = connection.cursor()
    cursor.execute("""
        SELECT userorAI, message, created_at
        FROM edwin_messages
        WHERE conv_id = %s
        ORDER BY created_at DESC
        LIMIT %s
    """, (conv_id, limit))

    messages = cursor.fetchall()
    cursor.close()

    # Reverse to get chronological order
    messages = list(reversed(messages))

    # Format conversation history
    history = ""
    for is_ai, message, timestamp in messages:
        if is_ai:
            # Skip the first system message (baseline context) from history
            if "You are Edwin, the TA AI" in message:
                continue
            history += f"Edwin: {message}\n\n"
        else:
            history += f"Student: {message}\n\n"

    return history


# --------------------------
# Ask a question in a thread using Snowflake Cortex
# --------------------------
def ask_question(user_id, courseID, question, connection, model=None):
    """
    Ask a question using Snowflake Cortex AI.
    """
    conv_id = get_user_conversation(user_id, courseID, connection)
    if not conv_id:
        return False, "No active thread found. Start a new one first.", None

    # Log user question
    log_to_snowflake(conv_id, user_id, False, question, connection)

    # Get conversation history
    history = get_conversation_history(conv_id, connection)

    # Get baseline context (first message in conversation)
    cursor = connection.cursor()
    cursor.execute("""
        SELECT message FROM edwin_messages
        WHERE conv_id = %s AND userorAI = TRUE
        ORDER BY created_at ASC
        LIMIT 1
    """, (conv_id,))
    baseline_row = cursor.fetchone()
    baseline_context = baseline_row[0] if baseline_row else ""

    # Build full prompt for Cortex
    full_prompt = f"""{baseline_context}

CONVERSATION HISTORY:
{history}

Student: {question}

Edwin:"""

    # Use Snowflake Cortex to generate response
    cortex_model = model or CORTEX_MODEL
    cursor.execute("""
        SELECT SNOWFLAKE.CORTEX.COMPLETE(%s, %s)
    """, (cortex_model, full_prompt))

    result = cursor.fetchone()
    answer = result[0] if result else "I'm sorry, I couldn't generate a response."

    cursor.close()

    # Log AI answer
    log_to_snowflake(conv_id, user_id, True, answer, connection)

    return True, "Successful message!", answer


if __name__ == "__main__":
    from credentials import get_db_connection
    conn = get_db_connection()
    if conn:
        status, message, error = ingest_pdf_to_snowflake("Lab1CSE434.pdf", 231849, conn)
        status, message, error = ingest_pptx_to_snowflake("Chapter_2_v8.0-2.pptx", 231849, conn)
        log_to_snowflake("test_conv_123", 1, False, "Hello Edwin (and snowflake!)", conn)  # log user question
