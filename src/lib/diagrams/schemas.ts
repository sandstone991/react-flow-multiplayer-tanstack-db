import { z } from "zod";

export const diagramNodeSchema = z.object({
	id: z.string(),
	diagramId: z.string(),
	type: z.string(),
	positionX: z.number(),
	positionY: z.number(),
	data: z.record(z.string(), z.unknown()),
	width: z.number().nullable().optional(),
	height: z.number().nullable().optional(),
});

export type DiagramNode = z.infer<typeof diagramNodeSchema>;

export const diagramEdgeSchema = z.object({
	id: z.string(),
	diagramId: z.string(),
	source: z.string(),
	target: z.string(),
	sourceHandle: z.string().nullable().optional(),
	targetHandle: z.string().nullable().optional(),
	type: z.string().nullable().optional(),
	animated: z.boolean().optional(),
	data: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type DiagramEdge = z.infer<typeof diagramEdgeSchema>;

const diagramDateTimeSchema = z
	.union([z.iso.datetime(), z.date()])
	.default(() => new Date().toISOString())
	.transform((val) => (typeof val === "string" ? new Date(val) : val));

export const diagramSchema = z.object({
	id: z.string(),
	workspaceId: z.string(),
	name: z.string(),
	createdAt: diagramDateTimeSchema,
	updatedAt: diagramDateTimeSchema,
});

export type Diagram = z.infer<typeof diagramSchema>;

export const diagramNodeUpsertInputSchema = diagramNodeSchema
	.omit({ diagramId: true })
	.extend({
		id: z.uuid(),
		type: diagramNodeSchema.shape.type.optional(),
		data: diagramNodeSchema.shape.data.optional(),
	});

export type DiagramNodeUpsertInput = z.input<
	typeof diagramNodeUpsertInputSchema
>;

export const diagramEdgeUpsertInputSchema = diagramEdgeSchema
	.omit({ diagramId: true })
	.extend({
		id: z.uuid(),
	});

export type DiagramEdgeUpsertInput = z.input<
	typeof diagramEdgeUpsertInputSchema
>;

export const applyDiagramMutationsInputSchema = z.object({
	diagramId: z.uuid(),
	nodeUpserts: z.array(diagramNodeUpsertInputSchema).optional().default([]),
	nodeDeletes: z.array(z.uuid()).optional().default([]),
	edgeUpserts: z.array(diagramEdgeUpsertInputSchema).optional().default([]),
	edgeDeletes: z.array(z.uuid()).optional().default([]),
});

export type ApplyDiagramMutationsInput = z.input<
	typeof applyDiagramMutationsInputSchema
>;
