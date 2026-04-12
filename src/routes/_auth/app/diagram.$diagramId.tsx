import { createFileRoute } from "@tanstack/react-router";

import { FlowCanvas } from "@/components/flow/flow-canvas";
import { getDiagramCollections } from "@/lib/diagrams/client-db/collections";

export const Route = createFileRoute("/_auth/app/diagram/$diagramId")({
	ssr: false,
	loader: async ({ params }) => {
		const { nodes, edges } = getDiagramCollections(params.diagramId);
		await Promise.all([nodes.preload(), edges.preload()]);
		return null;
	},
	component: DiagramPage,
});

function DiagramPage() {
	const { diagramId } = Route.useParams();

	return (
		<div className="fixed inset-0 z-40 bg-background">
			<FlowCanvas diagramId={diagramId} />
		</div>
	);
}
