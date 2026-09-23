# ATLAS English / Tamil localization patch

This build adds a persistent `EN / தமிழ்` interface switch aimed at Sri Lankan Tamil readers (`ta-LK`).

## Included
- Shared language provider with saved browser preference (`atlas-language`).
- `html lang` switches between English and `ta-LK`.
- Noto Sans Tamil via `next/font/google`, with Tamil-capable system fallbacks.
- Language switch in desktop navigation and the shared mobile navigation.
- Tamil localization for the World desk, world taxonomy, Sports, Entertainment, World Grid, Intelligence Map, video/newsroom modules, market UI, and major Canada Simulator controls.
- Dynamic UI phrases such as relative story age, result counts, feed timestamps, and common accessibility labels are localized.
- Publisher headlines and summaries remain in the original publisher language. Key headline/summary elements are explicitly excluded from UI translation.
- Internal category/filter IDs remain English so the existing API/filter/classification logic is unchanged.

## Translation model
The interface uses standard written Sri Lankan Tamil appropriate for Jaffna/Sri Lankan readers. The current implementation intentionally does not machine-translate live publisher journalism. A future `தமிழில் படிக்க` story-translation action can be added separately while preserving a visible original-source option.
