import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONTS } from '../config/theme';
import { getItemPrice, getImageUrl, getDisplayName } from '../types';
import type { MenuItem } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.md * 2 - CARD_GAP) / 2;

interface MenuGridProps {
  items: MenuItem[];
  onAddItem: (item: MenuItem) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function MenuGrid({ items, onAddItem, refreshing, onRefresh }: MenuGridProps) {
  const renderItem = ({ item }: { item: MenuItem }) => {
    const price = getItemPrice(item);
    const imageUrl = getImageUrl(item.image);
    const displayName = getDisplayName(item);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onAddItem(item)}
        activeOpacity={0.7}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>—</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          <View style={styles.bottomRow}>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => onAddItem(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{price.toFixed(2)}</Text>
              <Text style={styles.currency}> ر.س</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderItem}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>—</Text>
          <Text style={styles.emptyText}>لا توجد عناصر</Text>
          <Text style={styles.emptyHint}>اسحب للأسفل للتحديث</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: SPACING.md,
    paddingBottom: 120,
  },
  row: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    width: CARD_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 32,
  },
  info: {
    padding: SPACING.sm,
    paddingBottom: SPACING.sm,
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
    marginBottom: 6,
    minHeight: 34,
    lineHeight: 17,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    justifyContent: 'flex-end',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  currency: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyText: {
    ...FONTS.subtitle,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptyHint: {
    ...FONTS.caption,
    color: COLORS.textLight,
  },
});
