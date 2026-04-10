import {
	useState,
	useCallback,
	useMemo,
	useEffect,
	useRef,
	useLayoutEffect,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

interface HighlightsAccordionProps {
	highlightsHtml: string[];
	highlightId: string;
	paneId: string;
	count: number;
	summary: string;
	displayCategory: string;
	metaParts: string[];
}

const useReducedMotion = () => {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/* ── Highlight list variants ────────────────────────────────────── */

const containerVariants = {
	hidden: {},
	visible: {
		transition: { staggerChildren: 0.05, delayChildren: 0.12 },
	},
	exit: {
		transition: { staggerChildren: 0.04, staggerDirection: -1 },
	},
};

const itemVariants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: { duration: 0.35, ease: "easeOut" } },
	exit: { opacity: 0, transition: { duration: 0.25, ease: "easeIn" } },
};

const instantVariants = {
	hidden: { opacity: 1 },
	visible: { opacity: 1 },
	exit: { opacity: 1 },
};

/* ── Separator ──────────────────────────────────────────────────── */

function Dot() {
	return (
		<span className="text-yellow-700 dark:text-yellow-600">{" · "}</span>
	);
}

/* ── Description with animated height ───────────────────────────── */

function AnimatedDescription({
	text,
	isOpen,
	reducedMotion,
}: {
	text: string;
	isOpen: boolean;
	reducedMotion: boolean;
}) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLSpanElement>(null);
	const [heights, setHeights] = useState<{
		clamped: number;
		full: number;
	} | null>(null);

	useLayoutEffect(() => {
		const wrapper = wrapperRef.current;
		const inner = innerRef.current;
		if (!wrapper || !inner) return;

		// The inner span has feed-desc (with line-clamp-2 from CSS).
		// Measure clamped height from the wrapper (which clips to the clamp).
		const clampedHeight = wrapper.offsetHeight;

		// Temporarily unclamp to measure full height
		inner.style.webkitLineClamp = "unset";
		inner.style.maxHeight = "none";
		const fullHeight = wrapper.offsetHeight;

		// Restore
		inner.style.webkitLineClamp = "";
		inner.style.maxHeight = "";

		if (fullHeight > clampedHeight) {
			setHeights({ clamped: clampedHeight, full: fullHeight });
		}
	}, [text]);

	// No overflow detected — render with normal CSS clamp
	if (!heights) {
		return (
			<div ref={wrapperRef}>
				<span ref={innerRef} className="feed-desc">
					{text}
				</span>
			</div>
		);
	}

	// Overflow detected — animate between clamped and full height
	const targetH = isOpen ? heights.full : heights.clamped;

	return (
		<motion.div
			ref={wrapperRef}
			className="feed-desc-wrapper"
			animate={{ height: targetH }}
			initial={false}
			transition={
				reducedMotion
					? { duration: 0 }
					: {
							duration: 0.45,
							ease: [0.05, 0.7, 0.1, 1],
						}
			}
			style={{ overflow: "hidden" }}
		>
			<span ref={innerRef} className="feed-desc feed-desc--no-clamp">
				{text}
			</span>
		</motion.div>
	);
}

/* ── Main accordion component ───────────────────────────────────── */

export default function HighlightsAccordion({
	highlightsHtml,
	highlightId,
	paneId,
	count,
	summary,
	displayCategory,
	metaParts,
}: HighlightsAccordionProps) {
	const [isOpen, setIsOpen] = useState(false);
	const reducedMotion = useReducedMotion();
	const rootRef = useRef<HTMLDivElement>(null);

	const toggle = useCallback(() => {
		setIsOpen((prev) => !prev);
	}, []);

	useEffect(() => {
		const feedItem = rootRef.current?.closest(".feed-item");
		if (!feedItem) return;
		if (isOpen) {
			feedItem.setAttribute("data-expanded", "true");
		} else {
			feedItem.removeAttribute("data-expanded");
		}
	}, [isOpen]);

	const bodyTransition = useMemo(
		() =>
			reducedMotion
				? { duration: 0 }
				: {
						height: {
							duration: 0.45,
							ease: [0.05, 0.7, 0.1, 1] as const,
						},
						opacity: { duration: 0.3, ease: "easeInOut" as const },
					},
		[reducedMotion],
	);

	const listVariants = reducedMotion
		? { hidden: {}, visible: {}, exit: {} }
		: containerVariants;

	const liVariants = reducedMotion ? instantVariants : itemVariants;

	return (
		<div ref={rootRef} style={{ display: "contents" }}>
			{summary && (
				<AnimatedDescription
					text={summary}
					isOpen={isOpen}
					reducedMotion={reducedMotion}
				/>
			)}
			<span className="feed-meta">
				{displayCategory && (
					<span className="hidden md:inline">
						{displayCategory}
						<Dot />
					</span>
				)}
				{metaParts.map((part, i) => (
					<span key={i}>
						{i > 0 && <Dot />}
						{part}
					</span>
				))}
				<Dot />
				<button
					type="button"
					className="feed-highlight-btn"
					aria-expanded={isOpen}
					aria-controls={paneId}
					onClick={toggle}
				>
					{count} {count === 1 ? "highlight" : "highlights"}
					<motion.span
						className="feed-highlight-chevron"
						aria-hidden="true"
						animate={{ rotate: isOpen ? 180 : 0 }}
						transition={
							reducedMotion
								? { duration: 0 }
								: {
										type: "spring",
										stiffness: 400,
										damping: 25,
									}
						}
						style={{ display: "inline-block" }}
					>
						&#x25BC;
					</motion.span>
				</button>
			</span>
			<AnimatePresence initial={false}>
				{isOpen && (
					<motion.div
						key={paneId}
						id={paneId}
						className="feed-highlights-body"
						data-open="true"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={bodyTransition}
						style={{ overflow: "hidden" }}
					>
						<motion.ul
							className="feed-highlights-list"
							variants={listVariants}
							initial="hidden"
							animate="visible"
							exit="exit"
						>
							{highlightsHtml.map((html, i) => (
								<motion.li
									key={`${highlightId}-${i}`}
									variants={liVariants}
								>
									<blockquote
										dangerouslySetInnerHTML={{
											__html: html,
										}}
									/>
								</motion.li>
							))}
						</motion.ul>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
