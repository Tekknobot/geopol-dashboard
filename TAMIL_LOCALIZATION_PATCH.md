# ATLAS English / Tamil localization patch

This build adds a persistent `EN / தமிழ்` experience aimed at Sri Lankan Tamil readers (`ta-LK`).

## Included
- Shared language provider with saved browser preference (`atlas-language`).
- `html lang` switches between English and `ta-LK`.
- Noto Sans Tamil via `next/font/google`, with Tamil-capable system fallbacks.
- Language switch in desktop navigation and the shared mobile navigation.
- Tamil localization for the World desk, world taxonomy, Sports, Entertainment, World Grid, Intelligence Map, video/newsroom modules, market UI, and major Canada Simulator controls.
- Dynamic UI phrases such as relative story age, result counts, feed timestamps, and common accessibility labels are localized.
- **Live headline/content translation:** in Tamil mode, publisher headlines and on-site summaries/subtext are translated to Tamil at display time.
- The underlying story objects, publisher names, canonical article URLs, publication timestamps, filtering/classification data, and outbound source articles remain unchanged.
- Repeated headlines are deduplicated in the browser and translated in batches so the same story shown in several ATLAS modules is not translated repeatedly.
- If translation is unavailable, ATLAS gracefully displays the original publisher text instead of blocking the page.

## Translation service
`app/api/translate/route.ts` handles live text translation.

- If `GOOGLE_TRANSLATE_API_KEY` is configured in the deployment environment, ATLAS uses the official Google Cloud Translation v2 endpoint in batches.
- Without that environment variable, the route uses a no-key Google web translation fallback so the Tamil headline experience can work without additional setup.
- Translation responses are cached in the browser session and opportunistically in the server runtime.

For a production deployment where translation availability is business-critical, configuring `GOOGLE_TRANSLATE_API_KEY` is recommended because the official endpoint has a documented API contract.

## Translation model
Static interface copy uses standard written Sri Lankan Tamil suitable for Jaffna/Sri Lankan readers. Live publisher text is machine-translated and should be treated as a convenience translation; the `Read original` link always opens the publisher's original article.

## 2026-09-23 TypeScript build fix
- Added explicit `: string` return type to `translateAtlasText` to satisfy strict Next.js/Vercel type checking for its recursive translation branch.
