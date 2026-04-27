/**
 * Per-user event bus.
 *
 * Sprint F #21 scaffold. Today this is an in-process EventEmitter so a
 * single-replica deploy (or local dev) gets real-time fanout for free.
 *
 * For multi-replica production, set UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN and the bus will additionally publish to a
 * Redis channel and subscribe to it on every replica, so a notification
 * created on replica A reaches an SSE client connected to replica B.
 * That bridge is intentionally stubbed (commented TODO) until owner
 * provisions Upstash — the scaffolding shape is fixed so wiring is a
 * one-file change.
 *
 * Channel format: `notifications:<userId>`. Payload is opaque JSON.
 */
import { EventEmitter } from 'node:events';

export type EventPayload = {
  type: string;
  data: Record<string, unknown>;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

function channel(userId: string) {
  return `notifications:${userId}`;
}

/**
 * Publish an event to all subscribers for a user. Currently only fires
 * the in-process EventEmitter; Upstash bridge is the next addition
 * once REST creds land.
 */
export function publish(userId: string, payload: EventPayload): void {
  emitter.emit(channel(userId), payload);
  // TODO: when UPSTASH_REDIS_REST_URL is set, also POST to
  //   /publish/notifications:<userId> on Upstash so other replicas pick
  //   it up via their own subscriber.
}

/**
 * Subscribe to a user's notifications. Returns an unsubscribe function.
 * The handler is called for every published EventPayload until
 * unsubscribe() is invoked.
 */
export function subscribe(
  userId: string,
  handler: (p: EventPayload) => void,
): () => void {
  const ch = channel(userId);
  emitter.on(ch, handler);
  return () => {
    emitter.off(ch, handler);
  };
}
