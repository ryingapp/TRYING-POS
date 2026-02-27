import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Modal,
    Image,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSync } from '../context/SyncContext';
import { database } from '../services/database';
import { api } from '../services/api';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../config/theme';
import CartPanel from '../components/CartPanel';
import SyncBar from '../components/SyncBar';
import type { Category, MenuItem } from '../types';
import { getCategoryName, getItemPrice, getImageUrl, getDisplayName } from '../types';

export default function PosScreen() {
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const isLandscape = screenWidth > screenHeight;
    const { user, branch } = useAuth();
    const { items: cartItems, addItem, clearCart, itemCount, total, updateQuantity, removeItem } = useCart();
    const { isOnline, forceSync } = useSync();

    const [categories, setCategories] = useState<Category[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCart, setShowCart] = useState(false);

    const loadData = useCallback(async () => {
        try {
            let cats: Category[] = [];
            let items: MenuItem[] = [];

            if (isOnline) {
                try {
                    const [apiCats, apiItems] = await Promise.all([
                        api.getCategories(),
                        api.getMenuItems(),
                    ]);
                    cats = apiCats;
                    items = apiItems;
                    database.saveCategories(cats).catch(() => { });
                    database.saveMenuItems(items).catch(() => { });
                } catch (err) {
                    console.log('API fetch error, falling back to local:', err);
                    cats = await database.getCategories();
                    items = await database.getMenuItems();
                }
            } else {
                cats = await database.getCategories();
                items = await database.getMenuItems();
            }

            setCategories(cats);
            setMenuItems(items);
        } catch (err) {
            console.log('Load data error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isOnline]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (isOnline) {
            await forceSync();
        }
        await loadData();
    }, [isOnline, forceSync, loadData]);

    const filteredItems = menuItems.filter((item) => {
        if (item.isAvailable === false) return false;
        if (selectedCategory && item.categoryId !== selectedCategory) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return (
                (item.nameEn && item.nameEn.toLowerCase().includes(q)) ||
                (item.nameAr && item.nameAr.includes(q))
            );
        }
        return true;
    });

    const activeCategories = categories.filter((cat) => {
        if (cat.isActive === false) return false;
        return menuItems.some(
            (item) => item.categoryId === cat.id && item.isAvailable !== false
        );
    });

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>جاري تحميل المنيو...</Text>
            </View>
        );
    }

    // Dynamic card sizing
    const CARD_GAP = 8;
    const menuAreaWidth = isLandscape ? screenWidth * 0.6 : screenWidth;
    const numColumns = isLandscape ? 3 : 2;
    const cardWidth = (menuAreaWidth - SPACING.md * 2 - CARD_GAP * (numColumns - 1)) / numColumns;

    const renderMenuItem = ({ item }: { item: MenuItem }) => {
        const price = getItemPrice(item);
        const imageUrl = getImageUrl(item.image);
        const displayName = getDisplayName(item);

        return (
            <TouchableOpacity
                style={[styles.menuCard, { width: cardWidth }]}
                onPress={() => addItem(item)}
                activeOpacity={0.7}
            >
                {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.menuImage} />
                ) : (
                    <View style={styles.menuImagePlaceholder}>
                        <Text style={styles.menuImageEmoji}>—</Text>
                    </View>
                )}
                <View style={styles.menuInfo}>
                    <Text style={styles.menuName} numberOfLines={2}>{displayName}</Text>
                    <View style={styles.menuBottom}>
                        <TouchableOpacity style={styles.menuAddBtn} onPress={() => addItem(item)}>
                            <Text style={styles.menuAddBtnText}>+</Text>
                        </TouchableOpacity>
                        <View style={styles.menuPriceWrap}>
                            <Text style={styles.menuPrice}>{price.toFixed(2)}</Text>
                            <Text style={styles.menuCurrency}> ر.س</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Landscape right-side cart panel
    const renderLandscapeCart = () => (
        <View style={styles.landscapeCart}>
            <View style={styles.lcHeader}>
                <Text style={styles.lcHeaderCount}>{itemCount}</Text>
                <Text style={styles.lcHeaderTitle}>السلة</Text>
            </View>
            <ScrollView style={styles.lcItems} showsVerticalScrollIndicator={false}>
                {cartItems.length === 0 ? (
                    <View style={styles.lcEmpty}>
                        <Text style={styles.lcEmptyText}>السلة فارغة</Text>
                    </View>
                ) : (
                    cartItems.map((item) => (
                        <View key={item.menuItemId} style={styles.lcItem}>
                            <View style={styles.lcItemInfo}>
                                <Text style={styles.lcItemName} numberOfLines={1}>
                                    {item.nameAr || item.nameEn}
                                </Text>
                                <Text style={styles.lcItemPrice}>
                                    {(parseFloat(item.price) * item.quantity).toFixed(2)} ر.س
                                </Text>
                            </View>
                            <View style={styles.lcItemQty}>
                                <TouchableOpacity
                                    style={styles.lcQtyBtn}
                                    onPress={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                                >
                                    <Text style={styles.lcQtyBtnText}>−</Text>
                                </TouchableOpacity>
                                <Text style={styles.lcQtyText}>{item.quantity}</Text>
                                <TouchableOpacity
                                    style={styles.lcQtyBtn}
                                    onPress={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                                >
                                    <Text style={styles.lcQtyBtnText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
            {cartItems.length > 0 && (
                <View style={styles.lcFooter}>
                    <View style={styles.lcTotalRow}>
                        <Text style={styles.lcTotalValue}>{total.toFixed(2)} ر.س</Text>
                        <Text style={styles.lcTotalLabel}>الإجمالي</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.lcCheckoutBtn}
                        onPress={() => setShowCart(true)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.lcCheckoutText}>إتمام الطلب</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearCart} style={styles.lcClearBtn}>
                        <Text style={styles.lcClearText}>مسح السلة</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Status bar spacer */}
            <View style={{ height: insets.top, backgroundColor: COLORS.surface }} />

            <View style={{ flex: 1, flexDirection: isLandscape ? 'row' : 'column' }}>
                {/* Menu Side (full in portrait, 60% in landscape) */}
                <View style={{ flex: isLandscape ? 0.6 : 1 }}>
                    {/* Header */}
                    <View style={[styles.header, isLandscape && styles.headerLand]}>
                        {!isLandscape && (
                            <View style={styles.headerLeft}>
                                <TouchableOpacity
                                    style={styles.cartButton}
                                    onPress={() => setShowCart(true)}
                                >
                                    <Text style={styles.cartIcon}>السلة</Text>
                                    {itemCount > 0 && (
                                        <View style={styles.cartBadge}>
                                            <Text style={styles.cartBadgeText}>{itemCount}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={styles.headerCenter}>
                            <View style={styles.logoMini}>
                                <Text style={styles.logoMiniText}>T</Text>
                            </View>
                            <View style={styles.headerTitleWrap}>
                                <Text style={[styles.headerTitle, isLandscape && { fontSize: 15 }]}>Trying</Text>
                                {branch && (
                                    <Text style={styles.branchLabel}>{branch.nameAr || branch.name}</Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.headerRight}>
                            <View style={[styles.onlineDot, { backgroundColor: isOnline ? COLORS.success : COLORS.textMuted }]} />
                        </View>
                    </View>

                    <SyncBar />

                    {/* Search */}
                    <View style={[styles.searchContainer, isLandscape && { paddingVertical: 4 }]}>
                        <View style={[styles.searchInputWrap, isLandscape && { height: 36 }]}>
                            <Text style={styles.searchIcon}>بحث</Text>
                            <TextInput
                                style={[styles.searchInput, isLandscape && { fontSize: 13 }]}
                                placeholder="بحث في القائمة..."
                                placeholderTextColor={COLORS.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                textAlign="right"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Text style={styles.searchClear}>✕</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Categories - BIGGER & CLEARER */}
                    <View style={styles.categoriesContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.categoriesList}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.categoryChip,
                                    !selectedCategory && styles.categoryChipActive,
                                ]}
                                onPress={() => setSelectedCategory(null)}
                            >
                                <Text
                                    style={[
                                        styles.categoryChipText,
                                        !selectedCategory && styles.categoryChipTextActive,
                                    ]}
                                >
                                    الكل ({menuItems.filter(i => i.isAvailable !== false).length})
                                </Text>
                            </TouchableOpacity>
                            {activeCategories.map((cat) => {
                                const count = menuItems.filter(i => i.categoryId === cat.id && i.isAvailable !== false).length;
                                return (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.categoryChip,
                                            selectedCategory === cat.id && styles.categoryChipActive,
                                        ]}
                                        onPress={() =>
                                            setSelectedCategory(
                                                selectedCategory === cat.id ? null : cat.id
                                            )
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.categoryChipText,
                                                selectedCategory === cat.id && styles.categoryChipTextActive,
                                            ]}
                                        >
                                            {getCategoryName(cat)} ({count})
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Menu Grid */}
                    <FlatList
                        data={filteredItems}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderMenuItem}
                        numColumns={numColumns}
                        key={`grid-${numColumns}`}
                        columnWrapperStyle={{ gap: CARD_GAP, marginBottom: CARD_GAP }}
                        contentContainerStyle={{ padding: SPACING.md, paddingBottom: isLandscape ? 20 : 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={{ fontSize: 14, color: COLORS.textMuted }}>لا توجد عناصر</Text>
                                <Text style={styles.emptyHint}>اسحب للأسفل للتحديث</Text>
                            </View>
                        }
                    />

                    {/* Floating cart (portrait only) */}
                    {!isLandscape && itemCount > 0 && !showCart && (
                        <TouchableOpacity
                            style={[styles.floatingCart, { bottom: 16 }]}
                            onPress={() => setShowCart(true)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.floatingCartLeft}>
                                <View style={styles.floatingCartCount}>
                                    <Text style={styles.floatingCartCountText}>{itemCount}</Text>
                                </View>
                                <Text style={styles.floatingCartLabel}>عرض السلة</Text>
                            </View>
                            <Text style={styles.floatingCartTotal}>{total.toFixed(2)} ر.س</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Landscape Cart Panel (right 40%) */}
                {isLandscape && renderLandscapeCart()}
            </View>

            {/* Cart Modal (full checkout) */}
            <Modal
                visible={showCart}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowCart(false)}
            >
                <CartPanel onClose={() => setShowCart(false)} />
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    loadingText: {
        marginTop: SPACING.md,
        ...FONTS.subtitle,
        color: COLORS.textLight,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    headerLand: {
        paddingVertical: 8,
    },
    headerLeft: {
        width: 48,
        alignItems: 'flex-start',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoMini: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    logoMiniText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#fff',
    },
    headerTitleWrap: {
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    branchLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '500',
        marginTop: 1,
    },
    headerRight: {
        width: 48,
        alignItems: 'flex-end',
    },
    onlineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    cartButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cartIcon: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.primary,
    },
    cartBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    cartBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    searchContainer: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.white,
    },
    searchInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingHorizontal: SPACING.md,
        height: 44,
    },
    searchIcon: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textMuted,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text,
        paddingVertical: 0,
    },
    searchClear: {
        fontSize: 14,
        color: COLORS.textMuted,
        padding: 4,
        fontWeight: '600',
    },
    categoriesContainer: {
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    categoriesList: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 10,
        alignItems: 'center',
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: COLORS.background,
        marginRight: 8,
    },
    categoryChipActive: {
        backgroundColor: COLORS.primary,
    },
    categoryChipText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    categoryChipTextActive: {
        color: '#fff',
    },

    // ===== Menu Cards (inline) =====
    menuCard: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
        elevation: 1,
    },
    menuImage: {
        width: '100%',
        height: 100,
        resizeMode: 'cover',
    },
    menuImagePlaceholder: {
        width: '100%',
        height: 100,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuImageEmoji: {
        fontSize: 30,
    },
    menuImagePlaceholderText: {
        fontSize: 26,
        fontWeight: '300',
        color: COLORS.textMuted,
    },
    menuInfo: {
        padding: 12,
    },
    menuName: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
        textAlign: 'right',
        marginBottom: 10,
        minHeight: 34,
        lineHeight: 18,
    },
    menuBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    menuAddBtn: {
        backgroundColor: COLORS.primary,
        width: 34,
        height: 34,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    menuAddBtnText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
        lineHeight: 22,
    },
    menuPriceWrap: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    menuPrice: {
        fontSize: 17,
        fontWeight: '900',
        color: COLORS.primary,
    },
    menuCurrency: {
        fontSize: 11,
        color: COLORS.primary,
        fontWeight: '600',
    },

    // ===== Empty =====
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: SPACING.xxl * 2.4,
    },
    emptyIcon: {
        fontSize: 40,
        fontWeight: '200',
        color: COLORS.textMuted,
        marginBottom: SPACING.sm,
    },
    emptyText: {
        ...FONTS.subtitle,
        color: COLORS.text,
        marginTop: SPACING.xs,
    },
    emptyHint: {
        ...FONTS.caption,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
    },

    // ===== Floating Cart (portrait) =====
    floatingCart: {
        position: 'absolute',
        left: SPACING.lg,
        right: SPACING.lg,
        backgroundColor: COLORS.primary,
        borderRadius: 20,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md + 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...SHADOWS.md,
    },
    floatingCartLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    floatingCartCount: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 8,
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.sm,
    },
    floatingCartCountText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
    },
    floatingCartLabel: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
    },
    floatingCartTotal: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 19,
    },

    // ===== Landscape Cart (right panel) =====
    landscapeCart: {
        flex: 0.4,
        backgroundColor: COLORS.surface,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: COLORS.border,
    },
    lcHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        gap: 8,
    },
    lcHeaderTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
    },
    lcHeaderCount: {
        backgroundColor: COLORS.primary,
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        overflow: 'hidden',
    },
    lcItems: {
        flex: 1,
    },
    lcEmpty: {
        padding: 20,
        alignItems: 'center',
    },
    lcEmptyText: {
        color: COLORS.textLight,
        fontSize: 14,
    },
    lcItem: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.border,
    },
    lcItemInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    lcItemName: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
        textAlign: 'right',
    },
    lcItemPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.primary,
        marginLeft: 8,
    },
    lcItemQty: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        backgroundColor: COLORS.background,
        borderRadius: 8,
        padding: 2,
    },
    lcQtyBtn: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lcQtyBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    lcQtyText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
        marginHorizontal: 10,
    },
    lcFooter: {
        padding: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
        backgroundColor: COLORS.background,
    },
    lcTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    lcTotalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    lcTotalValue: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.primary,
    },
    lcCheckoutBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    lcCheckoutText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '900',
    },
    lcClearBtn: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    lcClearText: {
        color: COLORS.error,
        fontSize: 12,
        fontWeight: '600',
    },
});
