// Vercel serverless entrypoint — the single function for the whole app.
// vercel.json rewrites every route here. An Express app is a valid Node
// (req,res) handler, so we re-export it directly.
import { app } from "../src/server.js";
export default app;
