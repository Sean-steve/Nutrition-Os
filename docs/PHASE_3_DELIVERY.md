# Nutrition OS — Phase 3 Delivery

## Implemented
- Seven-day meal planner with draft/approved lifecycle, locks, recipe swaps, portions, and deterministic example candidate ranking.
- Grocery requirements aggregated from approved recipes, with stock subtraction, manual items, editable prices and actual amounts kept separate from checkoffs.
- Purchase receiving into pantry/fridge/freezer, with immutable stock movements, consumption, waste/expiry, transfers and stock-availability validation.
- KES budget allocation, estimated baskets, explicitly recorded example actual spending and forecast differences.
- Expiry watchlist, waste-disposal ledger, estimated value lost and limited recipe suggestions from unexpired foods.
- Approved plan meals are visible in Today/Meals as planned, not consumed. Explicit confirmation creates a consumed snapshot linked by planEntryId.
- Dashboard grocery and inventory previews now use shared Phase 3 data.

## Non-negotiable boundaries
All state remains **in memory and sample-only**. No real identity, finance ledger, medical advice, authoritative nutrient dataset, unit conversion, allergen enforcement or backend. Grocery checkboxes do not create payment records or inventory without explicit receipt. Meal logging does not automatically consume pantry stock. No unobserved consumption is invented; no expired food is presented as safe.

## Verification
Run `npm install`, `npm run check`, `npm run test`, and `npm run build`. Browser/device QA and Pages publishing remain separate certification gates; do not claim they passed from compilation alone.

## Purchase-history continuity
Regenerating groceries is blocked while any checked purchase is unreceived. Received purchases from a replaced list are retained in an in-session archive for spending comparison; receiving a purchase twice is prevented. A received item's quantity and unit price cannot silently change, but manually recorded actual spending can be corrected. This is not a permanent financial ledger.
