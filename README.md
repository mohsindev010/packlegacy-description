# Pack Legacy: Custom Mailer Boxes page

A product category page built from the supplied 1920px design, served by a plain
Node.js server: **no Express, no template engine, no npm dependencies**.

## Run it

Requires Node.js 18+.

```bash
npm run dev     # restarts automatically when server files change
npm start       # production-style start
```

Open http://localhost:3000. Set `PORT` to use another port.

## Project structure

```
server.js                    HTTP server: hands every request to the router, catches crashes (500)
src/
  router.js                  "METHOD /path" -> handler; anything with a file extension -> static files
  handlers/
    staticHandler.js         serves /public with correct MIME types, ETag caching, path-traversal protection
    quoteHandler.js          POST /api/quote: parse -> validate -> save PDF -> save quote -> JSON reply
  utils/
    parseMultipart.js        multipart/form-data parser (fields + file) with a body size limit
    validateQuote.js         server-side validation (mirrors the browser rules)
    httpError.js             error carrying an HTTP status (400 / 413 / 415)
    mime.js                  file extension -> Content-Type
public/
  index.html                 the page (semantic HTML, inline SVG icon sprite, FAQ JSON-LD)
  css/style.css              all styles, numbered sections, BEM class names
  js/main.js                 desktop scaling, topbar slider, mobile menu, quote form, tabs
  images/                    logo, product photos, material illustrations (SVG)
storage/                     runtime data (quotes.json, uploads/): git-ignored
```

## Key decisions

**Pure Node.** Routing, static file serving and body parsing are written by hand in
`src/` so there are no dependencies to install or audit.

**Quote form with PDF upload.** The form posts `multipart/form-data`. Node has no
built-in parser for it, so `parseMultipart.js` splits the body on the boundary itself.

- The browser validates for convenience. The server validates again, because anyone can
  skip the browser checks with curl or Postman.
- An uploaded PDF is checked by its first bytes (`%PDF-`), not by its file name or the
  type the browser reports.
- Files are saved as `<uuid>.pdf`. The client's file name is never used in the path.
- Bodies over ~10 MB are rejected with `413`, wrong content types with `415`.
- Writes to `quotes.json` go through a queue, so simultaneous submissions can't overwrite
  each other. Each write goes to a temp file and is then renamed, so a crash mid-write
  can't corrupt the file.

**Matching the design on any desktop.** The design is a fixed 1920px layout. On screens
wider than 1024px the page is laid out at 1920px and scaled to the screen (CSS `zoom`,
set by `initPageScale()` in `main.js`), so alignment and proportions match the design on
1366, 1440, 1536 and 1920 screens. The scale stops at 70% so text stays readable. At
1024px and below, normal responsive CSS takes over: one column, hamburger menu, stacked
form fields.

**Caching.** Static files are sent with an `ETag` and `Cache-Control: no-cache`. The
browser revalidates on every load and gets a `304` when nothing changed, so edits always
show up on a normal refresh.

**Accessibility.** Semantic landmarks, labelled form fields with linked error messages,
WAI-ARIA tabs (arrow, Home and End keys), native `<details>` for the FAQ, visible focus
styles, and `aria-hidden` on decorative icons.

**SEO.** One `h1`, ordered headings, descriptive `alt` text, a meta description, and
`FAQPage` structured data (JSON-LD).

## Testing done

- **API, with curl:** valid submit; valid submit with a PDF; "upload" chosen without a
  file; a fake PDF; invalid fields sent around the browser; JSON instead of multipart; an
  11 MB file; a malformed body; a `../../` file name; 5 simultaneous submits (none lost).
- **Layout, in headless Edge:** compared side by side with the design at 1920 and 1536px.
  Checked for horizontal overflow at 1920, 1600, 1536, 1440, 1366, 1280, 1100, 1024, 768
  and 375px.
- **Interaction:** tab keyboard navigation, FAQ toggle, form validation and the
  end-to-end submit.

## Known limits and out of scope

- **Placeholders.** Product and Instagram photos reuse the 4 supplied mailer box images.
  The material images, the quote form illustrations and the Clutch, bark, Trustpilot, AI
  and payment logos are drawn SVG stand-ins until the real assets are supplied.
- **Uploads in memory.** An upload is held in memory (max ~10 MB) before saving. A
  production version would stream it to disk or object storage.
- **Storage.** Quotes are stored in a JSON file. A production version would use a
  database and send a notification email.
- **Not built (single-page task):** nav dropdown menus, the search results page, and the
  real URLs for the `href="#"` links.
- **No-JS desktop.** Desktop scaling needs JavaScript. Without it the page still works,
  just unscaled.
