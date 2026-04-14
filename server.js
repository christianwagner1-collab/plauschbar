const express = require("express");
const path = require("path");
const app = express();

// Render gibt PORT vor, lokal nutzt du 3001
const PORT = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname)));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



