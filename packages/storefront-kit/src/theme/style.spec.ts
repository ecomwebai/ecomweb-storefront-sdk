import { describe, expect, it } from "vitest";
import { themeStyleCss } from "./style";

describe("themeStyleCss", () => {
  it("writes custom properties in order on :root", () => {
    expect(themeStyleCss({ "--primary": "#112233", "--radius": "8px" })).toBe(
      ":root{--primary:#112233;--radius:8px}"
    );
  });

  it("renders nothing without variables", () => {
    expect(themeStyleCss(null)).toBeNull();
    expect(themeStyleCss({})).toBeNull();
  });

  it("drops names that are not custom properties and values that could escape the rule", () => {
    expect(
      themeStyleCss({
        color: "red",
        "--ok": "rgb(0 0 0 / 50%)",
        "--a": "red;}body{display:none",
        "--b": "</style><script>alert(1)</script>",
        "--c": "x\\",
        "--d": "line\nbreak",
        "--e": "  ",
      })
    ).toBe(":root{--ok:rgb(0 0 0 / 50%)}");
  });
});
