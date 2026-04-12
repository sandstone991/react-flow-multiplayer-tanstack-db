import {
	type NodeChange,
	type OnConnectEnd,
	type OnConnectStart,
	useReactFlow,
} from "@xyflow/react";
import {
	createContext,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	PRESENCE_HANDLE_TYPE,
	presenceHandleTypeSchema,
} from "@/lib/diagrams/events";
import {
	type PresenceState,
	usePresenceChannel,
} from "@/lib/diagrams/presence";
import { useSync } from "@/providers/sync";

type PresenceContextValue = {
	peers: Map<string, PresenceState>;
	localDraggingNodeIds: ReadonlySet<string>;
	selectedNodeIds: string[];
	selectedEdgeIds: string[];
	hasSelection: boolean;
	onNodesChange: (changes: NodeChange[]) => void;
	onConnectStart: OnConnectStart;
	onConnectEnd: OnConnectEnd;
	onMouseMove: (event: ReactMouseEvent) => void;
	onMouseLeave: () => void;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({
	diagramId,
	children,
}: {
	diagramId: string;
	children: ReactNode;
}) {
	const value = usePresenceController(diagramId);
	return (
		<PresenceContext.Provider value={value}>
			{children}
		</PresenceContext.Provider>
	);
}

export function usePresence(): PresenceContextValue {
	const context = useContext(PresenceContext);
	if (!context) {
		throw new Error("usePresence must be used within PresenceProvider");
	}
	return context;
}

function usePresenceController(diagramId: string): PresenceContextValue {
	const { peers, sendCursor, sendSelection, sendDrag, sendConnecting } =
		usePresenceChannel(diagramId);
	const { nodes, edges } = useSync();
	const reactFlow = useReactFlow();

	// ── Drag tracking ───────────────────────────────────────────────────────

	const draggingRef = useRef<Set<string>>(new Set());
	const [localDraggingNodeIds, setLocalDraggingNodeIds] = useState<
		ReadonlySet<string>
	>(new Set());

	const onNodesChange = useCallback(
		(changes: NodeChange[]) => {
			let changed = false;
			for (const change of changes) {
				if (change.type !== "position") continue;

				if (change.dragging) {
					if (!draggingRef.current.has(change.id)) {
						draggingRef.current.add(change.id);
						changed = true;
					}
					if (change.position) sendDrag(change.id, change.position);
				} else if (draggingRef.current.has(change.id)) {
					draggingRef.current.delete(change.id);
					changed = true;
					sendDrag(null, null);
				}
			}
			if (changed) {
				setLocalDraggingNodeIds(new Set(draggingRef.current));
			}
		},
		[sendDrag],
	);

	// ── Cursor tracking ─────────────────────────────────────────────────────

	const onMouseMove = useCallback(
		(event: ReactMouseEvent) => {
			const position = reactFlow.screenToFlowPosition({
				x: event.clientX,
				y: event.clientY,
			});
			sendCursor(position);
		},
		[reactFlow, sendCursor],
	);

	const onMouseLeave = useCallback(() => {
		sendCursor(null);
	}, [sendCursor]);

	// ── Connection tracking ────────────────────────────────────────────────

	const onConnectStart: OnConnectStart = useCallback(
		(_event, params) => {
			if (!params.nodeId) return;
			sendConnecting({
				nodeId: params.nodeId,
				handleId: params.handleId,
				handleType: presenceHandleTypeSchema.parse(
					params.handleType ?? PRESENCE_HANDLE_TYPE.SOURCE,
				),
			});
		},
		[sendConnecting],
	);

	const onConnectEnd: OnConnectEnd = useCallback(() => {
		sendConnecting(null);
	}, [sendConnecting]);

	// ── Selection sync ──────────────────────────────────────────────────────

	const selectedNodeIds = useMemo(
		() => nodes.filter((n) => n.selected).map((n) => n.id),
		[nodes],
	);
	const selectedEdgeIds = useMemo(
		() => edges.filter((e) => e.selected).map((e) => e.id),
		[edges],
	);
	const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;

	const prevSelectionRef = useRef<string>("");
	useEffect(() => {
		const key = `${[...selectedNodeIds].sort().join(",")}|${[...selectedEdgeIds]
			.sort()
			.join(",")}`;
		if (key === prevSelectionRef.current) return;
		prevSelectionRef.current = key;
		sendSelection(selectedNodeIds, selectedEdgeIds);
	}, [selectedNodeIds, selectedEdgeIds, sendSelection]);

	return {
		peers,
		localDraggingNodeIds,
		selectedNodeIds,
		selectedEdgeIds,
		hasSelection,
		onNodesChange,
		onConnectStart,
		onConnectEnd,
		onMouseMove,
		onMouseLeave,
	};
}
