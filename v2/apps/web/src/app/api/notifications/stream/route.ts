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

  let cleanup: (() => void) | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (payload: EventPayload) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${payload.type}\ndata: ${JSON.stringify(payload.data)}\n\n`,
            ),
          );
        } catch {
          // Controller already closed (client disconnected mid-flight).
          closed = true;
        }
      };
      // Heartbeat every 25s to keep the connection open through proxies
      // (Vercel's edge has a 30s idle timeout on streams).
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
        }
      }, 25_000);
      const unsubscribe = subscribe(userId, send);
      // First message tells the client the channel is live so the UI
      // can flip from "polling" to "live".
      send({ type: 'ready', data: { userId } });
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
    },
    cancel() {
      // Client disconnected. Free the heartbeat + bus subscription so
      // we don't leak listeners on long-running processes.
      cleanup?.();
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
