import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:8080,http://localhost:5173").split(",");
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
}));
app.use(express.json());

const OPEN_LIBRARY_BASE = "https://openlibrary.org";
const COVER_BASE = "https://covers.openlibrary.org";
const SEARCH_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,subject,publisher,edition_count,number_of_pages_median,ratings_average,ratings_count";
const VALID_SEARCH_TYPES = ["title", "author", "subject"];
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;

function shapeBook(book) {
  return {
    key: book.key,
    title: book.title || "Unknown Title",
    authors: book.author_name || [],
    firstPublished: book.first_publish_year || null,
    coverId: book.cover_i || null,
    coverUrl: book.cover_i ? `${COVER_BASE}/b/id/${book.cover_i}-M.jpg` : null,
    subjects: (book.subject || []).slice(0, 5),
    pages: book.number_of_pages_median || null,
    editions: book.edition_count || 1,
    rating: book.ratings_average ? parseFloat(book.ratings_average.toFixed(1)) : null,
    ratingCount: book.ratings_count || 0,
  };
}

// GET /api/books/search
app.get("/api/books/search", async (req, res) => {
  const { q, type = "title", limit = DEFAULT_LIMIT, page = 1 } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }
  if (!VALID_SEARCH_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid search type. Must be one of: ${VALID_SEARCH_TYPES.join(", ")}.` });
  }

  const parsedLimit = Math.min(parseInt(limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const params = new URLSearchParams({ [type]: q.trim(), limit: parsedLimit, offset, fields: SEARCH_FIELDS });

  try {
    const upstreamRes = await fetch(`${OPEN_LIBRARY_BASE}/search.json?${params}`);
    if (!upstreamRes.ok) return res.status(502).json({ error: "Upstream Open Library API returned an error." });

    const data = await upstreamRes.json();
    return res.json({
      total: data.numFound ?? 0,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil((data.numFound ?? 0) / parsedLimit),
      books: (data.docs ?? []).map(shapeBook),
    });
  } catch (err) {
    console.error("[/api/books/search] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch books from Open Library." });
  }
});

// GET /api/books/trending
app.get("/api/books/trending", async (req, res) => {
  const subjects = ["fiction", "mystery", "science", "history", "fantasy"];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];

  try {
    const url = `${OPEN_LIBRARY_BASE}/search.json?subject=${subject}&sort=rating&limit=8&fields=key,title,author_name,first_publish_year,cover_i,ratings_average,ratings_count`;
    const upstreamRes = await fetch(url);
    const data = await upstreamRes.json();

    const books = (data.docs ?? [])
      .filter((b) => b.cover_i)
      .slice(0, 8)
      .map((book) => ({
        key: book.key,
        title: book.title,
        authors: book.author_name || [],
        firstPublished: book.first_publish_year || null,
        coverUrl: `${COVER_BASE}/b/id/${book.cover_i}-M.jpg`,
        rating: book.ratings_average ? parseFloat(book.ratings_average.toFixed(1)) : null,
        ratingCount: book.ratings_count || 0,
      }));

    return res.json({ subject, books });
  } catch (err) {
    console.error("[/api/books/trending] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch trending books." });
  }
});

// GET /api/books/detail/:workId
app.get("/api/books/detail/:workId", async (req, res) => {
  const { workId } = req.params;

  try {
    const [workRes, ratingsRes] = await Promise.allSettled([
      fetch(`${OPEN_LIBRARY_BASE}/works/${workId}.json`),
      fetch(`${OPEN_LIBRARY_BASE}/works/${workId}/ratings.json`),
    ]);

    const work = workRes.status === "fulfilled" && workRes.value.ok
      ? await workRes.value.json() : null;
    const ratings = ratingsRes.status === "fulfilled" && ratingsRes.value.ok
      ? await ratingsRes.value.json() : null;

    if (!work) return res.status(404).json({ error: "Book not found." });

    const description = typeof work.description === "string"
      ? work.description : work.description?.value || null;

    return res.json({
      key: workId,
      title: work.title,
      description,
      subjects: (work.subjects || []).slice(0, 10),
      coverUrl: work.covers?.[0] ? `${COVER_BASE}/b/id/${work.covers[0]}-L.jpg` : null,
      firstPublished: work.first_publish_date || null,
      rating: ratings?.summary?.average ? parseFloat(ratings.summary.average.toFixed(1)) : null,
      ratingCount: ratings?.summary?.count || 0,
    });
  } catch (err) {
    console.error("[/api/books/detail] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch book details." });
  }
});

// GET /api/covers/:id
app.get("/api/covers/:id", async (req, res) => {
  const { id } = req.params;
  const { size = "M" } = req.query;

  if (!["S", "M", "L"].includes(size)) return res.status(400).json({ error: "Size must be S, M, or L." });
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Cover ID must be a number." });

  try {
    const upstreamRes = await fetch(`${COVER_BASE}/b/id/${id}-${size}.jpg`);
    if (!upstreamRes.ok) return res.status(upstreamRes.status).json({ error: "Cover not found." });

    res.setHeader("Content-Type", upstreamRes.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    upstreamRes.body.pipe(res);
  } catch (err) {
    console.error("[/api/covers/:id] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch cover image." });
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use("/api/*path", (_req, res) => res.status(404).json({ error: "API route not found." }));

app.listen(PORT, () => {
  console.log(`\n🚀  Express server running at http://localhost:${PORT}`);
  console.log(`   → GET /api/books/search?q=dune&type=title`);
  console.log(`   → GET /api/books/trending`);
  console.log(`   → GET /api/books/detail/OL8479867W`);
  console.log(`   → GET /api/covers/12345?size=M\n`);
});
