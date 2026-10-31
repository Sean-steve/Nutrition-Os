# Nutrition OS — Phase 2: Personal Nutrition Experience

## Delivered
Functional, consistent premium React screens for:
1. Three-step onboarding (name, dietary preferences, explicitly chosen example targets)
2. Nutrition profile (edit display/diet/food exclusion/meal count/units)
3. Today (dated meal timeline, logged vs planned, coverage, sample-day water)
4. Meals (date-scoped search, logged/planned filters, detail, historical correction and delete)
5. Foods & portions (regional sample catalogue, serving scale and explicit consumption confirmation)
6. Recipes (create/edit/delete, ingredient-based per-serving estimation and log)
7. Goals (editable limits and dashboard synchronization)
8. Progress (only actual in-session observed dates; no synthetic history)

## Architecture decisions
- Frontend-only/in-memory state. No authentication, live AI or persistence is implied.
- Sample meals remain attributed to their sample date; new records have an explicit ISO date.
- Recipe nutrition uses the deterministic local preview calculator; every logged recipe creates a scalar meal snapshot, so later recipe editing does not silently rewrite past meal logs.
- Intake only includes meals marked logged; planned items do not count.
- Missing intake is unknown, not zero physiological intake.
- Exclusions are not yet automatically enforced; **no allergen safety claim** is made.
- Targets are editable example numbers, not medically prescribed.
- Family context remains isolated from personal nutrition data.
- Data resets on refresh; durable storage and authoritative food provenance belong to later phases.

## Checkpoints
- Phase 2 routes accessible via sidebar, including direct hash navigation.
- Dashboard and personal screens share the same meal and goal state.
- Date selection provides distinct records; non-sample dates do not inherit sample entries.
- Forms validate quantities and numeric limits.
- Unit tests cover nutritional math, date filtering, and input constraints.
- Typecheck, tests, production build and Pages (when enabled) must pass.
