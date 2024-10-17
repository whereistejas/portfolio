import { c as createComponent, r as renderTemplate, m as maybeRenderHead, d as renderSlot, e as createAstro, a as renderComponent, F as Fragment } from '../chunks/astro/server_DGFpQpaA.mjs';
import 'kleur/colors';
/* empty css                                */
import { $ as $$Textorlink, a as $$Homepage } from '../chunks/textorlink_-oquCdUe.mjs';
import 'clsx';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro();
const $$Row = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Row;
  const { key } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div class="row"> <div> ${key} </div> <div class="value"> ${renderSlot($$result, $$slots["default"])} </div> </div>`;
}, "/Users/whereistejas/repos/portfolio/src/components/row.astro", void 0);

const $$Info = createComponent(($$result, $$props, $$slots) => {
  const headers = [
    { type: "text", content: "TEJAS SANAP" },
    { type: "text", content: "INFO" },
    { type: "link", content: "CLOSE", href: "/" }
  ];
  const footers = [
    { type: "link", content: "BLOGROLL", href: "/blogroll" },
    { type: "text", content: "" },
    {
      type: "link",
      content: "SEND AN EMAIL",
      href: "mailto:email@whereistejas.xyz"
    }
  ];
  return renderTemplate`${renderComponent($$result, "Homepage", $$Homepage, {}, { "footer": ($$result2) => renderTemplate`${renderComponent($$result2, "Fragment", Fragment, { "slot": "footer" }, { "default": ($$result3) => renderTemplate`${footers.map((el) => renderTemplate`${renderComponent($$result3, "Textorlink", $$Textorlink, { "type": el.type, "content": el.content, "href": el.href })}`)}` })}`, "header": ($$result2) => renderTemplate`${renderComponent($$result2, "Fragment", Fragment, { "slot": "header" }, { "default": ($$result3) => renderTemplate`${headers.map((el) => renderTemplate`${renderComponent($$result3, "Textorlink", $$Textorlink, { "type": el.type, "content": el.content, "href": el.href })}`)}` })}`, "main": ($$result2) => renderTemplate`${renderComponent($$result2, "Fragment", Fragment, { "slot": "main" }, { "default": ($$result3) => renderTemplate` ${maybeRenderHead()}<section class="info"> <div class="info-inner"> ${renderComponent($$result3, "Row", $$Row, { "key": "Profile" }, { "default": ($$result4) => renderTemplate` <p>
A software engineer and street photographer based in London, UK.
</p> ` })} ${renderComponent($$result3, "Row", $$Row, { "key": "Things I believe" }, { "default": ($$result4) => renderTemplate` <p>All software is a tool, a means to an end.</p> <p>A good tool is simple and intuitive to use.</p> <p>Software is made "for" humans.</p> ` })} ${renderComponent($$result3, "Row", $$Row, { "key": "Experience" }, { "default": ($$result4) => renderTemplate` <p> <a href="https://tably.com">Tably</a>, 2021&mdash;Present
</p> <p> <a href="https://wipro.com">Wipro</a>, 2019&mdash;2021
</p> ` })} ${renderComponent($$result3, "Row", $$Row, { "key": "Education" }, { "default": ($$result4) => renderTemplate` <p>
Bachelors in Mechanical Engineering, <a href="https://www.unipune.ac.in">SPPU</a>, 2016&mdash;2019
</p> ` })} ${renderComponent($$result3, "Row", $$Row, { "key": "Elsewhere" }, { "default": ($$result4) => renderTemplate` <p> <a href="https://www.linkedin.com/in/whereistejas">Linkedin</a>,
<a href="https://www.github.com/whereistejas">Github</a>,
<a href="https://www.x.com/whereistejas">X</a>,
<a href="https://www.instagram.com/whereistejas">Instagram</a> </p> ` })} </div> </section> ` })}` })}`;
}, "/Users/whereistejas/repos/portfolio/src/pages/info.astro", void 0);

const $$file = "/Users/whereistejas/repos/portfolio/src/pages/info.astro";
const $$url = "/info";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Info,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
