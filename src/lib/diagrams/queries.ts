import { queryOptions } from "@tanstack/react-query";
import { $getDiagrams } from "./functions";

export const diagramsQueryOptions = (workspaceId: string) =>
	queryOptions({
		queryKey: ["diagrams", workspaceId],
		queryFn: () => $getDiagrams({ data: { workspaceId } }),
		enabled: !!workspaceId,
	});
