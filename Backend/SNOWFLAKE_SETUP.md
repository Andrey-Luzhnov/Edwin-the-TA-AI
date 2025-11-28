# Snowflake Setup Guide for Edwin TA AI

## Step-by-Step Snowflake Configuration

### Step 1: Create a Snowflake Account

1. Go to https://signup.snowflake.com/
2. Choose your cloud provider (AWS, Azure, or GCP)
3. Select your region (choose closest to you for best performance)
4. Complete the signup form with your email
5. Verify your email and set a password
6. You'll get a 30-day free trial with $400 credits

**Important**: Note your account identifier - it looks like `abc12345.us-east-1` or `orgname-accountname`

### Step 2: Log Into Snowflake Web Interface

1. Go to your Snowflake URL (sent via email): `https://<account_identifier>.snowflakecomputing.com`
2. Log in with your username and password
3. You'll see the Snowflake Web UI (called Snowsight)

### Step 3: Create a Warehouse

A warehouse is Snowflake's compute resource that executes queries.

**Option A: Using the Web UI**
1. Click on **Admin** → **Warehouses** in the left menu
2. Click **+ Warehouse** button (top right)
3. Configure:
   - **Name**: `EDWIN_WH` (or any name you prefer)
   - **Size**: `X-Small` (smallest/cheapest option, sufficient for this project)
   - **Auto Suspend**: `5 minutes` (saves costs)
   - **Auto Resume**: `Enabled`
4. Click **Create Warehouse**

**Option B: Using SQL**
1. Click on **Worksheets** in the left menu
2. Click **+ Worksheet** button
3. Run this SQL:

```sql
CREATE WAREHOUSE EDWIN_WH
  WITH WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 300
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = FALSE;
```

### Step 4: Create a Database

**Option A: Using the Web UI**
1. Click on **Data** → **Databases** in the left menu
2. Click **+ Database** button (top right)
3. Enter name: `EDWIN_DB` (or any name you prefer)
4. Click **Create**

**Option B: Using SQL**

In your Worksheet, run:

```sql
CREATE DATABASE EDWIN_DB;
```

### Step 5: Create a Schema (Optional)

The default `PUBLIC` schema is already created with every database, so you can use that.

If you want a custom schema:

```sql
USE DATABASE EDWIN_DB;
CREATE SCHEMA EDWIN_SCHEMA;
```

For this project, we'll use the default `PUBLIC` schema.

### Step 6: Set Context (Use the Database)

Run these commands to set your working context:

```sql
USE WAREHOUSE EDWIN_WH;
USE DATABASE EDWIN_DB;
USE SCHEMA PUBLIC;
```

### Step 7: Gather Your Credentials

You'll need these values for `credentials.py`:

| Parameter | Where to Find It | Example |
|-----------|-----------------|---------|
| **user** | Your login username | `ADMIN` or `YOUR_EMAIL` |
| **password** | Your login password | `YourPassword123!` |
| **account** | Account identifier from URL or Admin→Accounts | `abc12345.us-east-1` or `orgname-accountname` |
| **warehouse** | Warehouse name you created | `EDWIN_WH` |
| **database** | Database name you created | `EDWIN_DB` |
| **schema** | Schema name (default is PUBLIC) | `PUBLIC` |

**To find your account identifier:**
- Look at your Snowflake URL: `https://ABC12345.snowflakecomputing.com` → account is `ABC12345`
- Or go to **Admin** → **Accounts** → copy the **Account Locator**
- For newer accounts, it might be in format `orgname-accountname`

### Step 8: Update credentials.py

Edit `Backend/credentials.py` and replace the placeholders:

```python
def get_db_connection():
    connection = snowflake.connector.connect(
        user='ADMIN',                    # Your Snowflake username
        password='YourPassword123!',      # Your Snowflake password
        account='abc12345.us-east-1',    # Your account identifier
        warehouse='EDWIN_WH',             # Warehouse name you created
        database='EDWIN_DB',              # Database name you created
        schema='PUBLIC'                   # Schema name (PUBLIC is default)
    )
    return connection
```

### Step 9: Initialize the Database Tables

From the Backend directory, run:

```bash
python InitDatabase.py
```

This will create all 9 required tables:
- `users` - User accounts and OpenAI keys
- `courses` - Course information
- `user_courses` - User-course enrollments
- `conversations` - OpenAI conversation threads
- `course_materials` - PDFs, slides, notes
- `quizzes` - Quiz definitions
- `quiz_questions` - Quiz questions and answers
- `user_quiz_attempts` - Student quiz submissions
- `edwin_messages` - Chat message logs

### Step 10: Verify Setup

**Option A: In Snowflake Web UI**
1. Go to **Data** → **Databases** → **EDWIN_DB** → **PUBLIC** → **Tables**
2. You should see 9 tables listed
3. Click on any table to view its structure

**Option B: Using SQL**

In a Worksheet, run:

```sql
USE DATABASE EDWIN_DB;
USE SCHEMA PUBLIC;

SHOW TABLES;
```

You should see all 9 tables.

**Option C: Test the Python connection**

Create a test file `test_connection.py`:

```python
from credentials import get_db_connection

try:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT CURRENT_VERSION()")
    version = cursor.fetchone()
    print(f"✓ Connected to Snowflake! Version: {version[0]}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"✗ Connection failed: {e}")
```

Run it:
```bash
python test_connection.py
```

## Cost Management Tips

Snowflake charges for:
1. **Compute** (warehouse usage) - Charged per second when warehouse is running
2. **Storage** (data stored) - Charged per TB per month

**To minimize costs:**

1. **Use X-Small warehouse**: Smallest size, cheapest compute
2. **Enable Auto-Suspend**: Warehouse stops after 5 minutes of inactivity
3. **Monitor credits**: Go to **Admin** → **Usage** to track consumption
4. **Stop warehouse when not in use**:
   ```sql
   ALTER WAREHOUSE EDWIN_WH SUSPEND;
   ```
5. **Free trial**: You get $400 credits for 30 days - plenty for development

## Troubleshooting

### "Invalid account identifier"
- Make sure your account identifier includes the region: `abc12345.us-east-1`
- For newer accounts, use format: `orgname-accountname`
- Don't include `https://` or `.snowflakecomputing.com`

### "Incorrect username or password"
- Usernames are case-insensitive in Snowflake
- Passwords are case-sensitive
- Try resetting password in Snowflake Web UI

### "Object does not exist: warehouse 'EDWIN_WH'"
- Check the warehouse name matches exactly (case-insensitive)
- Make sure the warehouse is created and not suspended
- Run `SHOW WAREHOUSES;` in Snowflake UI to verify

### "002003: Compilation error: Database 'EDWIN_DB' does not exist"
- Make sure you created the database
- Run `SHOW DATABASES;` to verify
- Check spelling matches exactly

### Connection timeout
- Check your firewall/network settings
- Snowflake needs outbound HTTPS (port 443) access
- Try from a different network

## Next Steps

After Snowflake is configured:

1. **Configure OpenAI API key** in `Modules/ChatGPT.py`
2. **Run the Flask server**: `python !database.py`
3. **Test the API**: Server should start on http://localhost:5000

## Alternative: Free Database Options

If you want to avoid Snowflake costs entirely, I can help you migrate to:
- **SQLite**: Completely free, no setup, file-based
- **PostgreSQL**: Free, open-source, more powerful than SQLite
- **MySQL**: Free, open-source

This would require code changes in the database connection and query logic.
