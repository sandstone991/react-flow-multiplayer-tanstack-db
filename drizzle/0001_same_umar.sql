CREATE TABLE "diagram" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagram_edge" (
	"id" uuid PRIMARY KEY NOT NULL,
	"diagram_id" uuid NOT NULL,
	"source" text NOT NULL,
	"target" text NOT NULL,
	"source_handle" text,
	"target_handle" text,
	"type" text,
	"animated" boolean DEFAULT false NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagram_node" (
	"id" uuid PRIMARY KEY NOT NULL,
	"diagram_id" uuid NOT NULL,
	"type" text DEFAULT 'default' NOT NULL,
	"position_x" real DEFAULT 0 NOT NULL,
	"position_y" real DEFAULT 0 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"width" real,
	"height" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diagram" ADD CONSTRAINT "diagram_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagram_edge" ADD CONSTRAINT "diagram_edge_diagram_id_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagram_node" ADD CONSTRAINT "diagram_node_diagram_id_diagram_id_fk" FOREIGN KEY ("diagram_id") REFERENCES "public"."diagram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diagram_workspace_id_idx" ON "diagram" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "diagram_edge_diagram_id_idx" ON "diagram_edge" USING btree ("diagram_id");--> statement-breakpoint
CREATE INDEX "diagram_node_diagram_id_idx" ON "diagram_node" USING btree ("diagram_id");