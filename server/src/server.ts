import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// Load environment variables from .env
dotenv.config();
// Create an Express application
const app = express();
// Read the port from the environment, default to 3000
const PORT = process.env.PORT || 3000;
// Middleware
app.use(cors());
app.use(express.json());
// Health Check Route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "ConnectX Backend is running",
    timestamp: new Date().toISOString(),
  });
});
// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});