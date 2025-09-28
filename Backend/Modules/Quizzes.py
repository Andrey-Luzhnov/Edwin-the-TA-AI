import random
import snowflake.connector
from mysql.connector import Error

def get_db_connection():
    try:
        connection = snowflake.connector.connect(
            user='USER',
            password='PASSWORD',
            account='ACCOUNT',
            warehouse='WAREHOUSE',
            database='DATABASE',
            schema='PUBLIC'
        )
        return connection
    except Error as e:
        print(f"Error: {e}")
        return None
    
    
import random

def grab_quiz_question(user_id, quiz_id, connection):
    cursor = connection.cursor()

    # 1. Grab all questions for this quiz
    cursor.execute("""
        SELECT q.question_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d
        FROM quiz_questions q
        WHERE q.quiz_id = %s
    """, (quiz_id,))
    all_questions = cursor.fetchall()
    
    print(all_questions)

    master_list = [
        {
            "question_id": row[0],
            "question_text": row[1],
            "option_a": row[2],
            "option_b": row[3],
            "option_c": row[4],
            "option_d": row[5]
        }
        for row in all_questions
    ]
    
    print(master_list)

    # 2. Find which questions this user already attempted
    cursor.execute("""
        SELECT question_id
        FROM user_quiz_attempts
        WHERE user_id = %s
          AND question_id IN (SELECT question_id FROM quiz_questions WHERE quiz_id = %s)
    """, (user_id, quiz_id))
    attempted_questions = {row[0] for row in cursor.fetchall()}
    print(attempted_questions)

    # 3. Filter master list
    master_list = [q for q in master_list if q["question_id"] not in attempted_questions]

    # 4. Pick up to 3 questions
    selected = random.sample(master_list, min(3, len(master_list)))

    cursor.close()
    return selected

    
def insertQuiz(course_id, unit_name, material_id, connection):
    if not connection:
        return False, "Database connection error", None, 500

    cursor = connection.cursor()

    try:
        # Insert quiz
        cursor.execute("""
            INSERT INTO quizzes (course_id, unit_name, material_id) 
            VALUES (%s, %s, %s)
        """, (course_id, unit_name, material_id))

        # Get quiz_id from RESULT_SCAN
        cursor.execute("SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))")
        quiz_id = cursor.fetchone()[0]  # first column is quiz_id

        connection.commit()
        return True, "Quiz created successfully", quiz_id, 201

    except Exception as e:
        connection.rollback()
        return False, f"ERROR Creating quiz. {e}", None, 500

    
def insertQuizQuestion(quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, connection):
    if not connection:
        return False, "Database connection error", 500
    cursor = connection.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO quiz_questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation))
        connection.commit()
        return True, "Quiz question added successfully", 201
    except Exception as e:
        connection.rollback()
        return False, f"ERROR Adding quiz question. {e}", 500
    
def recordQuizAttempt(user_id, question_id, selected_option, is_correct, connection):
    if not connection:
        return False, "Database connection error", 500
    cursor = connection.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO user_quiz_attempts (user_id, question_id, selected_option, is_correct)
            VALUES (%s, %s, %s, %s)
            """, (user_id, question_id, selected_option, is_correct))
        connection.commit()
        return True, "Quiz attempt recorded successfully", 201
    except Exception as e:
        connection.rollback()
        return False, f"ERROR Recording quiz attempt. {e}", 500
    
def setupQuizQuestions():
    connection = get_db_connection()
    status, message, quizID, error = insertQuiz(231849, "Chapter 1: Introduction", 0, connection)
    print(message)
    print(quizID)
    7
     # CSE434 Computer Networks Chapter 1 Quiz Questions
    # Generated from Chapter 1: Introduction PowerPoint Analysis
    # Question 1
    status, message, error = insertQuizQuestion(quizID, "What is the Internet best described as?", "A single large network owned by one company", "A network of networks interconnecting billions of devices", "A collection of websites and web pages", "A wireless communication system only", "B", "The Internet is fundamentally a 'network of networks' that interconnects billions of computing devices (hosts/end systems) worldwide.", connection)
    print(status, message, error)
    # Question 2
    insertQuizQuestion(quizID, "What do network protocols define?", "Only the format of messages sent between network entities", "Only the order of messages sent between network entities", "The format, order of messages sent/received among network entities, and actions taken", "Only the hardware specifications for network devices", "C", "Protocols define the format, order of messages sent and received among network entities, and the actions taken on message transmission and receipt.", connection)
    # Question 3
    insertQuizQuestion(quizID, "In packet switching with store-and-forward, what must happen before a packet can be transmitted on the next link?", "Only the packet header must arrive at the router", "The entire packet must arrive at the router", "Half of the packet must arrive at the router", "The packet can be forwarded immediately upon arrival", "B", "Store-and-forward means the entire packet must arrive at a router before it can be transmitted on the next link.", connection)
    # Question 4
    insertQuizQuestion(quizID, "Which access network technology provides asymmetric speeds up to 40 Mbps - 1.2 Gbps downstream and 30-100 Mbps upstream?", "DSL (Digital Subscriber Line)", "Ethernet", "HFC (Hybrid Fiber Coax)", "WiFi", "C", "HFC (Hybrid Fiber Coax) cable networks provide asymmetric speeds with up to 40 Mbps - 1.2 Gbps downstream and 30-100 Mbps upstream transmission rates.", connection)
    # Question 5
    insertQuizQuestion(quizID, "The nodal delay in packet switching consists of which four components?", "Processing, queueing, transmission, and propagation delay", "Processing, routing, switching, and forwarding delay", "Transmission, reception, encoding, and decoding delay", "Network, transport, session, and application delay", "A", "Nodal delay = processing delay + queueing delay + transmission delay + propagation delay (dproc + dqueue + dtrans + dprop).", connection)
    # Question 6
    insertQuizQuestion(quizID, "What is a key advantage of packet switching over circuit switching?", "Guaranteed bandwidth for each connection", "No possibility of congestion", "Allows more users to share network resources efficiently", "Provides dedicated end-to-end circuits", "C", "Packet switching allows more users to use the network efficiently by sharing resources, unlike circuit switching which dedicates resources even when not in use.", connection)
    # Question 7
    insertQuizQuestion(quizID, "Which physical medium is immune to electromagnetic noise and can support transmission rates of 10s-100s Gbps?", "Twisted pair copper wire", "Coaxial cable", "Fiber optic cable", "Wireless radio", "C", "Fiber optic cable uses light pulses through glass fiber, is immune to electromagnetic noise, and supports very high-speed transmission (10s-100s Gbps).", connection)
    # Question 8
    insertQuizQuestion(quizID, "In the Internet protocol stack, which layer is responsible for routing datagrams from source to destination?", "Application layer", "Transport layer", "Network layer", "Link layer", "C", "The network layer is responsible for routing datagrams from source to destination and includes IP and routing protocols.", connection)
    # Question 9
    insertQuizQuestion(quizID, "In an end-to-end path, what determines the throughput between sender and receiver?", "The fastest link in the path", "The average speed of all links", "The bottleneck link (slowest link) in the path", "Only the sender's transmission capability", "C", "The end-to-end throughput is constrained by the bottleneck link - the link with the minimum capacity in the end-to-end path.", connection)
    # Question 10
    insertQuizQuestion(quizID, "What are Tier-1 ISPs?", "Local internet service providers serving residential customers", "Small regional networks connecting businesses", "Large commercial ISPs with national and international coverage", "Content delivery networks only", "C", "Tier-1 ISPs are large commercial ISPs (like Level 3, Sprint, AT&T, NTT) that provide national and international coverage and form the core of the Internet.", connection)
    # Question 11
    insertQuizQuestion(quizID, "What is packet sniffing?", "Encrypting packets for secure transmission", "Reading and recording all packets passing by on broadcast media", "Filtering unwanted network traffic", "Compressing packets to reduce bandwidth usage", "B", "Packet sniffing involves using promiscuous network interfaces to read and record all packets passing by, especially on broadcast media like shared Ethernet or wireless.", connection)
    # Question 12
    insertQuizQuestion(quizID, "When does packet loss occur in routers?", "When packets are transmitted too slowly", "When the router's buffer (queue) becomes full", "When packets are too large", "When the network protocol is incorrect", "B", "Packet loss occurs when packets arrive at a router whose buffer is full - the arriving packets are dropped (lost) due to lack of buffer space.", connection)
    # Question 13
    insertQuizQuestion(quizID, "What is the difference between transmission delay and propagation delay?", "There is no difference - they are the same", "Transmission delay is L/R, propagation delay is d/s", "Transmission delay is d/s, propagation delay is L/R", "Both depend only on the packet size", "B", "Transmission delay = L/R (time to push packet onto link), while propagation delay = d/s (time for signal to travel across the physical link).", connection)
    # Question 14
    insertQuizQuestion(quizID, "What is the main benefit of layering in network architecture?", "It makes networks faster", "It reduces the cost of networking equipment", "It provides modularization, making system maintenance and updates easier", "It eliminates the need for protocols", "C", "Layering provides modularization which eases maintenance and updating - changes in one layer's implementation are transparent to the rest of the system.", connection)
    # Question 15
    insertQuizQuestion(quizID, "What were Cerf and Kahn's key internetworking principles that define today's Internet architecture?", "Centralized control, guaranteed service, and stateful routing", "Minimalism, autonomy, best-effort service, stateless routing, and decentralized control", "Maximum complexity, interdependence, and guaranteed delivery", "Proprietary protocols, central management, and circuit switching", "B", "Cerf and Kahn's principles included minimalism, autonomy (no internal changes needed), best-effort service model, stateless routing, and decentralized control.", connection)
    print("WTF#")

setupQuizQuestions()
connection = get_db_connection()
questions = grab_quiz_question(1, 231849, connection)
print(questions)