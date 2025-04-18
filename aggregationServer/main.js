const express = require("express");
const axios = require("axios");
const cors = require("cors");
const helmet = require("helmet");
const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

const postingServers = ["http://localhost:3001"];

app.get("/feed", async (req, res) => {
  console.log("Fetching aggregated feed from posting servers...");

  try {
    let allPosts = [];
    for (const serverUrl of postingServers) {
      try {
        const response = await axios.get(`${serverUrl}/posts`);
        allPosts = allPosts.concat(response.data);
      } catch (error) {
        console.error(`Error fetching posts from ${serverUrl}:`, error.message);
      }
    }
    allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log("Aggregated posts:", allPosts);

    res.json(allPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error aggregating posts" });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Aggregation server listening on port ${PORT}`);
});
