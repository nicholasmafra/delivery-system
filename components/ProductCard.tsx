"use client";

import Image from "next/image";
import { Product } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import { Plus } from "lucide-react";
import { useState } from "react";
import FlyToCart from "./FlyToCart";
import { isStoreOpen } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import React from "react";

function ProductCardInner({ product }: { product: Product }) {
  const { dispatch } = useCart();
  const { showToast } = useToast();
  const [animating, setAnimating] = useState<{ x: number; y: number } | null>(null);

  const storeOpen = isStoreOpen();
  const outOfStock = (product.stock_quantity ?? 0) <= 0;
  const canBuy = storeOpen && !outOfStock;

  const handleAdd = (e: React.MouseEvent) => {
    if (!canBuy) return;

    setAnimating({ x: e.clientX, y: e.clientY });
    dispatch({ type: "ADD_ITEM", payload: product });
    showToast(`${product.name} adicionado ao carrinho`);
  };

  return (
    <>
      {animating && (
        <FlyToCart
          image={product.image_url}
          startPos={animating}
          onComplete={() => setAnimating(null)}
        />
      )}

      <div
        className={[
          "group bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col transition-all",
          "hover:shadow-xl hover:-translate-y-1",
          outOfStock ? "grayscale opacity-60" : "",
          !storeOpen ? "opacity-80" : "",
        ].join(" ")}
      >
        <div className="aspect-square bg-[#F8F9FA] rounded-[1.5rem] overflow-hidden relative">
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
            unoptimized
          />

          <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full shadow-sm">
            <span className="text-[9px] font-black uppercase text-gray-500 tracking-tighter">
              {product.category}
            </span>
          </div>

          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="text-white font-black text-[10px] uppercase tracking-widest">
                Esgotado
              </span>
            </div>
          )}
        </div>

        <div className="p-3 flex flex-col flex-1">
          <h3 className="text-gray-900 font-bold text-sm leading-tight line-clamp-2 mb-2">
            {product.name}
          </h3>

          <div className="mt-auto flex items-center justify-between">
            <span className="text-lg font-black text-black">R$ {product.price.toFixed(2)}</span>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!canBuy || !!animating}
              aria-label={canBuy ? `Adicionar ${product.name} ao carrinho` : "Indisponível"}
              className={[
                "p-3 rounded-xl transition-all active:scale-95",
                canBuy && !animating
                  ? "bg-black text-[#FBBE01] hover:opacity-90"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
              ].join(" ")}
            >
              <Plus size={20} />
            </button>
          </div>

          {!storeOpen && (
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-300">
              Loja fechada
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default React.memo(ProductCardInner);
