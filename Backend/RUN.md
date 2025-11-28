# How to Run Edwin TA AI

## ⚠️ Python Version Issue

You're using Python 3.14, which has a compatibility issue with the Snowflake connector (version 1.9.1) - it's missing the `cgi` module that was removed in Python 3.13+.

## Option 1: Install Python 3.11 or 3.12 (Recommended)

1. Download Python 3.11 or 3.12 from https://www.python.org/downloads/
2. Install it
3. Run with the new Python version:
   ```bash
   cd Backend
   py -3.11 -m pip install -r requirements.txt
   py -3.11 "!database.py"
   ```

## Option 2: Install the cgi Module Manually

Install a backport of the cgi module:

```bash
pip install legacycgi
```

Then add this line at the top of `credentials.py`:
```python
import legacycgi as cgi
import sys
sys.modules['cgi'] = cgi
```

## Option 3: Run with Current Setup (May Have Issues)

Try running as-is - it might work for some operations:

```bash
cd Backend
python InitDatabase.py   # Initialize database tables
python "!database.py"    # Start the server
```

## What the Server Does

Once running, the Flask server will:
- Listen on http://localhost:5000
- Provide API endpoints for:
  - User registration
  - Course management
  - Quiz functionality
  - AI conversation with Edwin (via OpenAI)
  - Course materials upload (PDFs, PowerPoints)

## Frontend

To use the frontend (Tampermonkey userscript):
1. Install Tampermonkey browser extension
2. Open `Edwin AI Canvas Chat (Quizzes Section) - Full Panel v10.0-10.0.0.user.js`
3. Navigate to https://canvas.asu.edu/
4. The Edwin AI chat panel should appear

## Troubleshooting

### "ModuleNotFoundError: No module named 'cgi'"
- This means you need to use Option 1 or 2 above
- Python 3.13+ removed the cgi module
- Snowflake connector 1.9.1 still depends on it

### "Snowflake connection error"
- Verify your credentials in `credentials.py`
- Make sure your Snowflake warehouse is running
- Check your account identifier format

### "No module named 'flask'"
- Run: `pip install -r requirements.txt`

## Next Steps After Running

1. Initialize the database (if not done):
   ```bash
   python InitDatabase.py
   ```

2. Start the server:
   ```bash
   python "!database.py"
   ```

3. Server should start on port 5000
4. Install the Tampermonkey userscript for the frontend
5. Navigate to Canvas and start chatting with Edwin!
