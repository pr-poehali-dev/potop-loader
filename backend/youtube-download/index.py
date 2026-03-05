"""
Скачивание YouTube видео через yt-dlp и загрузка в S3.
Возвращает CDN-ссылку для воспроизведения и скачивания.
"""
import json
import os
import re
import tempfile
import uuid
import boto3
import psycopg2
import yt_dlp

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def extract_video_id(url: str) -> str | None:
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
        r"youtube\.com/shorts/([a-zA-Z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        url = body.get("url", "").strip()
        quality = body.get("quality", "1080p")
    except Exception:
        return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Неверный формат запроса"})}

    if not url:
        return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "URL не указан"})}

    video_id = extract_video_id(url)
    if not video_id:
        return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Неверная ссылка YouTube"})}

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        f"SELECT cdn_url, title, author, duration FROM {SCHEMA}.videos WHERE video_id=%s AND quality=%s AND status='ready' ORDER BY created_at DESC LIMIT 1",
        (video_id, quality),
    )
    row = cur.fetchone()
    if row:
        cur.close()
        conn.close()
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "cdn_url": row[0],
                "title": row[1],
                "author": row[2],
                "duration": row[3],
                "cached": True,
            }, ensure_ascii=False),
        }

    record_id = str(uuid.uuid4())
    cur.execute(
        f"INSERT INTO {SCHEMA}.videos (id, video_id, quality, status) VALUES (%s, %s, %s, 'processing')",
        (record_id, video_id, quality),
    )
    conn.commit()

    proxy = os.environ.get("YT_PROXY", "")

    with tempfile.TemporaryDirectory() as tmpdir:
        out_template = os.path.join(tmpdir, "%(id)s.%(ext)s")

        if quality == "audio":
            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "format": "bestaudio/best",
                "outtmpl": out_template,
                "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}],
                "proxy": proxy,
            }
            ext = "mp3"
            content_type = "audio/mpeg"
        else:
            height = int(quality.replace("p", ""))
            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "format": f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={height}]+bestaudio/best[height<={height}]/best",
                "outtmpl": out_template,
                "merge_output_format": "mp4",
                "proxy": proxy,
            }
            ext = "mp4"
            content_type = "video/mp4"

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
            title = info.get("title", video_id)
            author = info.get("uploader", "")
            duration = info.get("duration", 0)

        import glob as globlib
        files = globlib.glob(os.path.join(tmpdir, "*"))
        if not files:
            cur.execute(f"UPDATE {SCHEMA}.videos SET status='error' WHERE id=%s", (record_id,))
            conn.commit()
            cur.close()
            conn.close()
            return {"statusCode": 500, "headers": CORS_HEADERS, "body": json.dumps({"error": "Не удалось скачать видео"})}

        local_file = files[0]
        file_key = f"videos/{record_id}.{ext}"

        s3 = get_s3()
        with open(local_file, "rb") as fh:
            s3.put_object(
                Bucket="files",
                Key=file_key,
                Body=fh.read(),
                ContentType=content_type,
                ContentDisposition=f'attachment; filename="{video_id}.{ext}"',
            )

    access_key = os.environ["AWS_ACCESS_KEY_ID"]
    cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{file_key}"

    cur.execute(
        f"UPDATE {SCHEMA}.videos SET status='ready', cdn_url=%s, title=%s, author=%s, duration=%s, file_key=%s WHERE id=%s",
        (cdn_url, title, author, duration, file_key, record_id),
    )
    conn.commit()
    cur.close()
    conn.close()

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps({
            "cdn_url": cdn_url,
            "title": title,
            "author": author,
            "duration": duration,
            "cached": False,
        }, ensure_ascii=False),
    }
