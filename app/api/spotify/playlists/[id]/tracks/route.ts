import { NextRequest, NextResponse } from "next/server";
import { spotifyErrorResponse, spotifyFetch } from "@/lib/spotify-server";

type SpotifyTrack = {
  id: string; name: string; duration_ms: number; type: string;
  artists?: Array<{ name: string }>;
  album?: { name: string; images?: Array<{ url: string }> };
  external_urls?: { spotify?: string };
};
type Page = { items: Array<{ item?: SpotifyTrack | null; track?: SpotifyTrack | null }>; next: string | null; limit: number };

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
    const tracks: SpotifyTrack[] = [];
    let offset = 0;
    for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
      const page = await spotifyFetch<Page>(`/playlists/${id}/items?limit=50&offset=${offset}`, request);
      for (const entry of page.items) {
        const item = entry.item || entry.track;
        if (item?.type === "track") tracks.push(item);
      }
      if (!page.next) break;
      offset += page.limit;
    }
    return NextResponse.json({ tracks: tracks.map((track) => ({
      id: track.id,
      title: track.name,
      artist: track.artists?.map((artist) => artist.name).join(", ") || "Bilinmeyen sanatçı",
      album: track.album?.name || "Bilinmeyen albüm",
      durationMs: track.duration_ms,
      image: track.album?.images?.[0]?.url || null,
      spotifyUrl: track.external_urls?.spotify || null,
    })) });
  } catch (error) { return spotifyErrorResponse(error); }
}
