import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

app.get("/lyrics", async (req, res) => {
  try {
    const song = req.query.song;
    if (!song) return res.json({ ok: false, error: "Missing ?song=" });

    if (!process.env.GENIUS_TOKEN)
      return res.json({ ok: false, error: "GENIUS_TOKEN missing" });

    // Genius Search API
    const search = await fetch(
      "https://api.genius.com/search?q=" + encodeURIComponent(song),
      {
        headers: { Authorization: `Bearer ${process.env.GENIUS_TOKEN}` }
      }
    );

    const json = await search.json();
    const hits = json?.response?.hits || [];
    if (!hits.length) return res.json({ ok: false, error: "Song not found" });

    const pick = hits[0].result;

    // Fetch page with browser headers
    const page = await fetch(pick.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: "text/html"
      }
    });

    const html = await page.text();
    const $ = cheerio.load(html);

    let lyrics = "";

    // METHOD 1 — new Genius layout (data-lyrics-container)
    $("[data-lyrics-container='true']").each((i, el) => {
      const text = $(el)
        .html()
        .replace(/<br\s*\/?>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      lyrics += text + "\n\n";
    });

    // METHOD 2 — old Genius layout
    if (!lyrics.trim()) {
      $(".lyrics").each((i, el) => {
        lyrics += $(el).text().trim() + "\n\n";
      });
    }

    // METHOD 3 — fallback: Lyrics__Root
    if (!lyrics.trim()) {
      $(".Lyrics__Root__container").each((i, el) => {
        lyrics += $(el).text().trim() + "\n\n";
      });
    }

    // METHOD 4 — fallback: rich_text_formatting
    if (!lyrics.trim()) {
      $("div[class*='RichText__Container']").each((i, el) => {
        lyrics += $(el).text().trim() + "\n\n";
      });
    }

    if (!lyrics.trim())
      return res.json({
        ok: false,
        error: "Lyrics not found on this Genius page (FULL SCRAPE FAILED)"
      });

    res.json({
      ok: true,
      title: pick.title,
      artist: pick.primary_artist?.name,
      thumbnail: pick.song_art_image_url,
      url: pick.url,
      lyrics: lyrics.trim()
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () =>
  console.log("Lyro Lyrics API running on " + port)
);
