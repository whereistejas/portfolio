import { c as createComponent, r as renderTemplate, a as renderComponent, F as Fragment, m as maybeRenderHead, b as addAttribute } from '../chunks/astro/server_DGFpQpaA.mjs';
import 'kleur/colors';
/* empty css                                    */
import { $ as $$Textorlink, a as $$Homepage } from '../chunks/textorlink_-oquCdUe.mjs';
import { Omnivore } from '@omnivore-app/api';
export { renderers } from '../renderers.mjs';

const $$Blogroll = createComponent(async ($$result, $$props, $$slots) => {
  const OMNIVORE_API_URL = "https://api-prod.omnivore.app/api/graphql";
  const OMNIVORE_API_KEY = "2b6ef701-27a9-4fe6-9ec2-994d0b6f2e8a";
  const omnivore = new Omnivore({
    apiKey: OMNIVORE_API_KEY,
    baseUrl: OMNIVORE_API_URL
  });
  const data = await omnivore.items.search({
    after: 0,
    first: 1e3,
    query: "in:archive"
  });
  const articles = data.edges.map((edge) => edge.node);
  const headers = [
    { type: "text", content: "TEJAS SANAP" },
    { type: "text", content: "BLOGROLL" },
    { type: "link", content: "CLOSE", href: "/" }
  ];
  return renderTemplate`${renderComponent($$result, "Homepage", $$Homepage, {}, { "header": ($$result2) => renderTemplate`${renderComponent($$result2, "Fragment", Fragment, { "slot": "header" }, { "default": ($$result3) => renderTemplate`${headers.map((el) => renderTemplate`${renderComponent($$result3, "Textorlink", $$Textorlink, { "type": el.type, "content": el.content, "href": el.href })}`)}` })}`, "main": ($$result2) => renderTemplate`${renderComponent($$result2, "Fragment", Fragment, { "slot": "main" }, { "default": ($$result3) => renderTemplate` ${maybeRenderHead()}<div class="readinglist"> <ul> ${articles.map((article) => renderTemplate`<li> <a${addAttribute(article.url, "href")} target="_blank" rel="noopener noreferrer"> ${article.title} </a>  <p>${new Date(article.savedAt).toLocaleDateString()}</p> </li>`)} </ul> </div> ` })}` })}`;
}, "/Users/whereistejas/repos/portfolio/src/pages/blogroll.astro", void 0);

const $$file = "/Users/whereistejas/repos/portfolio/src/pages/blogroll.astro";
const $$url = "/blogroll";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Blogroll,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
