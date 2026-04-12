import type { Edge, Node } from "@xyflow/react";
import type { z } from "zod";

import { diagramEdgeSchema, diagramNodeSchema } from "./schemas";

export const DIAGRAM_NODE_TYPE = "diagramNode";
export const DEFAULT_EDGE_STYLE: Edge["style"] = { strokeWidth: 2 };

type PersistedFlowNodeStateOutput = Pick<
	Node,
	"id" | "type" | "position" | "data" | "width" | "height"
>;

type PersistedFlowEdgeStateOutput = Pick<
	Edge,
	| "id"
	| "source"
	| "target"
	| "sourceHandle"
	| "targetHandle"
	| "type"
	| "animated"
	| "data"
>;

export const persistedFlowNodeStateSchema = diagramNodeSchema.transform(
	(n): PersistedFlowNodeStateOutput => ({
		id: n.id,
		type: DIAGRAM_NODE_TYPE,
		position: { x: n.positionX, y: n.positionY },
		data: { label: String(n.data?.label ?? "Node"), ...n.data },
		width: n.width ?? undefined,
		height: n.height ?? undefined,
	}),
);

export const persistedFlowEdgeStateSchema = diagramEdgeSchema.transform(
	(e): PersistedFlowEdgeStateOutput => ({
		id: e.id,
		source: e.source,
		target: e.target,
		sourceHandle: e.sourceHandle ?? undefined,
		targetHandle: e.targetHandle ?? undefined,
		type: e.type ?? "smoothstep",
		animated: e.animated ?? false,
		data: e.data ?? undefined,
	}),
);

export type PersistedFlowNodeStateInput = z.input<
	typeof persistedFlowNodeStateSchema
>;
export type PersistedFlowNodeState = z.output<
	typeof persistedFlowNodeStateSchema
>;
export type PersistedFlowEdgeStateInput = z.input<
	typeof persistedFlowEdgeStateSchema
>;
export type PersistedFlowEdgeState = z.output<
	typeof persistedFlowEdgeStateSchema
>;

export function toFlowNode(n: PersistedFlowNodeStateInput): Node {
	return persistedFlowNodeStateSchema.parse(n);
}

export function toFlowEdge(e: PersistedFlowEdgeStateInput): Edge {
	return {
		...persistedFlowEdgeStateSchema.parse(e),
		style: DEFAULT_EDGE_STYLE,
	};
}
