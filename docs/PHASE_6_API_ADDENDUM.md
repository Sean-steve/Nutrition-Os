# Phase 6 API contract extension

Root: /api/v1/nutrition. Bearer token with verified subject and tenant_id is always mandatory. Mutating calls require Idempotency-Key: 8–120 permitted characters. All resources are tenant and user scoped unless explicitly shared via signed-member household authorization.

Session:
GET /session -> data:{userId,tenantId,scopes,identitySource}

Personal:
GET /hydration?date=YYYY-MM-DD -> data:{date,observedL:null|number,revision:null|number}
PUT /hydration {date,observedL}
GET /progress?from=YYYY-MM-DD&to=YYYY-MM-DD -> observations[] and hydration[] (only explicitly recorded dates)
PUT /foods/:id {name,servingLabel,energyKcal,proteinG,carbsG,fatG,expectedRevision}
DELETE /foods/:id {} -> soft retire
PUT /recipes/:id {name,yieldServings,prepMinutes,instructions,ingredients:[{foodId,servings}],expectedRevision}
DELETE /recipes/:id {} -> soft retire; approved-plan recipes cannot be edited.

Grocery and inventory:
POST /groceries/lists {}
POST /groceries/lines {foodId,quantityServings,unitPriceKes}
PUT /groceries/lines/:id {quantityServings,unitPriceKes} (unchecked/unreceived active lines only)
DELETE /groceries/lines/:id {} (unchecked active lines only)
GET /inventory/movements -> append-only movement rows.
GET /groceries returns active/archived lists; prior receipts remain stored when new lists are generated.

Family Kitchen (SANITIZED logistics, NOT personal intake):
GET /family -> {boards:[{id,name,role,ownerUserId,members,meals,tasks,groceries}],invites,disclaimer}
POST /family {name}
POST /family/:id/invites {userId,alias,role:'viewer'|'editor'}
POST /family/:id/accept {}
PATCH /family/:id/members/:memberId {role}
POST /family/:id/share-plan {planId}
PUT /family/:id/tasks {mealId,assignedUserId,note,status:'planned'|'preparing'|'completed'}
POST /family/:id/groceries {title,quantity,estimateKes}
PATCH /family/:id/groceries/:itemId {checked}

Viewer permissions are read-only. Editors cannot publish a personal plan or manage membership. Invited users cannot see household contents until accepting their own invitation with their signed JWT. No household API includes any member's private logged meal, nutrient target, medical context, or personal payment allocation.
