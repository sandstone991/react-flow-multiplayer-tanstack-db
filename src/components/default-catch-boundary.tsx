import {
	ErrorComponent,
	type ErrorComponentProps,
	Link,
	rootRouteId,
	useMatch,
	useRouter,
} from "@tanstack/react-router";

import { Button } from "./ui/button";

const formatErrorForConsole = (error: unknown) => {
	if (error instanceof Error) {
		const stack = typeof error.stack === "string" ? `\n${error.stack}` : "";
		return `${error.name}: ${error.message}${stack}`;
	}

	if (typeof error === "string") {
		return error;
	}

	if (typeof error === "symbol") {
		return `Non-Error thrown value: ${error.toString()}`;
	}

	if (
		typeof error === "number" ||
		typeof error === "boolean" ||
		typeof error === "bigint" ||
		typeof error === "undefined" ||
		error === null
	) {
		return `Non-Error thrown value: ${String(error)}`;
	}

	if (typeof error === "object") {
		const constructorName =
			Object.getPrototypeOf(error)?.constructor?.name ?? "Object";
		return `Non-Error thrown value: [${constructorName}]`;
	}

	return "Unknown thrown value";
};

export function DefaultCatchBoundary({ error }: Readonly<ErrorComponentProps>) {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});

	const formattedError = formatErrorForConsole(error);
	const errorForDisplay =
		error instanceof Error ? error : new Error(formattedError);

	console.error(formattedError);

	return (
		<div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 p-4">
			<ErrorComponent error={errorForDisplay} />
			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					onClick={() => {
						router.invalidate();
					}}
				>
					Try Again
				</Button>
				{isRoot ? (
					<Button
						render={<Link to="/" />}
						variant="secondary"
						nativeButton={false}
					>
						Home
					</Button>
				) : (
					<Button
						render={
							<Link
								to="/"
								onClick={(e) => {
									e.preventDefault();
									window.history.back();
								}}
							/>
						}
						variant="secondary"
						nativeButton={false}
					>
						Go Back
					</Button>
				)}
			</div>
		</div>
	);
}
