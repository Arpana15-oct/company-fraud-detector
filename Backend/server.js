const express = require("express");
const cors = require("cors");
require("dotenv").config();

const companyRoute = require("./Routes/Company.js");

const app = express();
console.log("🔑 API Key Loaded:", process.env.GEMINI_API_KEY ? "YES" : "NO");

// Enable CORS with options to allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use("/api/company", companyRoute);

app.get("/", (req, res) => {
  res.send("Company Fraud Detection Backend Running");
});

const PORT = 5001;

// Listen on all network interfaces (0.0.0.0) instead of just localhost
app.listen(PORT, "0.0.0.0", () => {
  console.log(` Server running on http://localhost:${PORT}`);
});
