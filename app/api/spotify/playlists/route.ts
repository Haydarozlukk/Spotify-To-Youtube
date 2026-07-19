import { NextRequest, NextResponse } from "next/server";
import { spotifyErrorResponse, spotifyFetch } from "@/lib/spotify-server";

type SpotifyPlaylist = {
  id: string; name: string; description?: string; images?: Array<{ url: string }>;
  external_urls?: { spotify?: string }; items?: { total: number }; tracks?: { total: number };
};
type Page = { items: SpotifyPlaylist[]; next: string | null; total: number; limit: number; offset: number };

export async function GET(request: NextRequest) {
  try {
    const all: SpotifyPlaylist[] = [];
    let offset = 0;
    for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
      const page = await spotifyFetch<Page>(`/me/playlists?limit=50&offset=${offset}`, request);
      all.push(...page.items);
      if (!page.next) break;
      offset += page.limit;
    }
    return NextResponse.json({ playlists: all.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      count: playlist.items?.total ?? playlist.tracks?.total ?? 0,
      image: playlist.images?.[0]?.url || null,
      spotifyUrl: playlist.external_urls?.spotify || null,
    })) });
  } catch (error) { return spotifyErrorResponse(error); }
}
