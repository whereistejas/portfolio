import { renderers } from './renderers.mjs';
import { c as createExports } from './chunks/entrypoint_C4qFHIKR.mjs';
import { manifest } from './manifest_D9gR6UdJ.mjs';
import { onRequest } from './_noop-middleware.mjs';

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/blogroll.astro.mjs');
const _page2 = () => import('./pages/info.astro.mjs');
const _page3 = () => import('./pages/index.astro.mjs');

const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/blogroll.astro", _page1],
    ["src/pages/info.astro", _page2],
    ["src/pages/index.astro", _page3]
]);
const serverIslandMap = new Map();

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: onRequest
});
const _args = {
    "middlewareSecret": "002b21d4-e1d6-47c4-9966-c22040cf0c8a",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;

export { __astrojsSsrVirtualEntry as default, pageMap };
