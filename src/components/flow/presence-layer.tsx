import { type ReactFlowState, useReactFlow, useStore } from "@xyflow/react";
import { memo } from "react";

import type { PresenceState } from "@/lib/diagrams/presence";
import { usePresence } from "@/providers/presence";
import { RemoteCursor } from "./remote-cursor";

const viewportSelector = (state: ReactFlowState) => state.transform;

function RemoteConnectionLine({
	peer,
	tx,
	ty,
	zoom,
}: {
	peer: PresenceState;
	tx: number;
	ty: number;
	zoom: number;
}) {
	const { getNode } = useReactFlow();

	if (!peer.connectingFrom || !peer.cursor) return null;

	const node = getNode(peer.connectingFrom.nodeId);
	if (!node) return null;

	const w = node.measured?.width ?? 120;
	const h = node.measured?.height ?? 50;

	const isSource = peer.connectingFrom.handleType === "source";
	const handleX = node.position.x + w / 2;
	const handleY = isSource ? node.position.y + h : node.position.y;

	const sx = handleX * zoom + tx;
	const sy = handleY * zoom + ty;
	const ex = peer.cursor.x * zoom + tx;
	const ey = peer.cursor.y * zoom + ty;

	const midY = (sy + ey) / 2;

	return (
		<svg
			aria-hidden="true"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				overflow: "visible",
			}}
		>
			<path
				d={`M ${sx} ${sy} C ${sx} ${midY}, ${ex} ${midY}, ${ex} ${ey}`}
				fill="none"
				stroke={peer.userColor}
				strokeWidth={2}
				strokeDasharray="6 4"
				opacity={0.6}
			/>
			<circle
				cx={sx}
				cy={sy}
				r={4 * zoom}
				fill={peer.userColor}
				opacity={0.8}
			/>
		</svg>
	);
}

function PresenceLayerInner() {
	const { peers } = usePresence();
	const [tx, ty, zoom] = useStore(viewportSelector);

	const cursors: Array<PresenceState> = [];
	const connectors: Array<PresenceState> = [];
	peers.forEach((p) => {
		if (p.cursor) cursors.push(p);
		if (p.connectingFrom && p.cursor) connectors.push(p);
	});

	if (cursors.length === 0 && connectors.length === 0) return null;

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 50,
				overflow: "hidden",
			}}
		>
			{connectors.map((peer) => (
				<RemoteConnectionLine
					key={`conn-${peer.userId}`}
					peer={peer}
					tx={tx}
					ty={ty}
					zoom={zoom}
				/>
			))}
			{cursors.map((peer) => {
				const cursor = peer.cursor;
				if (!cursor) return null;

				return (
					<RemoteCursor
						key={peer.userId}
						point={{
							x: cursor.x * zoom + tx,
							y: cursor.y * zoom + ty,
						}}
						userName={peer.userName}
						userColor={peer.userColor}
					/>
				);
			})}
		</div>
	);
}

export const PresenceLayer = memo(PresenceLayerInner);
