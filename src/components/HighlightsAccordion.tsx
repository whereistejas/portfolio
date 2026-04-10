import { useState, useCallback } from "react";

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
			{isOpen && (
				<div className="feed-highlights-body" id={paneId} data-open="true">
					<ul className="feed-highlights-list">
						{highlightsHtml.map((html, i) => (
							<li
								key={`${highlightId}-${i}`}
								style={
									{
										"--i": i,
										"--reverse-i": highlightsHtml.length - 1 - i,
									} as React.CSSProperties
								}
							>
								<blockquote
									dangerouslySetInnerHTML={{ __html: html }}
								/>
							</li>
						))}
					</ul>
				</div>
			)}
		</>
	);
}
