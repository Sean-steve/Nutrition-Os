-- Nutrition OS Phase 5, migration 001. Authoritative local persistence (no demo rows).
-- Apply with a dedicated migration role. All personal tables are RLS-protected in 002.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS nutrition;

CREATE TABLE IF NOT EXISTS nutrition.schema_migrations(
  filename text PRIMARY KEY,
  sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nutrition.profile(
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text NOT NULL DEFAULT '',
  diet_style text NOT NULL DEFAULT 'flexible',
  excluded_foods text NOT NULL DEFAULT '',
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,user_id),
  CONSTRAINT profile_preferences_object CHECK (jsonb_typeof(preferences)='object'),
  CONSTRAINT profile_targets_object CHECK (jsonb_typeof(targets)='object')
);

CREATE TABLE nutrition.food(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 140),
  serving_label text NOT NULL CHECK (length(trim(serving_label)) BETWEEN 1 AND 120),
  energy_kcal numeric(12,3) NOT NULL CHECK (energy_kcal>=0 AND energy_kcal<=100000),
  protein_g numeric(12,3) NOT NULL CHECK (protein_g>=0 AND protein_g<=100000),
  carbs_g numeric(12,3) NOT NULL CHECK (carbs_g>=0 AND carbs_g<=100000),
  fat_g numeric(12,3) NOT NULL CHECK (fat_g>=0 AND fat_g<=100000),
  source text NOT NULL DEFAULT 'user_unverified' CHECK(source IN ('user_unverified','import_unverified','verified_reference')),
  source_reference text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX food_search ON nutrition.food(tenant_id,user_id,lower(name));

CREATE TABLE nutrition.recipe(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 140),
  yield_servings numeric(10,3) NOT NULL CHECK(yield_servings>0 AND yield_servings<=1000),
  instructions text NOT NULL DEFAULT '',
  prep_minutes integer NOT NULL DEFAULT 0 CHECK(prep_minutes BETWEEN 0 AND 20000),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE nutrition.recipe_ingredient(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  recipe_id uuid NOT NULL REFERENCES nutrition.recipe(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES nutrition.food(id),
  servings numeric(12,3) NOT NULL CHECK(servings>0 AND servings<=1000),
  UNIQUE(recipe_id,food_id)
);
CREATE INDEX recipe_ingredients_owner ON nutrition.recipe_ingredient(tenant_id,user_id,recipe_id);

CREATE TABLE nutrition.goal(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  metric text NOT NULL CHECK(metric IN ('energy_kcal','protein_g','carbs_g','fat_g','hydration_l')),
  target numeric(12,3) NOT NULL CHECK(target>0 AND target<=100000),
  unit text NOT NULL CHECK(length(unit) BETWEEN 1 AND 16),
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(effective_to IS NULL OR effective_to>=effective_from)
);
CREATE INDEX goal_owner ON nutrition.goal(tenant_id,user_id,effective_from DESC);

CREATE TABLE nutrition.meal(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  consumed_on date NOT NULL,
  slot text NOT NULL CHECK(slot IN ('Breakfast','Lunch','Snack','Dinner')),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 180),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'logged' CHECK(status='logged'),
  energy_kcal numeric(14,3) NOT NULL CHECK(energy_kcal>=0),
  protein_g numeric(14,3) NOT NULL CHECK(protein_g>=0),
  carbs_g numeric(14,3) NOT NULL CHECK(carbs_g>=0),
  fat_g numeric(14,3) NOT NULL CHECK(fat_g>=0),
  revision integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meals_by_day ON nutrition.meal(tenant_id,user_id,consumed_on DESC) WHERE deleted_at IS NULL;
CREATE TABLE nutrition.meal_item(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  meal_id uuid NOT NULL REFERENCES nutrition.meal(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES nutrition.food(id),
  servings numeric(12,3) NOT NULL CHECK(servings>0 AND servings<=1000),
  snapshot_name text NOT NULL,
  snapshot_serving_label text NOT NULL,
  snapshot_source text NOT NULL,
  snapshot_energy_kcal numeric(14,3) NOT NULL CHECK(snapshot_energy_kcal>=0),
  snapshot_protein_g numeric(14,3) NOT NULL CHECK(snapshot_protein_g>=0),
  snapshot_carbs_g numeric(14,3) NOT NULL CHECK(snapshot_carbs_g>=0),
  snapshot_fat_g numeric(14,3) NOT NULL CHECK(snapshot_fat_g>=0)
);
CREATE INDEX meal_item_parent ON nutrition.meal_item(tenant_id,user_id,meal_id);

CREATE TABLE nutrition.meal_plan(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved')),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,user_id,week_start),
  CHECK(EXTRACT(ISODOW FROM week_start)=1)
);
CREATE TABLE nutrition.planned_meal(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES nutrition.meal_plan(id) ON DELETE CASCADE,
  planned_on date NOT NULL,
  slot text NOT NULL CHECK(slot IN ('Breakfast','Lunch','Snack','Dinner')),
  recipe_id uuid NOT NULL REFERENCES nutrition.recipe(id),
  portions numeric(12,3) NOT NULL CHECK(portions>0 AND portions<=1000),
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id,planned_on,slot)
);
CREATE INDEX planned_meal_by_plan ON nutrition.planned_meal(tenant_id,user_id,plan_id);

CREATE TABLE nutrition.inventory_lot(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  food_id uuid NOT NULL REFERENCES nutrition.food(id),
  location text NOT NULL CHECK(location IN ('Pantry','Fridge','Freezer')),
  acquired_on date NOT NULL,
  expires_on date,
  unit_cost_kes numeric(12,2) NOT NULL DEFAULT 0 CHECK(unit_cost_kes>=0 AND unit_cost_kes<=1000000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE nutrition.inventory_movement(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  lot_id uuid NOT NULL REFERENCES nutrition.inventory_lot(id),
  happened_on date NOT NULL,
  kind text NOT NULL CHECK(kind IN ('PURCHASE','CONSUMPTION','WASTE','EXPIRY','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT')),
  delta_servings numeric(12,3) NOT NULL CHECK(delta_servings<>0 AND abs(delta_servings)<=100000),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((kind IN ('PURCHASE','TRANSFER_IN') AND delta_servings>0)
     OR (kind IN ('CONSUMPTION','WASTE','EXPIRY','TRANSFER_OUT') AND delta_servings<0)
     OR kind='ADJUSTMENT')
);
CREATE INDEX movement_lot ON nutrition.inventory_movement(tenant_id,user_id,lot_id,created_at);

CREATE TABLE nutrition.grocery_list(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  source_plan_id uuid REFERENCES nutrition.meal_plan(id),
  source_plan_revision integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX grocery_owner ON nutrition.grocery_list(tenant_id,user_id,created_at DESC);
CREATE TABLE nutrition.grocery_line(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES nutrition.grocery_list(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES nutrition.food(id),
  quantity_servings numeric(12,3) NOT NULL CHECK(quantity_servings>0 AND quantity_servings<=100000),
  needed_servings numeric(12,3) NOT NULL DEFAULT 0 CHECK(needed_servings>=0),
  stock_offset_servings numeric(12,3) NOT NULL DEFAULT 0 CHECK(stock_offset_servings>=0),
  unit_price_kes numeric(12,2) NOT NULL DEFAULT 0 CHECK(unit_price_kes>=0),
  purchased boolean NOT NULL DEFAULT false,
  actual_paid_kes numeric(12,2) CHECK(actual_paid_kes>=0),
  received boolean NOT NULL DEFAULT false,
  CHECK(received=false OR purchased=true),
  CHECK(actual_paid_kes IS NULL OR purchased=true)
);
CREATE INDEX grocery_line_parent ON nutrition.grocery_line(tenant_id,user_id,list_id);

CREATE TABLE nutrition.food_budget(
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount_kes numeric(14,2) NOT NULL CHECK(amount_kes>=0 AND amount_kes<=100000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,user_id)
);

-- Outbox and inbox share the same tenant/user security boundary. Events contain IDs
-- and change types, never clinical narratives or full meal/health payloads.
CREATE TABLE nutrition.event_outbox(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','published','dead')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  leased_until timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(jsonb_typeof(data)='object')
);
CREATE INDEX outbox_claim ON nutrition.event_outbox(state,available_at,created_at) WHERE state IN ('pending','leased');
CREATE TABLE nutrition.event_inbox(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  source_event_id uuid NOT NULL,
  source text NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,user_id,source_event_id)
);
CREATE TABLE nutrition.idempotency_receipt(
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  idempotency_key text NOT NULL,
  request_sha256 text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,user_id,method,path,idempotency_key)
);
CREATE TABLE nutrition.audit_event(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id uuid,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_owner ON nutrition.audit_event(tenant_id,user_id,created_at DESC);

-- Ledger mutations must serialize on their lot row, even for competing requests.
CREATE FUNCTION nutrition.guard_lot_movement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE balance numeric(15,3);
BEGIN
  PERFORM 1 FROM nutrition.inventory_lot
   WHERE id=NEW.lot_id AND tenant_id=NEW.tenant_id AND user_id=NEW.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory lot is not owned by this actor' USING ERRCODE='23503'; END IF;
  SELECT COALESCE(sum(delta_servings),0) INTO balance FROM nutrition.inventory_movement
   WHERE lot_id=NEW.lot_id AND tenant_id=NEW.tenant_id AND user_id=NEW.user_id;
  IF balance+NEW.delta_servings<0 THEN
    RAISE EXCEPTION 'Inventory cannot become negative' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_lot_guard BEFORE INSERT ON nutrition.inventory_movement
 FOR EACH ROW EXECUTE FUNCTION nutrition.guard_lot_movement();

CREATE FUNCTION nutrition.no_ledger_rewrites() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only ledger entries cannot be modified'; END $$;
CREATE TRIGGER immutable_inventory BEFORE UPDATE OR DELETE ON nutrition.inventory_movement
 FOR EACH ROW EXECUTE FUNCTION nutrition.no_ledger_rewrites();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON nutrition.audit_event
 FOR EACH ROW EXECUTE FUNCTION nutrition.no_ledger_rewrites();
