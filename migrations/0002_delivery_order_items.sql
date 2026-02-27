-- Make menuItemId nullable for delivery items that don't map to menu items
ALTER TABLE "order_items" ALTER COLUMN "menu_item_id" DROP NOT NULL;

-- Add item name for delivery items (when no menu item reference)
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "item_name" text;
