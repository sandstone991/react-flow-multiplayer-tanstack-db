import { z } from "zod";

import { diagramEdgeSchema, diagramNodeSchema } from "./schemas";

export enum DIAGRAM_CHANGE_EVENT_TYPE {
	INSERT = "insert",
	UPDATE = "update",
	DELETE = "delete",
}

export const diagramChangeEventTypeSchema = z.enum(DIAGRAM_CHANGE_EVENT_TYPE);

export type DiagramChangeEventType = z.output<
	typeof diagramChangeEventTypeSchema
>;

export enum DIAGRAM_CHANGE_TABLE {
	NODES = "nodes",
	EDGES = "edges",
}

export const diagramChangeTableSchema = z.enum(DIAGRAM_CHANGE_TABLE);
export type DiagramChangeTable = z.output<typeof diagramChangeTableSchema>;

export const diagramChangeItemSchema = z.object({
	type: diagramChangeEventTypeSchema,
	table: diagramChangeTableSchema,
	key: z.string(),
	value: z.record(z.string(), z.unknown()).optional(),
});
export type ChangeItem = z.output<typeof diagramChangeItemSchema>;

export const diagramBatchChangeEventSchema = z.object({
	diagramId: z.string(),
	txid: z.string(),
	changes: z.array(diagramChangeItemSchema),
});
export type BatchChangeEvent = z.output<typeof diagramBatchChangeEventSchema>;

export const diagramEventsInitialPayloadSchema = z.object({
	nodes: z.array(diagramNodeSchema),
	edges: z.array(diagramEdgeSchema),
});
export type DiagramEventsInitialPayload = z.output<
	typeof diagramEventsInitialPayloadSchema
>;

export enum DIAGRAM_SSE_EVENT_NAME {
	INITIAL = "initial",
	CHANGE = "change",
	PRESENCE_INITIAL = "presence-initial",
	PRESENCE_UPDATE = "presence-update",
	PRESENCE_LEAVE = "presence-leave",
}

export const diagramSseEventNameSchema = z.enum(DIAGRAM_SSE_EVENT_NAME);
export type DiagramSseEventName = z.output<typeof diagramSseEventNameSchema>;

export enum PRESENCE_HANDLE_TYPE {
	SOURCE = "source",
	TARGET = "target",
}

export const presenceHandleTypeSchema = z.enum(PRESENCE_HANDLE_TYPE);
export type PresenceHandleType = z.output<typeof presenceHandleTypeSchema>;

export const presencePointSchema = z.object({
	x: z.number(),
	y: z.number(),
});
export type PresencePoint = z.output<typeof presencePointSchema>;

export const connectingFromSchema = z.object({
	nodeId: z.string(),
	handleId: z.string().nullable(),
	handleType: presenceHandleTypeSchema,
});
export type ConnectingFrom = z.output<typeof connectingFromSchema>;

export const presenceStateSchema = z.object({
	userId: z.string(),
	userName: z.string(),
	userColor: z.string(),
	cursor: presencePointSchema.nullable(),
	selectedNodeIds: z.array(z.string()),
	selectedEdgeIds: z.array(z.string()),
	draggingNodeId: z.string().nullable(),
	draggingPosition: presencePointSchema.nullable(),
	connectingFrom: connectingFromSchema.nullable(),
});
export type PresenceState = z.output<typeof presenceStateSchema>;

export const presencePatchSchema = presenceStateSchema
	.omit({
		userId: true,
		userName: true,
		userColor: true,
	})
	.partial();
export type PresencePatch = z.output<typeof presencePatchSchema>;

export enum PRESENCE_EVENT_TYPE {
	UPDATE = "update",
	LEAVE = "leave",
}

export const presenceEventTypeSchema = z.enum(PRESENCE_EVENT_TYPE);
export type PresenceEventType = z.output<typeof presenceEventTypeSchema>;

export const presenceEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(PRESENCE_EVENT_TYPE.UPDATE),
		state: presenceStateSchema,
	}),
	z.object({
		type: z.literal(PRESENCE_EVENT_TYPE.LEAVE),
		userId: z.string(),
	}),
]);
export type PresenceEvent = z.output<typeof presenceEventSchema>;

export const presenceInitialPayloadSchema = z.array(presenceStateSchema);

export const presenceLeavePayloadSchema = z.object({
	userId: z.string(),
});
