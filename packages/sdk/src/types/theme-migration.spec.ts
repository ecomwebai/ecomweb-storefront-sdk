import { describe, expect, it } from "vitest";
import {
  applyThemeMigration,
  parseThemeMigration,
  themeMajor,
  type ThemeMigration,
} from "./theme-schema";

const run = (values: Record<string, unknown>, steps: ThemeMigration["steps"]) =>
  applyThemeMigration(values, { from: 1, steps });

describe("themeMajor", () => {
  it("reads the first number of a release version", () => {
    expect(themeMajor("1.4.2")).toBe(1);
    expect(themeMajor("12.0.0")).toBe(12);
  });
  it("is null for anything else", () => {
    for (const v of [null, undefined, "", "1.2", "v1.2.3", "1.2.3-rc.1"])
      expect(themeMajor(v)).toBeNull();
  });
});

describe("applyThemeMigration", () => {
  it("renames a key", () => {
    const { values, report } = run({ a: "x" }, [
      { op: "rename", from: "a", to: "b" },
    ]);
    expect(values).toEqual({ b: "x" });
    expect(report.renamed).toEqual([{ from: "a", to: "b" }]);
  });

  it("rename with an absent from is a no-op", () => {
    const { values, report } = run({ c: 1 }, [
      { op: "rename", from: "a", to: "b" },
    ]);
    expect(values).toEqual({ c: 1 });
    expect(report.renamed).toEqual([]);
  });

  it("rename overwrites to", () => {
    expect(
      run({ a: "new", b: "old" }, [{ op: "rename", from: "a", to: "b" }]).values
    ).toEqual({ b: "new" });
  });

  it("rename to itself is a no-op", () => {
    const { values, report } = run({ a: "x" }, [
      { op: "rename", from: "a", to: "a" },
    ]);
    expect(values).toEqual({ a: "x" });
    expect(report.renamed).toEqual([]);
  });

  it("copy to itself is a no-op", () => {
    const { values, report } = run({ a: "x" }, [
      { op: "copy", from: "a", to: "a" },
    ]);
    expect(values).toEqual({ a: "x" });
    expect(report.copied).toEqual([]);
  });

  it("removes a key, reporting only keys that were there", () => {
    const { values, report } = run({ a: 1, b: 2 }, [
      { op: "remove", key: "a" },
      { op: "remove", key: "zz" },
    ]);
    expect(values).toEqual({ b: 2 });
    expect(report.removed).toEqual(["a"]);
  });

  it("maps a value listed in values, leaves others", () => {
    const steps: ThemeMigration["steps"] = [
      { op: "map", key: "layout", values: { grid: "cards" } },
    ];
    expect(run({ layout: "grid" }, steps).values).toEqual({ layout: "cards" });
    expect(run({ layout: "list" }, steps).values).toEqual({ layout: "list" });
    expect(run({ layout: "grid" }, steps).report.mapped).toEqual([
      { key: "layout", from: "grid", to: "cards" },
    ]);
  });

  it("copies a present value", () => {
    const { values, report } = run({ accent: "#000" }, [
      { op: "copy", from: "accent", to: "button" },
      { op: "copy", from: "missing", to: "other" },
    ]);
    expect(values).toEqual({ accent: "#000", button: "#000" });
    expect(report.copied).toEqual([{ from: "accent", to: "button" }]);
  });

  it("sets a default only when the key is absent or null", () => {
    const steps: ThemeMigration["steps"] = [
      { op: "default", key: "radius", value: 8 },
    ];
    expect(run({}, steps).values).toEqual({ radius: 8 });
    expect(run({ radius: null }, steps).values).toEqual({ radius: 8 });
    expect(run({ radius: 2 }, steps).values).toEqual({ radius: 2 });
    expect(run({ radius: 2 }, steps).report.defaulted).toEqual([]);
  });

  it("runs steps in order and never mutates its input", () => {
    const input = { a: "x" };
    const { values } = run(input, [
      { op: "rename", from: "a", to: "b" },
      { op: "copy", from: "b", to: "c" },
    ]);
    expect(values).toEqual({ b: "x", c: "x" });
    expect(input).toEqual({ a: "x" });
  });
});

describe("parseThemeMigration", () => {
  it("accepts every op", () => {
    const m = {
      from: 1,
      steps: [
        { op: "rename", from: "a", to: "b" },
        { op: "remove", key: "c" },
        { op: "map", key: "d", values: { x: "y" } },
        { op: "copy", from: "e", to: "f" },
        { op: "default", key: "g", value: true },
      ],
    };
    expect(parseThemeMigration(m)).toEqual(m);
  });

  it("rejects unknown ops, bad ids, extra fields and a from below 1", () => {
    for (const bad of [
      { from: 1, steps: [{ op: "eval", code: "x" }] },
      { from: 1, steps: [{ op: "remove", key: "Bad-Id" }] },
      { from: 1, steps: [{ op: "remove", key: "a", extra: 1 }] },
      { from: 0, steps: [] },
      { steps: [] },
    ])
      expect(() => parseThemeMigration(bad)).toThrow(/Invalid theme migration/);
  });
});
