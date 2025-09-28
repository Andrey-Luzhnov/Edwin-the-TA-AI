from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from flask_cors import cross_origin
import random
import smtplib
import sys
import os
import snowflake.connector

from Modules.CourseMaterials import uploadCourseMaterial
from credentials import get_db_connection

TESTING = False

from Modules.Users import register
from Modules.Courses import newCourse
from Modules.Courses import registerUserForCourse
from Modules.ChatGPT import create_blank_conversation, get_user_conversation, ingest_pdf_to_snowflake, ingest_pptx_to_snowflake, start_new_thread
from Modules.ChatGPT import ask_question
from InitDatabase import clean_database

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

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
    
@app.route('/newConversation', methods=['POST'])
@cross_origin()
def newConversation():
    data = request.get_json()
    userID = data.get("userID")
    courseID = data.get("courseID")
    
    connection = get_db_connection()
    convID = create_blank_conversation(courseID, connection)
    status, message, convID = start_new_thread(userID, courseID, connection)
    print(message)
    print("Assigned conversation ID:", convID)
    return True, "Successful new conversation!", 200

def grab_quiz_question():
    data = request.get_json()
    userID = data.get("userID")
    quizID = data.get("quizID")
    
    connection = get_db_connection()
    
@app.route('/sendMessage', methods=['POST'])
def sendMessage():
    data = request.get_json()

    # Extract values from frontend request
    userID = data.get("userID")
    courseID = data.get("courseID")
    question = data.get("question")

    connection = get_db_connection()
    status, message, answer = ask_question(
        userID,
        courseID,
        question,
        connection
    )

    print(message)
    print(question)
    print(answer)

    return jsonify({
        "success": status,
        "message": message,
        "answer": answer
    }), 200
    
    
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
