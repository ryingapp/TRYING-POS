import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { CartItem, MenuItem } from '../types';
import { getItemPrice } from '../types';

const VAT_RATE = 0.15;

interface CartState {
  items: CartItem[];
  orderType: 'dine_in' | 'takeout' | 'delivery';
  customerName: string;
  customerPhone: string;
  notes: string;
  kitchenNotes: string;
  tableId: string | null;
  discount: number;
  deliveryFee: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: MenuItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { menuItemId: string; quantity: number } }
  | { type: 'UPDATE_ITEM_NOTES'; payload: { menuItemId: string; notes: string } }
  | { type: 'SET_ORDER_TYPE'; payload: 'dine_in' | 'takeout' | 'delivery' }
  | { type: 'SET_CUSTOMER_NAME'; payload: string }
  | { type: 'SET_CUSTOMER_PHONE'; payload: string }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'SET_KITCHEN_NOTES'; payload: string }
  | { type: 'SET_TABLE'; payload: string | null }
  | { type: 'SET_DISCOUNT'; payload: number }
  | { type: 'SET_DELIVERY_FEE'; payload: number }
  | { type: 'CLEAR_CART' };

interface CartContextType extends CartState {
  addItem: (item: MenuItem) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateItemNotes: (menuItemId: string, notes: string) => void;
  setOrderType: (type: 'dine_in' | 'takeout' | 'delivery') => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setNotes: (notes: string) => void;
  setKitchenNotes: (notes: string) => void;
  setTable: (tableId: string | null) => void;
  setDiscount: (amount: number) => void;
  setDeliveryFee: (amount: number) => void;
  clearCart: () => void;
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const initialState: CartState = {
  items: [],
  orderType: 'dine_in',
  customerName: '',
  customerPhone: '',
  notes: '',
  kitchenNotes: '',
  tableId: null,
  discount: 0,
  deliveryFee: 0,
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find((i) => i.menuItemId === action.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.menuItemId === action.payload.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            menuItemId: action.payload.id,
            nameEn: action.payload.nameEn,
            nameAr: action.payload.nameAr,
            price: action.payload.price,
            quantity: 1,
            notes: '',
            image: action.payload.image,
          },
        ],
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.menuItemId !== action.payload),
      };
    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((i) => i.menuItemId !== action.payload.menuItemId),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.menuItemId === action.payload.menuItemId
            ? { ...i, quantity: action.payload.quantity }
            : i
        ),
      };
    }
    case 'UPDATE_ITEM_NOTES':
      return {
        ...state,
        items: state.items.map((i) =>
          i.menuItemId === action.payload.menuItemId
            ? { ...i, notes: action.payload.notes }
            : i
        ),
      };
    case 'SET_ORDER_TYPE':
      return { ...state, orderType: action.payload };
    case 'SET_CUSTOMER_NAME':
      return { ...state, customerName: action.payload };
    case 'SET_CUSTOMER_PHONE':
      return { ...state, customerPhone: action.payload };
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'SET_KITCHEN_NOTES':
      return { ...state, kitchenNotes: action.payload };
    case 'SET_TABLE':
      return { ...state, tableId: action.payload };
    case 'SET_DISCOUNT':
      return { ...state, discount: action.payload };
    case 'SET_DELIVERY_FEE':
      return { ...state, deliveryFee: action.payload };
    case 'CLEAR_CART':
      return initialState;
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = useCallback((item: MenuItem) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: menuItemId });
  }, []);

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { menuItemId, quantity } });
  }, []);

  const updateItemNotes = useCallback((menuItemId: string, notes: string) => {
    dispatch({ type: 'UPDATE_ITEM_NOTES', payload: { menuItemId, notes } });
  }, []);

  const setOrderType = useCallback((type: 'dine_in' | 'takeout' | 'delivery') => {
    dispatch({ type: 'SET_ORDER_TYPE', payload: type });
  }, []);

  const setCustomerName = useCallback((name: string) => {
    dispatch({ type: 'SET_CUSTOMER_NAME', payload: name });
  }, []);

  const setCustomerPhone = useCallback((phone: string) => {
    dispatch({ type: 'SET_CUSTOMER_PHONE', payload: phone });
  }, []);

  const setNotes = useCallback((notes: string) => {
    dispatch({ type: 'SET_NOTES', payload: notes });
  }, []);

  const setKitchenNotes = useCallback((notes: string) => {
    dispatch({ type: 'SET_KITCHEN_NOTES', payload: notes });
  }, []);

  const setTable = useCallback((tableId: string | null) => {
    dispatch({ type: 'SET_TABLE', payload: tableId });
  }, []);

  const setDiscount = useCallback((amount: number) => {
    dispatch({ type: 'SET_DISCOUNT', payload: amount });
  }, []);

  const setDeliveryFee = useCallback((amount: number) => {
    dispatch({ type: 'SET_DELIVERY_FEE', payload: amount });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const subtotal = useMemo(() => {
    return state.items.reduce(
      (sum, item) => sum + getItemPrice({ price: item.price } as any) * item.quantity,
      0
    );
  }, [state.items]);

  const tax = useMemo(() => {
    return (subtotal - state.discount) * VAT_RATE;
  }, [subtotal, state.discount]);

  const total = useMemo(() => {
    return subtotal - state.discount + tax + state.deliveryFee;
  }, [subtotal, state.discount, tax, state.deliveryFee]);

  const itemCount = useMemo(() => {
    return state.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [state.items]);

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem,
        removeItem,
        updateQuantity,
        updateItemNotes,
        setOrderType,
        setCustomerName,
        setCustomerPhone,
        setNotes,
        setKitchenNotes,
        setTable,
        setDiscount,
        setDeliveryFee,
        clearCart,
        subtotal,
        tax,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
