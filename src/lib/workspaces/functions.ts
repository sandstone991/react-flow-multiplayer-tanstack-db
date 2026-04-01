import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { authMiddleware, freshAuthMiddleware } from "@/lib/auth/middleware";
import { db } from "@/lib/drizzle";
import { user, workspace, workspaceInvite, workspaceMember } from "@/lib/drizzle/schema";

const createWorkspaceInput = z.object({
  name: z.string().trim().min(1).max(120),
});

const inviteActionInput = z.object({
  inviteId: z.uuid(),
});

const setLastWorkspaceInput = z.object({
  workspaceId: z.uuid(),
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getJoinedWorkspaces = async (userId: string) =>
  db
    .select({
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.ownerId,
      role: workspaceMember.role,
      joinedAt: workspaceMember.joinedAt,
    })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
    .where(eq(workspaceMember.userId, userId))
    .orderBy(desc(workspaceMember.joinedAt), asc(workspace.name));

const resolveWorkspaceRedirect = async (userId: string) => {
  const [dbUser] = await db
    .select({
      lastWorkspaceId: user.lastWorkspaceId,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const memberships = await db
    .select({
      workspaceId: workspaceMember.workspaceId,
    })
    .from(workspaceMember)
    .where(eq(workspaceMember.userId, userId))
    .orderBy(desc(workspaceMember.joinedAt), asc(workspaceMember.workspaceId));

  const membershipWorkspaceIds = new Set(memberships.map((membership) => membership.workspaceId));

  const validLastWorkspaceId =
    dbUser?.lastWorkspaceId && membershipWorkspaceIds.has(dbUser.lastWorkspaceId)
      ? dbUser.lastWorkspaceId
      : null;

  const fallbackWorkspaceId = validLastWorkspaceId ?? memberships[0]?.workspaceId ?? null;

  return {
    lastWorkspaceId: validLastWorkspaceId,
    fallbackWorkspaceId,
    hasMembership: memberships.length > 0,
  };
};

export const $getMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return getJoinedWorkspaces(context.user.id);
  });

export const $getJoinData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const joinedWorkspaces = await getJoinedWorkspaces(context.user.id);

    const invitedWorkspaces = await db
      .select({
        inviteId: workspaceInvite.id,
        workspaceId: workspaceInvite.workspaceId,
        workspaceName: workspace.name,
        invitedById: workspaceInvite.invitedById,
        createdAt: workspaceInvite.createdAt,
      })
      .from(workspaceInvite)
      .innerJoin(workspace, eq(workspaceInvite.workspaceId, workspace.id))
      .where(
        and(
          eq(workspaceInvite.email, normalizeEmail(context.user.email)),
          eq(workspaceInvite.status, "pending"),
        ),
      )
      .orderBy(desc(workspaceInvite.createdAt), asc(workspace.name));

    return {
      joinedWorkspaces,
      invitedWorkspaces,
    };
  });

export const $getPostLoginRedirect = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return resolveWorkspaceRedirect(context.user.id);
  });

export const $createWorkspace = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .inputValidator((data) => createWorkspaceInput.parse(data))
  .handler(async ({ context, data }) => {
    const workspaceName = data.name.trim();

    const createdWorkspace = await db.transaction(async (tx) => {
      const [nextWorkspace] = await tx
        .insert(workspace)
        .values({
          id: crypto.randomUUID(),
          name: workspaceName,
          ownerId: context.user.id,
        })
        .returning({
          id: workspace.id,
          name: workspace.name,
        });

      if (!nextWorkspace) {
        throw new Error("Unable to create workspace.");
      }

      await tx.insert(workspaceMember).values({
        workspaceId: nextWorkspace.id,
        userId: context.user.id,
        role: "owner",
      });

      await tx
        .update(user)
        .set({
          lastWorkspaceId: nextWorkspace.id,
        })
        .where(eq(user.id, context.user.id));

      return nextWorkspace;
    });

    return createdWorkspace;
  });

export const $acceptInvite = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .inputValidator((data) => inviteActionInput.parse(data))
  .handler(async ({ context, data }) => {
    return db.transaction(async (tx) => {
      const [invite] = await tx
        .select({
          id: workspaceInvite.id,
          workspaceId: workspaceInvite.workspaceId,
          email: workspaceInvite.email,
          status: workspaceInvite.status,
        })
        .from(workspaceInvite)
        .where(eq(workspaceInvite.id, data.inviteId))
        .limit(1);

      if (!invite) {
        throw new Error("Invite not found.");
      }

      if (normalizeEmail(invite.email) !== normalizeEmail(context.user.email)) {
        throw new Error("You can only accept invites sent to your email address.");
      }

      if (invite.status !== "pending") {
        throw new Error("Invite is no longer pending.");
      }

      const [updatedInvite] = await tx
        .update(workspaceInvite)
        .set({ status: "accepted" })
        .where(and(eq(workspaceInvite.id, invite.id), eq(workspaceInvite.status, "pending")))
        .returning({ workspaceId: workspaceInvite.workspaceId });

      if (!updatedInvite) {
        throw new Error("Invite is no longer pending.");
      }

      await tx
        .insert(workspaceMember)
        .values({
          workspaceId: updatedInvite.workspaceId,
          userId: context.user.id,
          role: "member",
        })
        .onConflictDoNothing();

      await tx
        .update(user)
        .set({
          lastWorkspaceId: updatedInvite.workspaceId,
        })
        .where(eq(user.id, context.user.id));

      return { workspaceId: updatedInvite.workspaceId };
    });
  });

export const $declineInvite = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .inputValidator((data) => inviteActionInput.parse(data))
  .handler(async ({ context, data }) => {
    const [invite] = await db
      .select({
        id: workspaceInvite.id,
        email: workspaceInvite.email,
        status: workspaceInvite.status,
      })
      .from(workspaceInvite)
      .where(eq(workspaceInvite.id, data.inviteId))
      .limit(1);

    if (!invite) {
      throw new Error("Invite not found.");
    }

    if (normalizeEmail(invite.email) !== normalizeEmail(context.user.email)) {
      throw new Error("You can only decline invites sent to your email address.");
    }

    if (invite.status !== "pending") {
      throw new Error("Invite is no longer pending.");
    }

    const [updatedInvite] = await db
      .update(workspaceInvite)
      .set({ status: "declined" })
      .where(and(eq(workspaceInvite.id, invite.id), eq(workspaceInvite.status, "pending")))
      .returning({ id: workspaceInvite.id });

    if (!updatedInvite) {
      throw new Error("Invite is no longer pending.");
    }

    return { inviteId: updatedInvite.id };
  });

export const $setLastWorkspace = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .inputValidator((data) => setLastWorkspaceInput.parse(data))
  .handler(async ({ context, data }) => {
    const [membership] = await db
      .select({
        workspaceId: workspaceMember.workspaceId,
      })
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.workspaceId, data.workspaceId),
          eq(workspaceMember.userId, context.user.id),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new Error("You do not have access to this workspace.");
    }

    await db
      .update(user)
      .set({
        lastWorkspaceId: membership.workspaceId,
      })
      .where(eq(user.id, context.user.id));

    return { workspaceId: membership.workspaceId };
  });
