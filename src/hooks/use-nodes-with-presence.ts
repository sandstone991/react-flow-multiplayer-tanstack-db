import type { Node } from "@xyflow/react";
import { useMemo } from "react";

import type { PresenceState } from "@/lib/diagrams/presence";
import type { RemoteConnector, RemoteSelector } from "@/lib/diagrams/types";

export function useNodesWithPresence(
	nodes: Node[],
	peers: Map<string, PresenceState>,
): Node[] {
	const presenceMaps = useMemo(() => {
		const selections = new Map<string, RemoteSelector[]>();
		const connectors = new Map<string, RemoteConnector[]>();

		for (const peer of peers.values()) {
			const selector: RemoteSelector = {
				userId: peer.userId,
				userName: peer.userName,
				userColor: peer.userColor,
			};

			for (const nodeId of peer.selectedNodeIds) {
				const arr = selections.get(nodeId) ?? [];
				arr.push(selector);
				selections.set(nodeId, arr);
			}

			if (peer.draggingNodeId) {
				const arr = selections.get(peer.draggingNodeId) ?? [];
				if (!arr.some((s) => s.userId === peer.userId)) {
					arr.push(selector);
					selections.set(peer.draggingNodeId, arr);
				}
			}

			if (peer.connectingFrom) {
				const { nodeId, handleType } = peer.connectingFrom;
				const arr = connectors.get(nodeId) ?? [];
				arr.push({ ...selector, handleType });
				connectors.set(nodeId, arr);
			}
		}

		return { selections, connectors };
	}, [peers]);

	return useMemo(() => {
		const { selections, connectors } = presenceMaps;

		if (selections.size === 0 && connectors.size === 0) {
			return nodes;
		}

		return nodes.map((node) => {
			const remoteSelectors = selections.get(node.id);
			const remoteConnectors = connectors.get(node.id);

			if (!remoteSelectors && !remoteConnectors) return node;

			return {
				...node,
				data: {
					...node.data,
					...(remoteSelectors && { remoteSelectors }),
					...(remoteConnectors && { remoteConnectors }),
				},
			};
		});
	}, [nodes, presenceMaps]);
}
