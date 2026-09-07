const { checkForUpdate, compareVersions, isNewerVersion } = require("./update");

describe("CLI version update checks", () => {
  test("compares stable and prerelease versions correctly", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.10")).toBeLessThan(0);
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
    expect(isNewerVersion("1.0.0", "0.9.9")).toBe(false);
  });

  test("reads a newer registry version", async () => {
    const result = await checkForUpdate(async () => new Response(JSON.stringify({ version: "1.1.0" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    expect(result.latestVersion).toBe("1.1.0");
    expect(result.updateAvailable).toBe(true);
  });
});
