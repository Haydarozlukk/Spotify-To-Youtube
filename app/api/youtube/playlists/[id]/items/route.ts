import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { googleErrorResponse, googleFetch } from "@/lib/google-server";

const itemSchema = z.object({ videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: playlistId } = await context.params;
    if (!/^[A-Za-z0-9_-]{10,80}$/.test(playlistId)) {
      return NextResponse.json({ error: "Geçersiz playlist kimliği." }, { status: 400 });
    }
    const { videoId } = itemSchema.parse(await request.json());
    const item = await googleFetch<{ id: string }>("/playlistItems?part=snippet", request, {
      method: "POST",
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: { kind: "youtube#video", videoId },
        },
      }),
    });
    return NextResponse.json({ itemId: item.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Geçersiz video kimliği." }, { status: 400 });
    return googleErrorResponse(error);
  }
}
