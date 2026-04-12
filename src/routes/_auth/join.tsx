import { RiLoader4Line } from "@remixicon/react";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authQueryOptions } from "@/lib/auth/queries";
import {
	$acceptInvite,
	$createWorkspace,
	$declineInvite,
} from "@/lib/workspaces/functions";
import {
	joinDataQueryOptions,
	myWorkspacesQueryOptions,
	postLoginRedirectQueryOptions,
} from "@/lib/workspaces/queries";

export const Route = createFileRoute("/_auth/join")({
	validateSearch: (search: Record<string, unknown>) => {
		if (
			search.manage === "1" ||
			search.manage === "true" ||
			search.manage === true
		) {
			return { manage: true };
		}

		return {};
	},
	beforeLoad: async ({ context, search }) => {
		if (search.manage) {
			return;
		}

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
	},
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(joinDataQueryOptions());

		return null;
	},
	component: JoinPage,
});

function JoinPage() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [workspaceName, setWorkspaceName] = useState("");
	const [pendingAcceptInviteId, setPendingAcceptInviteId] = useState<
		string | null
	>(null);
	const [pendingDeclineInviteId, setPendingDeclineInviteId] = useState<
		string | null
	>(null);

	const { data: joinData } = useSuspenseQuery(joinDataQueryOptions());

	const { mutate: createWorkspaceMutate, isPending: isCreateWorkspacePending } =
		useMutation({
			mutationFn: async () =>
				$createWorkspace({
					data: {
						name: workspaceName,
					},
				}),
			onSuccess: async (createdWorkspace) => {
				setWorkspaceName("");
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: joinDataQueryOptions().queryKey,
					}),
					queryClient.invalidateQueries({
						queryKey: myWorkspacesQueryOptions().queryKey,
					}),
					queryClient.invalidateQueries({
						queryKey: ["workspaces", "post-login-redirect"],
					}),
				]);
				await navigate({
					to: "/app",
					search: {
						workspaceId: createdWorkspace.id,
					},
				});
			},
			onError: (error) => {
				toast.error(error.message || "Unable to create workspace.");
			},
		});

	const { mutate: acceptInviteMutate } = useMutation({
		mutationFn: async (inviteId: string) =>
			$acceptInvite({
				data: {
					inviteId,
				},
			}),
		onMutate: (inviteId) => {
			setPendingAcceptInviteId(inviteId);
		},
		onSuccess: async (result) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: joinDataQueryOptions().queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: myWorkspacesQueryOptions().queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: ["workspaces", "post-login-redirect"],
				}),
			]);
			await navigate({
				to: "/app",
				search: {
					workspaceId: result.workspaceId,
				},
			});
		},
		onError: (error) => {
			toast.error(error.message || "Unable to accept invite.");
		},
		onSettled: () => {
			setPendingAcceptInviteId(null);
		},
	});

	const { mutate: declineInviteMutate } = useMutation({
		mutationFn: async (inviteId: string) =>
			$declineInvite({
				data: {
					inviteId,
				},
			}),
		onMutate: (inviteId) => {
			setPendingDeclineInviteId(inviteId);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: joinDataQueryOptions().queryKey,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Unable to decline invite.");
		},
		onSettled: () => {
			setPendingDeclineInviteId(null);
		},
	});

	const hasWorkspaceName = workspaceName.trim().length > 0;

	return (
		<div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold">Join a Workspace</h1>
					<p className="text-sm text-muted-foreground">
						Create a workspace or accept an invitation before opening shared
						todos.
					</p>
				</div>
				<SignOutButton />
			</div>

			<section className="rounded-md border p-4">
				<form
					className="flex flex-col gap-3 sm:flex-row sm:items-end"
					onSubmit={(event) => {
						event.preventDefault();

						if (!hasWorkspaceName || isCreateWorkspacePending) {
							return;
						}

						createWorkspaceMutate();
					}}
				>
					<div className="w-full space-y-2">
						<Label htmlFor="workspace-name">Workspace name</Label>
						<Input
							id="workspace-name"
							value={workspaceName}
							onChange={(event) => {
								setWorkspaceName(event.currentTarget.value);
							}}
							placeholder="My Team"
							readOnly={isCreateWorkspacePending}
						/>
					</div>
					<Button
						type="submit"
						disabled={!hasWorkspaceName || isCreateWorkspacePending}
					>
						{isCreateWorkspacePending && (
							<RiLoader4Line className="animate-spin" />
						)}
						{isCreateWorkspacePending ? "Creating..." : "Create workspace"}
					</Button>
				</form>
			</section>

			<section className="rounded-md border p-4">
				<div className="mb-3 flex items-center justify-between gap-2">
					<h2 className="font-medium">Joined workspaces</h2>
					{joinData.joinedWorkspaces[0] ? (
						<Button
							variant="outline"
							size="sm"
							render={
								<Link
									to="/app"
									search={{ workspaceId: joinData.joinedWorkspaces[0].id }}
								/>
							}
							nativeButton={false}
						>
							Open app
						</Button>
					) : (
						<Button variant="outline" size="sm" disabled>
							Open app
						</Button>
					)}
				</div>

				{joinData.joinedWorkspaces.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						You have not joined any workspace yet.
					</p>
				) : (
					<ul className="space-y-2">
						{joinData.joinedWorkspaces.map((joinedWorkspace) => (
							<li
								key={joinedWorkspace.id}
								className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
							>
								<div>
									<p className="font-medium">{joinedWorkspace.name}</p>
									<p className="text-xs text-muted-foreground">
										Role: {joinedWorkspace.role}
									</p>
								</div>
								<Button
									size="sm"
									variant="outline"
									render={
										<Link
											to="/app"
											search={{ workspaceId: joinedWorkspace.id }}
										/>
									}
									nativeButton={false}
								>
									Open
								</Button>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="rounded-md border p-4">
				<h2 className="mb-3 font-medium">Invitations</h2>
				{joinData.invitedWorkspaces.length === 0 ? (
					<p className="text-sm text-muted-foreground">No pending invites.</p>
				) : (
					<ul className="space-y-2">
						{joinData.invitedWorkspaces.map((invitedWorkspace) => {
							const isAccepting =
								pendingAcceptInviteId === invitedWorkspace.inviteId;
							const isDeclining =
								pendingDeclineInviteId === invitedWorkspace.inviteId;
							const isPendingAction = isAccepting || isDeclining;

							return (
								<li
									key={invitedWorkspace.inviteId}
									className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
								>
									<div>
										<p className="font-medium">
											{invitedWorkspace.workspaceName}
										</p>
										<p className="text-xs text-muted-foreground">
											Invite ID: {invitedWorkspace.inviteId}
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											size="sm"
											disabled={isPendingAction}
											onClick={() => {
												acceptInviteMutate(invitedWorkspace.inviteId);
											}}
										>
											{isAccepting && (
												<RiLoader4Line className="animate-spin" />
											)}
											Accept
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={isPendingAction}
											onClick={() => {
												declineInviteMutate(invitedWorkspace.inviteId);
											}}
										>
											{isDeclining && (
												<RiLoader4Line className="animate-spin" />
											)}
											Decline
										</Button>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</div>
	);
}
