"""
Setup script to initialize Snowflake database for Edwin AI
Run this after updating your credentials in credentials.py
"""

from credentials import get_db_connection
from InitDatabase import initialize_database

def main():
    print("Setting up Snowflake database for Edwin AI...")
    print("")

    # Test connection
    print("1. Testing Snowflake connection...")
    conn = get_db_connection()

    if not conn:
        print("FAILED to connect to Snowflake!")
        print("")
        print("Please check:")
        print("  1. Did you update your password in Backend/credentials.py?")
        print("  2. Did you create EDWIN_DB and EDWIN_WH in Snowflake?")
        print("  3. Is your account identifier correct?")
        return

    print("SUCCESS: Connected to Snowflake successfully!")
    conn.close()
    print("")

    # Initialize database tables
    print("2. Creating database tables...")
    success = initialize_database()

    if success:
        print("SUCCESS: Database tables created successfully!")
        print("")
        print("Setup complete! You can now run: py -3.11 Backend/!database.py")
    else:
        print("FAILED: Could not create database tables")
        print("Check the error messages above for details")

if __name__ == "__main__":
    main()
