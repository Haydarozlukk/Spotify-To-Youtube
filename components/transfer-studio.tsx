"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Check, ChevronDown, CircleAlert, Clock3, Disc3, ExternalLink,
  History, LockKeyhole, LogOut, Music2, Play, RefreshCw, Search, Settings,
  ShieldCheck, SlidersHorizontal, Sparkles, Trash2, UserRound, Youtube,
} from "lucide-react";
import type { MatchStatus, TrackMatch, YouTubeMatch } from "@/lib/types";

const initialTracks = [
  { id: "1", spotifyTitle: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", duration: "4:03", youtubeTitle: "M83 - Midnight City (Official Video)", channel: "M83", youtubeDuration: "4:04", confidence: 96, status: "matched", kind: "Official Video" },
  { id: "2", spotifyTitle: "Instant Crush", artist: "Daft Punk, Julian Casablancas", album: "Random Access Memories", duration: "5:37", youtubeTitle: "Daft Punk - Instant Crush (Video) ft. Julian Casablancas", channel: "Daft Punk", youtubeDuration: "5:40", confidence: 92, status: "matched", kind: "Official Video" },
  { id: "3", spotifyTitle: "Borderline", artist: "Tame Impala", album: "The Slow Rush", duration: "3:57", youtubeTitle: "Tame Impala - Borderline (Official Audio)", channel: "Tame Impala", youtubeDuration: "4:00", confidence: 88, status: "matched", kind: "Official Audio" },
  { id: "4", spotifyTitle: "After Dark", artist: "Mr.Kitty", album: "Time", duration: "4:18", youtubeTitle: "Mr.Kitty - After Dark (Lyrics)", channel: "7clouds", youtubeDuration: "4:21", confidence: 73, status: "review", kind: "Lyrics" },
  { id: "5", spotifyTitle: "The Less I Know the Better", artist: "Tame Impala", album: "Currents", duration: "3:36", youtubeTitle: "The Less I Know The Better - Live at Primavera", channel: "Festival Archive", youtubeDuration: "4:52", confidence: 42, status: "missing", kind: "Unknown" },
  { id: "6", spotifyTitle: "Nightcall", artist: "Kavinsky", album: "OutRun", duration: "4:18", youtubeTitle: "Kavinsky - Nightcall (Official Audio)", channel: "Record Makers", youtubeDuration: "4:17", confidence: 91, status: "matched", kind: "Official Audio" },
].map<TrackMatch>((track) => ({
  ...track,
  status: track.status as MatchStatus,
  kind: track.kind as TrackMatch["kind"],
  spotifyDurationMs: 0,
  spotifyImage: null,
  youtubeVideoId: null,
  youtubeUrl: null,
  youtubeThumbnail: null,
})) satisfies TrackMatch[];

const demoPlaylists = [
  { name: "Gece Sürüşü", count: 48, duration: "3 sa 12 dk", tone: "violet" },
  { name: "Synthwave Essentials", count: 73, duration: "5 sa 06 dk", tone: "orange" },
  { name: "Pazar Sabahı", count: 31, duration: "1 sa 54 dk", tone: "blue" },
];

const labels: Record<MatchStatus, string> = { matched: "Güvenli", review: "İncele", missing: "Değiştir" };

type LivePlaylist = { id: string; name: string; count: number; image: string | null; spotifyUrl: string | null };
type YouTubePlaylist = { id: string; name: string; count: number; image?: string | null };
type SpotifyStatus = { configured: boolean; connected: boolean; profile: { displayName: string; image?: string } | null };
type GoogleStatus = { configured: boolean; connected: boolean; profile: { displayName: string; image?: string } | null };
type ActiveView = "transfer" | "history" | "settings";
type Preferences = { privacy: "private" | "unlisted"; confidenceThreshold: number };
type TransferHistory = {
  id: string;
  sourceName: string;
  targetName: string;
  trackCount: number;
  completedAt: string;
  url: string;
};

const defaultPreferences: Preferences = { privacy: "private", confidenceThreshold: 85 };
const HISTORY_KEY = "playlistpilot.transfer.history";
const PREFERENCES_KEY = "playlistpilot.preferences";

async function responseError(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: string };
    return data.error || fallback;
  } catch { return fallback; }
}

export function TransferStudio() {
  const [activeView, setActiveView] = useState<ActiveView>("transfer");
  const [profileOpen, setProfileOpen] = useState(false);
  const [tracks, setTracks] = useState(initialTracks);
  const [filter, setFilter] = useState<"all" | MatchStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState(-1);
  const [connected, setConnected] = useState({ spotify: false, youtube: false });
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus>({ configured: false, connected: false, profile: null });
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ configured: false, connected: false, profile: null });
  const [youtubePlaylists, setYoutubePlaylists] = useState<YouTubePlaylist[]>([]);
  const [livePlaylists, setLivePlaylists] = useState<LivePlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState(0);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [targetPlaylistId, setTargetPlaylistId] = useState("new");
  const [transfer, setTransfer] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferUrl, setTransferUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<TransferHistory[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);

  const visibleTracks = useMemo(
    () => tracks.filter((track) => {
      const matchesFilter = filter === "all" || track.status === filter;
      const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
      const matchesSearch = !query || `${track.spotifyTitle} ${track.artist} ${track.album}`.toLocaleLowerCase("tr-TR").includes(query);
      return matchesFilter && matchesSearch;
    }),
    [filter, searchQuery, tracks],
  );
  const safe = tracks.filter((track) => track.status === "matched").length;
  const review = tracks.filter((track) => track.status !== "matched").length;
  const displayPlaylists = livePlaylists.length ? livePlaylists : demoPlaylists;
  const estimatedQuota = (displayPlaylists[selectedPlaylist]?.count || 0) * 50;
  const profileName = googleStatus.profile?.displayName || spotifyStatus.profile?.displayName || "Yerel kullanıcı";
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR") || "PP";
  const averageConfidence = tracks.length ? Math.round(tracks.reduce((sum, track) => sum + track.confidence, 0) / tracks.length) : 0;
  const totalTransferredTracks = history.reduce((sum, item) => sum + item.trackCount, 0);

  useEffect(() => {
    try {
      const savedHistory = window.localStorage.getItem(HISTORY_KEY);
      const savedPreferences = window.localStorage.getItem(PREFERENCES_KEY);
      if (savedHistory) setHistory(JSON.parse(savedHistory) as TransferHistory[]);
      if (savedPreferences) setPreferences({ ...defaultPreferences, ...JSON.parse(savedPreferences) as Preferences });
    } catch {
      window.localStorage.removeItem(HISTORY_KEY);
      window.localStorage.removeItem(PREFERENCES_KEY);
    }
  }, []);

  function navigate(view: ActiveView) {
    setActiveView(view);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function savePreferences(next: Preferences) {
    setPreferences(next);
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  }

  useEffect(() => {
    async function loadSpotify() {
      try {
        const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const callbackSession = fragment.get("spotify_session");
        if (callbackSession) {
          window.sessionStorage.setItem("playlistpilot.spotify.session", callbackSession);
          window.history.replaceState({}, "", window.location.pathname);
        }
        const sessionId = callbackSession || window.sessionStorage.getItem("playlistpilot.spotify.session");
        const sessionHeaders = sessionId ? { Authorization: `Session ${sessionId}` } : undefined;
        const statusResponse = await fetch("/api/spotify/status", { cache: "no-store", headers: sessionHeaders });
        const status = await statusResponse.json() as SpotifyStatus;
        setSpotifyStatus(status);
        setConnected((current) => ({ ...current, spotify: status.connected }));
        if (status.connected) {
          const playlistResponse = await fetch("/api/spotify/playlists", { cache: "no-store", headers: sessionHeaders });
          if (playlistResponse.ok) {
            const data = await playlistResponse.json() as { playlists: LivePlaylist[] };
            setLivePlaylists(data.playlists);
            if (data.playlists.length) setTracks([]);
          }
        }
      } finally { setLoadingPlaylists(false); }
    }
    void loadSpotify();

    async function loadGoogle() {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const callbackSession = fragment.get("google_session");
      if (callbackSession) {
        window.sessionStorage.setItem("playlistpilot.google.session", callbackSession);
        window.history.replaceState({}, "", window.location.pathname);
      }
      const sessionId = callbackSession || window.sessionStorage.getItem("playlistpilot.google.session");
      const headers = sessionId ? { Authorization: `Session ${sessionId}` } : undefined;
      const response = await fetch("/api/youtube/status", { cache: "no-store", headers });
      const status = await response.json() as GoogleStatus;
      setGoogleStatus(status);
      setConnected((current) => ({ ...current, youtube: status.connected }));
      if (status.connected) {
        const playlistsResponse = await fetch("/api/youtube/playlists", { cache: "no-store", headers });
        if (playlistsResponse.ok) {
          const data = await playlistsResponse.json() as { playlists: YouTubePlaylist[] };
          setYoutubePlaylists(data.playlists);
        }
      }
    }
    void loadGoogle();
  }, []);

  async function selectPlaylist(index: number) {
    setSelectedPlaylist(index);
    const playlist = livePlaylists[index];
    if (!playlist) return;
    setLoadingTracks(true);
    setMatchError(null);
    setTransfer("idle");
    setProgress(0);
    setTransferError(null);
    setTransferUrl(null);
    try {
      const sessionId = window.sessionStorage.getItem("playlistpilot.spotify.session");
      const response = await fetch(`/api/spotify/playlists/${playlist.id}/tracks`, {
        cache: "no-store",
        headers: sessionId ? { Authorization: `Session ${sessionId}` } : undefined,
      });
      if (!response.ok) {
        setMatchError(await responseError(response, "Spotify parçaları yüklenemedi."));
        return;
      }
      const data = await response.json() as { tracks: Array<{ id: string; title: string; artist: string; album: string; durationMs: number; image: string | null }> };
      const pendingTracks: TrackMatch[] = data.tracks.map((track) => ({
        id: track.id,
        spotifyTitle: track.title,
        artist: track.artist,
        album: track.album,
        spotifyImage: track.image,
        spotifyDurationMs: track.durationMs,
        duration: `${Math.floor(track.durationMs / 60000)}:${String(Math.floor((track.durationMs % 60000) / 1000)).padStart(2, "0")}`,
        youtubeVideoId: null,
        youtubeUrl: null,
        youtubeThumbnail: null,
        youtubeTitle: null,
        channel: null,
        youtubeDuration: null,
        confidence: 0,
        status: "missing",
        kind: "Unknown",
      }));
      setTracks(pendingTracks);
      setFilter("all");
      if (connected.youtube) await matchTracks(pendingTracks);
    } finally { setLoadingTracks(false); }
  }

  async function requestMatch(track: TrackMatch) {
    const sessionId = window.sessionStorage.getItem("playlistpilot.google.session");
    const response = await fetch("/api/youtube/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionId ? { Authorization: `Session ${sessionId}` } : {}),
      },
      body: JSON.stringify({
        title: track.spotifyTitle,
        artist: track.artist,
        durationMs: track.spotifyDurationMs,
      }),
    });
    if (!response.ok) throw new Error(await responseError(response, "YouTube Music araması başarısız oldu."));
    const data = await response.json() as { match: YouTubeMatch; candidates: YouTubeMatch[] };
    const applyThreshold = (match: YouTubeMatch): YouTubeMatch => ({
      ...match,
      status: !match.youtubeVideoId
        ? "missing"
        : match.confidence >= preferences.confidenceThreshold
          ? "matched"
          : match.confidence >= 60 ? "review" : "missing",
    });
    return { match: applyThreshold(data.match), candidates: data.candidates.map(applyThreshold) };
  }

  async function matchTracks(sourceTracks: TrackMatch[]) {
    if (!sourceTracks.length) return;
    setMatching(true);
    setMatchProgress(0);
    setMatchError(null);
    let completed = 0;
    try {
      for (let index = 0; index < sourceTracks.length; index += 2) {
        const batch = sourceTracks.slice(index, index + 2);
        const results = await Promise.all(batch.map(async (track) => {
          try { return { id: track.id, result: await requestMatch(track), error: null }; }
          catch (error) { return { id: track.id, result: null, error: error instanceof Error ? error.message : "Arama başarısız oldu." }; }
        }));
        setTracks((current) => current.map((track) => {
          const result = results.find((item) => item.id === track.id);
          return result?.result ? { ...track, ...result.result.match, alternatives: result.result.candidates } : track;
        }));
        const firstError = results.find((item) => item.error)?.error;
        if (firstError) setMatchError(firstError);
        completed += batch.length;
        setMatchProgress(Math.round((completed / sourceTracks.length) * 100));
      }
    } finally { setMatching(false); }
  }

  function connectSpotify() {
    if (!spotifyStatus.configured) {
      window.alert("Spotify henüz yapılandırılmadı. .env.local dosyasına Spotify uygulama bilgilerini eklemelisin.");
      return;
    }
    window.location.href = "http://127.0.0.1:3000/api/auth/spotify";
  }

  function connectYouTubeMusic() {
    if (!googleStatus.configured) {
      window.alert("Google OAuth henüz yapılandırılmadı. Önce Google Cloud istemci bilgilerini eklemelisin.");
      return;
    }
    window.location.href = "http://127.0.0.1:3000/api/auth/google";
  }

  async function disconnectService(service: "spotify" | "google") {
    const storageKey = service === "spotify" ? "playlistpilot.spotify.session" : "playlistpilot.google.session";
    const sessionId = window.sessionStorage.getItem(storageKey);
    try {
      await fetch(`/api/auth/${service}/logout`, {
        method: "POST",
        headers: sessionId ? { Authorization: `Session ${sessionId}` } : undefined,
      });
    } finally {
      window.sessionStorage.removeItem(storageKey);
      if (service === "spotify") {
        setConnected((current) => ({ ...current, spotify: false }));
        setSpotifyStatus((current) => ({ ...current, connected: false, profile: null }));
        setLivePlaylists([]);
        setTracks(initialTracks);
        setSelectedPlaylist(-1);
      } else {
        setConnected((current) => ({ ...current, youtube: false }));
        setGoogleStatus((current) => ({ ...current, connected: false, profile: null }));
        setYoutubePlaylists([]);
      }
      setProfileOpen(false);
    }
  }

  function clearHistory() {
    setHistory([]);
    window.localStorage.removeItem(HISTORY_KEY);
  }

  function approveMatch(id: string) {
    setTracks((items) => items.map((track) => track.id === id && track.youtubeVideoId ? {
      ...track,
      status: "matched",
      approved: true,
    } : track));
  }

  function chooseAlternative(trackId: string, videoId: string) {
    setTracks((items) => items.map((track) => {
      if (track.id !== trackId) return track;
      const selected = track.alternatives?.find((candidate) => candidate.youtubeVideoId === videoId);
      return selected ? { ...track, ...selected, approved: false } : track;
    }));
  }

  async function startTransfer() {
    if (
      transfer !== "idle" ||
      !livePlaylists.length ||
      !tracks.length ||
      tracks.some((track) => track.status !== "matched" || !track.youtubeVideoId)
    ) return;
    setTransfer("running");
    setProgress(0);
    setTransferError(null);
    const sessionId = window.sessionStorage.getItem("playlistpilot.google.session");
    const headers = {
      "Content-Type": "application/json",
      ...(sessionId ? { Authorization: `Session ${sessionId}` } : {}),
    };
    const sourcePlaylist = livePlaylists[selectedPlaylist];
    let playlistId = targetPlaylistId;
    let targetName = sourcePlaylist.name;
    let targetUrl = "";
    try {
      if (targetPlaylistId === "new") {
        const response = await fetch("/api/youtube/playlists", {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: sourcePlaylist.name,
            description: `Spotify'daki “${sourcePlaylist.name}” listesinden Playlist Pilot ile aktarıldı.`,
            privacy: preferences.privacy,
          }),
        });
        if (!response.ok) throw new Error(await responseError(response, "YouTube Music playlisti oluşturulamadı."));
        const data = await response.json() as { playlist: { id: string; name: string; url: string } };
        playlistId = data.playlist.id;
        targetName = data.playlist.name;
        targetUrl = data.playlist.url;
        setTransferUrl(targetUrl);
        setYoutubePlaylists((items) => [{ id: data.playlist.id, name: data.playlist.name, count: 0 }, ...items]);
      } else {
        targetName = youtubePlaylists.find((playlist) => playlist.id === playlistId)?.name || "YouTube Music playlisti";
        targetUrl = `https://music.youtube.com/playlist?list=${playlistId}`;
        setTransferUrl(targetUrl);
      }

      for (let index = 0; index < tracks.length; index += 1) {
        const response = await fetch(`/api/youtube/playlists/${encodeURIComponent(playlistId)}/items`, {
          method: "POST",
          headers,
          body: JSON.stringify({ videoId: tracks[index].youtubeVideoId }),
        });
        if (!response.ok) throw new Error(await responseError(response, `${index + 1}. parça eklenemedi.`));
        setProgress(Math.round(((index + 1) / tracks.length) * 100));
      }
      setYoutubePlaylists((items) => items.map((playlist) => playlist.id === playlistId
        ? { ...playlist, count: playlist.count + tracks.length }
        : playlist));
      const record: TransferHistory = {
        id: `${Date.now()}-${playlistId}`,
        sourceName: sourcePlaylist.name,
        targetName,
        trackCount: tracks.length,
        completedAt: new Date().toISOString(),
        url: targetUrl,
      };
      setHistory((items) => {
        const next = [record, ...items].slice(0, 50);
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
      setTransfer("done");
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Aktarım tamamlanamadı.");
      setTransfer("failed");
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Playlist Pilot ana sayfa" onClick={(event) => { event.preventDefault(); navigate("transfer"); }}>
          <span className="brand-mark"><Music2 size={18} /></span>
          <span>playlist<span>pilot</span></span>
        </a>
        <nav className="topnav" aria-label="Ana menü">
          <button className={activeView === "transfer" ? "active" : ""} onClick={() => navigate("transfer")}>Aktarım</button>
          <button className={activeView === "history" ? "active" : ""} onClick={() => navigate("history")}>Geçmiş</button>
          <button className={activeView === "settings" ? "active" : ""} onClick={() => navigate("settings")}>Ayarlar</button>
        </nav>
        <div className="profile-menu">
          <button className="profile" aria-label="Hesap menüsünü aç" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
            <span>{profileInitials}</span><span className="profile-copy"><b>{profileName}</b><small>{connected.spotify && connected.youtube ? "2 hesap bağlı" : connected.spotify || connected.youtube ? "1 hesap bağlı" : "Yerel kullanım"}</small></span><ChevronDown size={15} />
          </button>
          {profileOpen ? <div className="profile-popover">
            <div className="popover-title"><span><UserRound size={16} /></span><div><b>{profileName}</b><small>Bağlı servislerini yönet</small></div></div>
            <div className="account-row"><Disc3 size={17} /><span><b>Spotify</b><small>{connected.spotify ? spotifyStatus.profile?.displayName : "Bağlı değil"}</small></span>{connected.spotify ? <button onClick={() => void disconnectService("spotify")} title="Spotify bağlantısını kes"><LogOut size={15} /></button> : <button onClick={connectSpotify}>Bağla</button>}</div>
            <div className="account-row"><Youtube size={17} /><span><b>YouTube Music</b><small>{connected.youtube ? googleStatus.profile?.displayName : "Bağlı değil"}</small></span>{connected.youtube ? <button onClick={() => void disconnectService("google")} title="YouTube Music bağlantısını kes"><LogOut size={15} /></button> : <button onClick={connectYouTubeMusic}>Bağla</button>}</div>
            <div className="popover-nav"><button onClick={() => navigate("history")}><History size={15} /> Geçmiş</button><button onClick={() => navigate("settings")}><Settings size={15} /> Ayarlar</button></div>
          </div> : null}
        </div>
      </header>

      {activeView === "transfer" ? <><section className={`hero ${connected.spotify && connected.youtube ? "hero-ready" : ""}`} id="top">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> {connected.spotify && connected.youtube ? "Sistem hazır · iki hesap bağlı" : "Akıllı playlist taşıma"}</div>
            <h1>Müziğin aynı.<br /><span>Adresi değişiyor.</span></h1>
            <p>Spotify listeni analiz et, doğru YouTube Music kayıtlarını birlikte seçelim ve tek tıkla güvenle aktaralım.</p>
            <div className="hero-proof"><span><ShieldCheck size={14} /> Local-first</span><span><SlidersHorizontal size={14} /> İnsan denetimli</span><span><LockKeyhole size={14} /> Anahtarlar sende</span></div>
          </div>
          <div className="hero-stage" aria-hidden="true">
            <div className="stage-grid" />
            <div className="stage-card stage-source"><span><Disc3 size={19} /></span><div><small>KAYNAK</small><b>Spotify</b></div><i className={connected.spotify ? "online" : ""} /></div>
            <div className="stage-pipe"><span>{[8,16,25,12,31,19,38,23,14,29,18,10].map((height, index) => <i key={index} style={{ height }} />)}</span><b><ArrowRight size={17} /></b></div>
            <div className="stage-card stage-target"><span><Youtube size={19} /></span><div><small>HEDEF</small><b>YouTube Music</b></div><i className={connected.youtube ? "online" : ""} /></div>
            <div className="album-stack">
              {(livePlaylists.length ? livePlaylists.slice(0, 3) : demoPlaylists).map((playlist, index) => <span key={playlist.name} style={"image" in playlist && playlist.image ? { backgroundImage: `url(${playlist.image})` } : undefined}><Music2 size={16} /><i>{index + 1}</i></span>)}
            </div>
            <div className="stage-caption"><Sparkles size={13} /> Eşleştir · İncele · Aktar</div>
          </div>
        </div>
        <div className="connection-row">
          <button className={`connection spotify ${connected.spotify ? "connected" : ""}`} onClick={connectSpotify}>
            <span className="service-icon"><Disc3 size={21} /></span>
            <span><small>Kaynak hesap</small><b>{connected.spotify ? spotifyStatus.profile?.displayName || "Spotify bağlı" : spotifyStatus.configured ? "Spotify'ı bağla" : "Kurulum gerekli"}</b></span>
            <span className="connection-state">{connected.spotify ? <><Check size={14} /> Bağlı</> : spotifyStatus.configured ? <ArrowRight size={16} /> : <CircleAlert size={15} />}</span>
          </button>
          <ArrowRight className="connection-arrow" size={20} />
          <button className={`connection youtube ${connected.youtube ? "connected" : ""}`} onClick={connectYouTubeMusic}>
            <span className="service-icon"><Youtube size={21} /></span>
            <span><small>Hedef hesap</small><b>{connected.youtube ? googleStatus.profile?.displayName || "YouTube Music bağlı" : googleStatus.configured ? "YouTube Music'i bağla" : "Kurulum gerekli"}</b></span>
            <span className="connection-state">{connected.youtube ? <><Check size={14} /> {youtubePlaylists.length} liste</> : googleStatus.configured ? <ArrowRight size={16} /> : <CircleAlert size={15} />}</span>
          </button>
        </div>
      </section>

      <section className="workspace" id="studio">
        <div className="studio-overview">
          <div className="workflow-rail">
            <span className={selectedPlaylist >= 0 ? "done" : "active"}><i>01</i><b>Playlist</b></span>
            <em />
            <span className={tracks.length && !matching ? "done" : selectedPlaylist >= 0 ? "active" : ""}><i>02</i><b>Eşleştirme</b></span>
            <em />
            <span className={transfer === "done" ? "done" : tracks.length && !review ? "active" : ""}><i>03</i><b>Aktarım</b></span>
          </div>
          <div className="studio-metrics"><span><small>PARÇA</small><b>{tracks.length}</b></span><span><small>ORT. GÜVEN</small><b>%{averageConfidence}</b></span><span><small>HEDEF LİSTE</small><b>{youtubePlaylists.length}</b></span></div>
        </div>
        <div className="step-head">
          <div><span className="step-index">01</span><h2>Playlistini seç</h2><p>Spotify hesabındaki listelerden birini kaynak olarak belirle.</p></div>
          <button className="ghost-button" onClick={() => window.location.reload()}><RefreshCw size={15} /> Yenile</button>
        </div>

        {loadingPlaylists ? <div className="loading-line"><RefreshCw className="spin" size={16} /> Spotify bağlantısı kontrol ediliyor...</div> : null}
        <div className="playlist-grid">
          {displayPlaylists.slice(0, 6).map((playlist, index) => (
            <button key={"id" in playlist ? playlist.id : playlist.name} className={`playlist-card ${selectedPlaylist === index ? "selected" : ""}`} onClick={() => void selectPlaylist(index)}>
              <span className={`cover ${"tone" in playlist ? playlist.tone : "blue"}`} style={"image" in playlist && playlist.image ? { backgroundImage: `url(${playlist.image})`, backgroundSize: "cover" } : undefined}><span className="cover-disc"><span /></span></span>
              <span className="playlist-copy"><small>{livePlaylists.length ? "GERÇEK SPOTIFY PLAYLIST" : "DEMO PLAYLIST"}</small><b>{playlist.name}</b><span>{playlist.count} parça{"duration" in playlist ? ` · ${playlist.duration}` : ""}</span></span>
              <span className="radio"><Check size={14} /></span>
            </button>
          ))}
        </div>

        <div className="divider" />

        <div className="step-head compact">
          <div><span className="step-index">02</span><h2>Eşleşmeleri incele</h2><p>En iyi YouTube sonuçlarını bulduk. Şüpheli olanlarda son söz senin.</p></div>
          <div className="summary-pills"><span className="safe"><Check size={14} /> {safe} güvenli</span><span className="needs"><CircleAlert size={14} /> {review} inceleme</span></div>
        </div>

        {loadingTracks ? <div className="loading-line"><RefreshCw className="spin" size={16} /> Playlist parçaları yükleniyor...</div> : null}
        {matching ? <div className="loading-line"><RefreshCw className="spin" size={16} /> YouTube Music eşleşmeleri aranıyor... %{matchProgress}</div> : null}
        {matchError ? <div className="loading-line error-line"><CircleAlert size={16} /> {matchError}</div> : null}
        <div className="review-panel">
          <div className="review-toolbar">
            <div className="filters" role="group" aria-label="Eşleşme filtresi">
              {(["all", "matched", "review", "missing"] as const).map((value) => (
                <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                  {value === "all" ? "Tümü" : labels[value]}
                </button>
              ))}
            </div>
            <label className="search"><Search size={15} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Parça veya sanatçı ara" aria-label="Parça ara" /></label>
          </div>

          <div className="track-list">
            {visibleTracks.map((track, index) => (
              <article className="track-row" key={track.id}>
                <div className="track-source">
                  <span className={`mini-cover tone-${Number(track.id) % 4}`} style={track.spotifyImage ? { backgroundImage: `url(${track.spotifyImage})` } : undefined}>{track.spotifyImage ? null : <Music2 size={17} />}</span>
                  <span className="track-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="track-copy"><b>{track.spotifyTitle}</b><small>{track.artist} · {track.album}</small></span>
                  <span className="duration"><Clock3 size={12} /> {track.duration}</span>
                </div>
                <div className="match-link"><span /><ArrowRight size={15} /><span /></div>
                <div className="track-target">
                  {track.youtubeTitle ? <>
                    <span className="video-thumb" style={track.youtubeThumbnail ? { backgroundImage: `linear-gradient(rgba(0,0,0,.08), rgba(0,0,0,.48)), url(${track.youtubeThumbnail})` } : undefined}><Play size={14} fill="currentColor" /></span>
                    <span className="track-copy">
                      {track.youtubeUrl
                        ? <a href={track.youtubeUrl} target="_blank" rel="noreferrer">{track.youtubeTitle}</a>
                        : <b>{track.youtubeTitle}</b>}
                      <small>{track.channel} · {track.kind}</small>
                    </span>
                    <span className="duration"><Clock3 size={12} /> {track.youtubeDuration}</span>
                  </> : <span className="empty-result">Sonuç seçilmedi</span>}
                </div>
                <div className="match-actions">
                  <span className={`score ${track.status}`}><i style={{ "--score": `${track.confidence * 3.6}deg` } as React.CSSProperties} /><b>{track.confidence}</b><small>{track.approved ? "Onaylandı" : labels[track.status]}</small></span>
                  {track.status !== "matched" && track.youtubeVideoId
                    ? <>
                        {(track.alternatives?.length || 0) > 1 ? <select className="match-select" value={track.youtubeVideoId} onChange={(event) => chooseAlternative(track.id, event.target.value)} aria-label={`${track.spotifyTitle} için alternatif seç`}>
                          {track.alternatives?.map((candidate) => <option key={candidate.youtubeVideoId || candidate.youtubeTitle} value={candidate.youtubeVideoId || ""}>{candidate.confidence} · {candidate.youtubeTitle}</option>)}
                        </select> : null}
                        <button className="change-button" onClick={() => approveMatch(track.id)}><Check size={14} /> Bu sonucu onayla</button>
                      </>
                    : track.youtubeUrl
                      ? <a className="icon-button" href={track.youtubeUrl} target="_blank" rel="noreferrer" aria-label={`${track.spotifyTitle} sonucunu YouTube Music'te aç`}><ExternalLink size={15} /></a>
                      : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="transfer-footer">
          <div className="quota-card">
            <span><ShieldCheck size={19} /></span>
            <div><b>Kota kontrollü aktarım</b><small>Yazma maliyeti: yaklaşık {estimatedQuota.toLocaleString("tr-TR")} YouTube birimi</small></div>
          </div>
          <div className="transfer-action">
            <label className="target-picker">
              <span>Hedef playlist</span>
              <select value={targetPlaylistId} onChange={(event) => setTargetPlaylistId(event.target.value)} disabled={transfer !== "idle"}>
                <option value="new">Yeni {preferences.privacy === "private" ? "özel" : "liste dışı"} playlist oluştur</option>
                {youtubePlaylists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name} ({playlist.count})</option>)}
              </select>
            </label>
            {review > 0 && transfer === "idle" ? <span className="review-warning"><CircleAlert size={15} /> Önce {review} eşleşmeyi düzelt</span> : null}
            {transfer !== "idle" ? <div className="progress-wrap"><span><b>{transfer === "done" ? "Aktarım tamamlandı" : transfer === "failed" ? "Aktarım yarıda kaldı" : "YouTube Music'e aktarılıyor"}</b><small>{progress}%</small></span><div className="progress"><i style={{ width: `${progress}%` }} /></div></div> : null}
            {transferError ? <span className="review-warning"><CircleAlert size={15} /> {transferError}</span> : null}
            {transferUrl && transfer !== "running" ? <a className="result-link" href={transferUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Playlisti YouTube Music&apos;te aç</a> : null}
            <button className="primary-button" disabled={matching || review > 0 || transfer !== "idle" || !connected.youtube || !livePlaylists.length || !tracks.length || tracks.some((track) => !track.youtubeVideoId)} onClick={() => void startTransfer()}>
              {transfer === "done" ? <><Check size={18} /> Tamamlandı</> : transfer === "failed" ? <><CircleAlert size={18} /> Tamamlanamadı</> : transfer === "running" ? <><RefreshCw className="spin" size={17} /> Aktarılıyor</> : <>YouTube Music&apos;e aktar <ArrowRight size={18} /></>}
            </button>
          </div>
        </div>
        {transfer === "done" ? <div className="success-panel">
          <div className="success-sparkles"><i /><i /><i /><i /><i /></div>
          <span className="success-icon"><Check size={26} /></span>
          <div><small>ROTA TAMAMLANDI</small><h2>{tracks.length} parça YouTube Music&apos;te</h2><p>Playlist sırası ve seçtiğin eşleşmeler korunarak güvenle aktarıldı.</p></div>
          <div className="success-actions">{transferUrl ? <a href={transferUrl} target="_blank" rel="noreferrer">Playlisti aç <ExternalLink size={15} /></a> : null}<button onClick={() => { setTransfer("idle"); setProgress(0); setTransferUrl(null); setSelectedPlaylist(-1); setTracks([]); window.scrollTo({ top: document.getElementById("studio")?.offsetTop || 0, behavior: "smooth" }); }}>Yeni aktarım</button></div>
        </div> : null}
      </section></> : activeView === "history" ? <section className="secondary-page" id="history">
        <div className="page-heading">
          <span className="page-icon"><History size={20} /></span>
          <div><small>YEREL KAYITLAR</small><h1>Aktarım geçmişi</h1><p>Bu cihazda başarıyla tamamlanan son 50 aktarım.</p></div>
          {history.length ? <button className="ghost-button danger-button" onClick={clearHistory}><Trash2 size={15} /> Geçmişi temizle</button> : null}
        </div>
        <div className="history-summary"><span><small>TOPLAM AKTARIM</small><b>{history.length}</b><em>playlist</em></span><span><small>TAŞINAN MÜZİK</small><b>{totalTransferredTracks}</b><em>parça</em></span><span><small>BAŞARI ORANI</small><b>{history.length ? "%100" : "—"}</b><em>tamamlandı</em></span></div>
        {history.length ? <div className="history-list">
          {history.map((item) => <article className="history-card" key={item.id}>
            <span className="history-status"><Check size={17} /></span>
            <div className="history-main"><small>SPOTIFY</small><b>{item.sourceName}</b><span>{item.trackCount} parça</span></div>
            <ArrowRight className="history-arrow" size={18} />
            <div className="history-main"><small>YOUTUBE MUSIC</small><b>{item.targetName}</b><span>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.completedAt))}</span></div>
            <a className="history-link" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Aç</a>
          </article>)}
        </div> : <div className="empty-page"><span><History size={26} /></span><h2>Henüz aktarım yok</h2><p>İlk playlistini taşıdığında ayrıntıları burada göreceksin.</p><button className="primary-button" onClick={() => navigate("transfer")}>İlk aktarımı başlat <ArrowRight size={17} /></button></div>}
      </section> : <section className="secondary-page" id="settings">
        <div className="page-heading">
          <span className="page-icon"><Settings size={20} /></span>
          <div><small>YEREL TERCİHLER</small><h1>Ayarlar</h1><p>Aktarım davranışını bu tarayıcı için özelleştir.</p></div>
        </div>
        <div className="settings-grid">
          <article className="settings-card">
            <span className="settings-icon"><LockKeyhole size={19} /></span>
            <div className="settings-copy"><h2>Yeni playlist gizliliği</h2><p>Yeni oluşturulan YouTube Music listelerinin başlangıç görünürlüğü.</p></div>
            <div className="segmented-control" role="group" aria-label="Playlist gizliliği">
              <button className={preferences.privacy === "private" ? "active" : ""} onClick={() => savePreferences({ ...preferences, privacy: "private" })}>Özel</button>
              <button className={preferences.privacy === "unlisted" ? "active" : ""} onClick={() => savePreferences({ ...preferences, privacy: "unlisted" })}>Liste dışı</button>
            </div>
          </article>
          <article className="settings-card">
            <span className="settings-icon"><SlidersHorizontal size={19} /></span>
            <div className="settings-copy"><h2>Güven eşiği</h2><p>Bu puanın üzerindeki sonuçlar otomatik olarak güvenli kabul edilir.</p></div>
            <label className="settings-select"><span>Eşik</span><select value={preferences.confidenceThreshold} onChange={(event) => savePreferences({ ...preferences, confidenceThreshold: Number(event.target.value) })}>
              {[70, 80, 85, 90, 95].map((value) => <option key={value} value={value}>%{value}</option>)}
            </select></label>
          </article>
          <article className="settings-card wide-card">
            <span className="settings-icon"><ShieldCheck size={19} /></span>
            <div className="settings-copy"><h2>Yerel veri</h2><p>Tercihler ve aktarım geçmişi yalnızca bu tarayıcıda tutulur. OAuth anahtarları sayfada saklanmaz.</p></div>
            <button className="ghost-button danger-button" disabled={!history.length} onClick={clearHistory}><Trash2 size={15} /> {history.length} geçmiş kaydını sil</button>
          </article>
        </div>
      </section>}

      <nav className="mobile-nav" aria-label="Mobil menü"><button className={activeView === "transfer" ? "active" : ""} onClick={() => navigate("transfer")}><Music2 size={17} />Aktarım</button><button className={activeView === "history" ? "active" : ""} onClick={() => navigate("history")}><History size={17} />Geçmiş</button><button className={activeView === "settings" ? "active" : ""} onClick={() => navigate("settings")}><Settings size={17} />Ayarlar</button></nav>
      <footer className="footer"><span><Music2 size={15} /> playlistpilot</span><p>Spotify&apos;dan YouTube Music&apos;e, gizlilik odaklı aktarım.</p><a href="https://github.com/Haydarozlukk" target="_blank" rel="noreferrer">Built by <b>@haydarozlukk</b> <ExternalLink size={12} /></a></footer>
    </main>
  );
}
