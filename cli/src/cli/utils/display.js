const COLORS = {
  reset: "\x1b[0m",
  success: "\x1b[32m",
  error: "\x1b[31m",
  warning: "\x1b[33m",
  info: "\x1b[36m"
};

function showStatus(message, type = "info") {
  const labels = {
    success: "OK",
    error: "ERROR",
    warning: "WARN",
    info: "INFO"
  };

  const color = COLORS[type] || COLORS.info;
  const label = labels[type] || labels.info;

  console.log(`${color}${label}${COLORS.reset}  ${message}`);
}

module.exports = { showStatus };
