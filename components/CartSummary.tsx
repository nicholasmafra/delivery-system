"use client";

import React from "react";
import { useCart } from "@/context/CartContext";
import { formatCurrency } from "@/lib/utils";
import { ShoppingCart, ChevronRight } from "lucide-react";

export default function CartSummary() {
  const { state, dispatch } = useCart();

  const subtotal = state.items.reduce((acc, i) => acc + Number(i.price || 0) * Number(i.quantity || 0), 0);
  const total = Math.max(0, subtotal - (state.discount || 0));

  if (!state.items || state.items.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl z-50 md:hidden">
      <div className="bg-black text-white rounded-[2rem] p-3 flex items-center justify-between shadow-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <ShoppingCart size={18} />
          </div>
          <div>
            <div className="text-[12px] font-black uppercase tracking-widest text-white/60">No carrinho</div>
            <div className="text-sm font-black">{state.items.length} itens • {formatCurrency(total)}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "TOGGLE_CART" })}
            className="px-4 py-3 rounded-2xl bg-[#FBBE01] text-black font-black uppercase tracking-widest flex items-center gap-2"
          >
            Abrir carrinho <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
