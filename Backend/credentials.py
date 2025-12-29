# Python 3.14 compatibility fixes
import python314_compat

import snowflake.connector
from snowflake.connector import errors as sf_errors

def get_db_connection():
    """
    Creates and returns a Snowflake connection for the Edwin backend.
    Update the password on your local machine.
    """
    try:
        connection = snowflake.connector.connect(
            user="jahangir",              # Your Snowflake username
            password="Mexinbanu1!@#$",    # Your Snowflake password
            account="GJXBRDO-TRB77657",   # Account identifier from URL
            warehouse="EDWIN_WH",         # Warehouse you created
            database="EDWIN_DB",          # Your database
            schema="PUBLIC"               # Default schema
        )
        return connection

    except sf_errors.Error as e:
        print(f"❌ Snowflake Connection Error: {e}")
        return None


# Optional manual test
if __name__ == "__main__":
    conn = get_db_connection()
    if conn:
        print("✅ Connected to Snowflake successfully!")
