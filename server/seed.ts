import { db } from "./db";
import { restaurants, categories, menuItems, tables, orders } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_RESTAURANT_ID = "default";

export async function seedDatabase() {
  try {
    // Check if restaurant already exists
    const existingRestaurant = await db.select().from(restaurants).where(eq(restaurants.id, DEFAULT_RESTAURANT_ID)).limit(1);
    
    if (existingRestaurant.length > 0) {
      console.log("Database already seeded");
      return;
    }

    console.log("Seeding database...");

    // Create default restaurant
    await db.insert(restaurants).values({
      id: DEFAULT_RESTAURANT_ID,
      nameEn: "Al Majlis Restaurant",
      nameAr: "مطعم المجلس",
      address: "King Fahd Road, Riyadh, Saudi Arabia",
      phone: "+966 11 123 4567",
      email: "info@almajlis.sa",
      kitchenType: "casual_dining",
      priceRange: "$$",
    });

    // Create categories
    const categoryData = [
      { id: "cat-1", nameEn: "Appetizers", nameAr: "المقبلات", sortOrder: 1 },
      { id: "cat-2", nameEn: "Main Courses", nameAr: "الأطباق الرئيسية", sortOrder: 2 },
      { id: "cat-3", nameEn: "Grills", nameAr: "المشويات", sortOrder: 3 },
      { id: "cat-4", nameEn: "Desserts", nameAr: "الحلويات", sortOrder: 4 },
      { id: "cat-5", nameEn: "Beverages", nameAr: "المشروبات", sortOrder: 5 },
    ];

    for (const cat of categoryData) {
      await db.insert(categories).values({
        ...cat,
        restaurantId: DEFAULT_RESTAURANT_ID,
        isActive: true,
      });
    }

    // Create menu items
    const menuItemsData = [
      // Appetizers
      {
        nameEn: "Hummus",
        nameAr: "حمص",
        descriptionEn: "Creamy chickpea dip with tahini, olive oil and pine nuts",
        descriptionAr: "حمص كريمي مع طحينة وزيت زيتون وصنوبر",
        price: "18.00",
        categoryId: "cat-1",
        image: "https://images.unsplash.com/photo-1577805947697-89340c5ab1d5?w=400",
        calories: 250,
        prepTime: 5,
      },
      {
        nameEn: "Fattoush Salad",
        nameAr: "سلطة فتوش",
        descriptionEn: "Fresh garden vegetables with crispy bread and sumac dressing",
        descriptionAr: "خضروات طازجة مع خبز مقرمش وصلصة السماق",
        price: "22.00",
        categoryId: "cat-1",
        image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400",
        calories: 180,
        prepTime: 8,
      },
      {
        nameEn: "Kibbeh",
        nameAr: "كبة",
        descriptionEn: "Fried bulgur shells stuffed with spiced lamb and pine nuts",
        descriptionAr: "كبة مقلية محشوة بلحم الضأن المتبل والصنوبر",
        price: "28.00",
        categoryId: "cat-1",
        image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400",
        calories: 320,
        prepTime: 10,
      },
      // Main Courses
      {
        nameEn: "Lamb Kabsa",
        nameAr: "كبسة لحم",
        descriptionEn: "Traditional Saudi rice dish with tender lamb and aromatic spices",
        descriptionAr: "طبق أرز سعودي تقليدي مع لحم طري وتوابل عطرية",
        price: "75.00",
        categoryId: "cat-2",
        image: "https://images.unsplash.com/photo-1642821373181-696a54913e93?w=400",
        calories: 850,
        prepTime: 25,
      },
      {
        nameEn: "Chicken Mandi",
        nameAr: "مندي دجاج",
        descriptionEn: "Smoked chicken with fragrant basmati rice",
        descriptionAr: "دجاج مدخن مع أرز بسمتي عطري",
        price: "55.00",
        categoryId: "cat-2",
        image: "https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=400",
        calories: 720,
        prepTime: 20,
      },
      {
        nameEn: "Grilled Sea Bass",
        nameAr: "سمك سي باس مشوي",
        descriptionEn: "Fresh sea bass with herbs, served with rice and vegetables",
        descriptionAr: "سمك سي باس طازج مع الأعشاب، يقدم مع الأرز والخضروات",
        price: "95.00",
        categoryId: "cat-2",
        image: "https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=400",
        calories: 450,
        prepTime: 18,
      },
      // Grills
      {
        nameEn: "Mixed Grill Platter",
        nameAr: "طبق المشويات المشكلة",
        descriptionEn: "Assorted grilled meats including lamb chops, kebab and shish taouk",
        descriptionAr: "مشويات متنوعة تشمل ريش الضأن والكباب وشيش طاووق",
        price: "120.00",
        categoryId: "cat-3",
        image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400",
        calories: 980,
        prepTime: 25,
      },
      {
        nameEn: "Lamb Chops",
        nameAr: "ريش ضأن",
        descriptionEn: "Premium lamb chops marinated with herbs and spices",
        descriptionAr: "ريش ضأن ممتازة متبلة بالأعشاب والتوابل",
        price: "85.00",
        categoryId: "cat-3",
        image: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400",
        calories: 650,
        prepTime: 20,
      },
      // Desserts
      {
        nameEn: "Kunafa",
        nameAr: "كنافة",
        descriptionEn: "Traditional cheese pastry soaked in sweet syrup",
        descriptionAr: "حلوى تقليدية بالجبن مغموسة بالقطر",
        price: "32.00",
        categoryId: "cat-4",
        image: "https://images.unsplash.com/photo-1579888944880-d98341245702?w=400",
        calories: 450,
        prepTime: 10,
      },
      {
        nameEn: "Um Ali",
        nameAr: "أم علي",
        descriptionEn: "Warm bread pudding with nuts and cream",
        descriptionAr: "حلوى دافئة بالخبز والمكسرات والقشطة",
        price: "28.00",
        categoryId: "cat-4",
        image: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400",
        calories: 380,
        prepTime: 8,
      },
      // Beverages
      {
        nameEn: "Arabic Coffee",
        nameAr: "قهوة عربية",
        descriptionEn: "Traditional cardamom-spiced coffee",
        descriptionAr: "قهوة تقليدية بنكهة الهيل",
        price: "12.00",
        categoryId: "cat-5",
        calories: 5,
        prepTime: 3,
      },
      {
        nameEn: "Fresh Lemon Mint",
        nameAr: "ليمون بالنعناع",
        descriptionEn: "Refreshing lemonade with fresh mint leaves",
        descriptionAr: "عصير ليمون منعش مع أوراق النعناع الطازج",
        price: "15.00",
        categoryId: "cat-5",
        image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
        calories: 80,
        prepTime: 3,
      },
    ];

    for (const item of menuItemsData) {
      await db.insert(menuItems).values({
        ...item,
        restaurantId: DEFAULT_RESTAURANT_ID,
        isAvailable: true,
      });
    }

    // Create tables
    const tablesData = [
      { tableNumber: "T1", capacity: 2, location: "Indoor", status: "available" },
      { tableNumber: "T2", capacity: 4, location: "Indoor", status: "occupied" },
      { tableNumber: "T3", capacity: 4, location: "Indoor", status: "available" },
      { tableNumber: "T4", capacity: 6, location: "Indoor", status: "reserved" },
      { tableNumber: "T5", capacity: 8, location: "Private Room", status: "available" },
      { tableNumber: "O1", capacity: 2, location: "Outdoor", status: "available" },
      { tableNumber: "O2", capacity: 4, location: "Outdoor", status: "available" },
      { tableNumber: "O3", capacity: 6, location: "Outdoor", status: "occupied" },
    ];

    for (const table of tablesData) {
      await db.insert(tables).values({
        ...table,
        restaurantId: DEFAULT_RESTAURANT_ID,
      });
    }

    // Create sample orders
    const ordersData = [
      {
        orderNumber: "ORD-001",
        orderType: "dine_in",
        status: "preparing",
        customerName: "Ahmed Al-Rashid",
        customerPhone: "+966 50 123 4567",
        subtotal: "150.00",
        tax: "22.50",
        total: "172.50",
      },
      {
        orderNumber: "ORD-002",
        orderType: "pickup",
        status: "ready",
        customerName: "Sara Abdullah",
        customerPhone: "+966 55 987 6543",
        subtotal: "85.00",
        tax: "12.75",
        total: "97.75",
      },
      {
        orderNumber: "ORD-003",
        orderType: "delivery",
        status: "pending",
        customerName: "Mohammed Hassan",
        customerPhone: "+966 54 456 7890",
        notes: "Extra spicy please",
        subtotal: "220.00",
        tax: "33.00",
        total: "253.00",
      },
      {
        orderNumber: "ORD-004",
        orderType: "dine_in",
        status: "completed",
        customerName: "Fatima Al-Saud",
        customerPhone: "+966 56 111 2222",
        subtotal: "95.00",
        tax: "14.25",
        total: "109.25",
      },
    ];

    for (const order of ordersData) {
      await db.insert(orders).values({
        ...order,
        restaurantId: DEFAULT_RESTAURANT_ID,
      });
    }

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
