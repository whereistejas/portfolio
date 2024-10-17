import 'cookie';
import 'kleur/colors';
import 'es-module-lexer';
import './chunks/astro-designed-error-pages_eBYmH5B8.mjs';
import { g as decodeKey } from './chunks/astro/server_DGFpQpaA.mjs';
import 'clsx';
import { compile } from 'path-to-regexp';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getRouteGenerator(segments, addTrailingSlash) {
  const template = segments.map((segment) => {
    return "/" + segment.map((part) => {
      if (part.spread) {
        return `:${part.content.slice(3)}(.*)?`;
      } else if (part.dynamic) {
        return `:${part.content}`;
      } else {
        return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    }).join("");
  }).join("");
  let trailing = "";
  if (addTrailingSlash === "always" && segments.length) {
    trailing = "/";
  }
  const toPath = compile(template + trailing);
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    const path = toPath(sanitizedParams);
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware(_, next) {
      return next();
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///Users/whereistejas/repos/portfolio/","adapterName":"@astrojs/vercel/serverless","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.CmkSwYHY.js"}],"styles":[{"type":"inline","content":"@font-face{font-family:Authentic Sans;src:url(/AUTHENTICSans-90.woff2);font-weight:90}@font-face{font-family:Authentic Sans;src:url(/AUTHENTICSans-130.woff2);font-weight:130}:root{--step--2: clamp(.6944rem, .6856rem + .0444vw, .72rem);--step--1: clamp(.8333rem, .8101rem + .1159vw, .9rem);--step-0: clamp(1rem, .9565rem + .2174vw, 1.125rem);--step-1: clamp(1.2rem, 1.1283rem + .3587vw, 1.4063rem);--step-2: clamp(1.44rem, 1.3295rem + .5527vw, 1.7578rem);--step-3: clamp(1.728rem, 1.5648rem + .8161vw, 2.1973rem);--step-4: clamp(2.0736rem, 1.8395rem + 1.1704vw, 2.7466rem);--step-5: clamp(2.4883rem, 2.1597rem + 1.6433vw, 3.4332rem);--font-base: system-ui, sans-serif;--font-display: \"Authentic Sans\", var(--font-base);--font-mono: monospace;--font-bold: 130;--font-semibold: 130;--font-normal: 90}.readinglist{padding-top:calc(3 * var(--space-xs-s) + var(--step-1));padding-bottom:calc(2 * var(--space-xs-s) + var(--step-1));padding-left:var(--space-xs-s);padding-right:var(--space-xs-s)}ul{display:flex;flex-direction:column;gap:var(--space-s-m)}li{display:flex;flex-direction:column;gap:var(--space-3xs-2xs);>a{width:fit-content}>p{font-size:var(--step--1)}}\n"},{"type":"external","src":"/_astro/blogroll.DKl1Xj6A.css"}],"routeData":{"route":"/blogroll","isIndex":false,"type":"page","pattern":"^\\/blogroll\\/?$","segments":[[{"content":"blogroll","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/blogroll.astro","pathname":"/blogroll","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.CmkSwYHY.js"}],"styles":[{"type":"external","src":"/_astro/blogroll.DKl1Xj6A.css"},{"type":"inline","content":":root{--space-3xs: clamp(.25rem, .2283rem + .1087vw, .3125rem);--space-2xs: clamp(.5rem, .4783rem + .1087vw, .5625rem);--space-xs: clamp(.75rem, .7065rem + .2174vw, .875rem);--space-s: clamp(1rem, .9565rem + .2174vw, 1.125rem);--space-m: clamp(1.5rem, 1.4348rem + .3261vw, 1.6875rem);--space-l: clamp(2rem, 1.913rem + .4348vw, 2.25rem);--space-xl: clamp(3rem, 2.8696rem + .6522vw, 3.375rem);--space-2xl: clamp(4rem, 3.8261rem + .8696vw, 4.5rem);--space-3xl: clamp(5rem, 4.7826rem + 1.087vw, 5.625rem);--space-3xs-2xs: clamp(.25rem, .1413rem + .5435vw, .5625rem);--space-2xs-xs: clamp(.5rem, .3696rem + .6522vw, .875rem);--space-xs-s: clamp(.75rem, .6196rem + .6522vw, 1.125rem);--space-s-m: clamp(1rem, .7609rem + 1.1957vw, 1.6875rem);--space-m-l: clamp(1.5rem, 1.2391rem + 1.3043vw, 2.25rem);--space-l-xl: clamp(2rem, 1.5217rem + 2.3913vw, 3.375rem);--space-xl-2xl: clamp(3rem, 2.4783rem + 2.6087vw, 4.5rem);--space-2xl-3xl: clamp(4rem, 3.4348rem + 2.8261vw, 5.625rem);--space-s-l: clamp(1rem, .5652rem + 2.1739vw, 2.25rem)}.info{padding-top:calc(3 * var(--space-xs-s) + var(--step-1));padding-bottom:calc(2 * var(--space-xs-s) + var(--step-1));padding-left:var(--space-xs-s);padding-right:var(--space-xs-s)}.info-inner{height:100%;width:100%;display:flex;flex-direction:column;justify-content:center;gap:var(--space-m-l)}@media (max-width: 800px){.info-inner{width:100%}}.row{display:grid;grid-template-columns:1fr 3fr;align-items:start}@media (max-width: 800px){.row{display:flex;flex-direction:column;gap:var(--space-2xs-xs)}}.value{display:flex;flex-direction:column;line-height:1.1;gap:var(--space-2xs-xs)}\n"}],"routeData":{"route":"/info","isIndex":false,"type":"page","pattern":"^\\/info\\/?$","segments":[[{"content":"info","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/info.astro","pathname":"/info","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.CGV9iwNY.js"}],"styles":[{"type":"external","src":"/_astro/blogroll.DKl1Xj6A.css"},{"type":"inline","content":":root{--space-3xs: clamp(.25rem, .2283rem + .1087vw, .3125rem);--space-2xs: clamp(.5rem, .4783rem + .1087vw, .5625rem);--space-xs: clamp(.75rem, .7065rem + .2174vw, .875rem);--space-s: clamp(1rem, .9565rem + .2174vw, 1.125rem);--space-m: clamp(1.5rem, 1.4348rem + .3261vw, 1.6875rem);--space-l: clamp(2rem, 1.913rem + .4348vw, 2.25rem);--space-xl: clamp(3rem, 2.8696rem + .6522vw, 3.375rem);--space-2xl: clamp(4rem, 3.8261rem + .8696vw, 4.5rem);--space-3xl: clamp(5rem, 4.7826rem + 1.087vw, 5.625rem);--space-3xs-2xs: clamp(.25rem, .1413rem + .5435vw, .5625rem);--space-2xs-xs: clamp(.5rem, .3696rem + .6522vw, .875rem);--space-xs-s: clamp(.75rem, .6196rem + .6522vw, 1.125rem);--space-s-m: clamp(1rem, .7609rem + 1.1957vw, 1.6875rem);--space-m-l: clamp(1.5rem, 1.2391rem + 1.3043vw, 2.25rem);--space-l-xl: clamp(2rem, 1.5217rem + 2.3913vw, 3.375rem);--space-xl-2xl: clamp(3rem, 2.4783rem + 2.6087vw, 4.5rem);--space-2xl-3xl: clamp(4rem, 3.4348rem + 2.8261vw, 5.625rem);--space-s-l: clamp(1rem, .5652rem + 2.1739vw, 2.25rem)}.carousel{width:auto;max-height:75vh;max-width:75vw;display:flex;flex-direction:column;justify-content:center;align-items:center;position:relative;gap:.5rem;--current-slide: 0}@media (max-width: 800px){.carousel{max-width:95%;padding-left:var(--space-xs-s);padding-right:var(--space-xs-s)}}.slides-wrapper{width:100%;height:100%;display:flex;flex-direction:column;gap:.5rem;position:relative}.slides{aspect-ratio:3/2;width:100%;height:100%;overflow:scroll;scroll-snap-type:x mandatory;scroll-behavior:smooth;display:flex}.captions{width:100%;max-width:100%;overflow:scroll;scroll-snap-type:x mandatory;scroll-behavior:smooth;display:flex}.slide{width:100%;height:100%;scroll-snap-align:center;flex-shrink:0;transition:transform .5s;transform:translate(calc(-100% * var(--current-slide)));>.caption{display:none}img{height:auto;width:100%;max-height:100%;object-fit:contain}}.caption{width:100%;height:1lh;position:relative;flex-shrink:0;transform:translate(calc(-100% * var(--current-slide)));>span:first-child{float:left}>span:last-child{float:right}}.left-scroll{height:100%;width:50%;position:absolute;left:0%;z-index:10;cursor:w-resize}.right-scroll{height:100%;width:50%;position:absolute;left:50%;z-index:10;cursor:e-resize}\n"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/Users/whereistejas/repos/portfolio/src/pages/blogroll.astro",{"propagation":"none","containsHead":true}],["/Users/whereistejas/repos/portfolio/src/pages/index.astro",{"propagation":"none","containsHead":true}],["/Users/whereistejas/repos/portfolio/src/pages/info.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(o,t)=>{let i=async()=>{await(await o())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000noop-middleware":"_noop-middleware.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astro-page:src/pages/blogroll@_@astro":"pages/blogroll.astro.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/info@_@astro":"pages/info.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","/Users/whereistejas/repos/portfolio/node_modules/astro/dist/env/setup.js":"chunks/astro/env-setup_Cr6XTFvb.mjs","\u0000@astrojs-manifest":"manifest_D9gR6UdJ.mjs","/astro/hoisted.js?q=0":"_astro/hoisted.CGV9iwNY.js","/astro/hoisted.js?q=1":"_astro/hoisted.CmkSwYHY.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/DSCF2409.DD3TEBWM.jpg","/_astro/DSCF6631.Bwveol8z.jpg","/_astro/DSCF0134.BcQaq1bE.jpg","/_astro/DSCF0159._EhGZCW_.jpg","/_astro/DSCF1027.v_uyKcVn.jpg","/_astro/DSCF1447.C0xDWjUi.jpg","/_astro/DSCF3285.Bb_M0xiB.jpg","/_astro/DSCF3130.BM9Px18_.jpg","/_astro/DSCF1398.DgaMs7NZ.jpg","/_astro/DSCF5268.DTamGKp-.jpg","/_astro/DSCF0453.CJfTgSt7.jpg","/_astro/DSCF2518.CrgKfVOh.jpg","/_astro/DSCF5617.CZxGamjY.jpg","/_astro/DSCF5275.DrqYs4Ot.jpg","/_astro/DSCF5262.Dt6CeuIn.jpg","/_astro/blogroll.DKl1Xj6A.css","/AUTHENTICSans-130.woff2","/AUTHENTICSans-90.woff2","/_astro/hoisted.CGV9iwNY.js","/_astro/hoisted.CmkSwYHY.js"],"buildFormat":"directory","checkOrigin":false,"serverIslandNameMap":[],"key":"edvZJnpqi/OJJNitQwwcpCkBVFFy08YSJU5T1RsNT0M=","experimentalEnvGetSecretEnabled":false});

export { manifest };
