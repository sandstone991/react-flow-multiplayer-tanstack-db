import {
	type DeltaEvent,
	debounceStrategy,
	useLiveQuery,
	useLiveQueryEffect,
	usePacedMutations,
} from "@tanstack/react-db";
import {
	applyEdgeChanges,
	applyNodeChanges,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
} from "@xyflow/react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { awaitTxId } from "@/lib/diagrams/client-db/adapter";
import {
	getDiagramCollections,
	releaseDiagramCollections,
} from "@/lib/diagrams/client-db/collections";
import { DiagramEdges } from "@/lib/diagrams/client-db/diagram-edges";
import { DiagramNodes } from "@/lib/diagrams/client-db/diagram-nodes";
import { $applyDiagramMutations } from "@/lib/diagrams/functions";
import {
	DEFAULT_EDGE_STYLE,
	persistedFlowEdgeStateSchema,
	persistedFlowNodeStateSchema,
	toFlowEdge,
	toFlowNode,
} from "@/lib/diagrams/react-flow-transform";
import type { DiagramEdge, DiagramNode } from "@/lib/diagrams/schemas";

function mergeFlowNode(node: Node, dbNode: DiagramNode): Node {
	return {
		...node,
		...persistedFlowNodeStateSchema.parse(dbNode),
	};
}

function mergeFlowEdge(edge: Edge, dbEdge: DiagramEdge): Edge {
	return {
		...edge,
		...persistedFlowEdgeStateSchema.parse(dbEdge),
		style: edge.style ?? DEFAULT_EDGE_STYLE,
	};
}

enum MutateKind {
	NodeChanges = "nodeChanges",
	EdgeChanges = "edgeChanges",
	Explicit = "explicit",
}

type MutatePayload =
	| { kind: MutateKind.NodeChanges; changes: NodeChange[] }
	| { kind: MutateKind.EdgeChanges; changes: EdgeChange[] }
	| { kind: MutateKind.Explicit; callback: () => void };

function applyNodeDbEvents(
	previousNodes: Node[],
	events: Array<DeltaEvent<DiagramNode, string | number>>,
): Node[] {
	const nodesById = new Map(previousNodes.map((node) => [node.id, node]));
	const orderedIds = previousNodes.map((node) => node.id);

	for (const event of events) {
		const dbNode = event.value;

		switch (event.type) {
			case "exit": {
				nodesById.delete(dbNode.id);
				break;
			}
			case "enter":
			case "update": {
				const existing = nodesById.get(dbNode.id);
				if (existing) {
					nodesById.set(dbNode.id, mergeFlowNode(existing, dbNode));
					break;
				}

				nodesById.set(dbNode.id, toFlowNode(dbNode));
				orderedIds.push(dbNode.id);
				break;
			}
		}
	}

	return orderedIds
		.map((id) => nodesById.get(id))
		.filter((node): node is Node => Boolean(node));
}

function applyEdgeDbEvents(
	previousEdges: Edge[],
	events: Array<DeltaEvent<DiagramEdge, string | number>>,
): Edge[] {
	const edgesById = new Map(previousEdges.map((edge) => [edge.id, edge]));
	const orderedIds = previousEdges.map((edge) => edge.id);

	for (const event of events) {
		const dbEdge = event.value;

		switch (event.type) {
			case "exit": {
				edgesById.delete(dbEdge.id);
				break;
			}
			case "enter":
			case "update": {
				const existing = edgesById.get(dbEdge.id);
				if (existing) {
					edgesById.set(dbEdge.id, mergeFlowEdge(existing, dbEdge));
					break;
				}

				edgesById.set(dbEdge.id, toFlowEdge(dbEdge));
				orderedIds.push(dbEdge.id);
				break;
			}
		}
	}

	return orderedIds
		.map((id) => edgesById.get(id))
		.filter((edge): edge is Edge => Boolean(edge));
}

type SyncContextValue = {
	diagramId: string;
	nodes: Node[];
	edges: Edge[];
	isLoading: boolean;
	diagramNodes: DiagramNodes;
	diagramEdges: DiagramEdges;
	onNodesChange: (changes: NodeChange[]) => void;
	onEdgesChange: (changes: EdgeChange[]) => void;
	mutate: (callback: () => void) => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({
	diagramId,
	children,
}: {
	diagramId: string;
	children: ReactNode;
}) {
	const value = useSyncController(diagramId);
	return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
	const context = useContext(SyncContext);
	if (!context) {
		throw new Error("useSync must be used within SyncProvider");
	}
	return context;
}

function useSyncController(diagramId: string): SyncContextValue {
	const {
		nodes: nodeCollection,
		edges: edgeCollection,
		txids,
	} = useMemo(() => getDiagramCollections(diagramId), [diagramId]);

	useEffect(() => {
		return () => releaseDiagramCollections(diagramId);
	}, [diagramId]);

	const { isLoading: nodesLoading } = useLiveQuery(
		(q) => q.from({ node: nodeCollection }),
		[nodeCollection],
	);
	const { isLoading: edgesLoading } = useLiveQuery(
		(q) => q.from({ edge: edgeCollection }),
		[edgeCollection],
	);

	const [nodes, setNodes] = useState<Node[]>([]);
	const [edges, setEdges] = useState<Edge[]>([]);

	const diagramNodes = useMemo(
		() => new DiagramNodes(nodeCollection, diagramId),
		[nodeCollection, diagramId],
	);
	const diagramEdges = useMemo(
		() => new DiagramEdges(edgeCollection, diagramId),
		[edgeCollection, diagramId],
	);

	useLiveQueryEffect<DiagramNode>(
		{
			id: `diagram-flow-nodes-${diagramId}`,
			query: (q) => q.from({ node: nodeCollection }),
			onBatch: (events) => {
				setNodes((previousNodes) => applyNodeDbEvents(previousNodes, events));
			},
		},
		[diagramId, nodeCollection],
	);

	useLiveQueryEffect<DiagramEdge>(
		{
			id: `diagram-flow-edges-${diagramId}`,
			query: (q) => q.from({ edge: edgeCollection }),
			onBatch: (events) => {
				setEdges((previousEdges) => applyEdgeDbEvents(previousEdges, events));
			},
		},
		[diagramId, edgeCollection],
	);

	const pacedMutate = usePacedMutations<MutatePayload>({
		onMutate: (payload) => {
			switch (payload.kind) {
				case MutateKind.NodeChanges:
					diagramNodes.handleChanges(payload.changes);
					break;
				case MutateKind.EdgeChanges:
					diagramEdges.handleChanges(payload.changes);
					break;
				case MutateKind.Explicit:
					payload.callback();
					break;
			}
		},
		mutationFn: async ({ transaction }) => {
			const nodeUpserts: DiagramNode[] = [];
			const nodeDeletes: string[] = [];
			const edgeUpserts: DiagramEdge[] = [];
			const edgeDeletes: string[] = [];

			for (const mutation of transaction.mutations) {
				const isNode = mutation.collection.id === nodeCollection.id;
				const isEdge = mutation.collection.id === edgeCollection.id;
				if (!isNode && !isEdge) continue;

				if (mutation.type === "insert" || mutation.type === "update") {
					if (isNode) nodeUpserts.push(mutation.modified as DiagramNode);
					else edgeUpserts.push(mutation.modified as DiagramEdge);
				} else if (mutation.type === "delete") {
					const id = (mutation.original as { id: string }).id;
					if (isNode) nodeDeletes.push(id);
					else edgeDeletes.push(id);
				}
			}

			if (
				nodeUpserts.length === 0 &&
				nodeDeletes.length === 0 &&
				edgeUpserts.length === 0 &&
				edgeDeletes.length === 0
			) {
				return;
			}

			const { txid } = await $applyDiagramMutations({
				data: { diagramId, nodeUpserts, nodeDeletes, edgeUpserts, edgeDeletes },
			});

			await awaitTxId(txids, txid);
		},
		strategy: debounceStrategy({ wait: 0 }),
	});

	const onNodesChange = useCallback(
		(changes: NodeChange[]) => {
			setNodes((prev) => applyNodeChanges(changes, prev));
			pacedMutate({ kind: MutateKind.NodeChanges, changes });
		},
		[pacedMutate],
	);

	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => {
			setEdges((prev) => applyEdgeChanges(changes, prev));
			pacedMutate({ kind: MutateKind.EdgeChanges, changes });
		},
		[pacedMutate],
	);

	const mutate = useCallback(
		(callback: () => void) => {
			pacedMutate({ kind: MutateKind.Explicit, callback });
		},
		[pacedMutate],
	);

	return {
		diagramId,
		nodes,
		edges,
		isLoading: nodesLoading || edgesLoading,
		diagramNodes,
		diagramEdges,
		onNodesChange,
		onEdgesChange,
		mutate,
	};
}
