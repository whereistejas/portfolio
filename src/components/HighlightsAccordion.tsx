import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface HighlightsAccordionProps {
	highlightsHtml: string[];
	highlightId: string;
	paneId: string;
}

export default function HighlightsAccordion({
	highlightsHtml,
	highlightId,
	paneId,
}: HighlightsAccordionProps) {
	const [isOpen, setIsOpen] = useState(false);

	const toggle = useCallback(() => {
		setIsOpen((prev) => !prev);
	}, []);

	const count = highlightsHtml.length;

	return (
		<>
			<span className="feed-meta">
				<span className="text-yellow-700 dark:text-yellow-600">{" · "}</span>
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
						transition={{
							height: {
								type: "spring",
								stiffness: 300,
								damping: 30,
								mass: 0.8,
							},
							opacity: { duration: 0.25, ease: "easeInOut" },
						}}
						style={{ overflow: "hidden" }}
					>
						<ul className="feed-highlights-list">
							{highlightsHtml.map((html, i) => (
								<li
									key={`${highlightId}-${i}`}
									style={
										{
											"--i": i,
											"--reverse-i":
												highlightsHtml.length - 1 - i,
										} as React.CSSProperties
									}
								>
									<blockquote
										dangerouslySetInnerHTML={{
											__html: html,
										}}
									/>
								</li>
							))}
						</ul>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
