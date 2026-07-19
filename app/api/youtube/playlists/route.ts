import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { googleErrorResponse, googleFetch } from "@/lib/google-server";

type PlaylistPage = {
  items: Array<{
    id: string;
    snippet: { title: string; thumbnails?: { medium?: { url: string }; default?: { url: string } } };
    contentDetails: { itemCount: number };
  }>;
  nextPageToken?: string;
};

const createPlaylistSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).optional(),
  privacy: z.enum(["private", "unlisted"]).default("private"),
});

export async function GET(request: NextRequest) {
  try {
    const playlists: PlaylistPage["items"] = [];
    let pageToken = "";
    for (let page = 0; page < 10; page += 1) {
      const params = new URLSearchParams({ part: "snippet,contentDetails", mine: "true", maxResults: "50" });
      if (pageToken) params.set("pageToken", pageToken);
      const result = await googleFetch<PlaylistPage>(`/playlists?${params}`, request);
      playlists.push(...result.items);
      if (!result.nextPageToken) break;
      pageToken = result.nextPageToken;
    }
    return NextResponse.json({ playlists: playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.snippet.title,
      count: playlist.contentDetails.itemCount,
      image: playlist.snippet.thumbnails?.medium?.url || playlist.snippet.thumbnails?.default?.url || null,
    })) });
  } catch (error) { return googleErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const input = createPlaylistSchema.parse(await request.json());
    const playlist = await googleFetch<{ id: string; snippet: { title: string } }>(
      "/playlists?part=snippet,status",
      request,
      {
        method: "POST",
        body: JSON.stringify({
          snippet: {
            title: input.title,
            description: input.description || "Spotify'dan Playlist Pilot ile aktarıldı.",
          },
          status: { privacyStatus: input.privacy },
        }),
      },
    );
    return NextResponse.json({
      playlist: {
        id: playlist.id,
        name: playlist.snippet.title,
        url: `https://music.youtube.com/playlist?list=${playlist.id}`,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Geçersiz playlist bilgisi." }, { status: 400 });
    return googleErrorResponse(error);
  }
}
