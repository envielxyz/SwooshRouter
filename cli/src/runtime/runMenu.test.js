const { dashboardUrl, menuItems } = require("./runMenu");

describe("runtime menu", () => {
  test("uses the canonical dashboard path", () => {
    expect(dashboardUrl({ port: 14045 }, 8080)).toBe("http://127.0.0.1:8080/dashboard");
  });

  test("keeps the menu focused on runtime controls", () => {
    const labels = menuItems(true).map((item) => item.label);
    expect(labels).toEqual([
      "Run in Background / Tray",
      "Restart Swoosh Router",
      "Stop Swoosh Router",
      "Exit & Stop Router",
    ]);
    expect(menuItems(false).map((item) => item.label)).toEqual(labels);
    expect(menuItems({ updateAvailable: true, updateSupported: true, latestVersion: "1.1.0" }).map((item) => item.label)).toEqual([
      "Run in Background / Tray",
      "Restart Swoosh Router",
      "Stop Swoosh Router",
      "Update to v1.1.0",
      "Exit & Stop Router",
    ]);
  });
});
