require("dotenv").config();

const validKeys = (process.env.VALID_API_KEYS || "")
  .split(",")
  .map((k) => k.trim());

module.exports = function authMiddleware(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || !validKeys.includes(apiKey)) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid X-API-KEY header",
    });
  }

  // Attach key to request for downstream logging or rate limiting
  req.apiKey = apiKey;
  next();
};