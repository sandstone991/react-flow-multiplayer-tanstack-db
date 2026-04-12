import type { SyncConfig } from "@tanstack/db";

import {
	type BatchChangeEvent,
	type ChangeItem,
	DIAGRAM_CHANGE_EVENT_TYPE,
	DIAGRAM_SSE_EVENT_NAME,
	type DiagramChangeTable,
	diagramBatchChangeEventSchema,
	diagramEventsInitialPayloadSchema,
} from "../events";

const connections = new Map<
	string,
	{ eventSource: EventSource; refCount: number }
>();

export function getSharedEventSource(diagramId: string): EventSource {
	let connection = connections.get(diagramId);
	if (!connection) {
		connection = {
			eventSource: new EventSource(`/api/diagrams/${diagramId}/events`),
			refCount: 0,
		};
		connections.set(diagramId, connection);
	}
	connection.refCount++;
	return connection.eventSource;
}

export function releaseSharedEventSource(diagramId: string): void {
	const connection = connections.get(diagramId);
	if (connection && --connection.refCount <= 0) {
		connection.eventSource.close();
		connections.delete(diagramId);
	}
}

const TXID_SYNC_TIMEOUT_MS = 5000;
const MAX_SEEN_TXIDS = 1000;

export type Txid = string;

type PendingTxidWait = {
	resolve: () => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
};

export type TxidTracker = {
	seenTxids: Set<Txid>;
	pendingWaits: Map<Txid, PendingTxidWait[]>;
};

export function createTxidTracker(): TxidTracker {
	return {
		seenTxids: new Set(),
		pendingWaits: new Map(),
	};
}

function recordSeenTxid(tracker: TxidTracker, txid: Txid): void {
	tracker.seenTxids.add(txid);

	if (tracker.seenTxids.size > MAX_SEEN_TXIDS) {
		const excess = tracker.seenTxids.size - MAX_SEEN_TXIDS;
		const iter = tracker.seenTxids.values();
		for (let i = 0; i < excess; i++) {
			const result = iter.next();
			if (result.done) break;
			tracker.seenTxids.delete(result.value);
		}
	}

	const waits = tracker.pendingWaits.get(txid);
	if (!waits) return;
	tracker.pendingWaits.delete(txid);
	for (const wait of waits) {
		clearTimeout(wait.timeout);
		wait.resolve();
	}
}

function rejectPendingTxidWaits(tracker: TxidTracker): void {
	for (const [txid, waits] of tracker.pendingWaits) {
		for (const wait of waits) {
			clearTimeout(wait.timeout);
			wait.reject(new Error(`Cancelled waiting for txid ${txid} to sync.`));
		}
	}
	tracker.pendingWaits.clear();
}

export function awaitTxId(
	tracker: TxidTracker,
	txid: Txid,
	timeoutMs = TXID_SYNC_TIMEOUT_MS,
): Promise<void> {
	if (tracker.seenTxids.has(txid)) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		const wait: PendingTxidWait = {
			resolve,
			reject,
			timeout: setTimeout(() => {
				const waits = tracker.pendingWaits.get(txid);
				if (waits) {
					const idx = waits.indexOf(wait);
					if (idx >= 0) waits.splice(idx, 1);
					if (waits.length === 0) tracker.pendingWaits.delete(txid);
				}
				reject(
					new Error(
						`Timed out waiting ${timeoutMs}ms for txid ${txid} to sync.`,
					),
				);
			}, timeoutMs),
		};

		const waits = tracker.pendingWaits.get(txid);
		if (waits) {
			waits.push(wait);
		} else {
			tracker.pendingWaits.set(txid, [wait]);
		}
	});
}

// ── Write helper ────────────────────────────────────────────────────────────

type WriteMessage<T> =
	| { type: typeof DIAGRAM_CHANGE_EVENT_TYPE.INSERT; value: T }
	| { type: typeof DIAGRAM_CHANGE_EVENT_TYPE.UPDATE; key: string; value: T }
	| { type: typeof DIAGRAM_CHANGE_EVENT_TYPE.DELETE; key: string; value: T };

function writeChange<T>(
	write: (msg: WriteMessage<T>) => void,
	change: ChangeItem,
): void {
	const value = (change.value ?? {}) as T;
	switch (change.type) {
		case DIAGRAM_CHANGE_EVENT_TYPE.INSERT:
			write({ type: DIAGRAM_CHANGE_EVENT_TYPE.INSERT, value });
			break;
		case DIAGRAM_CHANGE_EVENT_TYPE.UPDATE:
			write({ type: DIAGRAM_CHANGE_EVENT_TYPE.UPDATE, key: change.key, value });
			break;
		case DIAGRAM_CHANGE_EVENT_TYPE.DELETE:
			write({ type: DIAGRAM_CHANGE_EVENT_TYPE.DELETE, key: change.key, value });
			break;
	}
}

// ── Sync adapter factory ────────────────────────────────────────────────────

export function createDiagramSyncAdapter<T extends object>(
	diagramId: string,
	table: DiagramChangeTable,
	txidTracker: TxidTracker,
): SyncConfig<T> {
	return {
		sync: ({ begin, write, commit, markReady, truncate }) => {
			let ready = false;
			const buffer: Array<BatchChangeEvent> = [];

			const es = getSharedEventSource(diagramId);

			const handleInitial = (event: MessageEvent) => {
				try {
					const data = diagramEventsInitialPayloadSchema.parse(
						JSON.parse(event.data),
					);
					const items = data[table] as Array<T>;

					begin();
					truncate();
					for (const item of items) {
						write({ type: DIAGRAM_CHANGE_EVENT_TYPE.INSERT, value: item });
					}
					commit();

					ready = true;
					for (const batch of buffer) {
						applyBatch(batch);
					}
					buffer.length = 0;
					markReady();
				} catch (err) {
					console.error("[sync] Failed to parse initial SSE payload:", err);
				}
			};

			function applyBatch(batch: BatchChangeEvent): void {
				const relevant = batch.changes.filter((c) => c.table === table);
				if (relevant.length === 0) {
					recordSeenTxid(txidTracker, batch.txid);
					return;
				}

				begin();
				for (const change of relevant) {
					writeChange(write, change);
				}
				commit();
				recordSeenTxid(txidTracker, batch.txid);
			}

			const handleChange = (event: MessageEvent) => {
				try {
					const batch = diagramBatchChangeEventSchema.parse(
						JSON.parse(event.data),
					);

					if (!ready) {
						buffer.push(batch);
						return;
					}

					applyBatch(batch);
				} catch (err) {
					console.error("[sync] Failed to parse change SSE payload:", err);
				}
			};

			es.addEventListener(DIAGRAM_SSE_EVENT_NAME.INITIAL, handleInitial);
			es.addEventListener(DIAGRAM_SSE_EVENT_NAME.CHANGE, handleChange);

			return () => {
				es.removeEventListener(DIAGRAM_SSE_EVENT_NAME.INITIAL, handleInitial);
				es.removeEventListener(DIAGRAM_SSE_EVENT_NAME.CHANGE, handleChange);
				rejectPendingTxidWaits(txidTracker);
				releaseSharedEventSource(diagramId);
			};
		},
		rowUpdateMode: "full",
	};
}
