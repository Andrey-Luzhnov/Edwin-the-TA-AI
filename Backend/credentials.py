import datetime
import uuid
import mysql.connector
from mysql.connector import Error
import snowflake.connector

def get_db_connectionOLD():
    try:
        connection = mysql.connector.connect(
            host="localhost",
            user="root",
            password="Jmoney1231$#2!",
            database="Edwin"
        )
        return connection
    except Error as e:
        print(f"Error: {e}")
        return None
    
    
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
    
        
# Example Usage:
if __name__ == "__main__":
    # Test the functions here if needed
    pass