import {
  deriveUrlsForPerms,
  splitCustomPaths,
  nextUrlsAfterPermissionChange,
} from "./deriveUrls";

const MANIFEST = {
  "student.read": ["/student-list", "/studentprofile"],
  "tool.read": ["/tools"],
  "tool.create": ["/tools/create", "/tools/edit/:id"],
};

describe("deriveUrlsForPerms", () => {
  it("unions routes across held permissions, sorted and deduped", () => {
    expect(deriveUrlsForPerms(["tool.read", "tool.create"], MANIFEST)).toEqual([
      "/tools",
      "/tools/create",
      "/tools/edit/:id",
    ]);
  });

  it("ignores permissions with no routes", () => {
    expect(deriveUrlsForPerms(["nonexistent.perm"], MANIFEST)).toEqual([]);
  });
});

describe("splitCustomPaths", () => {
  it("classifies manifest routes as derived and everything else as custom", () => {
    const { derived, custom } = splitCustomPaths(
      ["/tools", "/students/*", "/one-off/page"],
      MANIFEST
    );
    expect(derived).toEqual(["/tools"]);
    expect(custom).toEqual(["/students/*", "/one-off/page"]);
  });
});

describe("nextUrlsAfterPermissionChange", () => {
  it("re-derives from the new perms but keeps custom paths", () => {
    // Role used to hold tool.read (stored /tools) plus a custom wildcard.
    // Perms change to student.read only: /tools must drop, wildcard must stay.
    expect(
      nextUrlsAfterPermissionChange(
        ["student.read"],
        ["/tools", "/students/*"],
        MANIFEST
      )
    ).toEqual(["/student-list", "/studentprofile", "/students/*"]);
  });
});
