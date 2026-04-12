import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

export const workspace = pgTable(
	"workspace",
	{
		id: uuid("id").primaryKey(),
		name: text("name").notNull(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("workspace_owner_id_idx").on(table.ownerId)],
);

export const workspaceMember = pgTable(
	"workspace_member",
	{
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").default("member").notNull(),
		joinedAt: timestamp("joined_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.workspaceId, table.userId] }),
		index("workspace_member_user_id_idx").on(table.userId),
		index("workspace_member_workspace_id_idx").on(table.workspaceId),
	],
);

export const workspaceInvite = pgTable(
	"workspace_invite",
	{
		id: uuid("id").primaryKey(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		invitedById: text("invited_by_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status").default("pending").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("workspace_invite_email_idx").on(table.email),
		index("workspace_invite_workspace_id_idx").on(table.workspaceId),
		uniqueIndex("workspace_invite_pending_unique").on(
			table.workspaceId,
			table.email,
			table.status,
		),
	],
);

export const workspaceRelations = relations(workspace, ({ one, many }) => ({
	owner: one(user, {
		fields: [workspace.ownerId],
		references: [user.id],
	}),
	members: many(workspaceMember),
	invites: many(workspaceInvite),
	diagrams: many(diagram),
}));

export const workspaceMemberRelations = relations(
	workspaceMember,
	({ one }) => ({
		workspace: one(workspace, {
			fields: [workspaceMember.workspaceId],
			references: [workspace.id],
		}),
		user: one(user, {
			fields: [workspaceMember.userId],
			references: [user.id],
		}),
	}),
);

export const workspaceInviteRelations = relations(
	workspaceInvite,
	({ one }) => ({
		workspace: one(workspace, {
			fields: [workspaceInvite.workspaceId],
			references: [workspace.id],
		}),
		invitedBy: one(user, {
			fields: [workspaceInvite.invitedById],
			references: [user.id],
		}),
	}),
);

// ── Diagram tables ──────────────────────────────────────────────────────────

export const diagram = pgTable(
	"diagram",
	{
		id: uuid("id").primaryKey(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("diagram_workspace_id_idx").on(table.workspaceId)],
);

export const diagramNode = pgTable(
	"diagram_node",
	{
		id: uuid("id").primaryKey(),
		diagramId: uuid("diagram_id")
			.notNull()
			.references(() => diagram.id, { onDelete: "cascade" }),
		type: text("type").notNull().default("default"),
		positionX: real("position_x").notNull().default(0),
		positionY: real("position_y").notNull().default(0),
		data: jsonb("data").notNull().default({}).$type<Record<string, unknown>>(),
		width: real("width"),
		height: real("height"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("diagram_node_diagram_id_idx").on(table.diagramId)],
);

export const diagramEdge = pgTable(
	"diagram_edge",
	{
		id: uuid("id").primaryKey(),
		diagramId: uuid("diagram_id")
			.notNull()
			.references(() => diagram.id, { onDelete: "cascade" }),
		source: text("source").notNull(),
		target: text("target").notNull(),
		sourceHandle: text("source_handle"),
		targetHandle: text("target_handle"),
		type: text("type"),
		animated: boolean("animated").default(false).notNull(),
		data: jsonb("data").$type<Record<string, unknown> | null>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("diagram_edge_diagram_id_idx").on(table.diagramId)],
);

// ── Diagram relations ───────────────────────────────────────────────────────

export const diagramRelations = relations(diagram, ({ one, many }) => ({
	workspace: one(workspace, {
		fields: [diagram.workspaceId],
		references: [workspace.id],
	}),
	nodes: many(diagramNode),
	edges: many(diagramEdge),
}));

export const diagramNodeRelations = relations(diagramNode, ({ one }) => ({
	diagram: one(diagram, {
		fields: [diagramNode.diagramId],
		references: [diagram.id],
	}),
}));

export const diagramEdgeRelations = relations(diagramEdge, ({ one }) => ({
	diagram: one(diagram, {
		fields: [diagramEdge.diagramId],
		references: [diagram.id],
	}),
}));
