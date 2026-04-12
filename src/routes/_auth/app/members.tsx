import {
	RiLoader4Line,
	RiMailLine,
	RiTimeLine,
	RiUserLine,
} from "@remixicon/react";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { $sendInvite } from "@/lib/workspaces/functions";
import {
	myWorkspacesQueryOptions,
	workspaceMembersQueryOptions,
} from "@/lib/workspaces/queries";

export const Route = createFileRoute("/_auth/app/members")({
	validateSearch: (search: Record<string, unknown>) => {
		if (typeof search.workspaceId === "string") {
			return { workspaceId: search.workspaceId };
		}
		return {};
	},
	loaderDeps: ({ search }) => ({ workspaceId: search.workspaceId }),
	loader: async ({ context, deps }) => {
		const workspaces = await context.queryClient.ensureQueryData(
			myWorkspacesQueryOptions(),
		);

		if (workspaces.length === 0) {
			throw redirect({ to: "/join", search: { manage: true } });
		}

		const selectedWorkspace =
			workspaces.find((w) => w.id === deps.workspaceId) ?? workspaces[0];

		if (!selectedWorkspace) {
			throw redirect({ to: "/join", search: { manage: true } });
		}

		await context.queryClient.ensureQueryData(
			workspaceMembersQueryOptions(selectedWorkspace.id),
		);

		return { selectedWorkspaceId: selectedWorkspace.id };
	},
	component: MembersPage,
});

function MembersPage() {
	const search = Route.useSearch();
	const { selectedWorkspaceId: fallbackWorkspaceId } = Route.useLoaderData();
	const queryClient = useQueryClient();

	const { data: workspaces } = useSuspenseQuery(myWorkspacesQueryOptions());

	const selectedWorkspace =
		workspaces.find((w) => w.id === search.workspaceId) ??
		workspaces.find((w) => w.id === fallbackWorkspaceId) ??
		workspaces[0];

	const workspaceId = selectedWorkspace.id;

	const { data } = useSuspenseQuery(workspaceMembersQueryOptions(workspaceId));

	const [inviteEmail, setInviteEmail] = useState("");

	const { mutate: sendInviteMutate, isPending: isSendInvitePending } =
		useMutation({
			mutationFn: async (email: string) =>
				$sendInvite({ data: { workspaceId, email } }),
			onSuccess: async () => {
				setInviteEmail("");
				await queryClient.invalidateQueries({
					queryKey: workspaceMembersQueryOptions(workspaceId).queryKey,
				});
				toast.success("Invitation sent.");
			},
			onError: (error) => {
				toast.error(error.message || "Unable to send invitation.");
			},
		});

	const hasInviteEmail = inviteEmail.trim().length > 0;

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-lg font-semibold">Members</h2>
				<p className="text-sm text-muted-foreground">
					Manage members and invitations for{" "}
					<span className="font-medium text-foreground">
						{selectedWorkspace.name}
					</span>
					.
				</p>
			</div>

			<section className="rounded-lg border">
				<div className="border-b px-4 py-3">
					<h3 className="text-sm font-medium">Invite someone</h3>
				</div>
				<form
					className="flex gap-2 p-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!hasInviteEmail || isSendInvitePending) return;
						sendInviteMutate(inviteEmail);
					}}
				>
					<Input
						type="email"
						placeholder="colleague@example.com"
						value={inviteEmail}
						onChange={(event) => setInviteEmail(event.currentTarget.value)}
						readOnly={isSendInvitePending}
					/>
					<Button
						type="submit"
						disabled={!hasInviteEmail || isSendInvitePending}
					>
						{isSendInvitePending && <RiLoader4Line className="animate-spin" />}
						Invite
					</Button>
				</form>
			</section>

			{data.pendingInvites.length > 0 && (
				<section className="rounded-lg border">
					<div className="border-b px-4 py-3">
						<h3 className="text-sm font-medium">
							Pending invitations ({data.pendingInvites.length})
						</h3>
					</div>
					<ul className="divide-y">
						{data.pendingInvites.map((invite) => (
							<li key={invite.id} className="flex items-center gap-3 px-4 py-3">
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
									<RiMailLine className="h-4 w-4 text-muted-foreground" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{invite.email}</p>
									<p className="text-xs text-muted-foreground">
										Invited by {invite.invitedByName}
									</p>
								</div>
								<div className="flex items-center gap-1 text-xs text-muted-foreground">
									<RiTimeLine className="h-3.5 w-3.5" />
									{new Date(invite.createdAt).toLocaleDateString()}
								</div>
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="rounded-lg border">
				<div className="border-b px-4 py-3">
					<h3 className="text-sm font-medium">
						Members ({data.members.length})
					</h3>
				</div>
				<ul className="divide-y">
					{data.members.map((member) => (
						<li
							key={member.userId}
							className="flex items-center gap-3 px-4 py-3"
						>
							{member.image ? (
								<img
									src={member.image}
									alt=""
									className="h-8 w-8 shrink-0 rounded-full object-cover"
								/>
							) : (
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
									<RiUserLine className="h-4 w-4 text-muted-foreground" />
								</div>
							)}
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">{member.name}</p>
								<p className="truncate text-xs text-muted-foreground">
									{member.email}
								</p>
							</div>
							<span className="rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">
								{member.role}
							</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
