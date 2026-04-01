import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authQueryOptions } from "@/lib/auth/queries";
import { postLoginRedirectQueryOptions } from "@/lib/workspaces/queries";

export const Route = createFileRoute("/_guest")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      ...authQueryOptions(),
      revalidateIfStale: true,
    });

    if (user) {
      const postLoginRedirect = await context.queryClient.ensureQueryData(
        postLoginRedirectQueryOptions(user.id),
      );

      if (postLoginRedirect.hasMembership && postLoginRedirect.fallbackWorkspaceId) {
        throw redirect({
          to: "/app",
          search: {
            workspaceId: postLoginRedirect.fallbackWorkspaceId,
          },
        });
      }

      throw redirect({ to: "/join" });
    }

    return {
      redirectUrl: "/join" as const,
    };
  },
});

function RouteComponent() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  );
}
