// Versuche die App im Default-Browser zu öffnen
const { exec } = require("child_process");

const url = "http://localhost:3000";

let cmd;
switch (process.platform) {
  case "darwin":
    cmd = `open ${url}`; break;
  case "win32":
    cmd = `start ${url}`; break;
  default:
    cmd = `xdg-open ${url}`; break;
}

exec(cmd, (err) => {
  if (err) {
    console.log("Konnte Browser nicht öffnen:", err.message);
  } else {
    console.log("Browser geöffnet:", url);
  }
});
