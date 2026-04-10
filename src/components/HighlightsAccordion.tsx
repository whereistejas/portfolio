import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface HighlightsAccordionProps {
	highlightsHtml: string[];
	highlightId: string;
	paneId: string;
}

const useReducedMotion = () => {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const containerVariants = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.05,
			delayChildren: 0.12,
		},
	},
	exit: {
		transition: {
			staggerChildren: 0.04,
			staggerDirection: -1,
		},
	},
};

const itemVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { duration: 0.35, ease: "easeOut" },
	},
	exit: {
		opacity: 0,
		transition: { duration: 0.25, ease: "easeIn" },
	},
};

const instantVariants = {
	hidden: { opacity: 1 },
	visible: { opacity: 1 },
	exit: { opacity: 1 },
};

export default function HighlightsAccordion({
	highlightsHtml,
	highlightId,
	paneId,
}: HighlightsAccordionProps) {
	const [isOpen, setIsOpen] = useState(false);
	const reducedMotion = useReducedMotion();
	const rootRef = useRef<HTMLDivElement>(null);

	const toggle = useCallback(() => {
		setIsOpen((prev) => !prev);
	}, []);

	// Sync data-expanded on the closest .feed-item ancestor for CSS
	useEffect(() => {
		const feedItem = rootRef.current?.closest(".feed-item");
		if (!feedItem) return;
		if (isOpen) {
			feedItem.setAttribute("data-expanded", "true");
		} else {
			feedItem.removeAttribute("data-expanded");
		}
	}, [isOpen]);

	const count = highlightsHtml.length;

	const bodyTransition = useMemo(
		() =>
			reducedMotion
				? { duration: 0 }
				: {
						height: {
							type: "spring" as const,
							stiffness: 300,
							damping: 30,
							mass: 0.8,
						},
						opacity: { duration: 0.25, ease: "easeInOut" as const },
					},
		[reducedMotion],
	);

	const listVariants = reducedMotion
		? { hidden: {}, visible: {}, exit: {} }
		: containerVariants;

	const liVariants = reducedMotion ? instantVariants : itemVariants;

	return (
		<div ref={rootRef} style={{ display: "contents" }}>
			<span className="feed-meta">
				<span className="text-yellow-700 dark:text-yellow-600">
					{" · "}
				</span>
				<button
					type="button"
					className="feed-highlight-btn"
					aria-expanded={isOpen}
					aria-controls={paneId}
					onClick={toggle}
				>
					{count} {count === 1 ? "highlight" : "highlights"}
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
