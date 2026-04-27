# Testing anoraclub.com

## Overview
Anoraclub.com is an Astro 6.x static site with Tailwind CSS v4, deployed to Firebase Hosting with Firestore as the backend database.

## Devin Secrets Needed
- `FIREBASE_CI_TOKEN` (repo-scoped) — CI token for `firebase deploy --token`. Generate with `firebase login:ci` on a machine with browser access.

## Build & Deploy
```bash
cd /home/ubuntu/repos/anoraclub
npm run build
# Source the repo-scoped secret
source /run/repo_secrets/IamDelamax/anoraclub/.env.secrets 2>/dev/null || true
npx firebase deploy --token "$FIREBASE_CI_TOKEN" --only hosting
npx firebase deploy --token "$FIREBASE_CI_TOKEN" --only firestore:rules
```

## Testing with Playwright CDP

The site runs on Firebase Hosting at https://anoraclub.web.app. Use Playwright via CDP to test the live deployed site.

### Connection Setup
```python
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:29229")
        context = browser.contexts[0]
        page = await context.new_page()  # Always create a NEW page
        await page.set_viewport_size({"width": 1280, "height": 900})
```

### Key Gotchas

1. **Always create a new page** — Don't reuse `context.pages[0]`. The existing page may have stale state or cause screenshot timeouts.

2. **Use `wait_until="domcontentloaded"`** for the homepage — Firebase SDK + GA4 scripts never fully settle, so `networkidle` will timeout. Other pages (vote, status) are lighter and `domcontentloaded` works fine too.

3. **Screenshot timeouts** — If `page.screenshot()` times out, add `timeout=10000` parameter and wrap in try/except. Full-page screenshots (`full_page=True`) are more likely to timeout on heavy pages.

4. **localStorage for vote dedup** — The vote form uses `localStorage.setItem('club-name-vote-v1', ...)` to prevent double-voting. Clear it before testing:
   ```python
   await page.evaluate("window.localStorage.removeItem('club-name-vote-v1')")
   await page.reload(wait_until="domcontentloaded")
   ```

5. **Use `page.evaluate()` for DOM interactions on long pages** — Playwright's `page.click()` may timeout if elements are outside the viewport. Use JS evaluation instead:
   ```python
   # Scroll to element
   await page.evaluate("document.getElementById('vote')?.scrollIntoView({behavior:'instant', block:'center'})")
   # Click via JS
   await page.evaluate("document.getElementById('custom-radio')?.click()")
   # Dispatch change event for radio buttons clicked via JS
   await page.evaluate("""
       const radio = document.getElementById('custom-radio');
       radio.checked = true;
       radio.dispatchEvent(new Event('change', { bubbles: true }));
   """)
   ```

6. **Check classes via JS evaluate** — More reliable than `query_selector` + `get_attribute` on long pages:
   ```python
   classes = await page.evaluate("document.getElementById('vote')?.className || ''")
   ```

## Key Pages & Features to Test

| Page | URL | Key Elements |
|------|-----|-------------|
| Homepage | `/` | Hero, NameVote (embedded), PathChooser, Positioning, Events, CTA |
| Vote | `/vote` | NameVote (standalone, full-screen) |
| Status | `/status` | Request Update form → Firestore `status_requests` |
| Apply | `/apply` | 8-step multi-step form → Firestore `applications` |
| Nominate | `/nominate` | 5-step form → Firestore `nominations` |
| Events | `/events` | Event cards with category filters |

## NameVote Component
- **Standalone** (`/vote`): Has `min-h-screen pt-32 pb-20` classes
- **Embedded** (homepage): Has `py-24 md:py-28` classes, no `min-h-screen`
- Both modes: `bg-charcoal` dark background, cream text
- Options: 5 preset names + "Suggest your own" custom write-in
- Custom input (`#custom-name`) is hidden until the `#custom-radio` is selected
- Submit button (`#submit-vote`) is disabled until both a name option AND voter name are provided
- After submission: form shell hides, success section shows "Thank you" + selected vote echoed via `textContent` (XSS-safe)
- No live results — aggregate results are private (admin-only read in Firestore rules)

## Status Page
- Privacy-first model: writes to `status_requests` collection, shows "Request Received" confirmation
- Does NOT reveal whether an application exists or its status
- Button text: "Request Update" (not "Check Status")

## Security Headers
Verify with `curl -sI https://anoraclub.web.app`:
- Content-Security-Policy
- Strict-Transport-Security
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy

## Firestore Rules
Strict validation on all collections. Key constraints:
- `votes`: clubName 1-80 chars, voterName 1-80 chars, voterEmail null or valid email
- `status_requests`: email as doc ID, must match data.email
- `applications`: 12+ required fields with regex validation on age, gender, referralSource
- Anonymous read only allowed on `counters` collection
- All other reads are admin-only

## Firebase Token
The CI token expires periodically. If deployment fails with auth errors, ask the user to run `firebase login:ci` and provide the new token. Save it as repo-scoped secret `FIREBASE_CI_TOKEN`.
