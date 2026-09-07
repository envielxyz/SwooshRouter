import { describe, expect, test } from "bun:test";
import { beautifyPath, compactDatabasePath } from "@/lib/api";

describe("beautifyPath", () => {
  test("masks a Windows home directory", () => {
    expect(beautifyPath("C:\\Users\\operator\\AppData\\Roaming\\.swooshrouter\\db\\data.sqlite"))
      .toBe("~\\AppData\\Roaming\\.swooshrouter\\db\\data.sqlite");
    expect(beautifyPath("D:/Users/operator/.swooshrouter/db/data.sqlite"))
      .toBe("~/.swooshrouter/db/data.sqlite");
  });

  test("masks Linux and macOS home directories", () => {
    expect(beautifyPath("/home/operator/.swooshrouter/db/data.sqlite"))
      .toBe("~/.swooshrouter/db/data.sqlite");
    expect(beautifyPath("/Users/operator/.swooshrouter/db/data.sqlite"))
      .toBe("~/.swooshrouter/db/data.sqlite");
  });

  test("keeps empty and non-home paths usable", () => {
    expect(beautifyPath(undefined)).toBe("");
    expect(beautifyPath(null)).toBe("");
    expect(beautifyPath("./data/db/data.sqlite")).toBe("./data/db/data.sqlite");
    expect(beautifyPath("/var/lib/swooshrouter/db/data.sqlite"))
      .toBe("/var/lib/swooshrouter/db/data.sqlite");
    expect(beautifyPath("\\\\server\\share\\data.sqlite"))
      .toBe("\\\\server\\share\\data.sqlite");
  });

  test("renders the compact logical SQLite location", () => {
    expect(compactDatabasePath("/home/operator/.swooshrouter/db/data.sqlite"))
      .toBe("~/.swooshrouter/data.sqlite");
    expect(compactDatabasePath("C:\\Users\\operator\\AppData\\Roaming\\.swooshrouter\\db\\data.sqlite"))
      .toBe("~/.swooshrouter/data.sqlite");
    expect(compactDatabasePath("/srv/swooshrouter/db/data.sqlite"))
      .toBe("/srv/swooshrouter/data.sqlite");
    expect(compactDatabasePath(undefined)).toBe("");
  });
});
