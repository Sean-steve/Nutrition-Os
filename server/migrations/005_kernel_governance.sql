-- Phase 7: Kernel is the ONLY authority for engine lifecycle, consent and other-engine context.
-- No seed rows, no implied install, no static consent and no direct cross-engine DB links.
CREATE TABLE nutrition.kernel_binding (
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,
 engine_state text NOT NULL CHECK(engine_state IN
 ('REGISTERED','VALIDATED','ENABLED','RUNNING','SUSPENDED','DISABLED','UNINSTALLED')),
 assertion_id uuid NOT NULL, asserted_at timestamptz NOT NULL,
 lease_expires_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id),
 CHECK(lease_expires_at>asserted_at)
);
CREATE TABLE nutrition.kernel_grant (
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,
 scope text NOT NULL CHECK(scope IN (
  'nutrition.signal.publish','nutrition.schedule.propose',
  'nutrition.context.fitness','nutrition.context.finance',
  'nutrition.context.calendar','nutrition.context.health',
  'nutrition.context.family')),
 granted boolean NOT NULL,lease_expires_at timestamptz NOT NULL,
 assertion_id uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id,scope),
 FOREIGN KEY(tenant_id,user_id) REFERENCES nutrition.kernel_binding(tenant_id,user_id) ON DELETE CASCADE
);
CREATE TABLE nutrition.kernel_projection (
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,
 provider text NOT NULL CHECK(provider IN ('fitness','finance','calendar','health')),
 signal_key text NOT NULL CHECK(signal_key IN
  ('last_workout_duration_minutes','food_budget_headroom_kes','next_meal_window','clinical_review_required')),
 signal_value jsonb NOT NULL,
 source_event_id uuid NOT NULL,
 observed_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id,provider,signal_key),
 FOREIGN KEY(tenant_id,user_id) REFERENCES nutrition.kernel_binding(tenant_id,user_id) ON DELETE CASCADE,
 CHECK(expires_at>observed_at),
 CHECK(jsonb_typeof(signal_value) IN ('object','number','boolean'))
);
CREATE TABLE nutrition.kernel_family_attestation (
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,
 household_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('editor','viewer')),
 active boolean NOT NULL,expires_at timestamptz NOT NULL,
 asserted_at timestamptz NOT NULL,
 source_event_id uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id,household_id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES nutrition.kernel_binding(tenant_id,user_id) ON DELETE CASCADE
);
CREATE TABLE nutrition.kernel_schedule_proposal (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,
 source_plan_id uuid NOT NULL,
 proposed_day date NOT NULL,
 start_time time NOT NULL,end_time time NOT NULL,
 rationale_code text NOT NULL CHECK(rationale_code IN ('meal_preparation','meal_break','grocery_trip')),
 state text NOT NULL DEFAULT 'proposed' CHECK(state IN ('proposed','accepted','rejected','revoked')),
 kernel_decision_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 FOREIGN KEY(tenant_id,user_id,source_plan_id)
 REFERENCES nutrition.meal_plan(tenant_id,user_id,id),
 CHECK(start_time < end_time)
);
CREATE UNIQUE INDEX kernel_proposal_decision ON nutrition.kernel_schedule_proposal
 (tenant_id,user_id,kernel_decision_id) WHERE kernel_decision_id IS NOT NULL;
CREATE INDEX kernel_proposal_owner ON nutrition.kernel_schedule_proposal(tenant_id,user_id,created_at DESC);

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['kernel_binding','kernel_grant','kernel_projection',
 'kernel_family_attestation','kernel_schedule_proposal'] LOOP
  EXECUTE format('ALTER TABLE nutrition.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE nutrition.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY own_rows ON nutrition.%I USING (
   tenant_id=NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid
   AND user_id=NULLIF(current_setting(''app.user_id'',true),'''')::uuid)
   WITH CHECK(
   tenant_id=NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid
   AND user_id=NULLIF(current_setting(''app.user_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;

-- A member must have BOTH a locally accepted kitchen invitation AND a valid
-- Kernel/Family OS authority attestation when strict (production) mode is active.
-- No database pool is allowed to copy a user-provided flag into this GUC.
CREATE OR REPLACE FUNCTION nutrition.can_use_household(hid uuid,tid uuid,operation text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,nutrition AS $$
 SELECT EXISTS(
 SELECT 1 FROM nutrition.household h
 WHERE h.id=hid AND h.tenant_id=tid
 AND (
  h.owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
  OR (operation<>'owner' AND EXISTS (
   SELECT 1 FROM nutrition.household_member m
   WHERE m.tenant_id=tid AND m.household_id=hid
    AND m.member_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
    AND m.state='accepted' AND (operation='read' OR (operation='write' AND m.role='editor'))
    AND (
      COALESCE(current_setting('app.kernel_family_required',true),'on')='off'
      OR EXISTS (
       SELECT 1 FROM nutrition.kernel_family_attestation k
       JOIN nutrition.kernel_binding b ON b.tenant_id=k.tenant_id AND b.user_id=k.user_id
       JOIN nutrition.kernel_grant g ON g.tenant_id=k.tenant_id AND g.user_id=k.user_id
       WHERE k.tenant_id=tid AND k.user_id=m.member_user_id
         AND k.household_id=hid AND k.active=true AND k.role=m.role AND k.expires_at>now()
         AND b.engine_state IN ('ENABLED','RUNNING') AND b.lease_expires_at>now()
         AND g.scope='nutrition.context.family' AND g.granted AND g.lease_expires_at>now()
      )
    )
  ))
 )
 )
 $$;

DROP POLICY household_read ON nutrition.household;
CREATE POLICY household_read ON nutrition.household FOR SELECT USING(
 tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
 AND (
  owner_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
  OR EXISTS(
   SELECT 1 FROM nutrition.household_member m
   WHERE m.tenant_id=household.tenant_id AND m.household_id=household.id
    AND m.member_user_id=NULLIF(current_setting('app.user_id',true),'')::uuid
    AND m.state='accepted'
    AND (
      COALESCE(current_setting('app.kernel_family_required',true),'on')='off'
      OR EXISTS(
        SELECT 1 FROM nutrition.kernel_family_attestation k
        JOIN nutrition.kernel_binding b ON b.tenant_id=k.tenant_id AND b.user_id=k.user_id
        JOIN nutrition.kernel_grant g ON g.tenant_id=k.tenant_id AND g.user_id=k.user_id
        WHERE k.tenant_id=household.tenant_id AND k.user_id=m.member_user_id
         AND k.household_id=household.id AND k.active AND k.role=m.role
         AND k.expires_at>now() AND b.engine_state IN ('ENABLED','RUNNING')
         AND b.lease_expires_at>now() AND g.scope='nutrition.context.family'
         AND g.granted AND g.lease_expires_at>now()
      )
    )
  )
));
-- Household owners retain their own board; accepted members in strict mode must
-- additionally carry a current authorized family attestation.
