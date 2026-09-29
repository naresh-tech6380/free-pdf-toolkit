# Free PDF Toolkit

Free online PDF tools that run **100% in your browser** — no signup, no uploads, your files never leave your device.

**Live:** https://naresh-tech6380.github.io/free-pdf-toolkit/

## Tools

- **Merge PDFs** — combine multiple PDFs in any order
- **Extract pages** — pull out selected page ranges into a new PDF
- **Images to PDF** — convert JPG, PNG, WebP images into one PDF
- **Compress PDF** — reduce file size
- **Rotate PDF** — rotate all pages or selected ranges (90° / 180° / 270°)
- **PDF to Images** — export pages as JPG or PNG, individually or as ZIP

## Tech

Single-page static site — HTML + CSS + vanilla JavaScript.
PDF engine: [pdf-lib](https://github.com/Hopding/pdf-lib) ·
Rendering: [pdf.js](https://mozilla.github.io/pdf.js/) ·
ZIP: [JSZip](https://stuk.github.io/jszip/) (all via CDN, no build step).

## Project structure

```
free-pdf-toolkit/
├── index.html    # page markup
├── styles.css    # all styling
├── app.js        # all tool logic (client-side)
├── logo.svg      # "N" monogram logo + favicon
└── README.md
```

## Run locally

Just open `index.html` in a browser — no server or install needed.

---
Created by **Naresh**
