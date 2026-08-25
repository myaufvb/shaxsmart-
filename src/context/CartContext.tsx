import React, { createContext, useContext, useEffect, useState } from 'react';
import { Product } from '../types';
import { db } from '../db/database';

export interface CartItemWithProduct {
  id?: number;
  productId: number;
  variantId?: string;
  selectedAttributes?: Record<string, string>;
  quantity: number;
  priceOverride?: number;
  imageOverride?: string;
  product: Product;
}

interface CartContextType {
  items: CartItemWithProduct[];
  totalCount: number;
  totalPrice: number;
  addToCart: (product: Product, quantity?: number, variantId?: string, selectedAttributes?: Record<string, string>, priceOverride?: number, imageOverride?: string) => Promise<void>;
  updateQuantity: (cartItemId: number, delta: number) => Promise<void>;
  removeFromCart: (cartItemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  favorites: number[];
  toggleFavorite: (productId: number) => void;
  isFavorite: (productId: number) => boolean;
  selectedProductForDetails: Product | null;
  openProductDetails: (product: Product) => void;
  closeProductDetails: () => void;
  instantBuyProduct: Product | null;
  openInstantBuy: (product: Product) => void;
  closeInstantBuy: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem('favorites_items');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);
  const [instantBuyProduct, setInstantBuyProduct] = useState<Product | null>(null);

  const reloadCart = async () => {
    try {
      const rawCart = await db.cartItems.toArray();
      const detailed: CartItemWithProduct[] = [];

      for (const item of rawCart) {
        const prod = await db.products.get(item.productId);
        if (prod) {
          detailed.push({
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            selectedAttributes: item.selectedAttributes,
            quantity: item.quantity,
            priceOverride: item.priceOverride,
            imageOverride: item.imageOverride,
            product: prod
          });
        }
      }
      setItems(detailed);
    } catch (e) {
      console.error('Error loading cart:', e);
    }
  };

  useEffect(() => {
    reloadCart();
  }, []);

  const addToCart = async (
    product: Product,
    quantity: number = 1,
    variantId?: string,
    selectedAttributes?: Record<string, string>,
    priceOverride?: number,
    imageOverride?: string
  ) => {
    const rawCart = await db.cartItems.toArray();
    const existing = rawCart.find(i => 
      i.productId === product.id && (variantId ? i.variantId === variantId : !i.variantId)
    );

    if (existing && existing.id) {
      await db.cartItems.update(existing.id, { quantity: existing.quantity + quantity });
    } else {
      await db.cartItems.add({
        productId: product.id,
        variantId,
        selectedAttributes,
        quantity,
        priceOverride,
        imageOverride
      });
    }
    await reloadCart();
  };

  const updateQuantity = async (cartItemId: number, delta: number) => {
    const existing = await db.cartItems.get(cartItemId);
    if (!existing || !existing.id) return;

    const newQty = existing.quantity + delta;
    if (newQty <= 0) {
      await db.cartItems.delete(existing.id);
    } else {
      await db.cartItems.update(existing.id, { quantity: newQty });
    }
    await reloadCart();
  };

  const removeFromCart = async (cartItemId: number) => {
    await db.cartItems.delete(cartItemId);
    await reloadCart();
  };

  const clearCart = async () => {
    await db.cartItems.clear();
    await reloadCart();
  };

  const toggleFavorite = (productId: number) => {
    setFavorites(prev => {
      const updated = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      localStorage.setItem('favorites_items', JSON.stringify(updated));
      return updated;
    });
  };

  const isFavorite = (productId: number) => favorites.includes(productId);

  const openProductDetails = (product: Product) => {
    setSelectedProductForDetails(product);
  };

  const closeProductDetails = () => {
    setSelectedProductForDetails(null);
  };

  const openInstantBuy = (product: Product) => {
    setInstantBuyProduct(product);
  };

  const closeInstantBuy = () => {
    setInstantBuyProduct(null);
  };

  const totalCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = items.reduce((acc, item) => {
    const itemPrice = item.priceOverride !== undefined ? item.priceOverride : item.product.price;
    return acc + itemPrice * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        totalCount,
        totalPrice,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        favorites,
        toggleFavorite,
        isFavorite,
        selectedProductForDetails,
        openProductDetails,
        closeProductDetails,
        instantBuyProduct,
        openInstantBuy,
        closeInstantBuy
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
