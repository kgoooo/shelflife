# Shelflife

A dark, grainy reading tracker: currently reading, TBR pile, spice levels, tropes, content warnings, moods, reading stats and suggestions. Built as an installable web app (PWA) so it runs on a Galaxy Z Fold folded (bottom tab bar, one column) and unfolded (side rail, library + book details side by side).

## Run it on your computer

```bash
node server.mjs
```

Then open http://localhost:5173.

## Put it on your phone

A PWA needs to be served over HTTPS to install. The easiest free options:

- **Netlify Drop**: drag this folder onto https://app.netlify.com/drop
- **GitHub Pages**: push this folder to a repo and turn on Pages

Open the URL in Chrome or Samsung Internet on the Fold, then menu → **Add to Home screen / Install app**.

## Notes

- Data lives in the browser's local storage on each device. Use **Settings → Export backup** regularly.
- Book search, covers and suggestions come from Open Library (no account or API key).
- Spice, tropes and warnings are tagged by you; there's no public database of community spice ratings to pull from.
- No build step: plain HTML, CSS and JavaScript modules. Views are in `js/views/`, vocabularies (tropes, warnings, moods) in `js/data.js`.
