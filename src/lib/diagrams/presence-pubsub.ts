import "@tanstack/react-start/server-only";

import { z } from "zod";

import {
	PRESENCE_EVENT_TYPE,
	type PresenceEvent,
	type PresenceState,
	presenceEventSchema,
	presenceStateSchema,
} from "./events";
import {
	getRedisOriginId,
	isRedisConfigured,
	publishRedisMessage,
	redisChannel,
	redisExpire,
	redisHashDelete,
	redisHashSet,
	redisHashValues,
	redisKey,
	subscribeRedisChannel,
} from "./redis";

export type { PresenceEvent, PresenceState } from "./events";

const PRESENCE_TTL_SECONDS = 60 * 60;

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

const redisPresenceEnvelopeSchema = z.object({
	origin: z.string(),
	event: presenceEventSchema,
});

function emitLocal(diagramId: string, event: PresenceEvent): void {
	listeners.get(diagramId)?.forEach((cb) => {
		cb(event);
	});
}

function setLocalPresenceState(diagramId: string, state: PresenceState): void {
	let diagramStates = states.get(diagramId);
	if (!diagramStates) {
		diagramStates = new Map();
		states.set(diagramId, diagramStates);
	}
	diagramStates.set(state.userId, state);
}

function deleteLocalPresenceState(diagramId: string, userId: string): void {
	states.get(diagramId)?.delete(userId);
	if (states.get(diagramId)?.size === 0) {
		states.delete(diagramId);
	}
}

function getLocalPresenceStates(diagramId: string): PresenceState[] {
	const map = states.get(diagramId);
	return map ? Array.from(map.values()) : [];
}

export async function getPresenceStates(
	diagramId: string,
): Promise<PresenceState[]> {
	if (!isRedisConfigured()) {
		return getLocalPresenceStates(diagramId);
	}

	try {
		const values = await redisHashValues(redisKey.presence(diagramId));
		return values.map((value) => presenceStateSchema.parse(JSON.parse(value)));
	} catch (error) {
		console.error("[presence] Failed to load Redis presence states:", error);
		return getLocalPresenceStates(diagramId);
	}
}

export async function updatePresence(
	diagramId: string,
	state: PresenceState,
): Promise<void> {
	const parsed = presenceStateSchema.parse(state);
	setLocalPresenceState(diagramId, parsed);

	const event = presenceEventSchema.parse({
		type: PRESENCE_EVENT_TYPE.UPDATE,
		state: parsed,
	});
	emitLocal(diagramId, event);

	if (!isRedisConfigured()) return;

	await Promise.all([
		redisHashSet(
			redisKey.presence(diagramId),
			parsed.userId,
			JSON.stringify(parsed),
		)
			.then(() =>
				redisExpire(redisKey.presence(diagramId), PRESENCE_TTL_SECONDS),
			)
			.catch((error) => {
				console.error(
					"[presence] Failed to store Redis presence state:",
					error,
				);
			}),
		publishRedisMessage(redisChannel.presence(diagramId), {
			origin: getRedisOriginId(),
			event,
		}).catch((error) => {
			console.error(
				"[presence] Failed to publish Redis presence event:",
				error,
			);
		}),
	]);
}

export async function removePresence(
	diagramId: string,
	userId: string,
): Promise<void> {
	deleteLocalPresenceState(diagramId, userId);

	const event = presenceEventSchema.parse({
		type: PRESENCE_EVENT_TYPE.LEAVE,
		userId,
	});
	emitLocal(diagramId, event);

	if (!isRedisConfigured()) return;

	await Promise.all([
		redisHashDelete(redisKey.presence(diagramId), userId).catch((error) => {
			console.error("[presence] Failed to remove Redis presence state:", error);
		}),
		publishRedisMessage(redisChannel.presence(diagramId), {
			origin: getRedisOriginId(),
			event,
		}).catch((error) => {
			console.error(
				"[presence] Failed to publish Redis presence leave:",
				error,
			);
		}),
	]);
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
	const unsubscribeRedis = subscribeRedisChannel(
		redisChannel.presence(diagramId),
		(message) => {
			try {
				const envelope = redisPresenceEnvelopeSchema.parse(JSON.parse(message));
				if (envelope.origin === getRedisOriginId()) return;
				if (envelope.event.type === PRESENCE_EVENT_TYPE.UPDATE) {
					setLocalPresenceState(diagramId, envelope.event.state);
				} else {
					deleteLocalPresenceState(diagramId, envelope.event.userId);
				}
				cb(envelope.event);
			} catch (error) {
				console.error(
					"[presence] Failed to parse Redis presence event:",
					error,
				);
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
