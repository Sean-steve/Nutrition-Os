-- Migration 002: defense in depth for the verified JWT subject and tenant.
-- FORCE applies even to the table owner; never let the normal HTTP pool bypass RLS.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profile','food','recipe','recipe_ingredient','goal','meal','meal_item',
    'meal_plan','planned_meal','inventory_lot','inventory_movement',
    'grocery_list','grocery_line','food_budget','event_outbox','event_inbox',
    'idempotency_receipt','audit_event'
  ] LOOP
    EXECUTE format('ALTER TABLE nutrition.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE nutrition.%I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format(
      'CREATE POLICY own_rows ON nutrition.%I USING (
        tenant_id = NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid
        AND user_id = NULLIF(current_setting(''app.user_id'',true),'''')::uuid
      ) WITH CHECK (
        tenant_id = NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid
        AND user_id = NULLIF(current_setting(''app.user_id'',true),'''')::uuid
      )',table_name
    );
  END LOOP;
END $$;

-- No direct access to migration history; use separate privileged migration login.
-- Explicit table privileges are granted only to an externally provisioned HTTP role.
-- The development bootstrap can provision this role locally, never in production.
