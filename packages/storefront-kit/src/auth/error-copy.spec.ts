import { describe, expect, it } from "vitest";
import { errorCopy, errorCopyFor } from "./error-copy";

describe("STORE_COMING_SOON copy", () => {
  const COPY = "Cửa hàng chưa mở cửa nên chưa thể thực hiện thao tác này.";

  it("maps the code", () => {
    expect(errorCopy("STORE_COMING_SOON")).toBe(COPY);
  });

  it("wins over the 403 status copy for a caught error", () => {
    expect(errorCopyFor({ code: "STORE_COMING_SOON", statusCode: 403 })).toBe(
      COPY
    );
  });
});

describe("BLOG_COMMENTS_DISABLED copy", () => {
  const COPY = "Cửa hàng đã tắt bình luận cho blog.";

  it("maps the code", () => {
    expect(errorCopy("BLOG_COMMENTS_DISABLED")).toBe(COPY);
  });

  it("wins over the 403 status copy for a caught error", () => {
    expect(
      errorCopyFor({ code: "BLOG_COMMENTS_DISABLED", statusCode: 403 })
    ).toBe(COPY);
  });
});

describe("AUTH_ACCOUNT_DISABLED copy", () => {
  const COPY = "Tài khoản này không thể đăng nhập. Vui lòng liên hệ cửa hàng.";

  it("maps the code", () => {
    expect(errorCopy("AUTH_ACCOUNT_DISABLED")).toBe(COPY);
  });

  it("wins over the 403 status copy for a caught error", () => {
    expect(
      errorCopyFor({ code: "AUTH_ACCOUNT_DISABLED", statusCode: 403 })
    ).toBe(COPY);
  });
});

describe("PROMOTION_IDENTITY_REQUIRED copy", () => {
  const COPY =
    "Mã giảm giá này giới hạn lượt dùng cho mỗi khách hàng. Vui lòng nhập email để sử dụng mã.";

  it("maps the code", () => {
    expect(errorCopy("PROMOTION_IDENTITY_REQUIRED")).toBe(COPY);
  });

  it("wins over status copy for a caught error", () => {
    expect(
      errorCopyFor({ code: "PROMOTION_IDENTITY_REQUIRED", statusCode: 422 })
    ).toBe(COPY);
  });
});
