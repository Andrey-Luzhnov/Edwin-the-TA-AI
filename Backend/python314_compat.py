"""
Python 3.14 compatibility shims for old Snowflake connector and botocore.
Fixes multiple compatibility issues with packages that haven't been updated yet.
"""
import sys

# Fix 1: CGI module (removed in Python 3.13+)
if sys.version_info >= (3, 13):
    import cgi_shim
    sys.modules['cgi'] = cgi_shim

# Fix 2: collections.Mapping moved to collections.abc (Python 3.10+)
# Old botocore tries to import from collections directly
import collections
import collections.abc

# Add the moved items back to collections for backward compatibility
if not hasattr(collections, 'Mapping'):
    collections.Mapping = collections.abc.Mapping
if not hasattr(collections, 'MutableMapping'):
    collections.MutableMapping = collections.abc.MutableMapping
if not hasattr(collections, 'Iterable'):
    collections.Iterable = collections.abc.Iterable
if not hasattr(collections, 'MutableSet'):
    collections.MutableSet = collections.abc.MutableSet
if not hasattr(collections, 'Callable'):
    collections.Callable = collections.abc.Callable
