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

    // STEP 1 — Search Musixmatch via DuckDuckGo (works better than Google)
    const query = encodeURIComponent(`${song} site:musixmatch.com lyrics`);
    const searchUrl = `https://duckduckgo.com/html/?q=${query}`;

    const searchHtml = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
      }
    }).then(r => r.text());

    const $$ = cheerio.load(searchHtml);

    // Extract the first Musixmatch link
    let mmUrl = null;
    $$(".result__a").each((i, el) => {
      const href = $$(el).attr("href");
      if (href && href.includes("musixmatch.com/lyrics")) {
        mmUrl = href;
      }
    });

    if (!mmUrl) {
      return res.json({ ok: false, error: "No Musixmatch link found" });
    }

    // STEP 2 — Fetch Musixmatch lyrics page
    const mmPage = await fetch(mmUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: "text/html"
      }
    }).then(r => r.text());

    const $ = cheerio.load(mmPage);

    // Extract lyrics from new Musixmatch layout
    let lyrics = "";
    $("p.mxm-lyrics__content").each((i, el) => {
      const line = $(el).text().trim();
      if (line) lyrics += line + "\n";
    });

    if (!lyrics.trim()) {
      return res.json({
        ok: false,
        error: "Lyrics not found on Musixmatch"
      });
    }

    // Extract title and artist (best effort)
    let title = $("h1.mxm-track-title__track").text().trim();
    let artist = $("a.mxm-track-title__artist").text().trim();

    res.json({
      ok: true,
      url: mmUrl,
      title: title || song,
      artist: artist || null,
      lyrics: lyrics.trim()
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Lyro Lyrics API (Musixmatch) running on " + port));
