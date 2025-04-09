const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const Server = require("./models/serversModel");
const connectDB = require("./config/db");
const app = express();
app.use(cors());
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Endpoint to register a posting or aggregation server
app.post("/register", async (req, res) => {
  console.log("Registering server...");
  const { type, url } = req.body;
  if (!type || !url) {
    return res.status(400).json({ error: "Missing type or url" });
  }
  try {
    let server;
    // Use upsert so that a server with the same URL is updated
    server = await Server.findOneAndUpdate(
      {
        url,
      },
      {
        type,
      },
      {
        upsert: true,
        new: true,
      }
    );
    if (!server) {
      server = await Server.create({
        type,
        url,
      });
    }
    console.log("Server registered:", server);
    res.json(server);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error registering server" });
  }
});

// Endpoint to retrieve all registered servers
app.get("/servers", async (req, res) => {
  try {
    console.log("Fetching all registered servers...");
    const servers = await Server.find();
    console.log("Registered servers:", servers);
    res.json(servers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error retrieving servers" });
  }
});

const PORT = process.env.PORT || 3000;
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Posting server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to database:", error);
    process.exit(1);
  });
