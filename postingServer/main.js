// ========================
// Import Required Modules
// ========================
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken"); // For JWT authentication
const bcrypt = require("bcryptjs"); // For password hashing
const connectDB = require("./config/db"); // Function to connect to MongoDB
const User = require("./models/userModel"); // User Mongoose model
const Post = require("./models/postModel"); // Post Mongoose model (with comments and likes)
const { Server } = require("socket.io");
const Subscription = require("./models/subscription");

// ========================
// Initialize Express & HTTP Server
// ========================
const app = express();
const server = require("http").createServer(app);

// ========================
// Initialize Socket.IO
// ========================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});
const postsNameSpace = io.of("/postnamespace");

// ========================
// Middleware Configuration
// ========================
app.use(
  cors({
    origin: "http://localhost:3003",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(helmet());
app.use(express.json()); // For parsing JSON bodies

// ========================
// Utility: Authentication Middleware
// ========================
// This middleware verifies the JWT sent in the Authorization header.
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log(authHeader);

  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  // Expected header format: "Bearer <token>"
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Malformed token" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded; // decoded contains user's information (e.g. id, username)
    next();
  });
}

// ========================
// Authentication Endpoints
// ========================

// Register a new user
app.post("/auth/register", async (req, res) => {
  console.log("Registering a new user...");

  const { username, email, password } = req.body;
  // Basic field validation
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Missing username, email or password" });
  }
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }
    // Hash the password before storing it in the DB
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    // create token payload
    const payload = { id: newUser._id, username: newUser.username };
    // create token
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "720h",
    });
    res
      .status(201)
      .json({ message: "User registered successfully", user: payload, token });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// Login user and return a JWT
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    // Compare provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    // Create JWT payload and sign token
    const payload = { id: user._id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "720h",
    });
    res.json({ token, user: payload });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ========================
// Post Endpoints (Protected by Authentication)
// ========================

// Create a new post
app.post("/post", authenticateToken, async (req, res) => {
  console.log("Creating a new post...");
  const { content, topic } = req.body;
  if (!content || !topic) {
    return res.status(400).json({ error: "Missing content or topic" });
  }
  try {
    // Use the authenticated user's ID from req.user
    const post = await Post.create({
      user: req.user.id,
      content,
      topic,
    });
    // Emit the new post to all connected clients in the namespace
    postsNameSpace.emit("newPost", post);
    console.log("Post created:", post);
    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Error creating post" });
  }
});

// Retrieve all posts
app.get("/posts", async (req, res) => {
  console.log("Fetching all posts...");
  try {
    // Populate the user field (and comments.user) to fetch user details with the post
    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .populate("user", "username email avatar")
      .populate("comments.user", "username email avatar");
    console.log("Posts retrieved:", posts);
    res.json(posts);
  } catch (error) {
    console.error("Error retrieving posts:", error);
    res.status(500).json({ error: "Error retrieving posts" });
  }
});

// Add a comment to a post
app.post("/post/:postId/comment", authenticateToken, async (req, res) => {
  console.log("Adding a comment to post:", req.params.postId);
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Missing comment content" });
  }
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Add a new comment. Use the authenticated user's id.
    post.comments.push({ user: req.user.id, content });
    await post.save();

    // Optionally, you may emit an event for new comment notifications
    postsNameSpace.emit("newComment", {
      postId: post._id,
      comment: post.comments.slice(-1)[0],
    });

    console.log("Comment added:", post.comments.slice(-1)[0]);
    res.status(201).json(post);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Error adding comment" });
  }
});

// Like a post
app.post("/post/:postId/like", authenticateToken, async (req, res) => {
  console.log("Liking post:", req.params.postId);
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Prevent duplicate likes by the same user
    if (post.likes.includes(req.user.id)) {
      return res.status(400).json({ error: "You already liked this post" });
    }

    post.likes.push(req.user.id);
    await post.save();

    // Emit an event if you need real-time like updates
    postsNameSpace.emit("postLiked", { postId: post._id, likes: post.likes });

    console.log("Post liked by user:", req.user.id);
    res.json(post);
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ error: "Error liking post" });
  }
});

// Optionally, you can implement an unlike endpoint
app.post("/post/:postId/unlike", authenticateToken, async (req, res) => {
  console.log("Unliking post:", req.params.postId);
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Remove the user's like if it exists
    post.likes = post.likes.filter(
      (likeId) => likeId.toString() !== req.user.id
    );
    await post.save();

    // Emit an event if needed for real-time updates
    postsNameSpace.emit("postUnliked", { postId: post._id, likes: post.likes });

    console.log("Post unliked by user:", req.user.id);
    res.json(post);
  } catch (error) {
    console.error("Error unliking post:", error);
    res.status(500).json({ error: "Error unliking post" });
  }
});

// ------------------------------------------------------------------------
// POST /subscription
// Create a new subscription (by user and/or by topic)
// ------------------------------------------------------------------------
app.post("/subscription", authenticateToken, async (req, res) => {
  try {
    const { username, topic } = req.body;

    // Validate that at least one identifier (user or topic) is provided.
    if (!username && !topic) {
      return res
        .status(400)
        .json({ error: "Either user or topic must be provided." });
    }
    // sereach for existing subscription
    const existingSubscription = await Subscription.findOne({
      $or: [{ username }, { topic }],
    });
    if (existingSubscription) {
      return res.status(409).json({
        error: "Subscription already exists for this user and topic.",
      });
    }
    // search is existing user
    const user = await User.findOne({
      username,
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Create the new subscription.
    const newSubscription = new Subscription({ username, topic });
    const savedSubscription = await newSubscription.save();

    // Respond with the saved subscription object.
    res.status(201).json(savedSubscription);
  } catch (error) {
    console.error("Error creating subscription:", error);

    // Check for duplicate subscription error.
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Subscription already exists for this user and topic.",
      });
    }

    res.status(500).json({ error: "Error creating subscription" });
  }
});

// ------------------------------------------------------------------------
// DELETE /subscription
// Delete a subscription using the user and/or topic provided in the request body
// ------------------------------------------------------------------------
app.delete("/subscription", authenticateToken, async (req, res) => {
  try {
    const { username, topic } = req.body;

    // Validate that at least one identifier (user or topic) is provided.
    if (!username && !topic) {
      return res.status(400).json({
        error:
          "Either user or topic must be provided to delete a subscription.",
      });
    }

    // Find a subscription that matches the given combination and delete it.
    const deletedSubscription = await Subscription.findOneAndDelete({
      username,
      topic,
    });

    if (!deletedSubscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.status(200).json({
      message: "Subscription deleted",
      subscription: deletedSubscription,
    });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    res.status(500).json({ error: "Error deleting subscription" });
  }
});
app.get("/subscription", authenticateToken, async (req, res) => {
  try {
    // Read optional query parameters, e.g., /subscription?user=...&topic=...
    const { user, topic } = req.query;
    const filter = {};

    if (user) {
      filter.user = user;
    }
    if (topic) {
      filter.topic = topic;
    }

    const subscriptions = await Subscription.find(filter);
    res.status(200).json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ error: "Error fetching subscriptions" });
  }
});
// ========================
// Socket.IO Connection
// ========================
postsNameSpace.on("connection", (socket) => {
  console.log("New client connected to post namespace:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected from post namespace:", socket.id);
  });
});

// ------------------------------------------------------------------------
// Add a like to a post
// Endpoint: POST /post/:postId/like
// ------------------------------------------------------------------------
app.post("/post/:postId/like", authenticateToken, async (req, res) => {
  console.log("Liking post:", req.params.postId);
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Prevent duplicate likes by the same user
    if (post.likes.includes(req.user.id)) {
      return res.status(400).json({ error: "User already liked this post" });
    }

    // Add the user's like
    post.likes.push(req.user.id);
    await post.save();

    // Optionally, emit an event for real-time updates (if using Socket.IO)
    // postsNameSpace.emit("postLiked", { postId: post._id, likes: post.likes });

    res.status(200).json({ message: "Post liked", post });
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ error: "Error liking post" });
  }
});

// ------------------------------------------------------------------------
// Remove a like from a post
// Endpoint: POST /post/:postId/unlike
// ------------------------------------------------------------------------
app.post("/post/:postId/unlike", authenticateToken, async (req, res) => {
  console.log("Unliking post:", req.params.postId);
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Remove the user's like if it exists
    const initialLikeCount = post.likes.length;
    post.likes = post.likes.filter(
      (likeId) => likeId.toString() !== req.user.id
    );

    // Only save if the like was removed
    if (post.likes.length === initialLikeCount) {
      return res.status(400).json({ error: "User had not liked this post" });
    }

    await post.save();

    // Optionally, emit an event for real-time updates
    // postsNameSpace.emit("postUnliked", { postId: post._id, likes: post.likes });

    res.status(200).json({ message: "Post unliked", post });
  } catch (error) {
    console.error("Error unliking post:", error);
    res.status(500).json({ error: "Error unliking post" });
  }
});

// ========================
// Connect to Database and Start Server
// ========================
const PORT = process.env.PORT || 3001;
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Posting server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to database:", error);
    process.exit(1);
  });
