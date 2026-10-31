# Nutrition OS API — Contract Notes, v1 (Phase 5)

Base path: /api/v1/nutrition
Content type: application/json
Auth: Authorization: Bearer <verified JWT>
Write: Idempotency-Key: <8..120 permitted chars>

Successful reads: { "data": <resource | array> }
Successful mutations: { "data": <resource | confirmation> }
Errors: { "error": { "code": "<stable_code>", "message": "<safe_message>", "correlationId": "<uuid>" } }
400 malformed JSON (Fastify), 401 missing/invalid token, 403 scope, 404 absent/other actor resource, 409 revision/idempotency/ledger conflict, 422 validation, 428 idempotency key required, 500 internal.

### Food create
POST /foods
{ "name":"Beans", "servingLabel":"one cup cooked", "energyKcal":230, "proteinG":14, "carbsG":40, "fatG":1 }
Food source is always user_unverified and verified=false. A creator cannot claim medical provenance.

### Recipe create
POST /recipes
{ "name":"Beans bowl", "yieldServings":2, "prepMinutes":15, "instructions":"Cook safely.", "ingredients":[{"foodId":"<uuid>","servings":2}] }
All ingredient IDs must belong to the same actor, and duplicated food IDs are rejected.

### Logged meal
POST /meals
{ "consumedOn":"2026-10-31", "slot":"Lunch", "name":"Beans bowl eaten", "items":[{"foodId":"<uuid>","servings":1.5}] }
This is a user-confirmed observation. The server stores a nutrient/source snapshot for each item and sums the logged meal. Corrections PUT /meals/:id include the full meal payload plus expectedRevision.

### Unknown intake
GET /state?date=2026-11-02
{ "data": { "date":"2026-11-02", "observedMeals":0, "observationStatus":"unknown", "intake":null, "disclaimer":"..." } }
No arbitrary zeros or physiological deficiency conclusions.

### Weekly plan → grocery handoff
POST /plans {"weekStart":"2026-10-26"}
POST /plans/:id/entries {"plannedOn":"2026-10-31","slot":"Dinner","recipeId":"<uuid>","portions":2}
POST /plans/:id/approve {}
POST /groceries/generate {"planId":"<uuid>","unitPricesKes":{"<food_uuid>":120}}
Grocery generation gathers recipe ingredients and subtracts available non-expired lot quantities. Example KES unit prices come from the caller and are NOT live retailer quotes.

### Stock ledger
POST /inventory/lots {"foodId":"<uuid>","location":"Pantry","acquiredOn":"2026-10-31","expiresOn":null,"unitCostKes":50,"initialServings":3}
POST /inventory/movements {"lotId":"<uuid>","happenedOn":"2026-10-31","kind":"CONSUMPTION","deltaServings":-1}
Negative stock is rejected atomically by a database trigger; ledger rows cannot be updated/deleted.

### Expense vs receipt
PUT /groceries/lines/:id/purchase {"purchased":true,"actualPaidKes":250}
POST /groceries/lines/:id/receive {"location":"Fridge","acquiredOn":"2026-10-31","expiresOn":null}
Checkoff is not a payment; receipt into inventory requires a separate explicit call. Real monetary truth remains in Finance OS.

### Event envelope
Outbox rows provide: id, tenant_id, user_id, event_type, event_version, aggregate_type, aggregate_id, data (allowlisted), correlation_id, state, attempts, available_at, created_at.
Local relay renders: event_id, event_type, event_version, tenant_id, user_id, aggregate_type, aggregate_id, correlation_id, source, delivery.
Transport is at-least-once with consumer dedupe by event_id; production bus, schema registry, recipient filtering and consent enforcement are not connected in Phase 5.
