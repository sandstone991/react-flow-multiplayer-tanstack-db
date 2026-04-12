import "@tanstack/react-start/server-only";

import {
	PRESENCE_EVENT_TYPE,
	type PresenceEvent,
	type PresenceState,
	presenceEventSchema,
	presenceStateSchema,
} from "./events";

export type { PresenceEvent, PresenceState } from "./events";

const PRESENCE_COLORS = [
	"#e63946",
	"#457b9d",
	"#2a9d8f",
	"#e9c46a",
	"#f4a261",
	"#264653",
	"#6a4c93",
	"#1982c4",
	"#8ac926",
	"#ff595e",
	"#ff924c",
	"#c77dff",
];

export function getUserColor(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = (hash * 31 + userId.charCodeAt(i)) | 0;
	}
	return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

// diagramId -> userId -> PresenceState
const states = new Map<string, Map<string, PresenceState>>();

// diagramId -> Set<callback>
const listeners = new Map<string, Set<(event: PresenceEvent) => void>>();

export function getPresenceStates(diagramId: string): PresenceState[] {
	const map = states.get(diagramId);
	return map ? Array.from(map.values()) : [];
}

export function updatePresence(diagramId: string, state: PresenceState): void {
	const parsed = presenceStateSchema.parse(state);
	let diagramStates = states.get(diagramId);
	if (!diagramStates) {
		diagramStates = new Map();
		states.set(diagramId, diagramStates);
	}
	diagramStates.set(parsed.userId, parsed);
	const event = presenceEventSchema.parse({
		type: PRESENCE_EVENT_TYPE.UPDATE,
		state: parsed,
	});
	listeners.get(diagramId)?.forEach((cb) => {
		cb(event);
	});
}

export function removePresence(diagramId: string, userId: string): void {
	states.get(diagramId)?.delete(userId);
	if (states.get(diagramId)?.size === 0) {
		states.delete(diagramId);
	}
	const event = presenceEventSchema.parse({
		type: PRESENCE_EVENT_TYPE.LEAVE,
		userId,
	});
	listeners.get(diagramId)?.forEach((cb) => {
		cb(event);
	});
}

export function subscribePresence(
	diagramId: string,
	cb: (event: PresenceEvent) => void,
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
