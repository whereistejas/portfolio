import { c as createComponent, r as renderTemplate, b as addAttribute, e as createAstro, a as renderComponent, f as renderHead, d as renderSlot, m as maybeRenderHead } from './astro/server_DGFpQpaA.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                            */

const $$Astro$1 = createAstro();
const $$ViewTransitions = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$ViewTransitions;
  const { fallback = "animate" } = Astro2.props;
  return renderTemplate`<meta name="astro-view-transitions-enabled" content="true"><meta name="astro-view-transitions-fallback"${addAttribute(fallback, "content")}>`;
}, "/Users/whereistejas/repos/portfolio/node_modules/astro/components/ViewTransitions.astro", void 0);

const $$Homepage = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="en"> <head><!--
  Like to view source? We might get along
  email@whereistejas.xyz
--><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="preload" href="/AUTHENTICSans-90.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/AUTHENTICSans-130.woff2" as="font" type="font/woff2" crossorigin>${renderComponent($$result, "ViewTransitions", $$ViewTransitions, {})}<title>Tejas Sanap | Portfolio</title>${renderHead()}</head> <body> <header> ${renderSlot($$result, $$slots["header"])} </header> <main> ${renderSlot($$result, $$slots["main"])} </main> <footer> ${renderSlot($$result, $$slots["footer"])} </footer> </body></html>`;
}, "/Users/whereistejas/repos/portfolio/src/components/homepage.astro", void 0);

const $$Astro = createAstro();
const $$Textorlink = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Textorlink;
  const { type, content, href } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div> <h4> ${type === "link" ? renderTemplate`<a${addAttribute(href, "href")}>${content}</a>` : content} </h4> </div>`;
}, "/Users/whereistejas/repos/portfolio/src/components/textorlink.astro", void 0);

export { $$Textorlink as $, $$Homepage as a };
