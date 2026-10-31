-- Migration 003: cross-tenant foreign-key defense in depth.
-- RLS controls visibility and writes; composite FKs also forbid a row from
-- pointing to another user/tenant's resource ID through PostgreSQL FK checks.
ALTER TABLE nutrition.food ADD CONSTRAINT food_owner_id UNIQUE(tenant_id,user_id,id);
ALTER TABLE nutrition.recipe ADD CONSTRAINT recipe_owner_id UNIQUE(tenant_id,user_id,id);
ALTER TABLE nutrition.meal ADD CONSTRAINT meal_owner_id UNIQUE(tenant_id,user_id,id);
ALTER TABLE nutrition.meal_plan ADD CONSTRAINT meal_plan_owner_id UNIQUE(tenant_id,user_id,id);
ALTER TABLE nutrition.inventory_lot ADD CONSTRAINT lot_owner_id UNIQUE(tenant_id,user_id,id);
ALTER TABLE nutrition.grocery_list ADD CONSTRAINT grocery_list_owner_id UNIQUE(tenant_id,user_id,id);

ALTER TABLE nutrition.recipe_ingredient
 ADD CONSTRAINT ingredient_recipe_owner_fk FOREIGN KEY(tenant_id,user_id,recipe_id)
 REFERENCES nutrition.recipe(tenant_id,user_id,id) ON DELETE CASCADE;
ALTER TABLE nutrition.recipe_ingredient
 ADD CONSTRAINT ingredient_food_owner_fk FOREIGN KEY(tenant_id,user_id,food_id)
 REFERENCES nutrition.food(tenant_id,user_id,id);

ALTER TABLE nutrition.meal_item
 ADD CONSTRAINT meal_item_meal_owner_fk FOREIGN KEY(tenant_id,user_id,meal_id)
 REFERENCES nutrition.meal(tenant_id,user_id,id) ON DELETE CASCADE;
ALTER TABLE nutrition.meal_item
 ADD CONSTRAINT meal_item_food_owner_fk FOREIGN KEY(tenant_id,user_id,food_id)
 REFERENCES nutrition.food(tenant_id,user_id,id);

ALTER TABLE nutrition.planned_meal
 ADD CONSTRAINT planned_meal_plan_owner_fk FOREIGN KEY(tenant_id,user_id,plan_id)
 REFERENCES nutrition.meal_plan(tenant_id,user_id,id) ON DELETE CASCADE;
ALTER TABLE nutrition.planned_meal
 ADD CONSTRAINT planned_meal_recipe_owner_fk FOREIGN KEY(tenant_id,user_id,recipe_id)
 REFERENCES nutrition.recipe(tenant_id,user_id,id);

ALTER TABLE nutrition.inventory_lot
 ADD CONSTRAINT inventory_food_owner_fk FOREIGN KEY(tenant_id,user_id,food_id)
 REFERENCES nutrition.food(tenant_id,user_id,id);
ALTER TABLE nutrition.inventory_movement
 ADD CONSTRAINT inventory_lot_owner_fk FOREIGN KEY(tenant_id,user_id,lot_id)
 REFERENCES nutrition.inventory_lot(tenant_id,user_id,id);

ALTER TABLE nutrition.grocery_list
 ADD CONSTRAINT grocery_source_plan_owner_fk FOREIGN KEY(tenant_id,user_id,source_plan_id)
 REFERENCES nutrition.meal_plan(tenant_id,user_id,id);
ALTER TABLE nutrition.grocery_line
 ADD CONSTRAINT grocery_line_list_owner_fk FOREIGN KEY(tenant_id,user_id,list_id)
 REFERENCES nutrition.grocery_list(tenant_id,user_id,id) ON DELETE CASCADE;
ALTER TABLE nutrition.grocery_line
 ADD CONSTRAINT grocery_line_food_owner_fk FOREIGN KEY(tenant_id,user_id,food_id)
 REFERENCES nutrition.food(tenant_id,user_id,id);
