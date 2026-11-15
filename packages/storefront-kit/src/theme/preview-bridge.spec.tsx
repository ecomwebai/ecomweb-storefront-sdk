// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import {
  THEME_PREVIEW_FRAME_ATTR,
  THEME_PREVIEW_MESSAGE,
  ThemePreviewBridge,
} from "./preview-bridge";

const realParent = window.parent;

function inFrame() {
  const parent = { postMessage: vi.fn() };
  Object.defineProperty(window, "parent", {
    value: parent,
    configurable: true,
  });
  return parent;
}

function send(data: unknown, source: unknown) {
  window.dispatchEvent(
    new MessageEvent("message", { data, source: source as Window })
  );
}

describe("ThemePreviewBridge", () => {
  const refresh = vi.fn();
  beforeEach(() => refresh.mockReset());
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "parent", {
      value: realParent,
      configurable: true,
    });
  });

  it("in the editor's frame: says it is ready, marks the page, refreshes on request", () => {
    const parent = inFrame();
    render(<ThemePreviewBridge onRefresh={refresh} />);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: THEME_PREVIEW_MESSAGE, action: "ready" },
      "*"
    );
    expect(
      document.documentElement.hasAttribute(THEME_PREVIEW_FRAME_ATTR)
    ).toBe(true);

    send({ type: THEME_PREVIEW_MESSAGE, action: "refresh" }, parent);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores other windows and other messages", () => {
    const parent = inFrame();
    render(<ThemePreviewBridge onRefresh={refresh} />);
    send({ type: THEME_PREVIEW_MESSAGE, action: "refresh" }, window);
    send({ type: "other", action: "refresh" }, parent);
    send("refresh", parent);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does nothing outside a frame", () => {
    render(<ThemePreviewBridge onRefresh={refresh} />);
    send({ type: THEME_PREVIEW_MESSAGE, action: "refresh" }, window.parent);
    expect(refresh).not.toHaveBeenCalled();
    expect(
      document.documentElement.hasAttribute(THEME_PREVIEW_FRAME_ATTR)
    ).toBe(false);
  });

  it("unmarks the page when it unmounts", () => {
    inFrame();
    const { unmount } = render(<ThemePreviewBridge onRefresh={refresh} />);
    unmount();
    expect(
      document.documentElement.hasAttribute(THEME_PREVIEW_FRAME_ATTR)
    ).toBe(false);
  });
});
