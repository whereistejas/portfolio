// @ts-check
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  const nextConfig = {
    assetPrefix: isDev ? undefined : "https://whereistejas.xyz",
  };
  return nextConfig;
};
