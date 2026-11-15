"use client";

import { useEffect, useRef } from "react";

/** The messages the dashboard's theme editor and its preview frame trade. */
export const THEME_PREVIEW_MESSAGE = "ecomweb:theme-preview";

/** Set on <html> while the preview is inside the theme editor's frame. */
export const THEME_PREVIEW_FRAME_ATTR = "data-theme-preview-frame";

/**
 * The storefront side of the theme editor's live preview. Inside the
 * editor's frame it says it is ready, then calls onRefresh each time the
 * editor has sent its unsaved values to the API, which the preview token
 * reads them back from. The app re-renders the page in place (router.refresh:
 * server components again, scroll and client state kept); routing is the
 * app's, not the kit's. Only the frame's parent is listened to; outside a
 * frame it does nothing.
 */
export function ThemePreviewBridge({ onRefresh }: { onRefresh: () => void }) {
  // The latest callback, without listening again each render.
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    const parent = window.parent;
    if (!parent || parent === window) return;
    const root = document.documentElement;
    root.setAttribute(THEME_PREVIEW_FRAME_ATTR, "");

    const onMessage = (event: MessageEvent) => {
      if (event.source !== parent) return;
      const data = event.data as { type?: unknown; action?: unknown } | null;
      if (data?.type !== THEME_PREVIEW_MESSAGE) return;
      if (data.action === "refresh") refresh.current();
    };
    window.addEventListener("message", onMessage);
    // The editor holds back live updates until a storefront says it can.
    parent.postMessage({ type: THEME_PREVIEW_MESSAGE, action: "ready" }, "*");
    return () => {
      window.removeEventListener("message", onMessage);
      root.removeAttribute(THEME_PREVIEW_FRAME_ATTR);
    };
  }, []);

  return null;
}
