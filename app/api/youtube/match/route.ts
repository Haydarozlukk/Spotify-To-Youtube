import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { googleErrorResponse, googleFetch } from "@/lib/google-server";
import { decodeYouTubeText, parseYouTubeDuration, rankYouTubeMatches, selectBestYouTubeMatch } from "@/lib/youtube";

const trackSchema = z.object({
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().min(1).max(300),
  durationMs: z.number().int().positive().max(24 * 60 * 60 * 1000),
});

type SearchResponse = {
  items: Array<{
    id: { videoId?: string };
    snippet: { title: string; channelTitle: string; liveBroadcastContent?: string };
  }>;
};

type VideosResponse = {
  items: Array<{
    id: string;
    snippet: { title: string; channelTitle: string; thumbnails?: { medium?: { url: string }; default?: { url: string } } };
    contentDetails: { duration: string };
    status?: { uploadStatus?: string };
  }>;
};

export async function POST(request: NextRequest) {
  try {
    const input = trackSchema.parse(await request.json());
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      videoCategoryId: "10",
      maxResults: "5",
      q: `${input.artist} ${input.title}`,
    });
    const search = await googleFetch<SearchResponse>(`/search?${params}`, request);
    const ids = search.items
      .filter((item) => item.snippet.liveBroadcastContent !== "live")
      .map((item) => item.id.videoId)
      .filter((id): id is string => Boolean(id));

    if (!ids.length) return NextResponse.json({ match: selectBestYouTubeMatch({ ...input, candidates: [] }), candidates: [] });

    const videos = await googleFetch<VideosResponse>(
      `/videos?${new URLSearchParams({ part: "snippet,contentDetails,status", id: ids.join(",") })}`,
      request,
    );
    const candidates = videos.items
      .filter((video) => video.status?.uploadStatus !== "rejected")
      .map((video) => ({
        id: video.id,
        title: decodeYouTubeText(video.snippet.title),
        channel: decodeYouTubeText(video.snippet.channelTitle),
        durationMs: parseYouTubeDuration(video.contentDetails.duration),
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || null,
      }))
      .filter((candidate) => candidate.durationMs >= 30_000);

    return NextResponse.json({
      match: selectBestYouTubeMatch({ ...input, candidates }),
      candidates: rankYouTubeMatches({ ...input, candidates }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Geçersiz parça bilgisi." }, { status: 400 });
    return googleErrorResponse(error);
  }
}
