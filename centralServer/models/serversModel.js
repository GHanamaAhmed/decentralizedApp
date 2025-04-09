const mogoose = require("mongoose");
const serverSchema = new mogoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["posting", "aggregation"],
  },
  url: {
    type: String,
    required: true,
    unique: true,
  },
});
const Server= mogoose.model("Server", serverSchema);
module.exports = Server;
