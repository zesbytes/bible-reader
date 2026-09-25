# Bible Static Website

This package contains the static frontend application for reading the Bible with book/chapter/verse navigation, quick search, abbreviation lookups, and verse highlighting.

## Directory Structure
- `index.html` - The HTML webpage
- `styles.css` - Responsive stylesheet with sticky header and verse styling
- `app.js` - JavaScript handling navigation, URL hashes, search parsing, and highlighting
- `data/metadata.json` - Complete Bible metadata (all 66 books, chapter counts, and abbreviation variants)
- `data/GEN/1.json` - Sample chapter file showing the verse array structure
- `parse_bible.py` - Extractor script to populate the remaining chapter JSON files from `bsb-book-11.pdf`

## Running Locally
Because modern browsers restrict `fetch()` requests on the local filesystem (`file:///`), serve the folder using any local HTTP server:

```bash
# Python 3
python -m http.server 8000

# or Node.js / npx
npx serve .
```

Open `http://localhost:8000` in your web browser.
