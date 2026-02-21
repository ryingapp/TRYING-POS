CREATE TABLE "kitchen_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"icon" text,
	"color" text DEFAULT '#8B1A1A',
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "kitchen_section_id" varchar;--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "kitchen_section_id" varchar;--> statement-breakpoint
ALTER TABLE "kitchen_sections" ADD CONSTRAINT "kitchen_sections_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_sections" ADD CONSTRAINT "kitchen_sections_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_kitchen_section_id_kitchen_sections_id_fk" FOREIGN KEY ("kitchen_section_id") REFERENCES "public"."kitchen_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_kitchen_section_id_kitchen_sections_id_fk" FOREIGN KEY ("kitchen_section_id") REFERENCES "public"."kitchen_sections"("id") ON DELETE no action ON UPDATE no action;