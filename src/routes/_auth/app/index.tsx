import { RiAddLine, RiDeleteBinLine, RiFlowChart } from "@remixicon/react";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { $createDiagram, $deleteDiagram } from "@/lib/diagrams/functions";
import { diagramsQueryOptions } from "@/lib/diagrams/queries";
import { $setLastWorkspace } from "@/lib/workspaces/functions";
import { myWorkspacesQueryOptions } from "@/lib/workspaces/queries";

type WorkspaceSummary = {
	id: string;
	name: string;
};

function AppIndexContent({
	selectedWorkspace,
}: {
	selectedWorkspace: WorkspaceSummary;
}) {
	const queryClient = useQueryClient();
	const [newName, setNewName] = useState("");

	const { data: diagrams = [] } = useSuspenseQuery(
		diagramsQueryOptions(selectedWorkspace.id),
	);

	const createMutation = useMutation({
		mutationFn: (name: string) =>
			$createDiagram({ data: { workspaceId: selectedWorkspace.id, name } }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["diagrams", selectedWorkspace.id],
			});
			setNewName("");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (diagramId: string) => $deleteDiagram({ data: { diagramId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["diagrams", selectedWorkspace.id],
			});
		},
	});

	const handleCreate = useCallback(() => {
		const name = newName.trim();
		if (!name) return;
		createMutation.mutate(name);
	}, [newName, createMutation]);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-lg font-semibold">Diagrams</h2>
				<p className="text-sm text-muted-foreground">
					Click on a diagram to open the flow editor. Click the canvas to add
					nodes, drag from handles to connect them.
				</p>
			</div>

			<div className="flex items-center gap-2">
				<input
					type="text"
					placeholder="New diagram name..."
					className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleCreate();
					}}
				/>
				<Button
					size="sm"
					onClick={handleCreate}
					disabled={!newName.trim() || createMutation.isPending}
				>
					<RiAddLine className="mr-1 h-4 w-4" />
					Create
				</Button>
			</div>

			{diagrams.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center">
					<RiFlowChart className="mx-auto h-10 w-10 text-muted-foreground/50" />
					<p className="mt-2 text-sm text-muted-foreground">
						No diagrams yet. Create one to get started.
					</p>
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{diagrams.map((d) => (
						<div
							key={d.id}
							className="group relative rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-primary/50"
						>
							<Link
								to="/app/diagram/$diagramId"
								params={{ diagramId: d.id }}
								className="block"
							>
								<div className="flex items-center gap-2">
									<RiFlowChart className="h-5 w-5 text-muted-foreground" />
									<span className="font-medium">{d.name}</span>
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									{new Date(d.createdAt).toLocaleDateString()}
								</p>
							</Link>
							<Button
								variant="ghost"
								size="icon"
								className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									if (confirm("Delete this diagram?")) {
										deleteMutation.mutate(d.id);
									}
								}}
								disabled={deleteMutation.isPending}
							>
								<RiDeleteBinLine className="h-4 w-4" />
							</Button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function AppIndex() {
	const search = Route.useSearch();
	const { selectedWorkspaceId: fallbackWorkspaceId } = Route.useLoaderData();

	const { data: workspaces } = useSuspenseQuery(myWorkspacesQueryOptions());

	const selectedWorkspace =
		workspaces.find((workspace) => workspace.id === search.workspaceId) ??
		workspaces.find((workspace) => workspace.id === fallbackWorkspaceId) ??
		workspaces[0];

	return <AppIndexContent selectedWorkspace={selectedWorkspace} />;
}

export const Route = createFileRoute("/_auth/app/")({
	validateSearch: (search: Record<string, unknown>) => {
		if (typeof search.workspaceId === "string") {
			return { workspaceId: search.workspaceId };
		}

		return {};
	},
	loaderDeps: ({ search }) => ({
		workspaceId: search.workspaceId,
	}),
	loader: async ({ context, deps }) => {
		const workspaces = await context.queryClient.ensureQueryData(
			myWorkspacesQueryOptions(),
		);

		if (workspaces.length === 0) {
			throw redirect({ to: "/join", search: { manage: true } });
		}

		const selectedWorkspace =
			workspaces.find((workspace) => workspace.id === deps.workspaceId) ??
			workspaces[0];

		if (!selectedWorkspace) {
			throw redirect({ to: "/join", search: { manage: true } });
		}

		await $setLastWorkspace({
			data: {
				workspaceId: selectedWorkspace.id,
			},
		});

		await context.queryClient.ensureQueryData(
			diagramsQueryOptions(selectedWorkspace.id),
		);

		return {
			selectedWorkspaceId: selectedWorkspace.id,
		};
	},
	component: AppIndex,
});
