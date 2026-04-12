import { z } from "zod";

export const createWorkspaceInput = z.object({
	name: z.string().trim().min(1).max(120),
});

export const inviteActionInput = z.object({
	inviteId: z.uuid(),
});

export const sendInviteInput = z.object({
	workspaceId: z.uuid(),
	email: z.email(),
});

export const workspaceIdInput = z.object({
	workspaceId: z.uuid(),
});

export const setLastWorkspaceInput = z.object({
	workspaceId: z.uuid(),
});
