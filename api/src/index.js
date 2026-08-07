const express = require("express");
const snippetsRouter = require("./routes/snippets");

const app = express();
app.use(express.json());
app.use("/api/v1/snippets", snippetsRouter);

app.listen(4000, () => console.log("API server running on http://localhost:4000"));
