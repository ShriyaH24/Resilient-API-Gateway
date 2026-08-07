const express = require("express");
const router = express.Router();
const prisma = require("../db");

// CREATE
router.post("/", async (req, res) => {
  const { title, content, language } = req.body;
  if (!title || !content || !language) {
    return res.status(400).json({ error: "title, content, and language are required" });
  }
  const snippet = await prisma.snippet.create({ data: { title, content, language } });
  res.status(201).json(snippet);
});

// READ ALL
router.get("/", async (req, res) => {
  const snippets = await prisma.snippet.findMany();
  res.status(200).json(snippets);
});

// READ ONE
router.get("/:id", async (req, res) => {
  const snippet = await prisma.snippet.findUnique({ where: { id: Number(req.params.id) } });
  if (!snippet) return res.status(404).json({ error: "Not found" });
  res.status(200).json(snippet);
});

// UPDATE
router.put("/:id", async (req, res) => {
  const { title, content, language } = req.body;
  try {
    const snippet = await prisma.snippet.update({
      where: { id: Number(req.params.id) },
      data: { title, content, language },
    });
    res.status(200).json(snippet);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    await prisma.snippet.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

module.exports = router;
