"use client";

import React from "react";
import { Package, Search, Sparkles } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/lib/types";

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  suggestedProducts: Product[];
  isLoading?: boolean;
}

export default function EmptyState({
  hasFilters,
  onClearFilters,
  suggestedProducts,
  isLoading,
}: EmptyStateProps) {
  if (isLoading) return null;

  return (
    <div className="py-16 text-center space-y-8">
      {/* Ícone e mensagem principal */}
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center">
            <Search size={32} className="text-gray-400" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black text-gray-900 mb-2">
            {hasFilters ? "Nenhum resultado encontrado" : "Nenhum item disponível"}
          </h3>
          <p className="text-sm text-gray-400">
            {hasFilters
              ? "Tente mudar seus filtros ou busca para encontrar o que procura."
              : "Volte mais tarde para novas opções."}
          </p>
        </div>
      </div>

      {/* CTA para limpar filtros */}
      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-block px-6 py-3 bg-black text-white rounded-full text-sm font-black uppercase tracking-widest hover:bg-[#FBBE01] hover:text-black transition-colors"
        >
          Limpar tudo e explorar
        </button>
      )}

      {/* Sugestões populares */}
      {suggestedProducts.length > 0 && (
        <div className="mt-12 space-y-6">
          <div className="flex items-center justify-center gap-2">
            <Sparkles size={18} className="text-[#FBBE01]" />
            <h4 className="text-sm font-black uppercase tracking-widest text-gray-400">
              Mais vendidos
            </h4>
            <Sparkles size={18} className="text-[#FBBE01]" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto px-6">
            {suggestedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
