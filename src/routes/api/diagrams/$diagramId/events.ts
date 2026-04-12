import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/auth";
import {
	DIAGRAM_SSE_EVENT_NAME,
	type DiagramSseEventName,
	PRESENCE_EVENT_TYPE,
} from "@/lib/diagrams/events";
import { assertDiagramAccess } from "@/lib/diagrams/functions.server";
import {
	getPresenceStates,
	getUserColor,
	removePresence,
	subscribePresence,
	updatePresence,
} from "@/lib/diagrams/presence-pubsub";
import { subscribe } from "@/lib/diagrams/pubsub";
import { db } from "@/lib/drizzle";
import { diagramEdge, diagramNode } from "@/lib/drizzle/schema";

export const Route = createFileRoute("/api/diagrams/$diagramId/events")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const { diagramId } = params;

				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session?.user) {
					return new Response("Unauthorized", { status: 401 });
				}
				const user = session.user;

				try {
					await assertDiagramAccess(user.id, diagramId);
				} catch {
					return new Response("Forbidden", { status: 403 });
				}

				const [nodes, edges] = await Promise.all([
					db
						.select()
						.from(diagramNode)
						.where(eq(diagramNode.diagramId, diagramId)),
					db
						.select()
						.from(diagramEdge)
						.where(eq(diagramEdge.diagramId, diagramId)),
				]);

				const stream = new ReadableStream({
					start(controller) {
						const encoder = new TextEncoder();
						const send = (event: DiagramSseEventName, data: unknown) => {
							try {
								controller.enqueue(
									encoder.encode(
										`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
									),
								);
							} catch {
								// stream closed
							}
						};

						send(DIAGRAM_SSE_EVENT_NAME.INITIAL, { nodes, edges });

						updatePresence(diagramId, {
							userId: user.id,
							userName: user.name,
							userColor: getUserColor(user.id),
							cursor: null,
							selectedNodeIds: [],
							selectedEdgeIds: [],
							draggingNodeId: null,
							draggingPosition: null,
							connectingFrom: null,
						});

						send(
							DIAGRAM_SSE_EVENT_NAME.PRESENCE_INITIAL,
							getPresenceStates(diagramId),
						);

						const unsub = subscribe(diagramId, (change) => {
							send(DIAGRAM_SSE_EVENT_NAME.CHANGE, change);
						});

						const unsubPresence = subscribePresence(diagramId, (event) => {
							if (
								event.type === PRESENCE_EVENT_TYPE.UPDATE &&
								event.state.userId === user.id
							) {
								return;
							}
							if (event.type === PRESENCE_EVENT_TYPE.UPDATE) {
								send(DIAGRAM_SSE_EVENT_NAME.PRESENCE_UPDATE, event.state);
							} else {
								send(DIAGRAM_SSE_EVENT_NAME.PRESENCE_LEAVE, {
									userId: event.userId,
								});
							}
						});

						request.signal.addEventListener("abort", () => {
							unsub();
							unsubPresence();
							removePresence(diagramId, user.id);
							try {
								controller.close();
							} catch {
								// already closed
							}
						});
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					},
				});
			},
		},
	},
});
