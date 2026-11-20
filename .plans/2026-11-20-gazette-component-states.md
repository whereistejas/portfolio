# Gazette component states

The gazette reuses the same components on different pages, and each page renders them a little differently. The lead story gets a pull quote on the front page, for example, but not on its volume page. This note records how each component looks and behaves on each page, so we can design a page for a single item from the same pieces.

## The pages

There are two gazette pages today, and a third is planned.

- **Front page**, `/gazette` (`src/pages/gazette.astro`, which renders `src/components/Gazette.astro`). It has three parts:
  - **The front**: the latest volume, laid out like a newspaper front page by `GazetteFront` (`src/components/GazetteFront.astro`) with one `GazetteStory` per article.
  - **Back issues**: the 12 volumes before it, each rendered as a compact `GazetteEdition` (`src/components/GazetteEdition.astro`).
  - **Earlier volumes**: a list of links to every older volume (`GazetteEarlier`, `src/components/GazetteEarlier.astro`). As you scroll near the list, its script fetches four of those volume pages at a time and moves their `.gazette-edition` element onto the front page. Editions loaded this way keep the markup they had on the volume page.
- **Volume page**, `/gazette/vol-N` (`src/pages/gazette/[volume].astro`). Shows one volume as a `GazetteEdition`, with `anchored` set.
- **Item page** (planned). One article and its highlights.

`/tbr` (`src/pages/tbr.astro`) also renders `Gazette.astro`, but with `numbered={false}`: it has no volume numbers and no permalinks. Any change to a shared component reaches it too.

## Highlights: the accordion and the margin note

Every article can show its highlights in two ways, and this choice changes the most from page to page.

The first is the **highlights accordion**, `GazetteHighlights` (`src/components/GazetteHighlights.astro`). It is a `<details>` element whose summary reads "3 highlights", or "2 more highlights" when one highlight is already shown as a pull quote. It starts closed. Every accordion uses the same `name="gazette-highlights"`, so opening one closes whichever other one is open.

The second is the **margin note**, `GazetteNote` (`src/components/GazetteNote.astro`): a copy of the highlights under the article's title. It only appears on wide screens, at 116rem and up. At that width the script in `GazettePaper` (`src/components/GazettePaper.astro`) sets `data-rail` on the page and lines up the open article's note beside it in the right margin. On wide screens, opening the accordion of an article that has a note shows the note instead, and the accordion's own content stays hidden. On narrower screens notes are hidden, and every accordion opens in place.

Only some articles get a margin note. The table below says which ones do on each page.

## States by page

The permalink is the `#` after an article's title, from `GazettePermalink` (`src/components/GazettePermalink.astro`). The link is invisible until you hover over the article or focus the link, and it is always visible on touch screens. It points to `/gazette/vol-N#<anchor>`, where the anchor is a slug of the article's title (`anchorsOf`, `src/lib/gazette.ts:87`).

| | Front page: the front | Front page: back issues | Volume page | Item page |
| --- | --- | --- | --- | --- |
| Component | `GazetteStory`: one lead story, then side stories in the left and right columns, the fold under the lead, and the grid below | `GazetteEdition`: a lead piece, then the rest as a list (`GazetteEditionItem`) | `GazetteEdition`, as on the front page | Open |
| Summary text (dek) | Lead: in full. Side stories: cut to the lines that fit their space | Lead: in full. List items: none | As on the front page | Open |
| Pull quote | Lead only: its first highlight of 60 to 400 characters | None | None | Open |
| Highlights accordion | Closed. A separate "N highlights" line under the summary | Closed. Lead: a separate line. List items: the title and byline are the toggle | As on the front page | **Open by default** |
| Margin note | Lead and the left and right columns: whenever highlights remain after the pull quote. Fold and grid: more than 4 highlights | Lead: whenever it has highlights. List items: more than 4 highlights | As on the front page | **None** |
| Permalink (`#`) | Yes, to the latest volume | Yes | Yes | Open |
| Anchor `id`, yellow wash when linked to | No | No, except editions loaded while scrolling, which bring the volume page's `id`s | Yes, the wash comes from `:target` (`src/styles/global.css:571`) | Not needed |
| Masthead | Paper name, "Early Edition →" link to `/tbr`, "Vol. N", build date, tagline | None of its own | "Gazette" linking to `/gazette`, "Vol. N", the week's end date | Open |
| Edition heading | None | "Vol. N" linking to the volume page, and the week's end date | Same; "Vol. N" links to the page you are on | Open |
| Navigation | "Earlier volumes" list, loading more editions as you scroll | None | Links to the older and newer volume | Open |

Bold cells are decided. "Open" cells are the questions below.

## The item page

Two things are decided.

- **No margin note.** On a page with one article, the note would repeat the highlights in the margin for no reason. The item page should not mark the article as noted, so the accordion's own content shows at every width.
- **The accordion starts open.** The highlights are the reason to visit an item page, so they show without a click.

The rest is open:

- Should the accordion still close, or should the highlights be plain blockquotes with no toggle?
- Does the summary show in full? Does the first suitable highlight become a pull quote, as on the lead story?
- The `#` link would point at the page itself. Drop it, or keep it as a "copy link" target?
- What links back: to the volume (and to the article's place in it), to the previous and next item, or both?
- What does the masthead show?
- If the item page reuses `GazetteEdition` or `GazetteEditionItem`, its changes must not alter the volume page's edition. That edition is also the one the front page copies in as you scroll.
