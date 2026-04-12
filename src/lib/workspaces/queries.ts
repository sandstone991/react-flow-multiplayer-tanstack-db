import { queryOptions } from "@tanstack/react-query";

import {
	$getJoinData,
	$getMyWorkspaces,
	$getPostLoginRedirect,
	$getWorkspaceMembers,
} from "./functions";

export const joinDataQueryOptions = () =>
	queryOptions({
		queryKey: ["workspaces", "join-data"],
		queryFn: ({ signal }) => $getJoinData({ signal }),
	});

export const myWorkspacesQueryOptions = () =>
	queryOptions({
		queryKey: ["workspaces", "mine"],
		queryFn: ({ signal }) => $getMyWorkspaces({ signal }),
	});

export const postLoginRedirectQueryOptions = (userId: string) =>
	queryOptions({
		queryKey: ["workspaces", "post-login-redirect", userId],
		staleTime: 0,
		queryFn: ({ signal }) => $getPostLoginRedirect({ signal }),
	});

export const workspaceMembersQueryOptions = (workspaceId: string) =>
	queryOptions({
		queryKey: ["workspaces", "members", workspaceId],
		queryFn: ({ signal }) =>
			$getWorkspaceMembers({ signal, data: { workspaceId } }),
	});

export type JoinDataQueryResult = Awaited<ReturnType<typeof $getJoinData>>;
export type MyWorkspacesQueryResult = Awaited<
	ReturnType<typeof $getMyWorkspaces>
>;
export type PostLoginRedirectQueryResult = Awaited<
	ReturnType<typeof $getPostLoginRedirect>
>;
export type WorkspaceMembersQueryResult = Awaited<
	ReturnType<typeof $getWorkspaceMembers>
>;
