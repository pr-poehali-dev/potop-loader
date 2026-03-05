import { useState } from "react";
import Icon from "@/components/ui/icon";

type Quality = "2160p" | "1080p" | "720p" | "480p" | "360p" | "audio";
type Status = "idle" | "loading" | "ready" | "error";

const QUALITY_OPTIONS: { value: Quality; label: string; icon: string }[] = [
  { value: "2160p", label: "4K Ultra HD", icon: "Sparkles" },
  { value: "1080p", label: "Full HD 1080p", icon: "Monitor" },
  { value: "720p", label: "HD 720p", icon: "Tv" },
  { value: "480p", label: "SD 480p", icon: "Smartphone" },
  { value: "360p", label: "Низкое 360p", icon: "Wifi" },
  { value: "audio", label: "Только аудио MP3", icon: "Music" },
];

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
};

export default function Index() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState<Quality>("1080p");
  const [status, setStatus] = useState<Status>("idle");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleAnalyze = () => {
    const id = extractVideoId(url);
    if (!id) {
      setStatus("error");
      return;
    }
    setVideoId(id);
    setStatus("loading");
    setProgress(0);

    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 18 + 4;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setStatus("ready");
      }
      setProgress(Math.min(p, 100));
    }, 220);
  };

  const handleReset = () => {
    setUrl("");
    setStatus("idle");
    setVideoId(null);
    setProgress(0);
  };

  return (
    <div className="potop-bg min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Orbs */}
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
        <p className="potop-subtitle">Загрузка видео с YouTube · Работает в России</p>
      </div>

      {/* Card */}
      <div className="liquid-card animate-fade-in" style={{ animationDelay: "0.15s" }}>

        {/* URL Input */}
        {status === "idle" || status === "error" ? (
          <div className="space-y-5">
            <div className="liquid-input-wrap">
              <Icon name="Link" size={18} className="liquid-input-icon" />
              <input
                className="liquid-input"
                placeholder="Вставь ссылку на YouTube видео..."
                value={url}
                onChange={(e) => { setUrl(e.target.value); setStatus("idle"); }}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
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
                <span>Неверная ссылка. Вставь ссылку с YouTube</span>
              </div>
            )}

            {/* Quality selector */}
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

            <button
              className="liquid-btn-primary"
              onClick={handleAnalyze}
              disabled={!url.trim()}
            >
              <Icon name="Download" size={18} />
              Скачать видео
            </button>
          </div>
        ) : status === "loading" ? (
          /* Loading state */
          <div className="space-y-6 text-center">
            {videoId && (
              <div className="liquid-thumbnail">
                <img
                  src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                  alt="Превью"
                  className="w-full h-full object-cover"
                />
                <div className="liquid-thumbnail-overlay" />
              </div>
            )}
            <div>
              <p className="liquid-label mb-3">Подготовка файла...</p>
              <div className="liquid-progress-bar">
                <div
                  className="liquid-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="liquid-progress-text">{Math.round(progress)}%</p>
            </div>
            <div className="liquid-spinner-wrap">
              <div className="liquid-spinner" />
            </div>
          </div>
        ) : (
          /* Ready state */
          <div className="space-y-5 text-center animate-fade-in">
            {videoId && (
              <div className="liquid-thumbnail">
                <img
                  src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                  alt="Превью"
                  className="w-full h-full object-cover"
                />
                <div className="liquid-thumbnail-overlay" />
                <div className="liquid-thumbnail-badge">
                  <Icon name="CheckCircle2" size={20} />
                  <span>Готово!</span>
                </div>
              </div>
            )}

            <div className="liquid-ready-info">
              <Icon name="FileVideo" size={16} />
              <span>
                {QUALITY_OPTIONS.find((q) => q.value === quality)?.label} · MP4
              </span>
            </div>

            <button className="liquid-btn-primary liquid-btn-green">
              <Icon name="Download" size={18} />
              Скачать файл
            </button>

            <button className="liquid-btn-ghost" onClick={handleReset}>
              <Icon name="RotateCcw" size={15} />
              Загрузить другое видео
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="potop-footer animate-fade-in" style={{ animationDelay: "0.3s" }}>
        Работает через VPN-прокси · Без рекламы · Бесплатно
      </p>
    </div>
  );
}