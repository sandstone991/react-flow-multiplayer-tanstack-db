import { useCallback, useEffect, useRef, useState } from "react";
import { useThrottledCallback } from "use-debounce";

import { useAuth } from "@/lib/auth/hooks";
import {
	getSharedEventSource,
	releaseSharedEventSource,
} from "./client-db/adapter";
import {
	type ConnectingFrom,
	DIAGRAM_SSE_EVENT_NAME,
	type PresenceState,
	presenceInitialPayloadSchema,
	presenceLeavePayloadSchema,
	presenceStateSchema,
} from "./events";
import { buildPresencePeerMap } from "./presence-state";

export type { ConnectingFrom, PresenceState } from "./events";

const CURSOR_THROTTLE_MS = 50;

export function usePresenceChannel(diagramId: string) {
	const { user } = useAuth();
	const [peers, setPeers] = useState<Map<string, PresenceState>>(new Map());

	// Mutable ref for the latest local state we've sent, so throttled sends
	// always ship the most recent values without re-creating callbacks.
	const localRef = useRef<Partial<PresenceState>>({
		cursor: null,
		selectedNodeIds: [],
		selectedEdgeIds: [],
		draggingNodeId: null,
		draggingPosition: null,
		connectingFrom: null,
	});

	const postPresence = useCallback(() => {
		fetch(`/api/diagrams/${diagramId}/presence`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(localRef.current),
			keepalive: true,
		}).catch((err) => {
			console.error("[presence] Failed to send presence update:", err);
		});
	}, [diagramId]);

	const schedulePresenceSend = useThrottledCallback(
		postPresence,
		CURSOR_THROTTLE_MS,
		{ leading: true, trailing: true },
	);

	const sendPresence = useCallback(
		(patch: Partial<PresenceState>) => {
			Object.assign(localRef.current, patch);
			schedulePresenceSend();
		},
		[schedulePresenceSend],
	);

	// Listen to presence SSE events on the shared EventSource
	useEffect(() => {
		const es = getSharedEventSource(diagramId);

		const handleInitial = (event: MessageEvent) => {
			try {
				const states = presenceInitialPayloadSchema.parse(
					JSON.parse(event.data),
				);
				setPeers(buildPresencePeerMap(states, user?.id));
			} catch (err) {
				console.error("[presence] Failed to parse initial payload:", err);
			}
		};

		const handleUpdate = (event: MessageEvent) => {
			try {
				const state = presenceStateSchema.parse(JSON.parse(event.data));
				if (user && state.userId === user.id) return;
				setPeers((prev) => {
					const next = new Map(prev);
					next.set(state.userId, state);
					return next;
				});
			} catch (err) {
				console.error("[presence] Failed to parse update payload:", err);
			}
		};

		const handleLeave = (event: MessageEvent) => {
			try {
				const { userId } = presenceLeavePayloadSchema.parse(
					JSON.parse(event.data),
				);
				setPeers((prev) => {
					const next = new Map(prev);
					next.delete(userId);
					return next;
				});
			} catch (err) {
				console.error("[presence] Failed to parse leave payload:", err);
			}
		};

		es.addEventListener(DIAGRAM_SSE_EVENT_NAME.PRESENCE_INITIAL, handleInitial);
		es.addEventListener(DIAGRAM_SSE_EVENT_NAME.PRESENCE_UPDATE, handleUpdate);
		es.addEventListener(DIAGRAM_SSE_EVENT_NAME.PRESENCE_LEAVE, handleLeave);

		return () => {
			es.removeEventListener(
				DIAGRAM_SSE_EVENT_NAME.PRESENCE_INITIAL,
				handleInitial,
			);
			es.removeEventListener(
				DIAGRAM_SSE_EVENT_NAME.PRESENCE_UPDATE,
				handleUpdate,
			);
			es.removeEventListener(
				DIAGRAM_SSE_EVENT_NAME.PRESENCE_LEAVE,
				handleLeave,
			);
			releaseSharedEventSource(diagramId);
		};
	}, [diagramId, user]);

	useEffect(() => schedulePresenceSend.cancel, [schedulePresenceSend]);

	const sendCursor = useCallback(
		(point: { x: number; y: number } | null) => {
			sendPresence({ cursor: point });
		},
		[sendPresence],
	);

	const sendSelection = useCallback(
		(nodeIds: string[], edgeIds: string[]) => {
			sendPresence({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds });
		},
		[sendPresence],
	);

	const sendDrag = useCallback(
		(nodeId: string | null, position: { x: number; y: number } | null) => {
			sendPresence({ draggingNodeId: nodeId, draggingPosition: position });
		},
		[sendPresence],
	);

	const sendConnecting = useCallback(
		(from: ConnectingFrom | null) => {
			sendPresence({ connectingFrom: from });
		},
		[sendPresence],
	);

	return {
		peers,
		sendCursor,
		sendSelection,
		sendDrag,
		sendConnecting,
	};
}
