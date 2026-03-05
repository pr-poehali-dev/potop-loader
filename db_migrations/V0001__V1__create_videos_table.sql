CREATE TABLE IF NOT EXISTS t_p36305990_potop_loader.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id VARCHAR(20) NOT NULL,
    title TEXT,
    author TEXT,
    duration INTEGER,
    quality VARCHAR(10) NOT NULL,
    file_key TEXT,
    cdn_url TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON t_p36305990_potop_loader.videos(video_id);
