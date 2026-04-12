import { createFileRoute, redirect } from "@tanstack/react-router";

import { authQueryOptions } from "@/lib/auth/queries";
import { postLoginRedirectQueryOptions } from "@/lib/workspaces/queries";

export const Route = createFileRoute("/")({
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.ensureQueryData({
			...authQueryOptions(),
			revalidateIfStale: true,
		});

		if (!user) {
			throw redirect({ to: "/login" });
		}

		const postLoginRedirect = await context.queryClient.ensureQueryData(
			postLoginRedirectQueryOptions(user.id),
		);

		if (
			postLoginRedirect.hasMembership &&
			postLoginRedirect.fallbackWorkspaceId
		) {
			throw redirect({
				to: "/app",
				search: {
					workspaceId: postLoginRedirect.fallbackWorkspaceId,
				},
			});
		}

		throw redirect({ to: "/join" });
	},
	component: HomePage,
});

function HomePage() {
	return null;
}
