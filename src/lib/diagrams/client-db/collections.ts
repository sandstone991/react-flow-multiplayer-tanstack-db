import { type Collection, createCollection } from "@tanstack/react-db";
import { DIAGRAM_CHANGE_TABLE } from "../events";
import type { DiagramEdge, DiagramNode } from "../schemas";
import { diagramEdgeSchema, diagramNodeSchema } from "../schemas";
import {
	createDiagramSyncAdapter,
	createTxidTracker,
	releaseSharedEventSource,
	type TxidTracker,
} from "./adapter";

type DiagramCollections = {
	nodes: Collection<DiagramNode, string | number>;
	edges: Collection<DiagramEdge, string | number>;
	txids: TxidTracker;
};

const collectionCache = new Map<string, DiagramCollections>();

export function getDiagramCollections(diagramId: string): DiagramCollections {
	const cached = collectionCache.get(diagramId);
	if (cached) return cached;

	const txids: TxidTracker = createTxidTracker();

	const nodes = createCollection({
		id: `diagram-nodes-${diagramId}`,
		getKey: (item: DiagramNode) => item.id,
		schema: diagramNodeSchema,
		sync: createDiagramSyncAdapter<DiagramNode>(
			diagramId,
			DIAGRAM_CHANGE_TABLE.NODES,
			txids,
		),
	});

	const edges = createCollection({
		id: `diagram-edges-${diagramId}`,
		getKey: (item: DiagramEdge) => item.id,
		schema: diagramEdgeSchema,
		sync: createDiagramSyncAdapter<DiagramEdge>(
			diagramId,
			DIAGRAM_CHANGE_TABLE.EDGES,
			txids,
		),
	});

	const collections: DiagramCollections = {
		nodes,
		edges,
		txids,
	};
	collectionCache.set(diagramId, collections);
	return collections;
}

export function releaseDiagramCollections(diagramId: string): void {
	collectionCache.delete(diagramId);
	releaseSharedEventSource(diagramId);
}
