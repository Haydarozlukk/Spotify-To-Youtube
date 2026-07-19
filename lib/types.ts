export type MatchStatus = "matched" | "review" | "missing";
export type YouTubeKind = "Official Audio" | "Official Video" | "Lyrics" | "Unknown";

export type TrackMatch = {
  id: string;
  spotifyTitle: string;
  artist: string;
  album: string;
  spotifyImage: string | null;
  spotifyDurationMs: number;
  duration: string;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  youtubeThumbnail: string | null;
  youtubeTitle: string | null;
  channel: string | null;
  youtubeDuration: string | null;
  confidence: number;
  status: MatchStatus;
  kind: YouTubeKind;
  approved?: boolean;
  alternatives?: YouTubeMatch[];
};

export type Candidate = {
  id: string;
  title: string;
  channel: string;
  durationMs: number;
  thumbnail?: string | null;
};

export type YouTubeMatch = {
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  youtubeThumbnail: string | null;
  youtubeTitle: string | null;
  channel: string | null;
  youtubeDuration: string | null;
  confidence: number;
  status: MatchStatus;
  kind: YouTubeKind;
};
