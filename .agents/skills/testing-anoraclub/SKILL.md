# Testing anoraclub.com

## Overview
Anoraclub.com is an Astro 6.1 static site with Tailwind CSS v4 and Firebase (Hosting + Firestore). It includes multi-step forms, voting, event calendars, newsletter signup, and interactive components.

## Devin Secrets Needed
- `FIREBASE_CI_TOKEN` (repo-scoped) — Firebase CI token for deploying to Firebase Hosting and Firestore rules. Generate with `firebase login:ci`.

## Build & Dev Server
```bash
cd /home/ubuntu/repos/anoraclub
npm install
npm run dev          # Dev server at http://localhost:4321
npm run build        # Production build to dist/
```

## Deployment
```bash
# Deploy hosting (requires FIREBASE_CI_TOKEN)
npx firebase deploy --only hosting --token "$FIREBASE_CI_TOKEN"

# Deploy Firestore rules
npx firebase deploy --only firestore:rules --token "$FIREBASE_CI_TOKEN"
```
- Live site: https://anoraclub.web.app
- Firebase project: `anoraclub`
- The `firebase.json` config includes both `hosting` and `firestore` sections
- If token expires, user must run `firebase login:ci` locally and provide the new token

## Testing Approach

### Playwright CDP (recommended for E2E)
Chrome exposes CDP on `http://localhost:29229`. Use Playwright Python to connect:
```python
from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.connect_over_cdp("http://localhost:29229")
    context = browser.contexts[0]
    page = await context.new_page()
    await page.goto("https://anoraclub.web.app/vote", wait_until="domcontentloaded")
```

**Important**: Use `wait_until="domcontentloaded"` instead of `"networkidle"` for the homepage — Firebase/analytics requests may never fully settle, causing timeouts.

### Key Pages to Test
| Page | URL | Key Feature |
|------|-----|-------------|
| Homepage | `/` | PathChooser (Singles/Couples toggle), Hero, sections |
| Vote | `/vote` | Name voting with 5 options + custom write-in, live results |
| Apply | `/apply` | Multi-step application form (8 steps) |
| Nominate | `/nominate` | Multi-step nomination form (5 steps) |
| Events | `/events` | Event calendar with category filters |
| Status | `/status` | Application status checker by email |
| Privacy | `/privacy` | Privacy policy page |

### Key Interactive Features
1. **Vote page** (`/vote`): Submit button disabled until voter name + option selected. Custom write-in shows text input only when "Suggest your own" radio selected. Results shown as bar chart after Firestore write.
2. **PathChooser** (homepage): Two cards — "For Singles" and "For Couples". Click toggles detail sections (`#singles-detail`, `#couples-detail`). Both hidden by default.
3. **Nav/Footer**: Gold-colored "Vote" link in nav bar and "Vote on Our Name" in footer.
4. **Mobile CTA**: Floating sticky CTA that shows/hides based on scroll position.

### Firestore Collections
- `votes` — create + read allowed, update/delete denied
- `applications` — create + read allowed
- `nominations` — create only
- `counters` — read + write allowed
- `newsletter_subscribers` — create + update allowed, read denied

### Common Pitfalls
- **Cache busting**: Images use `?v=N` query params. If photos look stale, check the version number in component files.
- **Firebase token expiry**: CI tokens expire. If deploy fails with auth error, user needs to run `firebase login:ci` again.
- **Homepage networkidle timeout**: The homepage loads Firebase SDK + GA4, which may prevent `networkidle` from resolving. Always use `domcontentloaded` for homepage navigation.
- **XSS in vote results**: Vote names are rendered via `textContent` (not `innerHTML`) to prevent stored XSS. If adding new user-input displays, follow the same pattern.

## Design System
- Colors: cream `#FAF8F5`, charcoal `#1A1A1A`, gold `#8B6F4E`, divider `#E8E2DB`, muted `#6B6560`
- Typography: Instrument Serif (headings), Inter 300-400 (body)
- Gold color class: `text-gold` (used for accent links like Vote)
