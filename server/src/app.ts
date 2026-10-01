import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import workspaceRoutes from "./routes/workspace.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);

export default app;