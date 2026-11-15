import { describe, expect, it } from "vitest";
import { ApiClientError } from "@ecomweb/sdk";
import {
  isStoreSuspendedError,
  isStoreSuspendedResponseBody,
} from "./store-suspension";

describe("isStoreSuspendedError", () => {
  it("recognizes a STORE_SUSPENDED ApiClientError (the 403 path)", () => {
    const error = new ApiClientError(
      "This store has been suspended.",
      403,
      "STORE_SUSPENDED"
    );
    expect(isStoreSuspendedError(error)).toBe(true);
  });

  it("does not treat STORE_UNAVAILABLE as a suspension", () => {
    const error = new ApiClientError(
      "This store is not available.",
      404,
      "STORE_UNAVAILABLE"
    );
    expect(isStoreSuspendedError(error)).toBe(false);
  });

  it("does not treat an unrelated ApiClientError as a suspension", () => {
    const error = new ApiClientError("Request timeout", 0, "ECONNABORTED");
    expect(isStoreSuspendedError(error)).toBe(false);
  });

  it("does not treat a plain Error as a suspension", () => {
    expect(isStoreSuspendedError(new Error("boom"))).toBe(false);
  });

  it("does not treat null or undefined as a suspension", () => {
    expect(isStoreSuspendedError(null)).toBe(false);
    expect(isStoreSuspendedError(undefined)).toBe(false);
  });
});

describe("isStoreSuspendedResponseBody", () => {
  it("recognizes the raw BusinessException body shape", () => {
    expect(
      isStoreSuspendedResponseBody({
        code: "STORE_SUSPENDED",
        message: "This store has been suspended.",
        timestamp: "2026-08-16T00:00:00.000Z",
      })
    ).toBe(true);
  });

  it("does not treat a STORE_UNAVAILABLE body as a suspension", () => {
    expect(isStoreSuspendedResponseBody({ code: "STORE_UNAVAILABLE" })).toBe(
      false
    );
  });

  it("does not treat an unrelated body as a suspension", () => {
    expect(isStoreSuspendedResponseBody({ code: "VALIDATION_ERROR" })).toBe(
      false
    );
    expect(isStoreSuspendedResponseBody({})).toBe(false);
  });

  it("does not treat non-object bodies as a suspension", () => {
    expect(isStoreSuspendedResponseBody(null)).toBe(false);
    expect(isStoreSuspendedResponseBody(undefined)).toBe(false);
    expect(isStoreSuspendedResponseBody("STORE_SUSPENDED")).toBe(false);
  });
});
