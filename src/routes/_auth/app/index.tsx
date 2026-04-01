import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";


import { Button } from "@/components/ui/button";
import { $setLastWorkspace } from "@/lib/workspaces/functions";
import { myWorkspacesQueryOptions } from "@/lib/workspaces/queries";


type TodoFilter = "all" | "active" | "completed";

type WorkspaceSummary = {
  id: string;
  name: string;
};

const AppIndexContent =function AppIndexContent({
  selectedWorkspace,
  workspaces,
}: {
  selectedWorkspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
}) {
 

  return (
    <div className="space-y-4">

      
    </div>
  );
};

const AppIndex = function AppIndex() {
  const search = Route.useSearch();
  const { selectedWorkspaceId: fallbackWorkspaceId } = Route.useLoaderData();

  const { data: workspaces } = useSuspenseQuery(myWorkspacesQueryOptions());

  const selectedWorkspace =
    workspaces.find((workspace) => workspace.id === search.workspaceId) ??
    workspaces.find((workspace) => workspace.id === fallbackWorkspaceId) ??
    workspaces[0];

  const workspaceId = selectedWorkspace?.id ?? fallbackWorkspaceId;

  

  return (
   
      <AppIndexContent selectedWorkspace={selectedWorkspace} workspaces={workspaces} />
  );
};

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
    const workspaces = await context.queryClient.ensureQueryData(myWorkspacesQueryOptions());

    if (workspaces.length === 0) {
      throw redirect({ to: "/join", search: { manage: true } });
    }

    const selectedWorkspace =
      workspaces.find((workspace) => workspace.id === deps.workspaceId) ?? workspaces[0];

    if (!selectedWorkspace) {
      throw redirect({ to: "/join", search: { manage: true } });
    }

    await $setLastWorkspace({
      data: {
        workspaceId: selectedWorkspace.id,
      },
    });


    return {
      selectedWorkspaceId: selectedWorkspace.id,
    };
  },
  component: AppIndex,
});
