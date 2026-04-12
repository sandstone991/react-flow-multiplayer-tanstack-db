import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware, freshAuthMiddleware } from "@/lib/auth/middleware";
import { applyDiagramMutationsInputSchema } from "@/lib/diagrams/schemas";

const workspaceIdInput = z.object({ workspaceId: z.uuid() });
const diagramIdInput = z.object({ diagramId: z.uuid() });
const createDiagramInput = z.object({
	workspaceId: z.uuid(),
	name: z.string().trim().min(1).max(120),
});

// ── Diagram CRUD ────────────────────────────────────────────────────────────

export const $getDiagrams = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator(workspaceIdInput)
	.handler(async ({ context, data }) => {
		const { getDiagrams } = await import("./functions.server");
		return getDiagrams(context.user.id, data.workspaceId);
	});

export const $createDiagram = createServerFn({ method: "POST" })
	.middleware([freshAuthMiddleware])
	.inputValidator(createDiagramInput)
	.handler(async ({ context, data }) => {
		const { createDiagram } = await import("./functions.server");
		return createDiagram(context.user.id, data);
	});

export const $deleteDiagram = createServerFn({ method: "POST" })
	.middleware([freshAuthMiddleware])
	.inputValidator(diagramIdInput)
	.handler(async ({ context, data }) => {
		const { deleteDiagram } = await import("./functions.server");
		return deleteDiagram(context.user.id, data.diagramId);
	});

// ── Diagram node/edge mutations ─────────────────────────────────────────────

export const $applyDiagramMutations = createServerFn({ method: "POST" })
	.middleware([freshAuthMiddleware])
	.inputValidator(applyDiagramMutationsInputSchema)
	.handler(async ({ context, data }) => {
		const { applyDiagramMutations } = await import("./functions.server");
		return applyDiagramMutations(context.user.id, data);
	});
