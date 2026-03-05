import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";

const API_INFO = "https://functions.poehali.dev/a80b406c-09b7-496f-b930-ba615bdf372f";
const API_DOWNLOAD = "https://functions.poehali.dev/8b606a67-e00e-49d6-ab69-87a929f45c54";

type Quality = "2160p" | "1080p" | "720p" | "480p" | "360p" | "audio";
type AppStatus = "idle" | "fetching_info" | "choosing" | "downloading" | "player" | "error";

interface VideoInfo {
  video_id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  formats: { quality: string; height: number; ext: string }[];
}

interface DownloadResult {
  cdn_url: string;
  title: string;
  author: string;
  duration: number;
  cached: boolean;
}

const QUALITY_OPTIONS: { value: Quality; label: string; icon: string }[] = [
  { value: "2160p", label: "4K Ultra HD", icon: "Sparkles" },
  { value: "1080p", label: "Full HD 1080p", icon: "Monitor" },
  { value: "720p", label: "HD 720p", icon: "Tv" },
  { value: "480p", label: "SD 480p", icon: "Smartphone" },
  { value: "360p", label: "Низкое 360p", icon: "Wifi" },
  { value: "audio", label: "Только аудио MP3", icon: "Music" },
];

function formatDuration(sec: number): string {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

export default function Index() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState<Quality>("1080p");
  const [status, setStatus] = useState<AppStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [dlProgress, setDlProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startFakeProgress = () => {
    setDlProgress(0);
    let p = 0;
    progressRef.current = setInterval(() => {
      p += Math.random() * 6 + 2;
      if (p >= 92) { p = 92; clearInterval(progressRef.current!); }
      setDlProgress(Math.min(p, 92));
    }, 300);
  };
  const finishProgress = () => {
    if (progressRef.current) clearInterval(progressRef.current);
    setDlProgress(100);
  };

  const handleFetchInfo = async () => {
    if (!url.trim()) return;
    if (!extractVideoId(url)) {
      setErrorMsg("Неверная ссылка. Вставь ссылку с YouTube");
      setStatus("error");
      return;
    }
    setStatus("fetching_info");
    setErrorMsg("");
    try {
      const res = await fetch(API_INFO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setVideoInfo(data as VideoInfo);
      setStatus("choosing");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Не удалось получить информацию о видео");
      setStatus("error");
    }
  };

  const handleDownload = async () => {
    if (!videoInfo) return;
    setStatus("downloading");
    startFakeProgress();
    try {
      const res = await fetch(API_DOWNLOAD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, quality }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка скачивания");
      finishProgress();
      setTimeout(() => {
        setResult(data as DownloadResult);
        setStatus("player");
      }, 400);
    } catch (e: unknown) {
      if (progressRef.current) clearInterval(progressRef.current);
      setErrorMsg(e instanceof Error ? e.message : "Ошибка при скачивании видео");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setUrl("");
    setStatus("idle");
    setVideoInfo(null);
    setResult(null);
    setDlProgress(0);
    setErrorMsg("");
  };

  const isAudio = quality === "audio";

  return (
    <div className="potop-bg min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Logo */}
      <div className="mb-10 text-center animate-fade-in" style={{ animationDelay: "0s" }}>
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="liquid-logo-icon">
            <Icon name="Droplets" size={28} />
          </div>
          <h1 className="potop-logo">PotopLoader</h1>
        </div>
        <p className="potop-subtitle">Загрузка и просмотр видео с YouTube · Работает в России</p>
      </div>

      <div className="liquid-card animate-fade-in" style={{ animationDelay: "0.15s" }}>

        {/* ── IDLE / ERROR ── */}
        {(status === "idle" || status === "error") && (
          <div className="space-y-5">
            <div className="liquid-input-wrap">
              <Icon name="Link" size={18} className="liquid-input-icon" />
              <input
                className="liquid-input"
                placeholder="Вставь ссылку на YouTube видео..."
                value={url}
                onChange={(e) => { setUrl(e.target.value); setStatus("idle"); }}
                onKeyDown={(e) => e.key === "Enter" && handleFetchInfo()}
              />
              {url && (
                <button className="liquid-input-clear" onClick={() => setUrl("")}>
                  <Icon name="X" size={16} />
                </button>
              )}
            </div>
            {status === "error" && (
              <div className="liquid-error">
                <Icon name="AlertCircle" size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
            <button className="liquid-btn-primary" onClick={handleFetchInfo} disabled={!url.trim()}>
              <Icon name="Search" size={18} />
              Найти видео
            </button>
          </div>
        )}

        {/* ── FETCHING INFO ── */}
        {status === "fetching_info" && (
          <div className="text-center space-y-5 py-4">
            <div className="liquid-spinner-wrap"><div className="liquid-spinner" /></div>
            <p className="liquid-label">Получаю информацию о видео...</p>
          </div>
        )}

        {/* ── CHOOSING QUALITY ── */}
        {status === "choosing" && videoInfo && (
          <div className="space-y-5 animate-fade-in">
            {/* Thumbnail */}
            <div className="liquid-thumbnail">
              <img src={videoInfo.thumbnail} alt="Превью"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoInfo.video_id}/mqdefault.jpg`; }}
                className="w-full h-full object-cover" />
              <div className="liquid-thumbnail-overlay" />
              {videoInfo.duration > 0 && (
                <span className="liquid-duration-badge">{formatDuration(videoInfo.duration)}</span>
              )}
            </div>

            {/* Meta */}
            <div>
              <p className="text-white font-semibold text-sm leading-snug line-clamp-2">{videoInfo.title}</p>
              <p className="text-white/50 text-xs mt-1">{videoInfo.author}</p>
            </div>

            {/* Quality */}
            <div>
              <p className="liquid-label">Качество</p>
              <div className="quality-grid">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.value}
                    className={`quality-btn ${quality === q.value ? "quality-btn--active" : ""}`}
                    onClick={() => setQuality(q.value)}
                  >
                    <Icon name={q.icon} fallback="Download" size={14} />
                    <span>{q.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className="liquid-btn-primary" onClick={handleDownload}>
              <Icon name="Download" size={18} />
              Скачать и открыть
            </button>
            <button className="liquid-btn-ghost" onClick={handleReset}>
              <Icon name="RotateCcw" size={15} />
              Другое видео
            </button>
          </div>
        )}

        {/* ── DOWNLOADING ── */}
        {status === "downloading" && (
          <div className="space-y-6 text-center py-2 animate-fade-in">
            {videoInfo && (
              <div className="liquid-thumbnail">
                <img src={videoInfo.thumbnail} alt="Превью"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoInfo.video_id}/mqdefault.jpg`; }}
                  className="w-full h-full object-cover" />
                <div className="liquid-thumbnail-overlay" />
              </div>
            )}
            <div>
              <p className="liquid-label mb-3">
                {dlProgress < 92 ? "Скачиваю видео..." : "Загружаю в хранилище..."}
              </p>
              <div className="liquid-progress-bar">
                <div className="liquid-progress-fill" style={{ width: `${dlProgress}%` }} />
              </div>
              <p className="liquid-progress-text">{Math.round(dlProgress)}%</p>
            </div>
            <div className="liquid-spinner-wrap"><div className="liquid-spinner" /></div>
            <p className="text-white/30 text-xs">Это может занять 1–3 минуты для больших видео</p>
          </div>
        )}

        {/* ── PLAYER ── */}
        {status === "player" && result && (
          <div className="space-y-4 animate-fade-in">
            {/* Title */}
            <div>
              <p className="text-white font-semibold text-sm leading-snug line-clamp-2">{result.title}</p>
              <p className="text-white/50 text-xs mt-1">{result.author} · {formatDuration(result.duration)}</p>
            </div>

            {/* Player */}
            {isAudio ? (
              <div className="liquid-audio-player">
                <div className="liquid-audio-icon">
                  <Icon name="Music2" size={32} />
                </div>
                <audio
                  ref={videoRef as React.RefObject<HTMLAudioElement>}
                  controls
                  className="liquid-audio-el"
                  src={result.cdn_url}
                >
                  Ваш браузер не поддерживает аудио
                </audio>
              </div>
            ) : (
              <div className="liquid-video-wrap">
                <video
                  ref={videoRef}
                  controls
                  className="liquid-video-el"
                  src={result.cdn_url}
                  poster={videoInfo?.thumbnail}
                  preload="metadata"
                  playsInline
                >
                  Ваш браузер не поддерживает видео
                </video>
              </div>
            )}

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="liquid-ready-info">
                <Icon name={isAudio ? "Music" : "FileVideo"} size={14} />
                <span>{QUALITY_OPTIONS.find((q) => q.value === quality)?.label}</span>
              </div>
              {result.cached && (
                <div className="liquid-ready-info">
                  <Icon name="Zap" size={14} />
                  <span>Из кэша</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <a
              href={result.cdn_url}
              download
              className="liquid-btn-primary liquid-btn-green flex items-center justify-center gap-2"
            >
              <Icon name="Download" size={18} />
              Скачать файл
            </a>
            <button className="liquid-btn-ghost" onClick={handleReset}>
              <Icon name="RotateCcw" size={15} />
              Загрузить другое видео
            </button>
          </div>
        )}
      </div>

      <p className="potop-footer animate-fade-in" style={{ animationDelay: "0.3s" }}>
        Работает через серверный прокси · Без рекламы · Бесплатно
      </p>
    </div>
  );
}
