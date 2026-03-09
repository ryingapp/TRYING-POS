const BASE = "http://127.0.0.1:5000";

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text.substring(0, 150) };
  }
}

async function main() {
  const { data: login } = await api("POST", "/api/auth/login", {
    email: "demo@burgerhouse.sa",
    password: "Demo@2026",
  });
  if (!login.token) {
    console.log("Login failed:", JSON.stringify(login).substring(0, 200));
    return;
  }
  const token = login.token;
  console.log("Logged in OK");

  const MI = {
    classicSmash: "cfcc2d9c-40ed-4c1c-a576-218c6279fc5c",
    doubleSmash: "7b7daf3b-47f8-4f56-af28-d8894e79cf2d",
    mushroomSwiss: "37e89054-fee6-4c96-b5b2-c0bf09048227",
    spicyJalapeno: "2391861c-9ba7-4848-a6a6-6346622b1876",
    wagyuTruffle: "d166ae70-2a6b-4031-bbd2-da20dc28b0bf",
    crispyChicken: "583cc5bf-eac0-4c4b-847d-4e29d6b45a3a",
    grilledChicken: "6d31672e-3fa8-4d24-a203-35ffe9c6d265",
    nashvilleHot: "86ac68ed-ff1a-4169-8784-ecd7ae5ab69b",
    chickenTenders: "5f1c0765-1f8c-4a0d-8e9c-c52111c1b031",
    classicFries: "8e934917-4294-45e3-8bc4-ec9e7a1a8195",
    loadedFries: "8b7a5077-bbb3-45db-afe5-db3a0da12544",
    onionRings: "f0017f98-d6fa-4a6a-9ab3-dae811f17ed4",
    macCheeseBites: "bae66958-d69a-4a6b-b13d-831d9aef4221",
    caesarSalad: "2b7fc510-d6d6-4f33-9a3c-c66cf191f0af",
    gardenSalad: "513fe1dc-b6ad-4f52-865c-954c742ecef9",
    freshLemonade: "efc1318e-1ca3-48e0-abd5-c83e97aaecd1",
    mangoSmoothie: "d7d2d667-011d-4f20-a18e-e17f7516ced2",
    icedAmericano: "d1690705-0fe1-4e03-a3c9-1eee08a11a02",
    oreoMilkshake: "01ad0bb0-2cf1-493e-a4df-af4948737a08",
    brownie: "6b51d6e2-f899-4895-9b55-493178bc388d",
    churros: "a606a15f-3cb3-49c3-a56a-0ad8457fabdd",
    kidsCheeseburger: "82acb778-8fd4-4963-a3b6-a98f28116135",
    kidsNuggets: "ac5eb3af-f0b3-4fee-871c-1fe316e3348f",
    smashCombo: "314124cf-97cd-49a3-8df0-28ba8848629f",
    chickenCombo: "4a7868d9-e317-4df3-94ed-c221c58147ab",
  };

  const INV = {
    americanCheese: "2111aab9-109f-4f37-88ff-0c982b463efe",
    beefPatties: "7043a760-bb03-42a9-99a4-36457d315df7",
    burgerBuns: "6d21f577-fedf-4461-aa35-eb11ff0d5e00",
    chickenBreast: "9fb3067f-eb1b-4133-af95-c432c05737d4",
    chocolateSauce: "245cbc3e-59c8-4cef-b40c-72284486117a",
    coffeeBeans: "4e23c1fb-6398-4127-ab2b-920d41617f0b",
    cookingOil: "f557db28-8ee8-47dd-9531-3b81e4280187",
    freshLemons: "93d40de8-b52d-4562-a04c-c4f168c10f61",
    jalapenos: "a04b920e-4c60-465a-9649-b61f753af8be",
    lettuce: "cd1b18ed-2e71-4872-bab2-3bf7e42a4b77",
    mangoPulp: "43ff442c-9ff9-4cf9-9bf3-2128c91d4ce1",
    mushrooms: "bad81752-940e-408c-b80e-7805d17e02f1",
    onions: "c38596a6-1248-4625-ac82-b3c74b506b3e",
    potatoes: "7be592ed-0ab6-4e3e-b1a2-45532672463a",
    swissCheese: "207274fe-6577-444b-9ec4-bcf99760ad94",
    vanillaIceCream: "9365eb10-ab99-448f-b161-e8669e03c92d",
    wagyuBeef: "7678a90b-0028-4b86-b4a8-d1c29433f358",
  };

  const recipes = [
    { m: MI.classicSmash, i: INV.beefPatties, q: "0.15", u: "kg" },
    { m: MI.classicSmash, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.classicSmash, i: INV.americanCheese, q: "0.03", u: "kg" },
    { m: MI.classicSmash, i: INV.onions, q: "0.02", u: "kg" },
    { m: MI.classicSmash, i: INV.lettuce, q: "0.015", u: "kg" },
    { m: MI.classicSmash, i: INV.cookingOil, q: "0.015", u: "liter" },
    { m: MI.doubleSmash, i: INV.beefPatties, q: "0.30", u: "kg" },
    { m: MI.doubleSmash, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.doubleSmash, i: INV.americanCheese, q: "0.06", u: "kg" },
    { m: MI.doubleSmash, i: INV.onions, q: "0.03", u: "kg" },
    { m: MI.doubleSmash, i: INV.cookingOil, q: "0.02", u: "liter" },
    { m: MI.mushroomSwiss, i: INV.beefPatties, q: "0.15", u: "kg" },
    { m: MI.mushroomSwiss, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.mushroomSwiss, i: INV.swissCheese, q: "0.04", u: "kg" },
    { m: MI.mushroomSwiss, i: INV.mushrooms, q: "0.05", u: "kg" },
    { m: MI.mushroomSwiss, i: INV.cookingOil, q: "0.015", u: "liter" },
    { m: MI.spicyJalapeno, i: INV.beefPatties, q: "0.15", u: "kg" },
    { m: MI.spicyJalapeno, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.spicyJalapeno, i: INV.americanCheese, q: "0.03", u: "kg" },
    { m: MI.spicyJalapeno, i: INV.jalapenos, q: "0.02", u: "kg" },
    { m: MI.spicyJalapeno, i: INV.onions, q: "0.025", u: "kg" },
    { m: MI.spicyJalapeno, i: INV.cookingOil, q: "0.02", u: "liter" },
    { m: MI.wagyuTruffle, i: INV.wagyuBeef, q: "0.20", u: "kg" },
    { m: MI.wagyuTruffle, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.wagyuTruffle, i: INV.americanCheese, q: "0.04", u: "kg" },
    { m: MI.wagyuTruffle, i: INV.onions, q: "0.025", u: "kg" },
    { m: MI.wagyuTruffle, i: INV.lettuce, q: "0.015", u: "kg" },
    { m: MI.wagyuTruffle, i: INV.cookingOil, q: "0.015", u: "liter" },
    { m: MI.crispyChicken, i: INV.chickenBreast, q: "0.18", u: "kg" },
    { m: MI.crispyChicken, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.crispyChicken, i: INV.lettuce, q: "0.015", u: "kg" },
    { m: MI.crispyChicken, i: INV.cookingOil, q: "0.05", u: "liter" },
    { m: MI.grilledChicken, i: INV.chickenBreast, q: "0.18", u: "kg" },
    { m: MI.grilledChicken, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.grilledChicken, i: INV.lettuce, q: "0.02", u: "kg" },
    { m: MI.nashvilleHot, i: INV.chickenBreast, q: "0.20", u: "kg" },
    { m: MI.nashvilleHot, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.nashvilleHot, i: INV.cookingOil, q: "0.06", u: "liter" },
    { m: MI.chickenTenders, i: INV.chickenBreast, q: "0.25", u: "kg" },
    { m: MI.chickenTenders, i: INV.cookingOil, q: "0.08", u: "liter" },
    { m: MI.classicFries, i: INV.potatoes, q: "0.20", u: "kg" },
    { m: MI.classicFries, i: INV.cookingOil, q: "0.10", u: "liter" },
    { m: MI.loadedFries, i: INV.potatoes, q: "0.20", u: "kg" },
    { m: MI.loadedFries, i: INV.americanCheese, q: "0.04", u: "kg" },
    { m: MI.loadedFries, i: INV.jalapenos, q: "0.015", u: "kg" },
    { m: MI.loadedFries, i: INV.cookingOil, q: "0.10", u: "liter" },
    { m: MI.onionRings, i: INV.onions, q: "0.15", u: "kg" },
    { m: MI.onionRings, i: INV.cookingOil, q: "0.08", u: "liter" },
    { m: MI.macCheeseBites, i: INV.americanCheese, q: "0.05", u: "kg" },
    { m: MI.macCheeseBites, i: INV.cookingOil, q: "0.06", u: "liter" },
    { m: MI.caesarSalad, i: INV.lettuce, q: "0.08", u: "kg" },
    { m: MI.caesarSalad, i: INV.chickenBreast, q: "0.10", u: "kg" },
    { m: MI.caesarSalad, i: INV.americanCheese, q: "0.02", u: "kg" },
    { m: MI.gardenSalad, i: INV.lettuce, q: "0.10", u: "kg" },
    { m: MI.gardenSalad, i: INV.onions, q: "0.02", u: "kg" },
    { m: MI.freshLemonade, i: INV.freshLemons, q: "0.10", u: "kg" },
    { m: MI.mangoSmoothie, i: INV.mangoPulp, q: "0.15", u: "liter" },
    { m: MI.icedAmericano, i: INV.coffeeBeans, q: "0.018", u: "kg" },
    { m: MI.oreoMilkshake, i: INV.vanillaIceCream, q: "0.20", u: "liter" },
    { m: MI.oreoMilkshake, i: INV.chocolateSauce, q: "0.03", u: "liter" },
    { m: MI.brownie, i: INV.chocolateSauce, q: "0.05", u: "liter" },
    { m: MI.brownie, i: INV.vanillaIceCream, q: "0.08", u: "liter" },
    { m: MI.churros, i: INV.cookingOil, q: "0.04", u: "liter" },
    { m: MI.churros, i: INV.chocolateSauce, q: "0.03", u: "liter" },
    { m: MI.kidsCheeseburger, i: INV.beefPatties, q: "0.10", u: "kg" },
    { m: MI.kidsCheeseburger, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.kidsCheeseburger, i: INV.americanCheese, q: "0.02", u: "kg" },
    { m: MI.kidsCheeseburger, i: INV.potatoes, q: "0.10", u: "kg" },
    { m: MI.kidsCheeseburger, i: INV.cookingOil, q: "0.05", u: "liter" },
    { m: MI.kidsNuggets, i: INV.chickenBreast, q: "0.15", u: "kg" },
    { m: MI.kidsNuggets, i: INV.potatoes, q: "0.10", u: "kg" },
    { m: MI.kidsNuggets, i: INV.cookingOil, q: "0.06", u: "liter" },
    { m: MI.smashCombo, i: INV.beefPatties, q: "0.15", u: "kg" },
    { m: MI.smashCombo, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.smashCombo, i: INV.americanCheese, q: "0.03", u: "kg" },
    { m: MI.smashCombo, i: INV.potatoes, q: "0.20", u: "kg" },
    { m: MI.smashCombo, i: INV.freshLemons, q: "0.10", u: "kg" },
    { m: MI.smashCombo, i: INV.cookingOil, q: "0.115", u: "liter" },
    { m: MI.chickenCombo, i: INV.chickenBreast, q: "0.18", u: "kg" },
    { m: MI.chickenCombo, i: INV.burgerBuns, q: "1", u: "piece" },
    { m: MI.chickenCombo, i: INV.potatoes, q: "0.20", u: "kg" },
    { m: MI.chickenCombo, i: INV.coffeeBeans, q: "0.018", u: "kg" },
    { m: MI.chickenCombo, i: INV.lettuce, q: "0.015", u: "kg" },
    { m: MI.chickenCombo, i: INV.cookingOil, q: "0.15", u: "liter" },
  ];

  let ok = 0,
    fail = 0;
  for (const r of recipes) {
    const { status } = await api(
      "POST",
      "/api/recipes",
      {
        menuItemId: r.m,
        inventoryItemId: r.i,
        quantity: r.q,
        unit: r.u,
      },
      token,
    );
    if (status >= 200 && status < 300) ok++;
    else fail++;
  }
  console.log("Recipes:", ok, "ok,", fail, "failed");

  // Update restaurant with logo and description
  const { status: rs } = await api(
    "PUT",
    "/api/restaurant",
    {
      logo: "https://img.freepik.com/free-vector/hand-drawn-burger-logo-template_23-2149459738.jpg",
      banner:
        "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&h=400&fit=crop&q=80",
      descriptionEn:
        "Premium handcrafted burgers with 100% fresh Angus beef. Serving Riyadh best smash burgers since 2020.",
      descriptionAr:
        "برجر فاخر مصنوع يدويا من لحم انقس طازج. نقدم افضل سماش برجر في الرياض منذ 2020.",
    },
    token,
  );
  console.log("Restaurant update:", rs);

  // Set slug
  const { status: ss } = await api(
    "PUT",
    "/api/restaurant/slug",
    { slug: "burgerhouse" },
    token,
  );
  console.log("Slug update:", ss);
}

main();
