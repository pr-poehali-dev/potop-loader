"""
Получение информации о YouTube видео по ссылке.
Используется yt-dlp для извлечения метаданных без скачивания.
"""
import json
import os
import re
import yt_dlp


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


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
    except Exception:
        return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Неверный формат запроса"})}

    if not url:
        return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "URL не указан"})}

    video_id = extract_video_id(url)
    if not video_id:
        return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Неверная ссылка YouTube"})}

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "proxy": os.environ.get("YT_PROXY", ""),
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

    formats = []
    seen = set()
    for f in info.get("formats", []):
        height = f.get("height")
        ext = f.get("ext")
        vcodec = f.get("vcodec", "none")
        acodec = f.get("acodec", "none")
        if height and vcodec != "none" and ext in ("mp4", "webm"):
            label = f"{height}p"
            if label not in seen:
                seen.add(label)
                formats.append({"quality": label, "height": height, "ext": ext})
    formats.sort(key=lambda x: x["height"], reverse=True)
    formats.append({"quality": "audio", "height": 0, "ext": "mp3"})

    thumbnail = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"

    result = {
        "video_id": video_id,
        "title": info.get("title", ""),
        "author": info.get("uploader", ""),
        "duration": info.get("duration", 0),
        "thumbnail": thumbnail,
        "formats": formats,
    }

    return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps(result, ensure_ascii=False)}
