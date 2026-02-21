import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres:UVNPULADUy09n0jS@db.lwfcttkqqejzvdfzauwv.supabase.co:5432/postgres",
});

async function main() {
  // 1. Find restaurant for dd@dd.com
  const userResult = await pool.query(
    "SELECT u.restaurant_id, r.name_en, r.name_ar FROM users u JOIN restaurants r ON r.id = u.restaurant_id WHERE u.email = $1",
    ["dd@dd.com"]
  );
  
  if (userResult.rows.length === 0) {
    console.error("No restaurant found for dd@dd.com");
    await pool.end();
    return;
  }
  
  const restaurantId = userResult.rows[0].restaurant_id;
  console.log(`Found restaurant: ${userResult.rows[0].name_en} (${userResult.rows[0].name_ar}), ID: ${restaurantId}`);

  // 2. Delete existing categories and menu items for this restaurant
  // First delete order_items that reference menu_items, then invoices, then orders
  const oldMenuItems = await pool.query("SELECT id FROM menu_items WHERE restaurant_id = $1", [restaurantId]);
  const oldItemIds = oldMenuItems.rows.map((r: any) => r.id);
  
  if (oldItemIds.length > 0) {
    // Delete order_items referencing old menu items
    await pool.query("DELETE FROM order_items WHERE menu_item_id = ANY($1)", [oldItemIds]);
    console.log("Cleared old order items");
  }
  
  // Delete old orders for this restaurant
  const oldOrders = await pool.query("SELECT id FROM orders WHERE restaurant_id = $1", [restaurantId]);
  const oldOrderIds = oldOrders.rows.map((r: any) => r.id);
  if (oldOrderIds.length > 0) {
    await pool.query("DELETE FROM invoices WHERE order_id = ANY($1)", [oldOrderIds]);
    await pool.query("DELETE FROM orders WHERE restaurant_id = $1", [restaurantId]);
    console.log("Cleared old orders and invoices");
  }

  // Now safe to delete menu items and categories
  await pool.query("DELETE FROM menu_items WHERE restaurant_id = $1", [restaurantId]);
  await pool.query("DELETE FROM categories WHERE restaurant_id = $1", [restaurantId]);
  console.log("Cleared existing menu items and categories");

  // 3. Create categories based on Washel Menu PDF
  const categoriesData = [
    { nameEn: "Washel Specials", nameAr: "واصل سبيشل", sortOrder: 1 },
    { nameEn: "Burgers", nameAr: "برجر", sortOrder: 2 },
    { nameEn: "Sandwiches", nameAr: "ساندويتشات", sortOrder: 3 },
    { nameEn: "Wraps", nameAr: "رابات", sortOrder: 4 },
    { nameEn: "Sides", nameAr: "إضافات", sortOrder: 5 },
    { nameEn: "Drinks", nameAr: "مشروبات", sortOrder: 6 },
    { nameEn: "Mojitos", nameAr: "موهيتو", sortOrder: 7 },
    { nameEn: "Milkshakes", nameAr: "ميلك شيك", sortOrder: 8 },
    { nameEn: "Kids Meals", nameAr: "وجبات أطفال", sortOrder: 9 },
  ];

  const categoryIds: Record<string, string> = {};
  for (const cat of categoriesData) {
    const result = await pool.query(
      "INSERT INTO categories (restaurant_id, name_en, name_ar, sort_order, is_active) VALUES ($1, $2, $3, $4, true) RETURNING id",
      [restaurantId, cat.nameEn, cat.nameAr, cat.sortOrder]
    );
    categoryIds[cat.nameEn] = result.rows[0].id;
    console.log(`Created category: ${cat.nameEn} (${cat.nameAr}) -> ${result.rows[0].id}`);
  }

  // 4. Create menu items based on Washel Menu PDF
  const menuItemsData = [
    // === Washel Specials ===
    {
      category: "Washel Specials",
      nameEn: "Washel Meal",
      nameAr: "وجبة واصل",
      descriptionEn: "Washel's signature meal with special sauce",
      descriptionAr: "وجبة واصل المميزة مع صوص خاص",
      price: "32.00",
      calories: 750,
      image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
    },
    {
      category: "Washel Specials",
      nameEn: "Washel Combo",
      nameAr: "كومبو واصل",
      descriptionEn: "Complete combo with fries and drink",
      descriptionAr: "كومبو كامل مع بطاطس ومشروب",
      price: "38.00",
      calories: 950,
      image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400",
    },
    {
      category: "Washel Specials",
      nameEn: "Super Washel",
      nameAr: "سوبر واصل",
      descriptionEn: "Double patty with cheese and special toppings",
      descriptionAr: "دبل باتي مع جبن وإضافات خاصة",
      price: "42.00",
      calories: 1100,
      image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400",
    },

    // === Burgers ===
    {
      category: "Burgers",
      nameEn: "Classic Burger",
      nameAr: "كلاسيك برجر",
      descriptionEn: "Beef patty with lettuce, tomato, onion and special sauce",
      descriptionAr: "باتي لحم مع خس وطماطم وبصل وصوص خاص",
      price: "25.00",
      calories: 650,
      image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400",
    },
    {
      category: "Burgers",
      nameEn: "Cheese Burger",
      nameAr: "تشيز برجر",
      descriptionEn: "Beef patty with cheddar cheese, lettuce, tomato and pickles",
      descriptionAr: "باتي لحم مع جبن شيدر وخس وطماطم ومخلل",
      price: "28.00",
      calories: 720,
      image: "https://images.unsplash.com/photo-1550317138-10000687a72b?w=400",
    },
    {
      category: "Burgers",
      nameEn: "Double Cheese Burger",
      nameAr: "دبل تشيز برجر",
      descriptionEn: "Double beef patty with double cheddar cheese",
      descriptionAr: "دبل باتي لحم مع دبل جبن شيدر",
      price: "35.00",
      calories: 980,
      image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400",
    },
    {
      category: "Burgers",
      nameEn: "Mushroom Burger",
      nameAr: "مشروم برجر",
      descriptionEn: "Beef patty with sautéed mushrooms and Swiss cheese",
      descriptionAr: "باتي لحم مع مشروم سوتيه وجبن سويسري",
      price: "30.00",
      calories: 700,
      image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=400",
    },
    {
      category: "Burgers",
      nameEn: "Chicken Burger",
      nameAr: "تشيكن برجر",
      descriptionEn: "Crispy chicken fillet with lettuce, mayo and pickles",
      descriptionAr: "فيليه دجاج مقرمش مع خس ومايونيز ومخلل",
      price: "26.00",
      calories: 620,
      image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400",
    },
    {
      category: "Burgers",
      nameEn: "Spicy Burger",
      nameAr: "سبايسي برجر",
      descriptionEn: "Spicy beef patty with jalapeños, pepper jack cheese",
      descriptionAr: "باتي لحم حار مع هالابينو وجبن فلفل",
      price: "29.00",
      calories: 680,
      isSpicy: true,
      image: "https://images.unsplash.com/photo-1625813506062-0aeb1571a42b?w=400",
    },
    {
      category: "Burgers",
      nameEn: "BBQ Burger",
      nameAr: "باربكيو برجر",
      descriptionEn: "Beef patty with BBQ sauce, crispy onion rings and cheddar",
      descriptionAr: "باتي لحم مع صوص باربكيو وحلقات بصل مقرمشة وشيدر",
      price: "31.00",
      calories: 800,
      image: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400",
    },

    // === Sandwiches ===
    {
      category: "Sandwiches",
      nameEn: "Club Sandwich",
      nameAr: "كلوب ساندويتش",
      descriptionEn: "Triple-decker with chicken, bacon, lettuce, tomato and mayo",
      descriptionAr: "ساندويتش ثلاثي مع دجاج وبيكن وخس وطماطم ومايونيز",
      price: "28.00",
      calories: 650,
      image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400",
    },
    {
      category: "Sandwiches",
      nameEn: "Grilled Chicken Sandwich",
      nameAr: "ساندويتش دجاج مشوي",
      descriptionEn: "Grilled chicken breast with lettuce, tomato and garlic sauce",
      descriptionAr: "صدر دجاج مشوي مع خس وطماطم وصوص ثوم",
      price: "24.00",
      calories: 480,
      image: "https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?w=400",
    },
    {
      category: "Sandwiches",
      nameEn: "Philly Cheese Steak",
      nameAr: "فيلي تشيز ستيك",
      descriptionEn: "Sliced steak with melted cheese, peppers and onions",
      descriptionAr: "شرائح ستيك مع جبن ذايب وفلفل وبصل",
      price: "33.00",
      calories: 720,
      image: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400",
    },
    {
      category: "Sandwiches",
      nameEn: "Crispy Chicken Sandwich",
      nameAr: "ساندويتش دجاج كرسبي",
      descriptionEn: "Crispy fried chicken with coleslaw and spicy mayo",
      descriptionAr: "دجاج مقلي مقرمش مع كول سلو ومايونيز حار",
      price: "25.00",
      calories: 580,
      image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400",
    },

    // === Wraps ===
    {
      category: "Wraps",
      nameEn: "Chicken Wrap",
      nameAr: "راب دجاج",
      descriptionEn: "Grilled chicken with vegetables and garlic sauce in tortilla",
      descriptionAr: "دجاج مشوي مع خضار وصوص ثوم في تورتيلا",
      price: "22.00",
      calories: 450,
      image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400",
    },
    {
      category: "Wraps",
      nameEn: "Beef Wrap",
      nameAr: "راب لحم",
      descriptionEn: "Seasoned beef strips with onions, peppers in tortilla",
      descriptionAr: "شرائح لحم متبلة مع بصل وفلفل في تورتيلا",
      price: "25.00",
      calories: 520,
      image: "https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=400",
    },
    {
      category: "Wraps",
      nameEn: "Falafel Wrap",
      nameAr: "راب فلافل",
      descriptionEn: "Crispy falafel with tahini, pickles and vegetables",
      descriptionAr: "فلافل مقرمشة مع طحينة ومخلل وخضار",
      price: "18.00",
      calories: 380,
      isVegetarian: true,
      image: "https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=400",
    },
    {
      category: "Wraps",
      nameEn: "Shawarma Wrap",
      nameAr: "راب شاورما",
      descriptionEn: "Marinated chicken shawarma with garlic and pickles",
      descriptionAr: "شاورما دجاج متبلة مع ثوم ومخلل",
      price: "20.00",
      calories: 490,
      image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400",
    },

    // === Sides ===
    {
      category: "Sides",
      nameEn: "French Fries",
      nameAr: "بطاطس مقلية",
      descriptionEn: "Golden crispy french fries",
      descriptionAr: "بطاطس مقلية ذهبية مقرمشة",
      price: "10.00",
      calories: 320,
      isVegetarian: true,
      image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400",
    },
    {
      category: "Sides",
      nameEn: "Cheese Fries",
      nameAr: "بطاطس بالجبن",
      descriptionEn: "French fries topped with melted cheddar cheese",
      descriptionAr: "بطاطس مقلية مع جبن شيدر ذايب",
      price: "14.00",
      calories: 450,
      isVegetarian: true,
      image: "https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400",
    },
    {
      category: "Sides",
      nameEn: "Onion Rings",
      nameAr: "حلقات بصل",
      descriptionEn: "Crispy golden onion rings",
      descriptionAr: "حلقات بصل مقرمشة ذهبية",
      price: "12.00",
      calories: 280,
      isVegetarian: true,
      image: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400",
    },
    {
      category: "Sides",
      nameEn: "Chicken Nuggets",
      nameAr: "ناجتس دجاج",
      descriptionEn: "6 pieces of crispy chicken nuggets",
      descriptionAr: "٦ قطع ناجتس دجاج مقرمشة",
      price: "15.00",
      calories: 350,
      image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400",
    },
    {
      category: "Sides",
      nameEn: "Coleslaw",
      nameAr: "كول سلو",
      descriptionEn: "Fresh creamy coleslaw",
      descriptionAr: "كول سلو طازج كريمي",
      price: "8.00",
      calories: 150,
      isVegetarian: true,
      image: "https://images.unsplash.com/photo-1625938145744-e380515399bf?w=400",
    },
    {
      category: "Sides",
      nameEn: "Mozzarella Sticks",
      nameAr: "أصابع موزاريلا",
      descriptionEn: "Crispy fried mozzarella sticks with marinara sauce",
      descriptionAr: "أصابع موزاريلا مقلية مقرمشة مع صوص مارينارا",
      price: "16.00",
      calories: 400,
      isVegetarian: true,
      image: "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400",
    },

    // === Drinks ===
    {
      category: "Drinks",
      nameEn: "Pepsi",
      nameAr: "بيبسي",
      descriptionEn: "Cold Pepsi can",
      descriptionAr: "علبة بيبسي باردة",
      price: "5.00",
      calories: 150,
      image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400",
    },
    {
      category: "Drinks",
      nameEn: "7Up",
      nameAr: "سفن أب",
      descriptionEn: "Cold 7Up can",
      descriptionAr: "علبة سفن أب باردة",
      price: "5.00",
      calories: 140,
      image: "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400",
    },
    {
      category: "Drinks",
      nameEn: "Miranda",
      nameAr: "ميرندا",
      descriptionEn: "Cold Miranda orange can",
      descriptionAr: "علبة ميرندا برتقال باردة",
      price: "5.00",
      calories: 160,
      image: "https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=400",
    },
    {
      category: "Drinks",
      nameEn: "Water",
      nameAr: "ماء",
      descriptionEn: "Bottled water",
      descriptionAr: "مياه معبأة",
      price: "3.00",
      calories: 0,
      image: "https://images.unsplash.com/photo-1560023907-5f339617ea55?w=400",
    },

    // === Mojitos ===
    {
      category: "Mojitos",
      nameEn: "Classic Mojito",
      nameAr: "موهيتو كلاسيك",
      descriptionEn: "Fresh mint, lime and soda",
      descriptionAr: "نعناع طازج وليمون وصودا",
      price: "18.00",
      calories: 120,
      image: "https://images.unsplash.com/photo-1546171753-97d7676e4602?w=400",
    },
    {
      category: "Mojitos",
      nameEn: "Strawberry Mojito",
      nameAr: "موهيتو فراولة",
      descriptionEn: "Fresh strawberry with mint and lime",
      descriptionAr: "فراولة طازجة مع نعناع وليمون",
      price: "20.00",
      calories: 150,
      image: "https://images.unsplash.com/photo-1497534446932-c925b458314e?w=400",
    },
    {
      category: "Mojitos",
      nameEn: "Passion Fruit Mojito",
      nameAr: "موهيتو باشن فروت",
      descriptionEn: "Passion fruit with mint, lime and soda",
      descriptionAr: "باشن فروت مع نعناع وليمون وصودا",
      price: "20.00",
      calories: 140,
      image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400",
    },
    {
      category: "Mojitos",
      nameEn: "Blue Mojito",
      nameAr: "موهيتو ازرق",
      descriptionEn: "Blue curacao with mint, lime and soda",
      descriptionAr: "بلو كوراساو مع نعناع وليمون وصودا",
      price: "20.00",
      calories: 160,
      image: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400",
    },
    {
      category: "Mojitos",
      nameEn: "Mango Mojito",
      nameAr: "موهيتو مانجو",
      descriptionEn: "Fresh mango with mint and lime",
      descriptionAr: "مانجو طازج مع نعناع وليمون",
      price: "20.00",
      calories: 155,
      image: "https://images.unsplash.com/photo-1546173159-315724a31696?w=400",
    },

    // === Milkshakes ===
    {
      category: "Milkshakes",
      nameEn: "Chocolate Milkshake",
      nameAr: "ميلك شيك شوكولاتة",
      descriptionEn: "Rich chocolate milkshake with whipped cream",
      descriptionAr: "ميلك شيك شوكولاتة غني مع كريمة مخفوقة",
      price: "22.00",
      calories: 480,
      image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400",
    },
    {
      category: "Milkshakes",
      nameEn: "Vanilla Milkshake",
      nameAr: "ميلك شيك فانيلا",
      descriptionEn: "Classic vanilla milkshake with whipped cream",
      descriptionAr: "ميلك شيك فانيلا كلاسيكي مع كريمة مخفوقة",
      price: "20.00",
      calories: 420,
      image: "https://images.unsplash.com/photo-1577805947697-89340c5ab1d5?w=400",
    },
    {
      category: "Milkshakes",
      nameEn: "Strawberry Milkshake",
      nameAr: "ميلك شيك فراولة",
      descriptionEn: "Fresh strawberry milkshake with whipped cream",
      descriptionAr: "ميلك شيك فراولة طازجة مع كريمة مخفوقة",
      price: "22.00",
      calories: 440,
      image: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400",
    },
    {
      category: "Milkshakes",
      nameEn: "Oreo Milkshake",
      nameAr: "ميلك شيك أوريو",
      descriptionEn: "Cookies and cream milkshake with Oreo crumbs",
      descriptionAr: "ميلك شيك كوكيز آند كريم مع فتات أوريو",
      price: "24.00",
      calories: 520,
      image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400",
    },
    {
      category: "Milkshakes",
      nameEn: "Lotus Milkshake",
      nameAr: "ميلك شيك لوتس",
      descriptionEn: "Lotus biscoff milkshake with caramel drizzle",
      descriptionAr: "ميلك شيك لوتس بسكوف مع كراميل",
      price: "24.00",
      calories: 540,
      image: "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=400",
    },

    // === Kids Meals ===
    {
      category: "Kids Meals",
      nameEn: "Kids Burger Meal",
      nameAr: "وجبة برجر أطفال",
      descriptionEn: "Small burger with fries and juice",
      descriptionAr: "برجر صغير مع بطاطس وعصير",
      price: "18.00",
      calories: 450,
      image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400",
    },
    {
      category: "Kids Meals",
      nameEn: "Kids Nuggets Meal",
      nameAr: "وجبة ناجتس أطفال",
      descriptionEn: "4 chicken nuggets with fries and juice",
      descriptionAr: "٤ قطع ناجتس دجاج مع بطاطس وعصير",
      price: "16.00",
      calories: 380,
      image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400",
    },
    {
      category: "Kids Meals",
      nameEn: "Kids Chicken Sandwich Meal",
      nameAr: "وجبة ساندويتش دجاج أطفال",
      descriptionEn: "Small chicken sandwich with fries and juice",
      descriptionAr: "ساندويتش دجاج صغير مع بطاطس وعصير",
      price: "17.00",
      calories: 400,
      image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400",
    },
  ];

  let count = 0;
  for (const item of menuItemsData) {
    const catId = categoryIds[item.category];
    await pool.query(
      `INSERT INTO menu_items (restaurant_id, category_id, name_en, name_ar, description_en, description_ar, price, calories, is_available, sort_order, is_spicy, is_vegetarian, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, $12)`,
      [
        restaurantId,
        catId,
        item.nameEn,
        item.nameAr,
        item.descriptionEn,
        item.descriptionAr,
        item.price,
        item.calories || null,
        count + 1,
        (item as any).isSpicy || false,
        (item as any).isVegetarian || false,
        (item as any).image || null,
      ]
    );
    count++;
    console.log(`  Added: ${item.nameEn} (${item.nameAr}) - ${item.price} SAR`);
  }

  console.log(`\nDone! Added ${categoriesData.length} categories and ${count} menu items to restaurant ${restaurantId}`);
  await pool.end();
}

main().catch(console.error);
