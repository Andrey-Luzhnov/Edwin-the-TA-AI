from flask import json
from openai import OpenAI
import snowflake.connector
import fitz  # PyMuPDF (for PDF text/images)
from pptx import Presentation
import io
import base64

API_KEY = "YOUR API KEY HERE"
client = OpenAI(api_key=API_KEY)

connection = snowflake.connector.connect(
    user='USER',
    password='PASSWORD',
    account='ACCOUNT',
    warehouse='WAREHOUSE',
    database='DATABASE',
    schema='PUBLIC'
)

# -----------------------------
# Helper: Build baseline context
# -----------------------------
def get_baseline_context(courseID, connection, limit_chars=2000):
    """
    Fetch course materials from DB and build system baseline context.
    """
    cursor = connection.cursor()
    cursor.execute(
        "SELECT title, content FROM course_materials WHERE course_id = %s",
        (courseID,)
    )
    materials = cursor.fetchall()

    baseline = [
        {"role": "system", "content": f"You are Edwin, the TA AI for course {courseID}."},
        {"role": "system", "content": "Always give concise, helpful answers. Reference course materials when relevant. Give longer answers if you believe it will benefit the student. Add extra details about questions they are asking. Anything for them to get an A. It is okay to go into full depth, extra extra detail about absolutely everything. Paragraphs are great. GO INTO AS SPECIFIC AS POSSIBLE. EVERYTHING YOU KNOW. "}
    ]

    for m in materials:
        title, content = m
        if content:
            baseline.append({
                "role": "system",
                "content": f"Course Material - {title}: {content[:limit_chars]}"
            })

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
def create_blank_conversation(courseID, connection, model="gpt-4o-mini"):
    """
    Create a blank conversation with preloaded baseline course materials.
    Stored in DB without a user_id (unassigned).
    """
    conv = client.conversations.create()
    conv_id = conv.id
    print("NEW BLANK CONVERSATION:", conv_id)

    # preload baseline context
    baseline = get_baseline_context(courseID, connection)
    client.responses.create(
        model=model,
        input=baseline,
        conversation=conv_id
    )

    # store in DB as unassigned
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO conversations (course_id, user_id, conv_id, is_assigned) VALUES (%s, NULL, %s, FALSE)",
        (courseID, conv_id)
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
# Get the user’s active conversation
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
def log_to_snowflake(conv_id, user_id, userorai, message):
    # IF USER SENT MESSAGE, userorai is False. Else True for Edwin.
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO edwin_messages (conv_id, user_id, userorAI, message) VALUES (%s, %s, %s, %s)",
        (conv_id, user_id, userorai, message)
    )
    connection.commit()
    cursor.close()


# --------------------------
# Ask a question in a thread
# --------------------------
def ask_question(user_id, courseID, question, connection, model="gpt-4o-mini"):
    conv_id = get_user_conversation(user_id, courseID, connection)
    if not conv_id:
        return False, "No active thread found. Start a new one first.", None

    # Log user question
    log_to_snowflake(conv_id, user_id, False, question)

    resp = client.responses.create(
        model=model,
        input=[{"role": "user", "content": question}],
        conversation=conv_id
    )
    print(conv_id)
    answer = resp.output[0].content[0].text

    # Log AI answer
    log_to_snowflake(conv_id, user_id, True, answer)

    return True, "Successful message!", answer


if __name__ == "__main__":
    status, message, error = ingest_pdf_to_snowflake("Lab1CSE434.pdf", 231849, connection)
    status, message, error = ingest_pptx_to_snowflake("Chapter_2_v8.0-2.pptx", 231849, connection)
    log_to_snowflake(500, 1, False, "Hello Edwin (and snowflake!)")  # log user question
