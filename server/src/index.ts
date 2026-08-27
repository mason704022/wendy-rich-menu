import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getConfig, SERVER_ROOT } from "./config.js";
import { initDatabase } from "./db/index.js";
import { isGoogleSheetsConfigured } from "./services/googleSheetsService.js";
import { adminRouter } from "./routes/admin.js";
import { bookingsRouter } from "./routes/bookings.js";
import { coursesRouter } from "./routes/courses.js";
import { membersRouter } from "./routes/members.js";
import { purchasesRouter } from "./routes/purchases.js";
import { registerLineWebhook } from "./webhook/line.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { port } = getConfig();

initDatabase();

const app = express();

app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "wendy-line-api" });
});

registerLineWebhook(app);

app.use(express.json({ limit: "10mb" }));

app.use("/api/members", membersRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/admin", adminRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API_NOT_FOUND" });
});

const contentDir = path.join(SERVER_ROOT, "content");
app.use("/content", express.static(contentDir));

const liffDist = path.join(__dirname, "../../liff/dist");
app.use(express.static(liffDist));

app.get(/^(?!\/api)(?!\/content).*/, (_req, res) => {
  res.sendFile(path.join(liffDist, "index.html"), (err) => {
    if (err) {
      res.status(404).json({
        message: "LIFF frontend not built. Run: cd liff && npm run build",
      });
    }
  });
});

app.listen(port, "0.0.0.0", () => {
  const sheetsOk = isGoogleSheetsConfigured();
  console.log(`Wendy LINE API listening on http://localhost:${port}`);
  console.log(
    sheetsOk
      ? "[Google Sheets] Sync enabled"
      : "[Google Sheets] Sync disabled — check .env and credentials"
  );
});
