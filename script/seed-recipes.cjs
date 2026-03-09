/**
 * Add recipes + logo + fill all restaurant data for Burger House
 * Run: node script/seed-recipes.cjs
 */

const BASE = "https://tryingpos.com";

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

async function main() {
  // Login
  const { data: login } = await api("POST", "/api/users/login", {
    email: "demo@burgerhouse.sa",
    password: "Demo@2026",
  });
  if (!login.token) { console.error("Login failed:", login); process.exit(1); }
  const token = login.token;
  const restaurantId = login.user.restaurantId;
  console.log("✓ Logged in as", login.user.email);

  // ===== MENU ITEM IDs =====
  const MI = {
    classicSmash:     "cfcc2d9c-40ed-4c1c-a576-218c6279fc5c",
    doubleSmash:      "7b7daf3b-47f8-4f56-af28-d8894e79cf2d",
    mushroomSwiss:    "37e89054-fee6-4c96-b5b2-c0bf09048227",
    spicyJalapeno:    "2391861c-9ba7-4848-a6a6-6346622b1876",
    wagyuTruffle:     "d166ae70-2a6b-4031-bbd2-da20dc28b0bf",
    crispyChicken:    "583cc5bf-eac0-4c4b-847d-4e29d6b45a3a",
    grilledChicken:   "6d31672e-3fa8-4d24-a203-35ffe9c6d265",
    nashvilleHot:     "86ac68ed-ff1a-4169-8784-ecd7ae5ab69b",
    chickenTenders:   "5f1c0765-1f8c-4a0d-8e9c-c52111c1b031",
    classicFries:     "8e934917-4294-45e3-8bc4-ec9e7a1a8195",
    loadedFries:      "8b7a5077-bbb3-45db-afe5-db3a0da12544",
    onionRings:       "f0017f98-d6fa-4a6a-9ab3-dae811f17ed4",
    macCheeseBites:   "bae66958-d69a-4a6b-b13d-831d9aef4221",
    caesarSalad:      "2b7fc510-d6d6-4f33-9a3c-c66cf191f0af",
    gardenSalad:      "513fe1dc-b6ad-4f52-865c-954c742ecef9",
    freshLemonade:    "efc1318e-1ca3-48e0-abd5-c83e97aaecd1",
    mangoSmoothie:    "d7d2d667-011d-4f20-a18e-e17f7516ced2",
    icedAmericano:    "d1690705-0fe1-4e03-a3c9-1eee08a11a02",
    oreoMilkshake:    "01ad0bb0-2cf1-493e-a4df-af4948737a08",
    brownie:          "6b51d6e2-f899-4895-9b55-493178bc388d",
    churros:          "a606a15f-3cb3-49c3-a56a-0ad8457fabdd",
    kidsCheeseburger: "82acb778-8fd4-4963-a3b6-a98f28116135",
    kidsNuggets:      "ac5eb3af-f0b3-4fee-871c-1fe316e3348f",
    smashCombo:       "314124cf-97cd-49a3-8df0-28ba8848629f",
    chickenCombo:     "4a7868d9-e317-4df3-94ed-c221c58147ab",
  };

  // ===== INVENTORY IDs =====
  const INV = {
    americanCheese: "2111aab9-109f-4f37-88ff-0c982b463efe",
    beefPatties:    "7043a760-bb03-42a9-99a4-36457d315df7",
    burgerBuns:     "6d21f577-fedf-4461-aa35-eb11ff0d5e00",
    chickenBreast:  "9fb3067f-eb1b-4133-af95-c432c05737d4",
    chocolateSauce: "245cbc3e-59c8-4cef-b40c-72284486117a",
    cocaCola:       "f8cd28bc-adf4-41ee-97be-5b3ea98641c7",
    coffeeBeans:    "4e23c1fb-6398-4127-ab2b-920d41617f0b",
    cookingOil:     "f557db28-8ee8-47dd-9531-3b81e4280187",
    freshLemons:    "93d40de8-b52d-4562-a04c-c4f168c10f61",
    jalapenos:      "a04b920e-4c60-465a-9649-b61f753af8be",
    lettuce:        "cd1b18ed-2e71-4872-bab2-3bf7e42a4b77",
    mangoPulp:      "43ff442c-9ff9-4cf9-9bf3-2128c91d4ce1",
    mushrooms:      "bad81752-940e-408c-b80e-7805d17e02f1",
    onions:         "c38596a6-1248-4625-ac82-b3c74b506b3e",
    potatoes:       "7be592ed-0ab6-4e3e-b1a2-45532672463a",
    swissCheese:    "207274fe-6577-444b-9ec4-bcf99760ad94",
    takeawayBoxes:  "131e1382-f6e8-488e-8fb3-6c1a814b0e24",
    tomatoes:       "cefa9e69-64e5-42cc-a601-59a6a17a4beb",
    vanillaIceCream:"9365eb10-ab99-448f-b161-e8669e03c92d",
    wagyuBeef:      "7678a90b-0028-4b86-b4a8-d1c29433f358",
  };

  // ===== 1. CREATE RECIPES (ingredients for each menu item) =====
  const recipes = [
    // Classic Smash Burger -> beef 150g, bun 1, cheese 30g, onions 20g, lettuce 15g, tomato 20g, oil 15ml
    { menuItemId: MI.classicSmash, inventoryItemId: INV.beefPatties, quantity: "0.15", unit: "kg" },
    { menuItemId: MI.classicSmash, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.classicSmash, inventoryItemId: INV.americanCheese, quantity: "0.03", unit: "kg" },
    { menuItemId: MI.classicSmash, inventoryItemId: INV.onions, quantity: "0.02", unit: "kg" },
    { menuItemId: MI.classicSmash, inventoryItemId: INV.lettuce, quantity: "0.015", unit: "kg" },
    { menuItemId: MI.classicSmash, inventoryItemId: INV.tomatoes, quantity: "0.02", unit: "kg" },
    { menuItemId: MI.classicSmash, inventoryItemId: INV.cookingOil, quantity: "0.015", unit: "liter" },

    // Double Smash Burger -> beef 300g, bun 1, cheese 60g, onions 30g, oil 20ml
    { menuItemId: MI.doubleSmash, inventoryItemId: INV.beefPatties, quantity: "0.30", unit: "kg" },
    { menuItemId: MI.doubleSmash, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.doubleSmash, inventoryItemId: INV.americanCheese, quantity: "0.06", unit: "kg" },
    { menuItemId: MI.doubleSmash, inventoryItemId: INV.onions, quantity: "0.03", unit: "kg" },
    { menuItemId: MI.doubleSmash, inventoryItemId: INV.cookingOil, quantity: "0.02", unit: "liter" },

    // Mushroom Swiss Burger -> beef 150g, bun 1, swiss cheese 40g, mushrooms 50g, oil 15ml
    { menuItemId: MI.mushroomSwiss, inventoryItemId: INV.beefPatties, quantity: "0.15", unit: "kg" },
    { menuItemId: MI.mushroomSwiss, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.mushroomSwiss, inventoryItemId: INV.swissCheese, quantity: "0.04", unit: "kg" },
    { menuItemId: MI.mushroomSwiss, inventoryItemId: INV.mushrooms, quantity: "0.05", unit: "kg" },
    { menuItemId: MI.mushroomSwiss, inventoryItemId: INV.cookingOil, quantity: "0.015", unit: "liter" },

    // Spicy Jalapeño Burger -> beef 150g, bun 1, cheese 30g, jalapeños 20g, onions 25g, oil 20ml
    { menuItemId: MI.spicyJalapeno, inventoryItemId: INV.beefPatties, quantity: "0.15", unit: "kg" },
    { menuItemId: MI.spicyJalapeno, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.spicyJalapeno, inventoryItemId: INV.americanCheese, quantity: "0.03", unit: "kg" },
    { menuItemId: MI.spicyJalapeno, inventoryItemId: INV.jalapenos, quantity: "0.02", unit: "kg" },
    { menuItemId: MI.spicyJalapeno, inventoryItemId: INV.onions, quantity: "0.025", unit: "kg" },
    { menuItemId: MI.spicyJalapeno, inventoryItemId: INV.cookingOil, quantity: "0.02", unit: "liter" },

    // Wagyu Truffle Burger -> wagyu 200g, bun 1, cheese 40g, onions 25g, lettuce 15g, oil 15ml
    { menuItemId: MI.wagyuTruffle, inventoryItemId: INV.wagyuBeef, quantity: "0.20", unit: "kg" },
    { menuItemId: MI.wagyuTruffle, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.wagyuTruffle, inventoryItemId: INV.americanCheese, quantity: "0.04", unit: "kg" },
    { menuItemId: MI.wagyuTruffle, inventoryItemId: INV.onions, quantity: "0.025", unit: "kg" },
    { menuItemId: MI.wagyuTruffle, inventoryItemId: INV.lettuce, quantity: "0.015", unit: "kg" },
    { menuItemId: MI.wagyuTruffle, inventoryItemId: INV.cookingOil, quantity: "0.015", unit: "liter" },

    // Crispy Chicken Burger -> chicken 180g, bun 1, lettuce 15g, onions 15g, oil 50ml
    { menuItemId: MI.crispyChicken, inventoryItemId: INV.chickenBreast, quantity: "0.18", unit: "kg" },
    { menuItemId: MI.crispyChicken, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.crispyChicken, inventoryItemId: INV.lettuce, quantity: "0.015", unit: "kg" },
    { menuItemId: MI.crispyChicken, inventoryItemId: INV.onions, quantity: "0.015", unit: "kg" },
    { menuItemId: MI.crispyChicken, inventoryItemId: INV.cookingOil, quantity: "0.05", unit: "liter" },

    // Grilled Chicken Sandwich -> chicken 180g, bun 1, lettuce 20g, tomatoes 25g
    { menuItemId: MI.grilledChicken, inventoryItemId: INV.chickenBreast, quantity: "0.18", unit: "kg" },
    { menuItemId: MI.grilledChicken, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.grilledChicken, inventoryItemId: INV.lettuce, quantity: "0.02", unit: "kg" },
    { menuItemId: MI.grilledChicken, inventoryItemId: INV.tomatoes, quantity: "0.025", unit: "kg" },

    // Nashville Hot Chicken -> chicken 200g, bun 1, lettuce 15g, oil 60ml
    { menuItemId: MI.nashvilleHot, inventoryItemId: INV.chickenBreast, quantity: "0.20", unit: "kg" },
    { menuItemId: MI.nashvilleHot, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.nashvilleHot, inventoryItemId: INV.lettuce, quantity: "0.015", unit: "kg" },
    { menuItemId: MI.nashvilleHot, inventoryItemId: INV.cookingOil, quantity: "0.06", unit: "liter" },

    // Chicken Tenders -> chicken 250g, oil 80ml
    { menuItemId: MI.chickenTenders, inventoryItemId: INV.chickenBreast, quantity: "0.25", unit: "kg" },
    { menuItemId: MI.chickenTenders, inventoryItemId: INV.cookingOil, quantity: "0.08", unit: "liter" },

    // Classic Fries -> potatoes 200g, oil 100ml
    { menuItemId: MI.classicFries, inventoryItemId: INV.potatoes, quantity: "0.20", unit: "kg" },
    { menuItemId: MI.classicFries, inventoryItemId: INV.cookingOil, quantity: "0.10", unit: "liter" },

    // Loaded Fries -> potatoes 200g, cheese 40g, jalapeños 15g, oil 100ml
    { menuItemId: MI.loadedFries, inventoryItemId: INV.potatoes, quantity: "0.20", unit: "kg" },
    { menuItemId: MI.loadedFries, inventoryItemId: INV.americanCheese, quantity: "0.04", unit: "kg" },
    { menuItemId: MI.loadedFries, inventoryItemId: INV.jalapenos, quantity: "0.015", unit: "kg" },
    { menuItemId: MI.loadedFries, inventoryItemId: INV.cookingOil, quantity: "0.10", unit: "liter" },

    // Onion Rings -> onions 150g, oil 80ml
    { menuItemId: MI.onionRings, inventoryItemId: INV.onions, quantity: "0.15", unit: "kg" },
    { menuItemId: MI.onionRings, inventoryItemId: INV.cookingOil, quantity: "0.08", unit: "liter" },

    // Mac & Cheese Bites -> cheese 50g, oil 60ml
    { menuItemId: MI.macCheeseBites, inventoryItemId: INV.americanCheese, quantity: "0.05", unit: "kg" },
    { menuItemId: MI.macCheeseBites, inventoryItemId: INV.cookingOil, quantity: "0.06", unit: "liter" },

    // Caesar Salad -> lettuce 80g, chicken 100g, cheese 20g, tomatoes 15g
    { menuItemId: MI.caesarSalad, inventoryItemId: INV.lettuce, quantity: "0.08", unit: "kg" },
    { menuItemId: MI.caesarSalad, inventoryItemId: INV.chickenBreast, quantity: "0.10", unit: "kg" },
    { menuItemId: MI.caesarSalad, inventoryItemId: INV.americanCheese, quantity: "0.02", unit: "kg" },
    { menuItemId: MI.caesarSalad, inventoryItemId: INV.tomatoes, quantity: "0.015", unit: "kg" },

    // Garden Salad -> lettuce 100g, tomatoes 50g, onions 20g
    { menuItemId: MI.gardenSalad, inventoryItemId: INV.lettuce, quantity: "0.10", unit: "kg" },
    { menuItemId: MI.gardenSalad, inventoryItemId: INV.tomatoes, quantity: "0.05", unit: "kg" },
    { menuItemId: MI.gardenSalad, inventoryItemId: INV.onions, quantity: "0.02", unit: "kg" },

    // Fresh Lemonade -> lemons 100g
    { menuItemId: MI.freshLemonade, inventoryItemId: INV.freshLemons, quantity: "0.10", unit: "kg" },

    // Mango Smoothie -> mango pulp 150ml
    { menuItemId: MI.mangoSmoothie, inventoryItemId: INV.mangoPulp, quantity: "0.15", unit: "liter" },

    // Iced Americano -> coffee beans 18g
    { menuItemId: MI.icedAmericano, inventoryItemId: INV.coffeeBeans, quantity: "0.018", unit: "kg" },

    // Oreo Milkshake -> ice cream 200ml, chocolate sauce 30ml
    { menuItemId: MI.oreoMilkshake, inventoryItemId: INV.vanillaIceCream, quantity: "0.20", unit: "liter" },
    { menuItemId: MI.oreoMilkshake, inventoryItemId: INV.chocolateSauce, quantity: "0.03", unit: "liter" },

    // Chocolate Brownie -> chocolate sauce 50ml, ice cream 80ml
    { menuItemId: MI.brownie, inventoryItemId: INV.chocolateSauce, quantity: "0.05", unit: "liter" },
    { menuItemId: MI.brownie, inventoryItemId: INV.vanillaIceCream, quantity: "0.08", unit: "liter" },

    // Churros -> oil 40ml, chocolate sauce 30ml
    { menuItemId: MI.churros, inventoryItemId: INV.cookingOil, quantity: "0.04", unit: "liter" },
    { menuItemId: MI.churros, inventoryItemId: INV.chocolateSauce, quantity: "0.03", unit: "liter" },

    // Kids Cheeseburger -> beef 100g, bun 1, cheese 20g, potatoes 100g, oil 50ml
    { menuItemId: MI.kidsCheeseburger, inventoryItemId: INV.beefPatties, quantity: "0.10", unit: "kg" },
    { menuItemId: MI.kidsCheeseburger, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.kidsCheeseburger, inventoryItemId: INV.americanCheese, quantity: "0.02", unit: "kg" },
    { menuItemId: MI.kidsCheeseburger, inventoryItemId: INV.potatoes, quantity: "0.10", unit: "kg" },
    { menuItemId: MI.kidsCheeseburger, inventoryItemId: INV.cookingOil, quantity: "0.05", unit: "liter" },

    // Kids Nuggets -> chicken 150g, potatoes 100g, oil 60ml
    { menuItemId: MI.kidsNuggets, inventoryItemId: INV.chickenBreast, quantity: "0.15", unit: "kg" },
    { menuItemId: MI.kidsNuggets, inventoryItemId: INV.potatoes, quantity: "0.10", unit: "kg" },
    { menuItemId: MI.kidsNuggets, inventoryItemId: INV.cookingOil, quantity: "0.06", unit: "liter" },

    // Smash Combo -> beef 150g, bun 1, cheese 30g, potatoes 200g, lemons 100g, oil 115ml, onions 20g, lettuce 15g, tomato 20g
    { menuItemId: MI.smashCombo, inventoryItemId: INV.beefPatties, quantity: "0.15", unit: "kg" },
    { menuItemId: MI.smashCombo, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.smashCombo, inventoryItemId: INV.americanCheese, quantity: "0.03", unit: "kg" },
    { menuItemId: MI.smashCombo, inventoryItemId: INV.potatoes, quantity: "0.20", unit: "kg" },
    { menuItemId: MI.smashCombo, inventoryItemId: INV.freshLemons, quantity: "0.10", unit: "kg" },
    { menuItemId: MI.smashCombo, inventoryItemId: INV.cookingOil, quantity: "0.115", unit: "liter" },
    { menuItemId: MI.smashCombo, inventoryItemId: INV.onions, quantity: "0.02", unit: "kg" },
    { menuItemId: MI.smashCombo, inventoryItemId: INV.lettuce, quantity: "0.015", unit: "kg" },
    { menuItemId: MI.smashCombo, inventoryItemId: INV.tomatoes, quantity: "0.02", unit: "kg" },

    // Chicken Combo -> chicken 180g, bun 1, potatoes 200g, coffee 18g, lettuce 15g, oil 150ml
    { menuItemId: MI.chickenCombo, inventoryItemId: INV.chickenBreast, quantity: "0.18", unit: "kg" },
    { menuItemId: MI.chickenCombo, inventoryItemId: INV.burgerBuns, quantity: "1", unit: "piece" },
    { menuItemId: MI.chickenCombo, inventoryItemId: INV.potatoes, quantity: "0.20", unit: "kg" },
    { menuItemId: MI.chickenCombo, inventoryItemId: INV.coffeeBeans, quantity: "0.018", unit: "kg" },
    { menuItemId: MI.chickenCombo, inventoryItemId: INV.lettuce, quantity: "0.015", unit: "kg" },
    { menuItemId: MI.chickenCombo, inventoryItemId: INV.cookingOil, quantity: "0.15", unit: "liter" },
  ];

  let recipeCount = 0;
  let recipeErrors = 0;
  for (const r of recipes) {
    const { status } = await api("POST", "/api/recipes", r, token);
    if (status >= 200 && status < 300) recipeCount++;
    else recipeErrors++;
  }
  console.log(`✓ ${recipeCount} Recipes created` + (recipeErrors ? ` (${recipeErrors} errors)` : ""));

  // ===== 2. UPDATE RESTAURANT WITH LOGO & FULL DATA =====
  const { status: restStatus } = await api("PUT", "/api/restaurant", {
    nameEn: "Burger House",
    nameAr: "بيت البرجر",
    descriptionEn: "Premium handcrafted burgers with 100% fresh Angus beef. Serving Riyadh's best smash burgers since 2020. Dine-in, takeaway & delivery available daily from 11 AM to 1 AM.",
    descriptionAr: "برجر فاخر مصنوع يدوياً من لحم أنقس طازج 100%. نقدم أفضل سماش برجر في الرياض منذ 2020. نستقبلكم داخل المطعم أو استلام أو توصيل يومياً من 11 صباحاً حتى 1 بعد منتصف الليل.",
    logo: "https://img.freepik.com/free-vector/hand-drawn-burger-logo-template_23-2149459738.jpg",
    banner: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&h=400&fit=crop&q=80",
    address: "طريق الملك فهد، حي العليا، الرياض 12211، المملكة العربية السعودية",
    phone: "+966501234567",
    whatsapp: "+966501234567",
    email: "info@burgerhouse.sa",
    openingTime: "11:00",
    closingTime: "01:00",
    serviceDineIn: true,
    servicePickup: true,
    serviceDelivery: true,
    serviceTableBooking: true,
    serviceQueue: true,
    taxEnabled: true,
    taxRate: "15.00",
    vatNumber: "300012345600003",
    commercialRegistration: "1010012345",
    commercialRegistrationName: "شركة بيت البرجر للمطاعم",
    shortAddress: "RIYD1234",
    registrationType: "CRN",
    industry: "Food",
    invoiceType: "1100",
    postalCode: "12211",
    buildingNumber: "4532",
    streetName: "طريق الملك فهد",
    district: "العليا",
    city: "الرياض",
    ownerName: "أحمد بن عبدالله المالكي",
    ownerPhone: "+966501234567",
    bankName: "البنك الأهلي السعودي",
    bankAccountHolder: "شركة بيت البرجر للمطاعم",
    bankAccountNumber: "SA0310000012345678901",
    bankSwift: "NCBKSAJE",
    bankIban: "SA0310000012345678901",
    socialInstagram: "burgerhouse_sa",
    socialTwitter: "burgerhouse_sa",
    socialTiktok: "burgerhouse_sa",
    socialSnapchat: "burgerhouse_sa",
    socialFacebook: "burgerhousesa",
    menuHeaderType: "logo_banner",
    menuThemeColor: "#DC2626",
    menuDisplayStyle: "grid",
    reservationDuration: 60,
    reservationDepositAmount: "25.00",
    reservationDepositRequired: true,
    kitchenType: "fast_food",
    priceRange: "$$",
    currency: "SAR",
    timezone: "Asia/Riyadh",
    language: "ar",
  }, token);
  console.log("✓ Restaurant details updated with logo & full data (status:", restStatus, ")");

  // ===== 3. UPDATE RESTAURANT SLUG =====
  const { status: slugStatus } = await api("PUT", "/api/restaurant/slug", {
    slug: "burgerhouse"
  }, token);
  console.log("✓ Restaurant slug set to 'burgerhouse' (status:", slugStatus, ")");

  // Summary
  console.log("\n========================================");
  console.log("  ✅ All Data Updated!");
  console.log("========================================");
  console.log(`\n📦 Added:`);
  console.log(`  • ${recipeCount} Recipes linking menu items → inventory`);
  console.log(`  • Logo (burger vector) + Banner (burger photo)`);
  console.log(`  • Full restaurant info (VAT, CR, bank, address, social, services)`);
  console.log(`  • Slug: burgerhouse`);
  console.log(`\n🔗 Public Menu: https://tryingpos.com/menu/burgerhouse`);
}

main().catch(console.error);
