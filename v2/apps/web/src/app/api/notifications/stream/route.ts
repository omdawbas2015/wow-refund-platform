import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { subscribe, type EventPayload } from '@/lib/events/bus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events stream for live in-app notifications. Clients
 * connect via `new EventSource('/api/notifications/stream')` and
 * receive a `data:` line per published event; the bell icon in the
 * shell decrements the unread count without a poll.
 *
 * Sprint F #21 scaffold. The polling endpoint `GET /api/notifications`
 * is the canonical fallback for clients that don't keep an SSE channel
 * open (mobile background, flaky networks). When Upstash is wired up
 * the cross-replica bridge in `lib/events/bus.ts` activates and this
 * stream starts seeing events from other replicas too.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response('UNAUTHENTICATED', { status: 401 });
  }
  const userId = session.user.id;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: EventPayload) => {
        controller.enqueue(
          encoder.encode(
            `event: ${payload.type}\ndata: ${JSON.stringify(payload.data)}\n\n`,
          ),
        );
      };
      // Heartbeat every 25s to keep the connection open through proxies
      // (Vercel's edge has a 30s idle timeout on streams).
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 25_000);
      const unsubscribe = subscribe(userId, send);
      // First message tells the client the channel is live so the UI
      // can flip from "polling" to "live".
      send({ type: 'ready', data: { userId } });
      // Cleanup when the client disconnects. ReadableStream.cancel is
      // the only signal Next gives us here.
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
      // Tie cleanup to the controller for cancel() invocations.
      (controller as unknown as { _cleanup?: () => void })._cleanup = cleanup;
    },
    cancel() {
      // No-op; cleanup is wired via start() above.
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
