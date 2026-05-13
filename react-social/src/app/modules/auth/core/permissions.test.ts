import { allows } from "./permissions";

describe("allows() — frontend predicate mirrors backend AuthorizationService.allows()", () => {
  // ── RBAC gate ───────────────────────────────────────────────────────
  it("denies when permission is not in permissions array", () => {
    expect(allows(["student.read"], [{ i: 5 }], false, "student.write", { i: 5 }))
      .toBe(false);
  });

  it("denies when permissions is undefined (legacy-token user)", () => {
    expect(allows(undefined, undefined, false, "student.read")).toBe(false);
  });

  it("denies when permissions is empty array (logged-in-no-perms degrade)", () => {
    expect(allows([], [], false, "student.read")).toBe(false);
  });

  // ── Permission-only check (no scope arg) ─────────────────────────────
  it("allows when permission is present and no scope is required", () => {
    expect(allows(["student.read"], [], false, "student.read")).toBe(true);
  });

  it("allows when permission is present and scope rows are empty but no scope required", () => {
    expect(allows(["student.read"], [], false, "student.read", undefined)).toBe(true);
  });

  // ── Super-admin bypass ───────────────────────────────────────────────
  it("super-admin bypasses scope check (but still needs the permission)", () => {
    expect(allows(["student.read"], [], true, "student.read", { i: 999 })).toBe(true);
  });

  it("super-admin WITHOUT the permission is still denied (sa does not bypass RBAC gate)", () => {
    expect(allows([], [], true, "student.write", { i: 5 })).toBe(false);
  });

  // ── Wildcard rule: null on user's grant ≡ matches every value ────────
  it("user with scope {i:5} (no s/c/x) matches any required {i:5, s:2026, c:12, x:4}", () => {
    expect(
      allows(["student.read"], [{ i: 5 }], false, "student.read", {
        i: 5, s: 2026, c: 12, x: 4,
      })
    ).toBe(true);
  });

  it("user with totally empty scope row {} matches any required scope", () => {
    expect(
      allows(["student.read"], [{}], false, "student.read", { i: 5 })
    ).toBe(true);
  });

  // ── Exact-match rule on a constrained dimension ──────────────────────
  it("denies when user's scope.i=5 but required.i=7", () => {
    expect(allows(["student.read"], [{ i: 5 }], false, "student.read", { i: 7 }))
      .toBe(false);
  });

  // ── Multi-institute admin ────────────────────────────────────────────
  it("multi-institute admin {i:5}+{i:7} can access institute 5", () => {
    expect(
      allows(["student.read"], [{ i: 5 }, { i: 7 }], false, "student.read", { i: 5 })
    ).toBe(true);
  });

  it("multi-institute admin {i:5}+{i:7} can access institute 7", () => {
    expect(
      allows(["student.read"], [{ i: 5 }, { i: 7 }], false, "student.read", { i: 7 })
    ).toBe(true);
  });

  it("multi-institute admin {i:5}+{i:7} CANNOT access institute 9", () => {
    expect(
      allows(["student.read"], [{ i: 5 }, { i: 7 }], false, "student.read", { i: 9 })
    ).toBe(false);
  });

  // ── 4-dimension scope match ──────────────────────────────────────────
  it("narrow grant {i:9,s:2026,c:12,x:4} matches exact required scope", () => {
    expect(
      allows(["student.read"], [{ i: 9, s: 2026, c: 12, x: 4 }], false,
        "student.read", { i: 9, s: 2026, c: 12, x: 4 })
    ).toBe(true);
  });

  it("narrow grant {i:9,s:2026,c:12,x:4} denies different section", () => {
    expect(
      allows(["student.read"], [{ i: 9, s: 2026, c: 12, x: 4 }], false,
        "student.read", { i: 9, s: 2026, c: 12, x: 5 })
    ).toBe(false);
  });

  // ── Caller-side wildcard: required dimension is undefined ────────────
  it("required scope with only i=5 (s/c/x undefined) passes against narrow grant {i:5,s:2026,c:12,x:4}", () => {
    // Caller asked "any session/class/section in institute 5" — narrow grant satisfies.
    expect(
      allows(["student.read"], [{ i: 5, s: 2026, c: 12, x: 4 }], false,
        "student.read", { i: 5 })
    ).toBe(true);
  });

  // ── Empty scope arg object {} behaves identically to undefined ───────
  it("empty required scope {} is equivalent to no required scope (permission-only check)", () => {
    expect(allows(["student.read"], [{ i: 5 }], false, "student.read", {})).toBe(true);
  });
});
