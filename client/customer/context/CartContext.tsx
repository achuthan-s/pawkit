import React, { createContext, useContext, useEffect, useReducer } from "react";
import type { CartItem, Product, ProductSize } from "@/types";

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD"; product: Product; size: ProductSize; qty: number }
  | { type: "REMOVE"; productId: string; sizeLabel: string }
  | { type: "UPDATE_QTY"; productId: string; sizeLabel: string; qty: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const key = `${action.product._id}__${action.size.label}`;
      const existing = state.items.findIndex(
        (i) => `${i.product._id}__${i.selectedSize.label}` === key
      );
      if (existing >= 0) {
        const updated = [...state.items];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + action.qty,
        };
        return { items: updated };
      }
      return {
        items: [
          ...state.items,
          { product: action.product, selectedSize: action.size, quantity: action.qty },
        ],
      };
    }
    case "REMOVE":
      return {
        items: state.items.filter(
          (i) => !(i.product._id === action.productId && i.selectedSize.label === action.sizeLabel)
        ),
      };
    case "UPDATE_QTY": {
      if (action.qty <= 0) {
        return {
          items: state.items.filter(
            (i) =>
              !(i.product._id === action.productId && i.selectedSize.label === action.sizeLabel)
          ),
        };
      }
      return {
        items: state.items.map((i) =>
          i.product._id === action.productId && i.selectedSize.label === action.sizeLabel
            ? { ...i, quantity: action.qty }
            : i
        ),
      };
    }
    case "CLEAR":
      return { items: [] };
    case "HYDRATE":
      return { items: action.items };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: Product, size: ProductSize, qty?: number) => void;
  removeItem: (productId: string, sizeLabel: string) => void;
  updateQty: (productId: string, sizeLabel: string, qty: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pawkit_cart");
      if (stored) dispatch({ type: "HYDRATE", items: JSON.parse(stored) });
    } catch {}
  }, []);

  // Persist on every change
  useEffect(() => {
    localStorage.setItem("pawkit_cart", JSON.stringify(state.items));
  }, [state.items]);

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = state.items.reduce(
    (sum, i) => sum + i.selectedSize.price * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        itemCount,
        subtotal,
        addItem: (product, size, qty = 1) =>
          dispatch({ type: "ADD", product, size, qty }),
        removeItem: (productId, sizeLabel) =>
          dispatch({ type: "REMOVE", productId, sizeLabel }),
        updateQty: (productId, sizeLabel, qty) =>
          dispatch({ type: "UPDATE_QTY", productId, sizeLabel, qty }),
        clearCart: () => dispatch({ type: "CLEAR" }),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
