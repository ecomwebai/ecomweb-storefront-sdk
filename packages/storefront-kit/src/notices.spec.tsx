// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { NoticeProvider, useNotify, type Notice } from "./notices";

describe("useNotify", () => {
  it("is a callable no-op outside a provider", () => {
    const { result } = renderHook(() => useNotify());
    expect(() => result.current({ kind: "info", title: "x" })).not.toThrow();
  });

  it("forwards notices to the provider's onNotice", () => {
    const onNotice = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NoticeProvider onNotice={onNotice}>{children}</NoticeProvider>
    );
    const { result } = renderHook(() => useNotify(), { wrapper });
    const notice: Notice = { kind: "error", title: "Lỗi", description: "x" };
    result.current(notice);
    expect(onNotice).toHaveBeenCalledWith(notice);
  });

  it("keeps the same function when onNotice changes, and calls the latest one", () => {
    const first = vi.fn();
    const second = vi.fn();
    let current = first;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NoticeProvider onNotice={current}>{children}</NoticeProvider>
    );
    const { result, rerender } = renderHook(() => useNotify(), { wrapper });
    const notify = result.current;
    current = second;
    rerender();
    expect(result.current).toBe(notify);
    result.current({ kind: "success", title: "ok" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
