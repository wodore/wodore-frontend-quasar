# SEO: bare-URL language redirects broken on staging, preview bots forced to English

## Symptom (reported 261002)

- `https://stg.wodore.com/hut/taelli` → **no og preview** when shared.
- `https://stg.wodore.com/de/hut/taelli` → works (200, localized og tags).

## Root cause (two bugs in #201, staging only — prod does not run this code yet)

1. **Unreachable redirect target.** seo.js issues its language redirects with
   a _relative_ `Location` (`/en/hut/taelli`). nginx's default
   `absolute_redirect on` + `port_in_redirect on` absolutized it from its own
   listener behind the TLS edge: `http://stg.wodore.com:8080/en/hut/taelli`.
   Port 8080 is not reachable from outside → social crawlers got no og
   preview, and **first-visit users with de/fr/it Accept-Language were
   302'd into a connection timeout** (worse than the reported symptom).
2. **All crawlers were treated alike**: the single `CRAWLER_RE` 301'd every
   known bot (social preview bots included) to the _default_ language (`en`),
   ignoring the language of the user whose client unfurls the link.

Verified against stg with a local Alpine nginx + njs rig (same packages as
the Dockerfile serve stage, `WODORE_API_HOST=https://hub.stg.wodore.com`).

## Fix (`fix/seo-bare-url-language`)

- `docker/nginx-default.conf`: **`absolute_redirect off;`** in the server
  block — Location stays relative; clients resolve it against the request
  URL. Fixes both the crawler 301 and the first-visit 302.
- `docker/seo.js`:
  - Split `CRAWLER_RE` into `SEARCHBOT_RE` (Googlebot, bingbot, DuckDuckBot,
    YandexBot, GPTBot, ClaudeBot, …) and `PREVIEWBOT_RE`
    (facebookexternalhit, Twitterbot, WhatsApp, TelegramBot, Slackbot,
    LinkedInBot, Discordbot, Applebot).
  - **Preview bots on the bare URL are served inline (200, never
    redirected)** — several unfurlers follow redirects poorly or not at all.
    The og/twitter block is localized from the bot's `Accept-Language`:
    Telegram/WhatsApp forward the user's locale (→ "the user's language"),
    Facebook sends none (→ `WODORE_DEFAULT_LANG`, currently `en`).
  - Search bots keep the fixed 301 to the default-language prefix (index
    consolidation; a per-request negotiated 301 would be cache-poisonous).
  - Markdown content negotiation (`Accept: text/markdown`) moved **before**
    the redirect branches, restoring the documented "LLM crawlers get the
    document" behavior that the crawler 301 had shadowed.
  - `serve()` takes a `noStore` flag: Accept-Language-negotiated responses
    are always `no-store`, so a shared cache can never pin one language's
    HTML to the bare URL even when `WODORE_SEO_PAGE_TTL > 0`.

## Verification matrix (rig + real staging API)

| Request                                               | Before (stg)                      | After (rig)                        |
| ----------------------------------------------------- | --------------------------------- | ---------------------------------- |
| bare + facebookexternalhit                            | 301 → `http://…:8080/en/…` (dead) | 200, og in default (en), no-store  |
| bare + facebookexternalhit + `Accept-Language: de-CH` | 301 → dead                        | 200, og in **de**                  |
| bare + TelegramBot + `Accept-Language: fr`            | 301 → dead                        | 200, og in **fr**                  |
| bare + Googlebot                                      | 301 → dead                        | 301 → `/en/hut/taelli` (relative)  |
| bare + browser + `Accept-Language: de`, no cookie     | 302 → dead                        | 302 → `/de/hut/taelli` (relative)  |
| bare + browser + `wodore_lang` cookie                 | 200 en                            | 200 en (unchanged)                 |
| `/de/hut/taelli`                                      | 200 de                            | 200 de, self-canonical (unchanged) |
| bare + GPTBot + `Accept: text/markdown`               | HTML shell (bug)                  | `text/markdown` proxied            |

## Notes

- FB/LinkedIn previews will show the default language (`en`): their fetchers
  send no Accept-Language and scrape centrally. If German previews are
  wanted there, set `WODORE_DEFAULT_LANG=de` at deploy — no code change.
- Prod is unaffected today (doesn't run #201 yet); this fix rides along.
- Stale nginx comment "(/de/ is 301'd to bare inside seo.js.)" replaced with
  the actual full-prefix behavior.
