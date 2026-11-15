"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

export type NoticeKind = "success" | "error" | "info";

/**
 * Something the shopper should hear about (an item added, a failed request).
 * The kit never renders these; the app decides how, usually as a toast.
 */
export interface Notice {
  kind: NoticeKind;
  title: string;
  description?: string;
  /** Stable identifier for apps that render some notices specially. */
  code?: string;
  /** Values the description was built from, keyed by name. */
  data?: Record<string, string>;
}

export type NoticeHandler = (notice: Notice) => void;

const noop: NoticeHandler = () => {};

const NoticeContext = createContext<NoticeHandler>(noop);

export function NoticeProvider({
  onNotice,
  children,
}: {
  onNotice?: NoticeHandler;
  children: ReactNode;
}) {
  // A stable function, so hooks can list it as a dependency without
  // re-running whenever the app passes a new inline handler.
  const latest = useRef(onNotice);
  useEffect(() => {
    latest.current = onNotice;
  }, [onNotice]);
  const notify = useCallback<NoticeHandler>(n => latest.current?.(n), []);
  return (
    <NoticeContext.Provider value={notify}>{children}</NoticeContext.Provider>
  );
}

/** Report a notice to the app; a no-op outside a NoticeProvider. */
export function useNotify(): NoticeHandler {
  return useContext(NoticeContext);
}
