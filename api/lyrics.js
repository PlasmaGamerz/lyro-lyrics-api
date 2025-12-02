export default async function handler(req, res) {
  try {
    const song = (req.query.song || "").toString().trim();
    if (!song) {
      return res.status(400).json({ ok: false, error: "Missing ?song query" });
    }
    if (!process.env.GENIUS_TOKEN) {
      return res.status(500).json({ ok: false, error: "Missing GENIUS_TOKEN on server" });
    }

    // Search Genius
    const searchResp = await fetch(
      "https://api.genius.com/search?q=" + encodeURIComponent(song),
      { headers: { Authorization: `Bearer ${process.env.GENIUS_TOKEN}` } }
    );

    const search = await searchResp.json();
    const hits = search?.response?.hits || [];
    if (!hits.length) {
      return res.status(404).json({ ok: false, error: "No Genius results." });
    }

    const pick = hits[0].result;
    const htmlResp = await fetch(pick.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html"
      },
    });

    const html = await htmlResp.text();

    // Extract lyrics
    let parts = html.split('data-lyrics-container="true"');
    if (parts.length < 2) {
      return res.status(404).json({ ok: false, error: "Lyrics parsing failed." });
    }

    let lyrics = "";
    for (let i = 1; i < parts.length; i++) {
      let sec = parts[i].split("</div>")[0];
      sec = sec
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .trim();

      if (sec) lyrics += sec + "\n\n";
    }

    if (!lyrics.trim()) {
      return res.status(404).json({ ok: false, error: "Lyrics not found after parse." });
    }

    return res.status(200).json({
      ok: true,
      title: pick.title,
      artist: pick.primary_artist?.name,
      thumbnail: pick.song_art_image_url,
      url: pick.url,
      lyrics
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
                        }
