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
| Component | `GazetteStory`: one lead story, then side stories in the left and right columns, the fold under the lead, and the grid below | `GazetteEdition`: a lead piece, then the rest as a list (`GazetteEditionItem`) | `GazetteEdition`, as on the front page | Its own component, not `GazetteEdition` |
| Summary text (dek) | Lead: in full. Side stories: cut to the lines that fit their space | Lead: in full. List items: none | As on the front page | In full |
| Pull quote | Lead only: its first highlight of 60 to 400 characters | None | None | Yes: the first highlight of 60 to 400 characters, as on the lead story |
| Highlights accordion | Closed. A separate "N highlights" line under the summary | Closed. Lead: a separate line. List items: the title and byline are the toggle | As on the front page | None: every highlight is shown as a plain quote, with no toggle |
| Margin note | Lead and the left and right columns: whenever highlights remain after the pull quote. Fold and grid: more than 4 highlights | Lead: whenever it has highlights. List items: more than 4 highlights | As on the front page | None |
| Permalink (`#`) | Yes, to the latest volume | Yes | Yes | None |
| Anchor `id`, yellow wash when linked to | No | No, except editions loaded while scrolling, which bring the volume page's `id`s | Yes, the wash comes from `:target` (`src/styles/global.css:571`) | None |
| Masthead | Paper name, "Early Edition →" link to `/tbr`, "Vol. N", build date, tagline | None of its own | "Gazette" linking to `/gazette`, "Vol. N", the week's end date | As on the volume page; "Vol. N" links to the whole volume |
| Edition heading | None | "Vol. N" linking to the volume page, and the week's end date | Same; "Vol. N" links to the page you are on | None |
| Navigation | "Earlier volumes" list, loading more editions as you scroll | None | Links to the older and newer volume | None beyond the masthead's link to the volume |

## The item page

The item page exists to show one article's highlights, so it drops everything that hides them or competes with them.

- **No accordion.** All highlights show as plain quotes. With nothing to open, the page has no states to switch between.
- **No margin note.** It would repeat highlights that are already on the page.
- **Full summary and a pull quote**, as on the front page's lead story. The remaining highlights follow as quotes.
- **No permalink and no anchor.** The `#` would point at the page itself, and nothing links into the page by fragment.
- **The volume page's masthead.** Its "Vol. N" links to the whole volume, which is the way back. There are no links to older and newer volumes, or to neighbouring items.

## Keeping the volume page unchanged

The volume page's edition is also the one the front page copies in as you scroll: `GazetteEarlier` fetches each volume page and takes its `.gazette-edition` element. So the item page must not change how the volume page renders.

- **Its own component.** The item page renders the article with a component of its own, not with `GazetteEdition` or `GazetteEditionItem` in a new mode. It can reuse helpers such as `parseAuthors` and the highlight HTML from `renderHighlightsHtml`, but no edition component, so the volume page's markup cannot change by accident.
- **No edition on the item page.** The page contains no `.gazette-edition` element, so the front page's scrolling can never pick it up.
- **Styles under its own class.** New rules in `src/styles/global.css` select only the item page's own class, so they cannot restyle the volume page. The build comparison below checks markup, not styles.
- **A before-and-after build.** Build the site before and after the change, and compare every `dist/gazette/vol-*/index.html`. Apart from hashed asset names, the files must be identical.
