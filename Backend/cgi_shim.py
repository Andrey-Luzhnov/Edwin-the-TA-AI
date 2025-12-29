"""
CGI module shim for Python 3.13+ compatibility with old Snowflake connector.
The cgi module was removed in Python 3.13, but old versions of botocore still try to import it.
This provides minimal compatibility stubs.
"""

# Minimal parse_qs implementation (now in urllib.parse)
from urllib.parse import parse_qs, parse_qsl

# Add empty stubs for other cgi functions that might be imported
def parse_header(line):
    """Parse a Content-type like header"""
    from email.message import Message
    msg = Message()
    msg['content-type'] = line
    return msg.get_content_type(), dict(msg.get_params()[1:])

def parse_multipart(fp, pdict):
    """Deprecated - not implemented"""
    raise NotImplementedError("parse_multipart is deprecated and not available in Python 3.13+")

class FieldStorage:
    """Minimal FieldStorage stub"""
    def __init__(self, *args, **kwargs):
        raise NotImplementedError("FieldStorage is deprecated and not available in Python 3.13+")

# Export commonly used items
__all__ = ['parse_qs', 'parse_qsl', 'parse_header', 'parse_multipart', 'FieldStorage']
