import { RiBuilding4Line, RiLogoutBoxLine, RiMore2Fill, RiSettings4Line } from "@remixicon/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate, useSearch } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import authClient from "@/lib/auth/auth-client";
import { myWorkspacesQueryOptions } from "@/lib/workspaces/queries";

export const Route = createFileRoute("/_auth/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const workspaceId = (search as any).workspaceId as string | undefined;

  const { data: workspaces } = useSuspenseQuery(myWorkspacesQueryOptions());

  const selectedWorkspace = workspaces?.find((w) => w.id === workspaceId) ?? workspaces?.[0];

  return (
    <div className="flex min-h-svh w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <RiBuilding4Line className="h-4 w-4" />
            </div>
            <span>App</span>
          </div>

          <div className="h-4 w-[1px] bg-border" />

          {selectedWorkspace && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" className="h-8 gap-2 font-medium" />}
              >
                {selectedWorkspace.name}
                <RiMore2Fill className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                  {workspaces.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace.id}
                      onClick={() =>
                        navigate({ to: "/app", search: { workspaceId: workspace.id } })
                      }
                      className="justify-between"
                    >
                      {workspace.name}
                      {workspace.id === selectedWorkspace.id && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate({ to: "/join", search: { manage: true } })}
                >
                  <RiSettings4Line className="mr-2 h-4 w-4" />
                  Manage Workspaces
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-muted" />
              }
            >
              <span className="text-xs font-medium">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm leading-none font-medium">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  await authClient.signOut({
                    fetchOptions: {
                      onSuccess: async () => {
                        window.location.href = "/login";
                      },
                    },
                  });
                }}
              >
                <RiLogoutBoxLine className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
