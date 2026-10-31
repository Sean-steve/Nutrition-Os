-- Phase 6: missing durable frontend contracts, household-scoped *shared logistics*.
-- No user content or household demo state is seeded.
ALTER TABLE nutrition.food ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE nutrition.food ADD COLUMN deleted_at timestamptz;
ALTER TABLE nutrition.recipe ADD COLUMN deleted_at timestamptz;
ALTER TABLE nutrition.grocery_line ADD COLUMN source text NOT NULL DEFAULT 'plan'
 CHECK(source IN ('plan','manual'));
ALTER TABLE nutrition.grocery_list ADD COLUMN status text NOT NULL DEFAULT 'active'
 CHECK(status IN ('active','archived'));
UPDATE nutrition.grocery_list g SET status='archived'
 WHERE g.id NOT IN (
 SELECT DISTINCT ON (tenant_id,user_id) id FROM nutrition.grocery_list
 ORDER BY tenant_id,user_id,created_at DESC,id DESC
 );
CREATE UNIQUE INDEX one_active_grocery_list_per_owner ON nutrition.grocery_list(tenant_id,user_id)
 WHERE status='active';
-- Existing repositories are empty until the user creates their own records.

CREATE TABLE nutrition.hydration_day(
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,observed_on date NOT NULL,
 observed_l numeric(8,3) NOT NULL CHECK(observed_l >= 0 AND observed_l <= 15),
 revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id,observed_on)
);
ALTER TABLE nutrition.hydration_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition.hydration_day FORCE ROW LEVEL SECURITY;
CREATE POLICY own_hydration ON nutrition.hydration_day
 USING(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND user_id=NULLIF(current_setting('app.user_id',true),'')::uuid)
 WITH CHECK(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND user_id=NULLIF(current_setting('app.user_id',true),'')::uuid);

-- Household membership is a local sharing arrangement, NOT Family OS membership authority.
-- Only consenting (accepted) signed subjects may read the kitchen board.
CREATE TABLE nutrition.household(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 owner_user_id uuid NOT NULL,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,owner_user_id,id)
);
CREATE TABLE nutrition.household_member(
 tenant_id uuid NOT NULL,
 household_id uuid NOT NULL,
 owner_user_id uuid NOT NULL,
 member_user_id uuid NOT NULL,
 alias text NOT NULL CHECK(length(trim(alias)) BETWEEN 1 AND 70),
 role text NOT NULL CHECK(role IN ('editor','viewer')),
 state text NOT NULL DEFAULT 'invited' CHECK(state IN ('invited','accepted')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,household_id,member_user_id),
 FOREIGN KEY(tenant_id,owner_user_id,household_id)
 REFERENCES nutrition.household(tenant_id,owner_user_id,id) ON DELETE CASCADE,
 CHECK(owner_user_id<>member_user_id)
);
CREATE TABLE nutrition.household_meal(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 household_id uuid NOT NULL,
 source_entry_id uuid NOT NULL,
 meal_date date NOT NULL,
 slot text NOT NULL CHECK(slot IN ('Breakfast','Lunch','Snack','Dinner')),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 140),
 portions numeric(12,3) NOT NULL CHECK(portions>0 AND portions<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,household_id,source_entry_id),
 UNIQUE(tenant_id,household_id,id),
 FOREIGN KEY(tenant_id,household_id) REFERENCES nutrition.household(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE nutrition.household_task(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 household_id uuid NOT NULL,
 meal_id uuid NOT NULL,
 assigned_user_id uuid NOT NULL,
 note text NOT NULL DEFAULT '' CHECK(length(note)<=160),
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','preparing','completed')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,household_id,meal_id),
 FOREIGN KEY(tenant_id,household_id,meal_id) REFERENCES nutrition.household_meal(tenant_id,household_id,id) ON DELETE CASCADE
);
CREATE TABLE nutrition.household_grocery(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 household_id uuid NOT NULL,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 140),
 quantity text NOT NULL CHECK(length(trim(quantity)) BETWEEN 1 AND 80),
 estimate_kes numeric(12,2) NOT NULL CHECK(estimate_kes>=0 AND estimate_kes<=1000000),
 checked boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,household_id) REFERENCES nutrition.household(tenant_id,id) ON DELETE CASCADE
);

-- SECURITY NOTE: member table policy does not recursively consult itself.
-- It allows owners to manage their invitations, and signed members to read only their own.
ALTER TABLE nutrition.household_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition.household_member FORCE ROW LEVEL SECURITY;
CREATE POLICY member_read ON nutrition.household_member FOR SELECT USING(
 tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND (owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
      OR member_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY member_add ON nutrition.household_member FOR INSERT WITH CHECK(
 tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
 AND state='invited');
CREATE POLICY member_update ON nutrition.household_member FOR UPDATE USING(
 tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND (owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
      OR member_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid))
 WITH CHECK(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY member_remove ON nutrition.household_member FOR DELETE USING(
 tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid);

-- Accepted members must not be able to self-promote or modify invitations.
-- Enforce independent of service checks.
CREATE FUNCTION nutrition.member_update_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
 actor:=NULLIF(current_setting('app.user_id',true),'')::uuid;
 IF actor IS DISTINCT FROM OLD.owner_user_id THEN
   IF actor IS DISTINCT FROM OLD.member_user_id
     OR OLD.state <> 'invited' OR NEW.state <> 'accepted'
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.member_user_id IS DISTINCT FROM OLD.member_user_id
     OR NEW.role IS DISTINCT FROM OLD.role OR NEW.alias IS DISTINCT FROM OLD.alias THEN
     RAISE EXCEPTION 'Only invitation acceptance is permitted for members' USING ERRCODE='42501';
   END IF;
 ELSE
   IF NEW.state IS DISTINCT FROM OLD.state THEN
     RAISE EXCEPTION 'Owners cannot accept invitations for other subjects' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER household_member_guard BEFORE UPDATE ON nutrition.household_member
 FOR EACH ROW EXECUTE FUNCTION nutrition.member_update_guard();

-- Selection of households is based on owner or accepted membership only.
ALTER TABLE nutrition.household ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition.household FORCE ROW LEVEL SECURITY;
CREATE POLICY household_read ON nutrition.household FOR SELECT USING(
 tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid AND
 (owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid OR
 EXISTS(SELECT 1 FROM nutrition.household_member m WHERE m.tenant_id=household.tenant_id
   AND m.household_id=household.id AND m.member_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND m.state='accepted')));
CREATE POLICY household_add ON nutrition.household FOR INSERT WITH CHECK(
 tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY household_owner_update ON nutrition.household FOR UPDATE USING(
 tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid)
 WITH CHECK(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid);

-- A SECURITY INVOKER permission check inherits the actor's RLS context.
-- It never bypasses tenant or subject identity policies.
CREATE FUNCTION nutrition.can_use_household(hid uuid,tid uuid,operation text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,nutrition AS $$
  SELECT EXISTS (
    SELECT 1 FROM nutrition.household h
    WHERE h.id=hid AND h.tenant_id=tid
      AND (
        h.owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
        OR (operation<>'owner' AND EXISTS (
          SELECT 1 FROM nutrition.household_member m
          WHERE m.tenant_id=tid AND m.household_id=hid
            AND m.member_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
            AND m.state='accepted'
            AND (operation='read' OR (operation='write' AND m.role='editor'))
        ))
      )
  );
 $$;
DO $$
DECLARE tab text; authority text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['household_meal','household_task','household_grocery'] LOOP
   authority := CASE WHEN tab='household_meal' THEN 'owner' ELSE 'write' END;
   EXECUTE format('ALTER TABLE nutrition.%I ENABLE ROW LEVEL SECURITY',tab);
   EXECUTE format('ALTER TABLE nutrition.%I FORCE ROW LEVEL SECURITY',tab);
   EXECUTE format('CREATE POLICY shared_read ON nutrition.%I FOR SELECT USING (
     tenant_id=NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid
     AND nutrition.can_use_household(household_id,tenant_id,''read''))',tab);
   EXECUTE format('CREATE POLICY shared_write ON nutrition.%I FOR ALL USING (
     tenant_id=NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid
     AND nutrition.can_use_household(household_id,tenant_id,%L))
     WITH CHECK (
     tenant_id=NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid
     AND nutrition.can_use_household(household_id,tenant_id,%L))',tab,authority,authority);
 END LOOP;
END $$;

-- Kitchen sharing permission checks are bounded to this tenant and verified member.
