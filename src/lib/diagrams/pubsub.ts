import "@tanstack/react-start/server-only";

import { z } from "zod";

import { type BatchChangeEvent, diagramBatchChangeEventSchema } from "./events";
import {
	getRedisOriginId,
	publishRedisMessage,
	redisChannel,
	subscribeRedisChannel,
} from "./redis";

export type { BatchChangeEvent } from "./events";

const listeners = new Map<string, Set<(event: BatchChangeEvent) => void>>();

const redisDiagramChangeEnvelopeSchema = z.object({
	origin: z.string(),
	event: diagramBatchChangeEventSchema,
});

function emitLocal(event: BatchChangeEvent): void {
	listeners.get(event.diagramId)?.forEach((cb) => {
		cb(event);
	});
}

export function subscribe(
	diagramId: string,
	cb: (event: BatchChangeEvent) => void,
): () => void {
	let diagramListeners = listeners.get(diagramId);
	if (!diagramListeners) {
		diagramListeners = new Set();
		listeners.set(diagramId, diagramListeners);
	}
	diagramListeners.add(cb);
	const unsubscribeRedis = subscribeRedisChannel(
		redisChannel.diagramChanges(diagramId),
		(message) => {
			try {
				const envelope = redisDiagramChangeEnvelopeSchema.parse(
					JSON.parse(message),
				);
				if (envelope.origin === getRedisOriginId()) return;
				cb(envelope.event);
			} catch (error) {
				console.error("[pubsub] Failed to parse Redis diagram event:", error);
			}
		},
	);

	return () => {
		unsubscribeRedis();
		listeners.get(diagramId)?.delete(cb);
		if (listeners.get(diagramId)?.size === 0) {
			listeners.delete(diagramId);
		}
	};
}

export async function publish(event: BatchChangeEvent): Promise<void> {
	const parsed = diagramBatchChangeEventSchema.parse(event);
	emitLocal(parsed);
	try {
		await publishRedisMessage(redisChannel.diagramChanges(parsed.diagramId), {
			origin: getRedisOriginId(),
			event: parsed,
		});
	} catch (error) {
		console.error("[pubsub] Failed to publish Redis diagram event:", error);
	}
}
