"use client";
import React, { createContext, useContext, useReducer } from "react";
import { CartItem, Product } from "@/lib/types";

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  discount: number;
  appliedCoupon: string | null; // Guardará o nome do cupom (ex: HELP10)
  customer: Record<string, unknown> | null; // dados do checkout (nome, tel, bairro, pagamento etc.)
};

type CartAction =
  | { type: "ADD_ITEM"; payload: Product }
  | { type: "REMOVE_ONE"; payload: string }
  | { type: "TOGGLE_CART" }
  | { type: "CLEAR_CART" }
  | { type: "SET_DISCOUNT"; payload: { value: number; code: string } }
  | { type: "REMOVE_DISCOUNT" }
  | { type: "SET_CUSTOMER"; payload: Record<string, unknown> };

const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
} | undefined>(undefined);

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.payload.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { ...state, items: [...state.items, { ...action.payload, quantity: 1 }] };
    }

    case "REMOVE_ONE": {
      return {
        ...state,
        items: state.items
          .map((i) => (i.id === action.payload ? { ...i, quantity: i.quantity - 1 } : i))
          .filter((i) => i.quantity > 0),
      };
    }

    case "TOGGLE_CART":
      return { ...state, isOpen: !state.isOpen };

    case "CLEAR_CART":
      return { ...state, items: [], isOpen: false, discount: 0, appliedCoupon: null, customer: null };

    case "SET_DISCOUNT":
      return { ...state, discount: action.payload.value, appliedCoupon: action.payload.code };

    case "REMOVE_DISCOUNT":
      return { ...state, discount: 0, appliedCoupon: null };

    case "SET_CUSTOMER":
      return { ...state, customer: action.payload };

    default:
      return state;
  }
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isOpen: false,
    discount: 0,
    appliedCoupon: null,
    customer: null,
  });

  return <CartContext.Provider value={{ state, dispatch }}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
