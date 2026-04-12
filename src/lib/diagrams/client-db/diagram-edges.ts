import type { Collection } from "@tanstack/react-db";
import type { Connection, EdgeChange } from "@xyflow/react";
import type { DiagramEdge } from "../schemas";

type EdgeCollection = Collection<DiagramEdge, string | number>;

export class DiagramEdges {
	private collection: EdgeCollection;
	private diagramId: string;

	constructor(collection: EdgeCollection, diagramId: string) {
		this.collection = collection;
		this.diagramId = diagramId;
	}

	find(id: string): DiagramEdge | undefined {
		return this.collection.get(id);
	}

	handleChanges(changes: EdgeChange[]): void {
		for (const change of changes) {
			if (change.type === "remove") {
				this.remove(change.id);
			}
		}
	}

	connect(connection: Connection): void {
		if (!connection.source || !connection.target) return;
		const id = crypto.randomUUID();
		this.collection.insert({
			id,
			diagramId: this.diagramId,
			source: connection.source,
			target: connection.target,
			sourceHandle: connection.sourceHandle ?? null,
			targetHandle: connection.targetHandle ?? null,
			type: null,
			animated: false,
			data: null,
		});
	}

	remove(id: string): void {
		if (!this.collection.get(id)) return;
		this.collection.delete(id);
	}
}
