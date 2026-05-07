const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

app.use(require("./routes/forecast"));
app.use(require("./routes/tide"));
app.use(require("./routes/cache"));

module.exports = app;
