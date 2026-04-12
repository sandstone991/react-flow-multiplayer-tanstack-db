import "@tanstack/react-start/server-only";

import { type BatchChangeEvent, diagramBatchChangeEventSchema } from "./events";

export type { BatchChangeEvent } from "./events";

const listeners = new Map<string, Set<(event: BatchChangeEvent) => void>>();

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
	return () => {
		listeners.get(diagramId)?.delete(cb);
		if (listeners.get(diagramId)?.size === 0) {
			listeners.delete(diagramId);
		}
	};
}

export function publish(event: BatchChangeEvent): void {
	const parsed = diagramBatchChangeEventSchema.parse(event);
	listeners.get(parsed.diagramId)?.forEach((cb) => {
		cb(parsed);
	});
}
