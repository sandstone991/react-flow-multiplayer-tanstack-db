import { PerfectCursor } from "perfect-cursors";
import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";

function usePerfectCursor(cb: (point: number[]) => void) {
	const [pc] = useState(() => new PerfectCursor(cb));

	useLayoutEffect(() => {
		return () => pc.dispose();
	}, [pc]);

	const onPointChange = useCallback(
		(point: number[]) => pc.addPoint(point),
		[pc],
	);

	return onPointChange;
}

interface RemoteCursorProps {
	point: { x: number; y: number };
	userName: string;
	userColor: string;
}

function RemoteCursorInner({ point, userName, userColor }: RemoteCursorProps) {
	const rCursor = useRef<HTMLDivElement>(null);

	const animateCursor = useCallback((pt: number[]) => {
		const elm = rCursor.current;
		if (!elm) return;
		elm.style.setProperty("transform", `translate(${pt[0]}px, ${pt[1]}px)`);
	}, []);

	const onPointMove = usePerfectCursor(animateCursor);

	useLayoutEffect(() => {
		onPointMove([point.x, point.y]);
	}, [onPointMove, point.x, point.y]);

	return (
		<div
			ref={rCursor}
			style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
		>
			<svg
				aria-hidden="true"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				style={{ overflow: "visible" }}
			>
				<path
					d="M5.65 2.65L20.35 11.65L12.65 12.85L9.35 19.85L5.65 2.65Z"
					fill={userColor}
					stroke="white"
					strokeWidth="1.5"
					strokeLinejoin="round"
				/>
			</svg>
			<div
				style={{
					position: "absolute",
					left: 18,
					top: 16,
					backgroundColor: userColor,
					color: "white",
					fontSize: 11,
					lineHeight: 1,
					fontWeight: 500,
					padding: "3px 6px",
					borderRadius: 4,
					whiteSpace: "nowrap",
					pointerEvents: "none",
					boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
				}}
			>
				{userName}
			</div>
		</div>
	);
}

export const RemoteCursor = memo(RemoteCursorInner);
