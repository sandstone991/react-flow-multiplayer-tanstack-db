import "@tanstack/react-start/server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { z } from "zod";

import {
	DIAGRAM_CHANGE_EVENT_TYPE,
	DIAGRAM_CHANGE_TABLE,
} from "@/lib/diagrams/events";
import { publish } from "@/lib/diagrams/pubsub";
import type { applyDiagramMutationsInputSchema } from "@/lib/diagrams/schemas";
import { db } from "@/lib/drizzle";
import {
	diagram,
	diagramEdge,
	diagramNode,
	workspaceMember,
} from "@/lib/drizzle/schema";

type ApplyDiagramMutationsData = z.output<
	typeof applyDiagramMutationsInputSchema
>;

export async function assertWorkspaceMembership(
	userId: string,
	workspaceId: string,
) {
	const [membership] = await db
		.select({ workspaceId: workspaceMember.workspaceId })
		.from(workspaceMember)
		.where(
			and(
				eq(workspaceMember.workspaceId, workspaceId),
				eq(workspaceMember.userId, userId),
			),
		)
		.limit(1);

	if (!membership) {
		throw new Error("You do not have access to this workspace.");
	}
}

export async function assertDiagramAccess(userId: string, diagramId: string) {
	const [d] = await db
		.select({ workspaceId: diagram.workspaceId })
		.from(diagram)
		.where(eq(diagram.id, diagramId))
		.limit(1);

	if (!d) throw new Error("Diagram not found.");
	await assertWorkspaceMembership(userId, d.workspaceId);
	return d;
}

export async function getDiagrams(userId: string, workspaceId: string) {
	await assertWorkspaceMembership(userId, workspaceId);
	return db
		.select({
			id: diagram.id,
			name: diagram.name,
			workspaceId: diagram.workspaceId,
			createdAt: diagram.createdAt,
			updatedAt: diagram.updatedAt,
		})
		.from(diagram)
		.where(eq(diagram.workspaceId, workspaceId));
}

export async function createDiagram(
	userId: string,
	data: { workspaceId: string; name: string },
) {
	await assertWorkspaceMembership(userId, data.workspaceId);
	const [created] = await db
		.insert(diagram)
		.values({
			id: crypto.randomUUID(),
			workspaceId: data.workspaceId,
			name: data.name.trim(),
		})
		.returning({
			id: diagram.id,
			name: diagram.name,
			workspaceId: diagram.workspaceId,
			createdAt: diagram.createdAt,
			updatedAt: diagram.updatedAt,
		});
	if (!created) throw new Error("Failed to create diagram.");
	return created;
}

export async function deleteDiagram(userId: string, diagramId: string) {
	await assertDiagramAccess(userId, diagramId);
	await db.delete(diagram).where(eq(diagram.id, diagramId));
	return { diagramId };
}

export async function applyDiagramMutations(
	userId: string,
	data: ApplyDiagramMutationsData,
) {
	await assertDiagramAccess(userId, data.diagramId);

	const result = await db.transaction(async (tx) => {
		const [txidRow] = await tx.execute<{ txid: string }>(
			sql`select pg_current_xact_id()::text as txid`,
		);
		if (!txidRow) throw new Error("Failed to get transaction id.");
		const txid = txidRow.txid;

		const upsertedNodes: Array<Record<string, unknown>> = [];
		for (const node of data.nodeUpserts) {
			const values = {
				id: node.id,
				diagramId: data.diagramId,
				type: node.type ?? "default",
				positionX: node.positionX,
				positionY: node.positionY,
				data: node.data ?? {},
				width: node.width,
				height: node.height,
			};
			const [row] = await tx
				.insert(diagramNode)
				.values(values)
				.onConflictDoUpdate({
					target: diagramNode.id,
					set: {
						type: values.type,
						positionX: values.positionX,
						positionY: values.positionY,
						data: values.data,
						width: values.width,
						height: values.height,
					},
				})
				.returning();
			if (!row) throw new Error("Failed to upsert node.");
			upsertedNodes.push(row);
		}

		const upsertedEdges: Array<Record<string, unknown>> = [];
		for (const edge of data.edgeUpserts) {
			const values = {
				id: edge.id,
				diagramId: data.diagramId,
				source: edge.source,
				target: edge.target,
				sourceHandle: edge.sourceHandle,
				targetHandle: edge.targetHandle,
				type: edge.type,
				animated: edge.animated ?? false,
				data: edge.data,
			};
			const [row] = await tx
				.insert(diagramEdge)
				.values(values)
				.onConflictDoUpdate({
					target: diagramEdge.id,
					set: {
						source: values.source,
						target: values.target,
						sourceHandle: values.sourceHandle,
						targetHandle: values.targetHandle,
						type: values.type,
						animated: values.animated,
						data: values.data,
					},
				})
				.returning();
			if (!row) throw new Error("Failed to upsert edge.");
			upsertedEdges.push(row);
		}

		await tx
			.delete(diagramNode)
			.where(
				and(
					eq(diagramNode.diagramId, data.diagramId),
					inArray(diagramNode.id, data.nodeDeletes),
				),
			);

		const cascadeRows = await tx
			.delete(diagramEdge)
			.where(
				and(
					eq(diagramEdge.diagramId, data.diagramId),
					or(
						inArray(diagramEdge.source, data.nodeDeletes),
						inArray(diagramEdge.target, data.nodeDeletes),
					),
				),
			)
			.returning({ id: diagramEdge.id });
		const cascadeDeletedEdgeIds = cascadeRows.map((r) => r.id);

		const cascadeSet = new Set(cascadeDeletedEdgeIds);
		const explicitEdgeDeletes = data.edgeDeletes.filter(
			(id) => !cascadeSet.has(id),
		);
		await tx
			.delete(diagramEdge)
			.where(
				and(
					eq(diagramEdge.diagramId, data.diagramId),
					inArray(diagramEdge.id, explicitEdgeDeletes),
				),
			);

		return {
			txid,
			upsertedNodes,
			upsertedEdges,
			deletedNodeIds: data.nodeDeletes,
			allDeletedEdgeIds: [...cascadeDeletedEdgeIds, ...explicitEdgeDeletes],
		};
	});

	const changes = [
		...result.upsertedNodes.map((row) => ({
			type: DIAGRAM_CHANGE_EVENT_TYPE.UPDATE as const,
			table: DIAGRAM_CHANGE_TABLE.NODES as const,
			key: row.id as string,
			value: row,
		})),
		...result.deletedNodeIds.map((id) => ({
			type: DIAGRAM_CHANGE_EVENT_TYPE.DELETE as const,
			table: DIAGRAM_CHANGE_TABLE.NODES as const,
			key: id,
		})),
		...result.upsertedEdges.map((row) => ({
			type: DIAGRAM_CHANGE_EVENT_TYPE.UPDATE as const,
			table: DIAGRAM_CHANGE_TABLE.EDGES as const,
			key: row.id as string,
			value: row,
		})),
		...result.allDeletedEdgeIds.map((id) => ({
			type: DIAGRAM_CHANGE_EVENT_TYPE.DELETE as const,
			table: DIAGRAM_CHANGE_TABLE.EDGES as const,
			key: id,
		})),
	];

	if (changes.length > 0) {
		publish({
			diagramId: data.diagramId,
			txid: result.txid,
			changes,
		});
	}

	return { txid: result.txid };
}
