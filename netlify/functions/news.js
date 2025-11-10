// netlify/functions/news.js
import Parser from "rss-parser";

// Startliste: DE-offiziell & internationale Politik; du kannst später leicht erweitern
const FEEDS = [
  // DE – Offiziell / Sicherheit
  "https://www.auswaertiges-amt.de/en/newsroom/newsletter/rss",
  "https://www.bmvg.de/de/rss",
  "https://www.bundeswehr.de/de/rss",
  "http://feeds.bbci.co.uk/news/world/rss.xml",          // International: BBC World
  "https://rss.dw.com/rdf/rss-en-top",                   // DW Top Stories
  "https://apnews.com/index.rss"                         // AP – breite Weltpolitik
  // Später: Spiegel/FAZ/ZEIT/SZ/WELT/ntv Politik-Feeds ergänzen
];

const parser = new Parser({
  timeout: 15000, // 15s Schutz gegen Hänger
});

export default async () => {
  const articles = [];
  const results = await Promise.allSettled(FEEDS.map(url => parser.parseURL(url)));

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const feed = r.value;
    for (const item of feed.items ?? []) {
      const date = item.isoDate || item.pubDate || new Date().toISOString();
      articles.push({
        source: feed.title || new URL(feed.link || "").hostname || "Quelle",
        title: item.title || "(ohne Titel)",
        link: item.link,
        date,
        summary: item.contentSnippet || ""
      });
    }
  }

  // leichte Gewichtung: DE-Domains nach vorn
  const score = (a) => {
    const host = (() => { try { return new URL(a.link).hostname; } catch { return ""; } })();
    let s = 0;
    if (host.endsWith(".de")) s += 1;
    const t = (a.title || "").toLowerCase();
    const sec = ["nato","bundeswehr","verteidigung","ukraine","nahost","gaza","china","indopazifik","sanktion","rüstung","cyber","terror","drohne"];
    if (sec.some(k => t.includes(k))) s += 1;
    return s;
  };

  // sortieren: zuerst nach Zeit, dann Score
  articles.sort((a, b) => {
    const dt = new Date(b.date) - new Date(a.date);
    return dt !== 0 ? dt : score(b) - score(a);
  });

  // begrenzen
  const body = JSON.stringify(articles.slice(0, 200));

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // 60s Browser-Cache; Netlify cached die Function zusätzlich kurz
      "cache-control": "public, max-age=60"
    }
  });
};
