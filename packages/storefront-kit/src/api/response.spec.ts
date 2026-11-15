import { describe, expect, it } from "vitest";
import { ApiClientError, ensureSuccess, unwrap, unwrapOrNull } from "./response";

// This repo has TWO ApiClientError classes: the SDK's, which checkout's order
// creation throws, and this one, which the payment helpers throw. An
// INSUFFICIENT_INVENTORY rejection carries its per-line items in `details`, so
// a path that drops the payload loses the reason silently. These assert this
// copy carries it on every throwing path.
const rejection = {
  success: false as const,
  error: {
    message: "Insufficient inventory",
    statusCode: 409,
    error: "INSUFFICIENT_INVENTORY",
    details: { items: [{ variant_id: 9, requested: 5, available: 2 }] },
  },
};

const caught = (run: () => unknown): ApiClientError => {
  try {
    run();
  } catch (error) {
    return error as ApiClientError;
  }
  throw new Error("expected the call to throw");
};

describe("ApiClientError details", () => {
  it("carries the payload and the code out of unwrap", () => {
    const error = caught(() => unwrap(rejection as never));
    expect(error.code).toBe("INSUFFICIENT_INVENTORY");
    expect(error.details).toEqual({
      items: [{ variant_id: 9, requested: 5, available: 2 }],
    });
  });

  // Asserted separately rather than in a loop: a loop over the three would
  // still pass if one were deleted.
  it("carries the payload out of unwrapOrNull", () => {
    const error = caught(() => unwrapOrNull(rejection as never));
    expect(error.details).toEqual({
      items: [{ variant_id: 9, requested: 5, available: 2 }],
    });
  });

  it("carries the payload out of ensureSuccess", () => {
    const error = caught(() => ensureSuccess(rejection as never));
    expect(error.details).toEqual({
      items: [{ variant_id: 9, requested: 5, available: 2 }],
    });
  });

  it("leaves details undefined when the API sent none", () => {
    const error = caught(() =>
      unwrap({ success: false, error: { message: "Nope", statusCode: 400, error: "BAD" } } as never)
    );
    expect(error.details).toBeUndefined();
    expect(error.statusCode).toBe(400);
  });
});
