import "dotenv/config";
import { app } from "./app.js";

// Last-resort safety net for this long-running process (local dev, or Node hosting outside
// Vercel's per-request functions). Request-scoped errors already funnel through app.js's
// asyncRoute wrapper and global error handler without reaching here. These two only fire for
// something outside that path (a fire-and-forget promise, a bug in unwrapped code).
process.on("unhandledRejection", (reason) => {
  console.error(JSON.stringify({ level: "error", message: "unhandled promise rejection", reason: reason instanceof Error ? reason.message : reason }));
});
process.on("uncaughtException", (error) => {
  // Node's own guidance: process state after a synchronous throw outside all handlers is
  // unreliable, so log and exit rather than keep serving requests on an unknown state.
  console.error(JSON.stringify({ level: "error", message: "uncaught exception, exiting", error: error.message }));
  process.exit(1);
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`AutoAxis API listening on http://localhost:${port}`));
