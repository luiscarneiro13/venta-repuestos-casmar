const { app } = require("electron"); console.log("app type:", typeof app); if (app) { console.log("isPackaged:", app.isPackaged); app.quit(); } else { process.exit(1); }
