import { createFileRoute } from "@tanstack/react-router";

import { auth } from "@/lib/auth/auth";
import { presencePatchSchema } from "@/lib/diagrams/events";
import { assertDiagramAccess } from "@/lib/diagrams/functions.server";
import {
	getUserColor,
	type PresenceState,
	updatePresence,
} from "@/lib/diagrams/presence-pubsub";

export const Route = createFileRoute("/api/diagrams/$diagramId/presence")({
	server: {
		handlers: {
			POST: async ({ request, params }) => {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session?.user) {
					return new Response("Unauthorized", { status: 401 });
				}

				const user = session.user;
				const { diagramId } = params;

				try {
					await assertDiagramAccess(user.id, diagramId);
				} catch {
					return new Response("Forbidden", { status: 403 });
				}

				const body = presencePatchSchema.parse(await request.json());

				const state: PresenceState = {
					userId: user.id,
					userName: user.name,
					userColor: getUserColor(user.id),
					cursor: body.cursor ?? null,
					selectedNodeIds: body.selectedNodeIds ?? [],
					selectedEdgeIds: body.selectedEdgeIds ?? [],
					draggingNodeId: body.draggingNodeId ?? null,
					draggingPosition: body.draggingPosition ?? null,
					connectingFrom: body.connectingFrom ?? null,
				};

				updatePresence(diagramId, state);

				return new Response(null, { status: 204 });
			},
		},
	},
});
