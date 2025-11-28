# Edwin TA AI - Backend Setup Guide

## Prerequisites

- Python 3.8 or higher
- Snowflake account (required)
- OpenAI API key (required)

## Installation Steps

### 1. Install Python Dependencies

From the `Backend` directory, run:

```bash
pip install -r requirements.txt
```

### 2. Configure Snowflake Credentials

Edit `credentials.py` and replace the placeholders:

```python
def get_db_connection():
    connection = snowflake.connector.connect(
        user='YOUR_SNOWFLAKE_USER',
        password='YOUR_SNOWFLAKE_PASSWORD',
        account='YOUR_SNOWFLAKE_ACCOUNT',
        warehouse='YOUR_WAREHOUSE_NAME',
        database='YOUR_DATABASE_NAME',
        schema='PUBLIC'
    )
    return connection
```

**How to get Snowflake credentials:**
- Sign up at https://signup.snowflake.com/
- Create a warehouse, database, and schema
- Get your account identifier from Snowflake console

### 3. Configure OpenAI API Key

Edit `Modules/ChatGPT.py` and replace:

```python
API_KEY = "YOUR_OPENAI_API_KEY_HERE"
```

**How to get OpenAI API key:**
- Sign up at https://platform.openai.com/
- Go to API Keys section
- Create a new secret key

### 4. Initialize Database

Run the database initialization script:

```bash
python InitDatabase.py
```

This will create all required tables in Snowflake.

### 5. Start the Server

Run the Flask application:

```bash
python !database.py
```

The server will start on `http://localhost:5000`

## Troubleshooting

### "ModuleNotFoundError: No module named 'flask'"
- Make sure you ran `pip install -r requirements.txt`
- Check you're using the correct Python environment

### Snowflake Connection Errors
- Verify your credentials in `credentials.py`
- Ensure your Snowflake warehouse is running
- Check your account identifier format (should be like `abc12345.us-east-1`)

### OpenAI API Errors
- Verify your API key is valid
- Check you have credits in your OpenAI account
- Ensure you have access to gpt-4o-mini model

## Alternative: Running Without Snowflake

If you want to avoid Snowflake costs, you would need to:
1. Replace Snowflake connector with SQLite or PostgreSQL
2. Modify all database queries in `!database.py`, `ChatGPT.py`, and `Quizzes.py`
3. Update connection logic in `credentials.py`

This would require significant code changes as Snowflake is deeply integrated.
