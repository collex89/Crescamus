# scripts/parse-bible.mjs

One-time build script. Parses `dr_source.txt` — the public-domain
Douay-Rheims Bible (Challoner revision), Project Gutenberg ebook #1581 —
into one JSON file per book in `src/data/bible/`, matching the book ids in
`src/data/mockData.js`'s `BIBLE_BOOKS`.

Re-run it any time with:

```
node scripts/parse-bible.mjs
```

It re-downloads nothing (the source text is committed here for
reproducibility) and overwrites `src/data/bible/*.json`, printing a
per-book chapter/verse count report to `scripts/parse-report.txt`.
