const { selectMenu, pause } = require("../cli/utils/input");
const { showStatus } = require("../cli/utils/display");
const { openBrowser } = require("./uiAdapters");
const { installPackageVersion } = require("./update");
const lifecycle = require("./lifecycle");
const { initTray, killTray } = require("../cli/tray/tray");

function trayOptions(installation, port) {
  return {
    port,
    onOpenDashboard: () => openBrowser(dashboardUrl(installation, port)),
    onQuit: () => {
      try { lifecycle.stop(installation); } catch {}
    },
  };
}

function initializeTray(installation, port) {
  try { return initTray(trayOptions(installation, port)); } catch { return null; }
}

function isHeadless() {
  return process.platform === "linux" && !process.env.DISPLAY;
}

function backgroundStatusMessage(installation, port) {
  const suffix = isHeadless() ? " (headless mode; no system tray)" : "";
  return `Swoosh Router is running in background at ${dashboardUrl(installation, port)}${suffix}`;
}

function isTrayAvailable() {
  return process.platform !== "linux" || Boolean(process.env.DISPLAY);
}

function openTrayOnBackground(installation, port) {
  if (!isTrayAvailable()) return null;
  return initializeTray(installation, port);
}

function startTrayForMenu(installation, port) {
  return openTrayOnBackground(installation, port);
}

function dashboardUrl(installation, port) {
  return `http://127.0.0.1:${port || installation.port || 14045}/dashboard`;
}

async function startAndShow(installation, options, background) {
  try {
    const result = await lifecycle.start(installation, { ...options, background });
    if (background) {
      startTrayForMenu(installation, result.port);
      showStatus(backgroundStatusMessage(installation, result.port), "success");
    } else {
      showStatus(`Swoosh Router is ready at ${dashboardUrl(installation, result.port)}`, "success");
    }
    return true;
  } catch (error) {
    showStatus(error.message, "error");
    return false;
  }
}

function closeTray() {
  try { return killTray(); } catch { return Promise.resolve(); }
}

function disableTray() {
  return closeTray();
}

function menuItems(updateInfo = null) {
  const items = [
    { id: "background", label: "Run in Background / Tray" },
    { id: "restart", label: "Restart Swoosh Router" },
    { id: "stop", label: "Stop Swoosh Router" },
  ];
  if (updateInfo?.updateAvailable && updateInfo.updateSupported && updateInfo.latestVersion) {
    items.push({ id: "update", label: `Update to v${updateInfo.latestVersion}` });
  }
  items.push({ id: "exit", label: "Exit & Stop Router" });
  return items;
}

async function stopManaged(installation) {
  const result = lifecycle.stop(installation);
  await disableTray();
  return result;
}

function currentStatus(installation) {
  return lifecycle.status(installation);
}

function menuStatusText(status) {
  return status.running ? "Status: running" : "Status: stopped";
}

async function stopWithMessage(installation) {
  const result = await stopManaged(installation);
  showStatus(result.stopped ? "Swoosh Router stopped." : "Swoosh Router was not running.", result.stopped ? "success" : "info");
}

async function updateAndRestart(installation, options, updateInfo) {
  const wasRunning = currentStatus(installation).running;
  if (wasRunning) await stopManaged(installation);
  try {
    await installPackageVersion(updateInfo.latestVersion);
  } catch (error) {
    if (wasRunning) await startAndShow(installation, options, true);
    showStatus(error.message, "error");
    return false;
  }

  if (wasRunning) {
    const restarted = await startAndShow(installation, options, true);
    if (!restarted) return false;
  }
  showStatus(`Updated to v${updateInfo.latestVersion}. Closing menu.`, "success");
  return true;
}

async function runMenu(installation, options = {}) {
  const port = Number(options.port || installation.port || 14045);
  const updateInfo = options.updateInfo || null;
  while (true) {
    const current = currentStatus(installation);
    const items = menuItems(updateInfo);
    const selected = await selectMenu(
      "Swoosh Router",
      items,
      0,
      menuStatusText(current),
      `Dashboard: ${dashboardUrl(installation, port)}`,
    );
    if (selected === null) return 0;
    const selectedItem = items[selected];
    if (!selectedItem || selectedItem.id === "exit" || selected < 0) {
      await stopWithMessage(installation);
      return 0;
    }
    if (selectedItem.id === "background") {
      if (current.running) {
        const tray = openTrayOnBackground(installation, port);
        showStatus(`Swoosh Router will keep running in the background${tray ? " with the tray enabled" : ""}. Closing menu.`, "success");
      } else {
        const started = await startAndShow(installation, options, true);
        if (!started) {
          await pause("Press Enter to return to the menu...");
          continue;
        }
      }
      return 0;
    }
    if (selectedItem.id === "restart") {
      if (!currentStatus(installation).running) {
        showStatus("Swoosh Router is stopped. Start it with `swooshrouter start` first.", "warning");
      } else {
        await stopManaged(installation);
        await startAndShow(installation, options, true);
      }
      await pause("Press Enter to return to the menu...");
      continue;
    }
    if (selectedItem.id === "stop") {
      if (!currentStatus(installation).running) {
        showStatus("Swoosh Router is already stopped.", "info");
      } else {
        await stopWithMessage(installation);
      }
      await pause("Press Enter to return to the menu...");
      continue;
    }
    if (selectedItem.id === "update") {
      const updated = await updateAndRestart(installation, options, updateInfo);
      if (updated) return 0;
      await pause("Press Enter to return to the menu...");
    }
  }
}

module.exports = { runMenu, dashboardUrl, menuItems };
