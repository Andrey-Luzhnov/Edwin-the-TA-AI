import requests
import os
import tempfile
from pathlib import Path

CANVAS_BASE_URL = "https://canvas.asu.edu"

def get_canvas_files(course_id, access_token):
    """
    Fetch all files from a Canvas course.
    Returns list of file objects.
    """
    url = f"{CANVAS_BASE_URL}/api/v1/courses/{course_id}/files"
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"per_page": 100}  # Max files per page

    all_files = []
    page = 1

    while True:
        params["page"] = page
        response = requests.get(url, headers=headers, params=params)

        if response.status_code != 200:
            return None, f"Canvas API error: {response.status_code} - {response.text}"

        files = response.json()
        if not files:
            break

        all_files.extend(files)
        page += 1

        # Check if there are more pages
        if 'next' not in response.links:
            break

    return all_files, None

def download_canvas_file(file_url, access_token, save_path=None):
    """
    Download a file from Canvas.
    If save_path is None, saves to temp directory.
    Returns (file_path, error)
    """
    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(file_url, headers=headers)

    if response.status_code != 200:
        return None, f"Download failed: {response.status_code}"

    # Save to temp file if no path specified
    if save_path is None:
        # Extract filename from URL or use temp name
        filename = file_url.split('/')[-1].split('?')[0]
        temp_dir = tempfile.gettempdir()
        save_path = os.path.join(temp_dir, f"edwin_{filename}")

    # Write file
    with open(save_path, 'wb') as f:
        f.write(response.content)

    return save_path, None

def get_course_info(course_id, access_token):
    """
    Get basic course information.
    Returns course object or (None, error)
    """
    url = f"{CANVAS_BASE_URL}/api/v1/courses/{course_id}"
    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        return None, f"Canvas API error: {response.status_code}"

    return response.json(), None

def sync_course_materials(course_id, canvas_token, connection, material_ingestion_funcs):
    """
    Sync all course materials from Canvas to Snowflake.

    Args:
        course_id: Canvas course ID
        canvas_token: Canvas API access token
        connection: Snowflake database connection
        material_ingestion_funcs: dict with 'pdf' and 'pptx' functions

    Returns:
        (success, message, stats)
    """
    # Get all files from Canvas
    files, error = get_canvas_files(course_id, canvas_token)

    if error:
        return False, error, None

    if not files:
        return True, "No files found in course", {"total": 0, "ingested": 0, "skipped": 0}

    stats = {
        "total": len(files),
        "ingested": 0,
        "skipped": 0,
        "errors": []
    }

    # Check which files already exist in database
    cursor = connection.cursor()
    cursor.execute("""
        SELECT file_url FROM course_materials
        WHERE course_id = %s AND file_url IS NOT NULL
    """, (course_id,))

    existing_urls = {row[0] for row in cursor.fetchall()}
    cursor.close()

    # Process each file
    for file in files:
        file_url = file.get('url')
        filename = file.get('display_name', file.get('filename', 'unknown'))
        mime_type = file.get('content-type', '')

        # Skip if already ingested
        if file_url in existing_urls:
            stats["skipped"] += 1
            continue

        # Only process PDF and PPTX files
        if 'pdf' in mime_type.lower() or filename.lower().endswith('.pdf'):
            file_type = 'pdf'
        elif 'presentation' in mime_type.lower() or filename.lower().endswith(('.ppt', '.pptx')):
            file_type = 'pptx'
        else:
            stats["skipped"] += 1
            continue

        # Download file
        temp_path, download_error = download_canvas_file(file_url, canvas_token)

        if download_error:
            stats["errors"].append(f"{filename}: {download_error}")
            continue

        # Ingest file
        try:
            ingest_func = material_ingestion_funcs.get(file_type)
            if ingest_func:
                success, message, error = ingest_func(temp_path, course_id, connection)

                if success:
                    # Update database with file_url
                    cursor = connection.cursor()
                    cursor.execute("""
                        UPDATE course_materials
                        SET file_url = %s
                        WHERE course_id = %s AND title LIKE %s
                    """, (file_url, course_id, f"%{Path(filename).stem}%"))
                    connection.commit()
                    cursor.close()

                    stats["ingested"] += 1
                else:
                    stats["errors"].append(f"{filename}: {error or message}")
            else:
                stats["skipped"] += 1

        except Exception as e:
            stats["errors"].append(f"{filename}: {str(e)}")

        finally:
            # Clean up temp file
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except:
                pass

    summary = f"Synced {stats['ingested']}/{stats['total']} files. {stats['skipped']} skipped."

    if stats["errors"]:
        summary += f" {len(stats['errors'])} errors."

    return True, summary, stats
