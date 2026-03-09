/**
 * Seed a full demo restaurant with complete data
 * Run: node script/seed-demo-restaurant.cjs
 */

const BASE = "https://tryingpos.com";

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function main() {
  console.log("=== Creating Demo Restaurant ===\n");

  // 1. Register owner
  const reg = await api("POST", "/api/users/register", {
    email: "demo@burgerhouse.sa",
    password: "Demo@2026",
    name: "أحمد المالكي",
    restaurantName: "Burger House",
  });

  if (reg.error) {
    console.error("Registration failed:", reg.error);
    // Try login instead
    const login = await api("POST", "/api/users/login", {
      email: "demo@burgerhouse.sa",
      password: "Demo@2026",
    });
    if (login.error) { console.error("Login also failed:", login.error); process.exit(1); }
    var token = login.token;
    var restaurantId = login.user.restaurantId;
    console.log("Logged in with existing account");
  } else {
    var token = reg.token;
    var restaurantId = reg.user.restaurantId;
    console.log("✓ Owner registered: demo@burgerhouse.sa");
  }

  // 2. Update restaurant with full details
  await api("PUT", "/api/restaurant", {
    nameEn: "Burger House",
    nameAr: "بيت البرجر",
    descriptionEn: "Premium handcrafted burgers with fresh ingredients. Serving Riyadh since 2020.",
    descriptionAr: "برجر فاخر مصنوع يدوياً من أجود المكونات الطازجة. نخدم الرياض منذ 2020.",
    address: "طريق الملك فهد، حي العليا، الرياض 12211",
    phone: "+966501234567",
    whatsapp: "+966501234567",
    email: "info@burgerhouse.sa",
    kitchenType: "fast_food",
    priceRange: "$$",
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
    ownerName: "أحمد المالكي",
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
    menuThemeColor: "red",
    menuDisplayStyle: "grid",
    reservationDuration: 60,
    reservationDepositAmount: "25.00",
    reservationDepositRequired: true,
    logo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop",
    banner: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&h=400&fit=crop",
  }, token);
  console.log("✓ Restaurant details updated");

  // 3. Create additional branch
  const branch2 = await api("POST", "/api/branches", {
    name: "Tahlia Branch",
    nameAr: "فرع التحلية",
    address: "شارع التحلية، حي السليمانية، الرياض",
    phone: "+966509876543",
    openingTime: "11:00",
    closingTime: "02:00",
    isActive: true,
  }, token);
  console.log("✓ Second branch created");

  // 4. Create kitchen sections
  const sections = [
    { nameEn: "Grill Station", nameAr: "محطة الشوي", icon: "🔥", color: "#DC2626" },
    { nameEn: "Frying Station", nameAr: "محطة القلي", icon: "🍟", color: "#F59E0B" },
    { nameEn: "Cold Station", nameAr: "المحطة الباردة", icon: "🥗", color: "#10B981" },
    { nameEn: "Drinks Station", nameAr: "محطة المشروبات", icon: "🥤", color: "#3B82F6" },
    { nameEn: "Desserts Station", nameAr: "محطة الحلويات", icon: "🍰", color: "#EC4899" },
  ];
  const sectionIds = {};
  for (const s of sections) {
    const res = await api("POST", "/api/kitchen-sections", s, token);
    sectionIds[s.nameEn] = res.id;
  }
  console.log("✓ 5 Kitchen sections created");

  // 5. Create categories
  const cats = [
    { nameEn: "Burgers", nameAr: "البرجر" },
    { nameEn: "Chicken", nameAr: "الدجاج" },
    { nameEn: "Sides", nameAr: "الأطباق الجانبية" },
    { nameEn: "Salads", nameAr: "السلطات" },
    { nameEn: "Drinks", nameAr: "المشروبات" },
    { nameEn: "Desserts", nameAr: "الحلويات" },
    { nameEn: "Kids Menu", nameAr: "قائمة الأطفال" },
    { nameEn: "Combo Meals", nameAr: "الوجبات" },
  ];
  const catIds = {};
  for (let i = 0; i < cats.length; i++) {
    const res = await api("POST", "/api/categories", { ...cats[i], sortOrder: i }, token);
    catIds[cats[i].nameEn] = res.id;
  }
  console.log("✓ 8 Categories created");

  // 6. Create menu items (with images, nutrition, allergens)
  const menuItems = [
    // Burgers
    { nameEn: "Classic Smash Burger", nameAr: "سماش برجر كلاسيك", price: "29.00", categoryKey: "Burgers", sectionKey: "Grill Station", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop", descriptionEn: "Hand-smashed beef patty with American cheese, pickles, onions and secret sauce", descriptionAr: "لحم بقري مضغوط يدوياً مع جبنة أمريكية ومخللات وبصل وصوص سري", calories: 580, protein: "32", fat: "35", carbs: "38", sugar: "8", sodium: "890", fiber: "2", prepTime: 12, allergens: ["gluten", "dairy"], isSpicy: false, isBestseller: true },
    { nameEn: "Double Smash Burger", nameAr: "دبل سماش برجر", price: "39.00", categoryKey: "Burgers", sectionKey: "Grill Station", image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=400&fit=crop", descriptionEn: "Two hand-smashed beef patties with double cheese, caramelized onions and smoky sauce", descriptionAr: "طبقتين لحم بقري مع جبنة مزدوجة وبصل مكرمل وصوص مدخن", calories: 850, protein: "52", fat: "55", carbs: "42", sugar: "10", sodium: "1200", fiber: "2", prepTime: 15, allergens: ["gluten", "dairy"], isHighSodium: true, isBestseller: true },
    { nameEn: "Mushroom Swiss Burger", nameAr: "برجر مشروم سويس", price: "35.00", categoryKey: "Burgers", sectionKey: "Grill Station", image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=400&h=400&fit=crop", descriptionEn: "Juicy beef patty topped with sautéed mushrooms and melted Swiss cheese", descriptionAr: "لحم بقري طري مع فطر سوتيه وجبنة سويسرية ذائبة", calories: 620, protein: "38", fat: "38", carbs: "35", sugar: "6", sodium: "780", fiber: "3", prepTime: 14, allergens: ["gluten", "dairy"] },
    { nameEn: "Spicy Jalapeño Burger", nameAr: "برجر هالابينو حار", price: "33.00", categoryKey: "Burgers", sectionKey: "Grill Station", image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&h=400&fit=crop", descriptionEn: "Beef patty with jalapeños, pepper jack cheese, spicy mayo and crispy onion rings", descriptionAr: "لحم بقري مع هالابينو وجبنة بيبر جاك ومايونيز حار وحلقات بصل مقرمشة", calories: 690, protein: "34", fat: "42", carbs: "44", sugar: "7", sodium: "950", fiber: "3", prepTime: 14, allergens: ["gluten", "dairy"], isSpicy: true, isNew: true },
    { nameEn: "Wagyu Truffle Burger", nameAr: "برجر واقيو ترافل", price: "65.00", categoryKey: "Burgers", sectionKey: "Grill Station", image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&h=400&fit=crop", descriptionEn: "Premium Wagyu beef with truffle aioli, aged cheddar, arugula and caramelized onions", descriptionAr: "لحم واقيو فاخر مع أيولي الترافل وشيدر معتق وجرجير وبصل مكرمل", calories: 780, protein: "45", fat: "52", carbs: "35", sugar: "9", sodium: "850", fiber: "2", prepTime: 18, allergens: ["gluten", "dairy", "eggs"], isNew: true },

    // Chicken
    { nameEn: "Crispy Chicken Burger", nameAr: "برجر دجاج كرسبي", price: "27.00", categoryKey: "Chicken", sectionKey: "Frying Station", image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=400&fit=crop", descriptionEn: "Crispy fried chicken breast with coleslaw, pickles and honey mustard", descriptionAr: "صدر دجاج مقرمش مع كولسلو ومخللات وصوص خردل بالعسل", calories: 520, protein: "28", fat: "28", carbs: "42", sugar: "12", sodium: "820", fiber: "2", prepTime: 12, allergens: ["gluten", "eggs"], isBestseller: true },
    { nameEn: "Grilled Chicken Sandwich", nameAr: "ساندويتش دجاج مشوي", price: "25.00", categoryKey: "Chicken", sectionKey: "Grill Station", image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=400&fit=crop", descriptionEn: "Marinated grilled chicken with lettuce, tomato, avocado and garlic sauce", descriptionAr: "دجاج مشوي متبل مع خس وطماطم وأفوكادو وصوص ثوم", calories: 420, protein: "35", fat: "18", carbs: "38", sugar: "5", sodium: "680", fiber: "4", prepTime: 15, allergens: ["gluten"] },
    { nameEn: "Nashville Hot Chicken", nameAr: "ناشفيل هوت تشيكن", price: "32.00", categoryKey: "Chicken", sectionKey: "Frying Station", image: "https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=400&h=400&fit=crop", descriptionEn: "Extra crispy chicken coated in Nashville-style hot sauce with pickles and coleslaw", descriptionAr: "دجاج مقرمش مغطى بصوص ناشفيل الحار مع مخللات وكولسلو", calories: 650, protein: "30", fat: "38", carbs: "48", sugar: "8", sodium: "1100", fiber: "2", prepTime: 14, allergens: ["gluten", "eggs"], isSpicy: true, isHighSodium: true },
    { nameEn: "Chicken Tenders (6 pcs)", nameAr: "تندر دجاج (6 قطع)", price: "28.00", categoryKey: "Chicken", sectionKey: "Frying Station", image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=400&fit=crop", descriptionEn: "Hand-breaded chicken tenders served with your choice of dipping sauce", descriptionAr: "تندر دجاج مغلف يدوياً يقدم مع صوص من اختيارك", calories: 480, protein: "32", fat: "24", carbs: "36", sugar: "3", sodium: "750", fiber: "1", prepTime: 10, allergens: ["gluten", "eggs"] },

    // Sides
    { nameEn: "Classic Fries", nameAr: "بطاطس كلاسيك", price: "12.00", categoryKey: "Sides", sectionKey: "Frying Station", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop", descriptionEn: "Crispy golden french fries with sea salt", descriptionAr: "بطاطس مقلية ذهبية مقرمشة مع ملح بحري", calories: 320, protein: "4", fat: "15", carbs: "43", sugar: "1", sodium: "480", fiber: "4", prepTime: 6, allergens: [], isVegetarian: true, isGlutenFree: true },
    { nameEn: "Loaded Fries", nameAr: "بطاطس محملة", price: "22.00", categoryKey: "Sides", sectionKey: "Frying Station", image: "https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400&h=400&fit=crop", descriptionEn: "Fries loaded with cheese sauce, bacon bits, jalapeños and sour cream", descriptionAr: "بطاطس محملة بصوص الجبنة وقطع اللحم المقدد والهالابينو والكريمة الحامضة", calories: 580, protein: "15", fat: "35", carbs: "52", sugar: "4", sodium: "920", fiber: "4", prepTime: 8, allergens: ["dairy"], isSpicy: true },
    { nameEn: "Onion Rings", nameAr: "حلقات البصل", price: "14.00", categoryKey: "Sides", sectionKey: "Frying Station", image: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=400&fit=crop", descriptionEn: "Beer-battered crispy onion rings with chipotle mayo", descriptionAr: "حلقات بصل مقرمشة مع مايونيز تشيبوتل", calories: 380, protein: "6", fat: "22", carbs: "42", sugar: "6", sodium: "560", fiber: "2", prepTime: 7, allergens: ["gluten", "eggs"], isVegetarian: true },
    { nameEn: "Mac & Cheese Bites", nameAr: "كرات ماك أند تشيز", price: "18.00", categoryKey: "Sides", sectionKey: "Frying Station", image: "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=400&h=400&fit=crop", descriptionEn: "Crispy fried mac and cheese bites with ranch dipping sauce", descriptionAr: "كرات ماك أند تشيز مقلية مقرمشة مع صوص رانش", calories: 420, protein: "12", fat: "25", carbs: "38", sugar: "3", sodium: "680", fiber: "1", prepTime: 8, allergens: ["gluten", "dairy", "eggs"] },

    // Salads
    { nameEn: "Caesar Salad", nameAr: "سلطة سيزر", price: "22.00", categoryKey: "Salads", sectionKey: "Cold Station", image: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=400&fit=crop", descriptionEn: "Crisp romaine lettuce with Caesar dressing, parmesan, croutons and grilled chicken", descriptionAr: "خس روماني مقرمش مع صوص سيزر وبارميزان وخبز محمص ودجاج مشوي", calories: 380, protein: "28", fat: "22", carbs: "18", sugar: "3", sodium: "720", fiber: "4", prepTime: 8, allergens: ["gluten", "dairy", "eggs"] },
    { nameEn: "Garden Fresh Salad", nameAr: "سلطة الحديقة الطازجة", price: "18.00", categoryKey: "Salads", sectionKey: "Cold Station", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop", descriptionEn: "Mixed greens with cherry tomatoes, cucumber, red onion and balsamic vinaigrette", descriptionAr: "خضروات مشكلة مع طماطم كرزية وخيار وبصل أحمر وصوص بلسمك", calories: 180, protein: "4", fat: "12", carbs: "16", sugar: "8", sodium: "320", fiber: "5", prepTime: 6, allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true },

    // Drinks
    { nameEn: "Fresh Lemonade", nameAr: "ليمونادة طازجة", price: "14.00", categoryKey: "Drinks", sectionKey: "Drinks Station", image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=400&fit=crop", descriptionEn: "Freshly squeezed lemonade with mint and ice", descriptionAr: "ليمونادة معصورة طازجة مع نعناع وثلج", calories: 120, protein: "0", fat: "0", carbs: "32", sugar: "28", sodium: "10", fiber: "0", prepTime: 3, allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true },
    { nameEn: "Mango Smoothie", nameAr: "سموذي مانجو", price: "18.00", categoryKey: "Drinks", sectionKey: "Drinks Station", image: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&h=400&fit=crop", descriptionEn: "Thick mango smoothie blended with yogurt and honey", descriptionAr: "سموذي مانجو سميك ممزوج بالزبادي والعسل", calories: 240, protein: "6", fat: "3", carbs: "52", sugar: "45", sodium: "60", fiber: "2", prepTime: 4, allergens: ["dairy"], isVegetarian: true, isGlutenFree: true },
    { nameEn: "Iced Americano", nameAr: "أمريكانو مثلج", price: "16.00", categoryKey: "Drinks", sectionKey: "Drinks Station", image: "https://images.unsplash.com/photo-1517959105821-eaf2591984ca?w=400&h=400&fit=crop", descriptionEn: "Double shot espresso over ice with cold water", descriptionAr: "إسبريسو مزدوج مع ثلج وماء بارد", calories: 10, protein: "0", fat: "0", carbs: "2", sugar: "0", sodium: "5", fiber: "0", caffeine: "150", prepTime: 3, allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true },
    { nameEn: "Oreo Milkshake", nameAr: "ميلك شيك أوريو", price: "22.00", categoryKey: "Drinks", sectionKey: "Drinks Station", image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=400&fit=crop", descriptionEn: "Thick creamy milkshake blended with Oreo cookies and vanilla ice cream", descriptionAr: "ميلك شيك كريمي سميك مع بسكويت أوريو وآيس كريم فانيلا", calories: 580, protein: "12", fat: "25", carbs: "78", sugar: "65", sodium: "350", fiber: "1", prepTime: 5, allergens: ["dairy", "gluten"], isBestseller: true },

    // Desserts
    { nameEn: "Chocolate Brownie", nameAr: "براوني شوكولاتة", price: "20.00", categoryKey: "Desserts", sectionKey: "Desserts Station", image: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&h=400&fit=crop", descriptionEn: "Warm chocolate brownie with vanilla ice cream and chocolate sauce", descriptionAr: "براوني شوكولاتة دافئ مع آيس كريم فانيلا وصوص شوكولاتة", calories: 520, protein: "8", fat: "28", carbs: "62", sugar: "48", sodium: "280", fiber: "3", prepTime: 5, allergens: ["dairy", "gluten", "eggs"] },
    { nameEn: "Churros (6 pcs)", nameAr: "تشوروز (6 قطع)", price: "18.00", categoryKey: "Desserts", sectionKey: "Desserts Station", image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=400&fit=crop", descriptionEn: "Crispy cinnamon churros with chocolate and caramel dipping sauces", descriptionAr: "تشوروز قرفة مقرمشة مع صوص شوكولاتة وكراميل", calories: 380, protein: "4", fat: "18", carbs: "52", sugar: "28", sodium: "220", fiber: "1", prepTime: 8, allergens: ["gluten", "dairy", "eggs"], isNew: true },

    // Kids Menu
    { nameEn: "Kids Cheeseburger", nameAr: "تشيز برجر أطفال", price: "19.00", categoryKey: "Kids Menu", sectionKey: "Grill Station", image: "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=400&fit=crop", descriptionEn: "Mini cheeseburger with fries and juice box", descriptionAr: "تشيز برجر صغير مع بطاطس وعصير", calories: 420, protein: "18", fat: "20", carbs: "45", sugar: "15", sodium: "580", fiber: "2", prepTime: 10, allergens: ["gluten", "dairy"] },
    { nameEn: "Kids Chicken Nuggets", nameAr: "ناجتس دجاج أطفال", price: "17.00", categoryKey: "Kids Menu", sectionKey: "Frying Station", image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=400&fit=crop", descriptionEn: "6 chicken nuggets with fries and apple juice", descriptionAr: "6 قطع ناجتس دجاج مع بطاطس وعصير تفاح", calories: 380, protein: "16", fat: "18", carbs: "40", sugar: "12", sodium: "520", fiber: "2", prepTime: 8, allergens: ["gluten", "eggs"] },

    // Combo Meals
    { nameEn: "Smash Combo", nameAr: "كومبو سماش", price: "42.00", categoryKey: "Combo Meals", sectionKey: "Grill Station", image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&h=400&fit=crop", descriptionEn: "Classic Smash Burger + Classic Fries + Fresh Lemonade", descriptionAr: "سماش برجر كلاسيك + بطاطس كلاسيك + ليمونادة طازجة", calories: 920, protein: "36", fat: "50", carbs: "113", sugar: "37", sodium: "1380", fiber: "6", prepTime: 15, allergens: ["gluten", "dairy"], isHighSodium: true, isBestseller: true },
    { nameEn: "Chicken Combo", nameAr: "كومبو دجاج", price: "38.00", categoryKey: "Combo Meals", sectionKey: "Frying Station", image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=400&fit=crop", descriptionEn: "Crispy Chicken Burger + Classic Fries + Iced Americano", descriptionAr: "برجر دجاج كرسبي + بطاطس كلاسيك + أمريكانو مثلج", calories: 850, protein: "32", fat: "43", carbs: "87", sugar: "2", sodium: "1310", fiber: "6", prepTime: 15, allergens: ["gluten", "eggs"], isHighSodium: true },
  ];

  let itemCount = 0;
  for (const item of menuItems) {
    const { categoryKey, sectionKey, ...data } = item;
    data.categoryId = catIds[categoryKey];
    data.kitchenSectionId = sectionIds[sectionKey] || null;
    data.isAvailable = true;
    data.sortOrder = itemCount;
    await api("POST", "/api/menu-items", data, token);
    itemCount++;
  }
  console.log(`✓ ${itemCount} Menu items created`);

  // 7. Create tables
  const tableData = [
    { tableNumber: "T1", capacity: 2, location: "Indoor" },
    { tableNumber: "T2", capacity: 2, location: "Indoor" },
    { tableNumber: "T3", capacity: 4, location: "Indoor" },
    { tableNumber: "T4", capacity: 4, location: "Indoor" },
    { tableNumber: "T5", capacity: 6, location: "Indoor" },
    { tableNumber: "T6", capacity: 6, location: "Indoor" },
    { tableNumber: "T7", capacity: 8, location: "Indoor" },
    { tableNumber: "P1", capacity: 4, location: "Patio" },
    { tableNumber: "P2", capacity: 4, location: "Patio" },
    { tableNumber: "P3", capacity: 6, location: "Patio" },
    { tableNumber: "VIP1", capacity: 8, location: "VIP Room" },
    { tableNumber: "VIP2", capacity: 10, location: "VIP Room" },
  ];
  for (const t of tableData) {
    await api("POST", "/api/tables", { ...t, status: "available" }, token);
  }
  console.log("✓ 12 Tables created");

  // 8. Create inventory items
  const inventory = [
    { name: "Beef Patties", nameAr: "لحم بقري", unit: "kg", currentStock: "50", minStock: "10", costPerUnit: "45.00", category: "meat" },
    { name: "Wagyu Beef", nameAr: "لحم واقيو", unit: "kg", currentStock: "15", minStock: "5", costPerUnit: "120.00", category: "meat" },
    { name: "Chicken Breast", nameAr: "صدر دجاج", unit: "kg", currentStock: "40", minStock: "8", costPerUnit: "28.00", category: "poultry" },
    { name: "Burger Buns", nameAr: "خبز برجر", unit: "piece", currentStock: "200", minStock: "50", costPerUnit: "1.50", category: "grains" },
    { name: "American Cheese", nameAr: "جبنة أمريكية", unit: "kg", currentStock: "20", minStock: "5", costPerUnit: "35.00", category: "dairy" },
    { name: "Swiss Cheese", nameAr: "جبنة سويسرية", unit: "kg", currentStock: "10", minStock: "3", costPerUnit: "48.00", category: "dairy" },
    { name: "Lettuce", nameAr: "خس", unit: "kg", currentStock: "15", minStock: "5", costPerUnit: "8.00", category: "vegetables" },
    { name: "Tomatoes", nameAr: "طماطم", unit: "kg", currentStock: "20", minStock: "5", costPerUnit: "6.00", category: "vegetables" },
    { name: "Onions", nameAr: "بصل", unit: "kg", currentStock: "25", minStock: "5", costPerUnit: "4.00", category: "vegetables" },
    { name: "Jalapeños", nameAr: "هالابينو", unit: "kg", currentStock: "8", minStock: "3", costPerUnit: "15.00", category: "vegetables" },
    { name: "Mushrooms", nameAr: "فطر", unit: "kg", currentStock: "10", minStock: "3", costPerUnit: "22.00", category: "vegetables" },
    { name: "Potatoes (Fries)", nameAr: "بطاطس (مقلية)", unit: "kg", currentStock: "60", minStock: "15", costPerUnit: "5.00", category: "vegetables" },
    { name: "Cooking Oil", nameAr: "زيت طبخ", unit: "liter", currentStock: "40", minStock: "10", costPerUnit: "8.00", category: "other" },
    { name: "Coca Cola (330ml)", nameAr: "كوكا كولا (330مل)", unit: "piece", currentStock: "120", minStock: "30", costPerUnit: "2.00", category: "beverages" },
    { name: "Fresh Lemons", nameAr: "ليمون طازج", unit: "kg", currentStock: "12", minStock: "4", costPerUnit: "10.00", category: "fruits" },
    { name: "Mango Pulp", nameAr: "لب مانجو", unit: "liter", currentStock: "10", minStock: "3", costPerUnit: "18.00", category: "fruits" },
    { name: "Coffee Beans", nameAr: "حبوب قهوة", unit: "kg", currentStock: "8", minStock: "2", costPerUnit: "85.00", category: "beverages" },
    { name: "Vanilla Ice Cream", nameAr: "آيس كريم فانيلا", unit: "liter", currentStock: "15", minStock: "5", costPerUnit: "25.00", category: "dairy" },
    { name: "Chocolate Sauce", nameAr: "صوص شوكولاتة", unit: "liter", currentStock: "6", minStock: "2", costPerUnit: "30.00", category: "other" },
    { name: "Takeaway Boxes", nameAr: "علب تيك أواي", unit: "piece", currentStock: "300", minStock: "100", costPerUnit: "0.80", category: "packaging" },
  ];
  for (const inv of inventory) {
    await api("POST", "/api/inventory", inv, token);
  }
  console.log("✓ 20 Inventory items created");

  // 9. Create additional staff users
  const staff = [
    { email: "cashier@burgerhouse.sa", password: "Cashier@2026", name: "سارة الحربي", role: "cashier", permPos: true, permOrders: true },
    { email: "kitchen@burgerhouse.sa", password: "Kitchen@2026", name: "خالد العتيبي", role: "kitchen", permKitchen: true, permOrders: true },
    { email: "manager@burgerhouse.sa", password: "Manager@2026", name: "فهد القحطاني", role: "branch_manager", permDashboard: true, permPos: true, permOrders: true, permMenu: true, permKitchen: true, permInventory: true, permReports: true, permSettings: true, permTables: true },
  ];
  for (const s of staff) {
    await api("POST", "/api/users", s, token);
  }
  console.log("✓ 3 Staff users created");

  console.log("\n========================================");
  console.log("  ✅ Demo Restaurant Ready!");
  console.log("========================================");
  console.log("\n📋 Login Credentials:");
  console.log("─────────────────────────────────────");
  console.log("🔗 URL:      https://tryingpos.com");
  console.log("👤 Owner:    demo@burgerhouse.sa / Demo@2026");
  console.log("💳 Cashier:  cashier@burgerhouse.sa / Cashier@2026");
  console.log("🍳 Kitchen:  kitchen@burgerhouse.sa / Kitchen@2026");
  console.log("📊 Manager:  manager@burgerhouse.sa / Manager@2026");
  console.log("─────────────────────────────────────");
  console.log("\n📦 Created:");
  console.log("  • 1 Restaurant (Burger House / بيت البرجر)");
  console.log("  • 2 Branches");
  console.log("  • 4 Users (owner + 3 staff)");
  console.log("  • 5 Kitchen sections");
  console.log("  • 8 Categories");
  console.log(`  • ${itemCount} Menu items (with images & nutrition)`);
  console.log("  • 12 Tables (indoor + patio + VIP)");
  console.log("  • 20 Inventory items");
}

main().catch(console.error);
