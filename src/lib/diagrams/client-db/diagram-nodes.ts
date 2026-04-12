import type { Collection } from "@tanstack/react-db";
import type { NodeChange } from "@xyflow/react";

import type { DiagramNode } from "../schemas";

type NodeCollection = Collection<DiagramNode, string | number>;

export class DiagramNodes {
	private collection: NodeCollection;
	private diagramId: string;
	private dragging = new Set<string>();

	constructor(collection: NodeCollection, diagramId: string) {
		this.collection = collection;
		this.diagramId = diagramId;
	}

	get count(): number {
		return this.collection.size;
	}

	find(id: string): DiagramNode | undefined {
		return this.collection.get(id);
	}

	handleChanges(changes: NodeChange[]): void {
		for (const change of changes) {
			switch (change.type) {
				case "position": {
					if (change.dragging) {
						this.dragging.add(change.id);
						break;
					}
					if (!this.dragging.has(change.id)) break;
					this.dragging.delete(change.id);

					// React Flow emits many transient drag positions locally. We write
					// only the final drop position to TanStack DB.
					const position = change.position;
					if (!position) break;
					this.updatePosition({ id: change.id, x: position.x, y: position.y });
					break;
				}
				case "remove": {
					this.remove(change.id);
					break;
				}
				case "dimensions": {
					const dimensions = change.dimensions;
					if (!dimensions) break;
					this.updateDimensions({
						id: change.id,
						width: dimensions.width,
						height: dimensions.height,
					});
					break;
				}
				default:
					break;
			}
		}
	}

	updatePosition({ id, x, y }: { id: string; x: number; y: number }): void {
		this.collection.update(id, (draft: DiagramNode) => {
			draft.positionX = x;
			draft.positionY = y;
		});
	}

	updateDimensions({
		id,
		width,
		height,
	}: {
		id: string;
		width: number;
		height: number;
	}): void {
		this.collection.update(id, (draft: DiagramNode) => {
			draft.width = width;
			draft.height = height;
		});
	}

	insert({
		position,
		data,
	}: {
		position: { x: number; y: number };
		data?: Record<string, unknown>;
	}): void {
		const id = crypto.randomUUID();
		this.collection.insert({
			id,
			diagramId: this.diagramId,
			type: "default",
			positionX: position.x,
			positionY: position.y,
			data: data ?? { label: `Node ${this.collection.size + 1}` },
			width: null,
			height: null,
		});
	}

	remove(id: string): void {
		if (!this.collection.get(id)) return;
		this.collection.delete(id);
	}
}
