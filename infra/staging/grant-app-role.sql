-- Run with a separate, privileged migrator after 001–005 complete.
-- Never grant BYPASSRLS, superuser or migration ownership to nutrition_app.
BEGIN;
REVOKE ALL ON SCHEMA nutrition FROM PUBLIC;
GRANT USAGE ON SCHEMA nutrition TO nutrition_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON
 nutrition.profile,nutrition.food,nutrition.recipe,nutrition.recipe_ingredient,
 nutrition.goal,nutrition.meal,nutrition.meal_item,nutrition.meal_plan,
 nutrition.planned_meal,nutrition.inventory_lot,nutrition.grocery_list,
 nutrition.grocery_line,nutrition.food_budget,nutrition.idempotency_receipt,
 nutrition.event_inbox,nutrition.hydration_day,nutrition.household,
 nutrition.household_member,nutrition.household_meal,nutrition.household_task,
 nutrition.household_grocery,nutrition.kernel_binding,nutrition.kernel_grant,
 nutrition.kernel_projection,nutrition.kernel_family_attestation,
 nutrition.kernel_schedule_proposal TO nutrition_app;
GRANT SELECT,INSERT ON nutrition.inventory_movement TO nutrition_app;
GRANT INSERT ON nutrition.audit_event,nutrition.event_outbox TO nutrition_app;
COMMIT;
