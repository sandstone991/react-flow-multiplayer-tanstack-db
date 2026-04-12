import { useNavigate } from "@tanstack/react-router";
import {
	Background,
	BackgroundVariant,
	type Connection,
	Controls,
	MiniMap,
	type NodeChange,
	Panel,
	ReactFlow,
	ReactFlowProvider,
	SelectionMode,
	useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RiAddLine, RiArrowLeftLine, RiDeleteBinLine } from "@remixicon/react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { useNodesWithPresence } from "@/hooks/use-nodes-with-presence";
import { DIAGRAM_NODE_TYPE } from "@/lib/diagrams/react-flow-transform";
import { PresenceProvider, usePresence } from "@/providers/presence";
import { SyncProvider, useSync } from "@/providers/sync";
import { DiagramNodeComponent } from "./diagram-node";
import { PresenceLayer } from "./presence-layer";

const nodeTypes = { [DIAGRAM_NODE_TYPE]: DiagramNodeComponent };

function FlowCanvasContent() {
	const navigate = useNavigate();
	const sync = useSync();
	const presence = usePresence();
	const reactFlow = useReactFlow();

	const { nodes, edges, isLoading, diagramNodes, diagramEdges, mutate } = sync;
	const {
		onMouseMove,
		onMouseLeave,
		onConnectStart,
		onConnectEnd,
		peers,
		selectedNodeIds,
		selectedEdgeIds,
		hasSelection,
	} = presence;

	const onNodesChange = useCallback(
		(changes: NodeChange[]) => {
			sync.onNodesChange(changes);
			presence.onNodesChange(changes);
		},
		[sync.onNodesChange, presence.onNodesChange],
	);

	const onConnect = useCallback(
		(connection: Connection) => {
			mutate(() => diagramEdges.connect(connection));
		},
		[diagramEdges, mutate],
	);

	const addNodeAtCenter = useCallback(() => {
		const { x, y, zoom } = reactFlow.getViewport();
		const centerX = (-x + window.innerWidth / 2) / zoom;
		const centerY = (-y + window.innerHeight / 2) / zoom;
		mutate(() => {
			diagramNodes.insert({
				position: { x: centerX - 75, y: centerY - 25 },
			});
		});
	}, [reactFlow, diagramNodes, mutate]);

	const deleteSelected = useCallback(() => {
		mutate(() => {
			for (const nodeId of selectedNodeIds) {
				diagramNodes.remove(nodeId);
			}
			for (const edgeId of selectedEdgeIds) {
				diagramEdges.remove(edgeId);
			}
		});
	}, [selectedNodeIds, selectedEdgeIds, diagramNodes, diagramEdges, mutate]);

	const nodesWithPresence = useNodesWithPresence(nodes, peers);

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-sm text-muted-foreground">Loading diagram...</p>
			</div>
		);
	}

	return (
		<div className="relative h-full w-full">
			<ReactFlow
				nodes={nodesWithPresence}
				edges={edges}
				nodeTypes={nodeTypes}
				onNodesChange={onNodesChange}
				onEdgesChange={sync.onEdgesChange}
				onConnect={onConnect}
				onConnectStart={onConnectStart}
				onConnectEnd={onConnectEnd}
				onMouseMove={onMouseMove}
				onMouseLeave={onMouseLeave}
				fitView
				deleteKeyCode={["Backspace", "Delete"]}
				selectionOnDrag
				panOnDrag={[1, 2]}
				selectionMode={SelectionMode.Partial}
				defaultEdgeOptions={{
					type: "smoothstep",
					animated: false,
					style: { strokeWidth: 2 },
				}}
				proOptions={{ hideAttribution: true }}
				className="!bg-background"
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={20}
					size={1}
					className="!bg-background"
					color="hsl(var(--muted-foreground) / 0.2)"
				/>
				<Controls
					showInteractive={false}
					className="!rounded-lg !border !border-border !bg-background !shadow-md [&>button]:!border-border [&>button]:!bg-background [&>button]:!fill-foreground hover:[&>button]:!bg-muted"
				/>
				<MiniMap
					nodeColor="hsl(var(--primary))"
					maskColor="hsl(var(--background) / 0.8)"
					className="!rounded-lg !border !border-border !bg-background !shadow-md"
				/>

				<Panel position="top-left" className="!m-3 flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						className="h-9 w-9 shadow-md"
						onClick={() => navigate({ to: "/app" })}
					>
						<RiArrowLeftLine className="h-4 w-4" />
					</Button>

					<div className="flex items-center gap-1 rounded-lg border bg-background p-1 shadow-md">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 gap-1.5 px-3 text-xs"
							onClick={addNodeAtCenter}
						>
							<RiAddLine className="h-4 w-4" />
							Add Node
						</Button>
						{hasSelection && (
							<>
								<div className="h-5 w-px bg-border" />
								<Button
									variant="ghost"
									size="sm"
									className="h-8 gap-1.5 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
									onClick={deleteSelected}
								>
									<RiDeleteBinLine className="h-4 w-4" />
									Delete
									<span className="tabular-nums">
										({selectedNodeIds.length + selectedEdgeIds.length})
									</span>
								</Button>
							</>
						)}
					</div>
				</Panel>

				<Panel position="bottom-center" className="!mb-3">
					<p className="rounded-md bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
						Double-click to add a node &middot; Drag from handles to connect
						&middot; Select + Delete to remove
					</p>
				</Panel>
			</ReactFlow>
			<PresenceLayer />
		</div>
	);
}

export function FlowCanvas({ diagramId }: { diagramId: string }) {
	return (
		<ReactFlowProvider key={diagramId}>
			<SyncProvider diagramId={diagramId}>
				<PresenceProvider diagramId={diagramId}>
					<FlowCanvasContent />
				</PresenceProvider>
			</SyncProvider>
		</ReactFlowProvider>
	);
}
