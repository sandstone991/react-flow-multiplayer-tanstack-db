import { Handle, type NodeProps, Position } from "@xyflow/react";
import { memo, useMemo } from "react";

import type { RemoteConnector, RemoteSelector } from "@/lib/diagrams/types";

type DiagramNodeData = {
	label?: unknown;
	remoteSelectors?: RemoteSelector[];
	remoteConnectors?: RemoteConnector[];
};

function DiagramNodeInner({ data, selected }: NodeProps) {
	const d = data as DiagramNodeData;
	const label = d.label ?? "Node";
	const remoteSelectors = d.remoteSelectors ?? [];
	const remoteConnectors = d.remoteConnectors ?? [];
	const firstRemote = remoteSelectors[0] as RemoteSelector | undefined;

	const sourceConnector = useMemo(
		() => remoteConnectors.find((c) => c.handleType === "source"),
		[remoteConnectors],
	);
	const targetConnector = useMemo(
		() => remoteConnectors.find((c) => c.handleType === "target"),
		[remoteConnectors],
	);

	return (
		<div
			className={`
        relative min-w-[120px] rounded-lg border-2 bg-background px-4 py-3 shadow-sm
        transition-all duration-150
        ${selected ? "border-primary shadow-md ring-2 ring-primary/20" : "border-border hover:border-primary/40 hover:shadow-md"}
      `}
			style={
				firstRemote && !selected
					? {
							borderColor: firstRemote.userColor,
							boxShadow: `0 0 0 3px ${firstRemote.userColor}33`,
						}
					: undefined
			}
		>
			<Handle
				type="target"
				position={Position.Top}
				className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-primary"
				style={
					targetConnector
						? {
								backgroundColor: targetConnector.userColor,
								boxShadow: `0 0 0 4px ${targetConnector.userColor}55`,
								animation: "handle-pulse 1.2s ease-in-out infinite",
							}
						: undefined
				}
			/>
			<div className="text-center text-sm font-medium">{String(label)}</div>
			<Handle
				type="source"
				position={Position.Bottom}
				className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-primary"
				style={
					sourceConnector
						? {
								backgroundColor: sourceConnector.userColor,
								boxShadow: `0 0 0 4px ${sourceConnector.userColor}55`,
								animation: "handle-pulse 1.2s ease-in-out infinite",
							}
						: undefined
				}
			/>
			{remoteSelectors.length > 0 && (
				<div className="absolute -top-6 left-0 flex gap-1">
					{remoteSelectors.map((s) => (
						<span
							key={s.userId}
							className="rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white shadow-sm"
							style={{ backgroundColor: s.userColor }}
						>
							{s.userName}
						</span>
					))}
				</div>
			)}
		</div>
	);
}

export const DiagramNodeComponent = memo(DiagramNodeInner);
