import type { PresenceState } from "./events";

export function buildPresencePeerMap(
	states: PresenceState[],
	currentUserId?: string,
): Map<string, PresenceState> {
	const peers = new Map<string, PresenceState>();
	for (const state of states) {
		if (currentUserId && state.userId === currentUserId) continue;
		peers.set(state.userId, state);
	}
	return peers;
}
