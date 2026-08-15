import { useEffect } from "react";
import { getPublicEnv } from "@/lib/env";

type SeoOptions = {
  /** Pass `undefined` while data is loading to avoid a stale-title flash. */
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
};

const SITE_NAME = "Baraza Protocol";
const FALLBACK_ORIGIN = "https://barazaprotocol.com";
const DEFAULT_IMAGE_PATH = "/og-image.svg";

function getOrigin(): string {
  const configured = getPublicEnv().VITE_SITE_URL.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window === "undefined") return FALLBACK_ORIGIN;
  return window.location.origin || FALLBACK_ORIGIN;
}

function setMeta(selector: string, attr: "content" | "href", value: string) {
  let node = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (!node) {
    if (selector.startsWith("link")) {
      node = document.createElement("link");
      const rel = selector.match(/rel="([^"]+)"/)?.[1];
      if (rel) (node as HTMLLinkElement).rel = rel;
    } else {
      node = document.createElement("meta");
      const name = selector.match(/name="([^"]+)"/)?.[1];
      const property = selector.match(/property="([^"]+)"/)?.[1];
      if (name) (node as HTMLMetaElement).name = name;
      if (property) (node as HTMLMetaElement).setAttribute("property", property);
    }
    document.head.appendChild(node);
  }
  node.setAttribute(attr, value);
}

export function useSeo({ title, description, path, image, noIndex }: SeoOptions) {
  useEffect(() => {
    // Skip title update while data is still loading (title === undefined).
    if (title === undefined) return;

    const origin = getOrigin();
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
    const url = `${origin}${path ?? ""}`;
    const ogImage = image
      ? image.startsWith("http")
        ? image
        : `${origin}${image}`
      : `${origin}${DEFAULT_IMAGE_PATH}`;

    document.title = fullTitle;

    if (description) {
      setMeta('meta[name="description"]', "content", description);
      setMeta('meta[property="og:description"]', "content", description);
      setMeta('meta[name="twitter:description"]', "content", description);
    }

    setMeta('meta[property="og:title"]', "content", fullTitle);
    setMeta('meta[name="twitter:title"]', "content", fullTitle);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="og:image"]', "content", ogImage);
    setMeta('meta[name="twitter:image"]', "content", ogImage);
    setMeta('link[rel="canonical"]', "href", url);
    setMeta(
      'meta[name="robots"]',
      "content",
      noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    );
  }, [title, description, path, image, noIndex]);
}
