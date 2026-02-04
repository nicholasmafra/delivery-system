"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { mutate } from '@/lib/simpleSWR';
import Link from "next/link";
import { Package, Search, ShoppingBag, AlertCircle, X, ArrowUpDown, EyeOff } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Product } from "@/lib/types";
import { isStoreOpen } from "@/lib/utils";
import useDebounce from '@/lib/useDebounce';
import { useToast } from '@/components/ToastProvider';

import ProductCard from "@/components/ProductCard";
import ProductSkeleton from "@/components/ProductSkeleton";
import CartDrawer from "@/components/CartDrawer";
import CategoryBar from "@/components/CategoryBar";
import StatusBadge from "@/components/StatusBadge";
import TabBar from "@/components/TabBar";
import ClosedStoreModal from "@/components/ClosedStoreModal";
import { useCart } from "@/context/CartContext";

type SortOption = "relevance" | "price_asc" | "price_desc" | "name_asc";

export default function HomePage() {
  const { state, dispatch } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);

  const [activeCategory, setActiveCategory] = useState(() => searchParams.get("cat") || "Todos");
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") || "");

  const [sort, setSort] = useState<SortOption>(
    () => (searchParams.get("sort") as SortOption) || "relevance"
  );
  const [hideOutOfStock, setHideOutOfStock] = useState<boolean>(() => searchParams.get("hide") === "1");

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { showToast } = useToast();

  const storeOpen = isStoreOpen();

  // mantém URL em sync com filtros (debounced para evitar muitas escritas)
  useEffect(() => {
    const params = new URLSearchParams();

    if (activeCategory && activeCategory !== "Todos") params.set("cat", activeCategory);
    if (debouncedSearchTerm.trim()) params.set("q", debouncedSearchTerm.trim());
    if (sort !== "relevance") params.set("sort", sort);
    if (hideOutOfStock) params.set("hide", "1");

    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, debouncedSearchTerm, sort, hideOutOfStock]);

  useEffect(() => { setMounted(true); }, []);

  // SWR fetcher for products (cached)
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*, categories(name)")
      .eq("is_active", true);

    if (error) throw error;

    const formatted = (data || []).map((p: any) => ({
      ...(p as Product),
      category: p.categories?.name || "Geral",
    } as Product));

    return formatted;
  };

  const { data: products = [], error: swrError, isLoading } = useSWR<Product[]>('products', fetchProducts);

  useEffect(() => {
    if (swrError) {
      console.error(swrError);
      const msg = (swrError as any)?.message || 'Erro ao carregar produtos';
      setLoadError(msg);
      showToast(msg, 'error');
    }
  }, [swrError, showToast]);

  const filteredProducts = useMemo(() => {
    const q = (debouncedSearchTerm || '').trim().toLowerCase();

    let list = products.filter((p) => {
      const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      const inStock = Number(p.stock_quantity ?? 0) > 0;

      const matchesStock = hideOutOfStock ? inStock : true;

      return matchesCategory && matchesSearch && matchesStock;
    });

    // Ordenação
    if (sort !== "relevance") {
      list = [...list].sort((a, b) => {
        const ap = Number(a.price || 0);
        const bp = Number(b.price || 0);

        if (sort === "price_asc") return ap - bp;
        if (sort === "price_desc") return bp - ap;
        if (sort === "name_asc") return String(a.name).localeCompare(String(b.name));
        return 0;
      });
    }

    return list;
  }, [products, activeCategory, debouncedSearchTerm, sort, hideOutOfStock]);

  const cartItemsCount = state.items.reduce((acc, item) => acc + item.quantity, 0);

  const clearSearch = () => setSearchTerm("");
  const clearAllFilters = () => {
    setActiveCategory("Todos");
    setSearchTerm("");
    setSort("relevance");
    setHideOutOfStock(false);
  };

  const hasActiveFilters =
    (activeCategory && activeCategory !== "Todos") ||
    !!searchTerm.trim() ||
    sort !== "relevance" ||
    hideOutOfStock;

  return (
    <main className="min-h-screen bg-white">
      <ClosedStoreModal />

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black tracking-tighter italic uppercase text-black">
                Help Gela
              </h1>
              <StatusBadge isOpen={storeOpen} />
            </div>

            <button
              onClick={() => dispatch({ type: "TOGGLE_CART" })}
              className="cart-icon-target relative p-3 bg-gray-100 rounded-2xl hover:bg-black hover:text-white transition-all active:scale-90"
              aria-label="Abrir carrinho"
              type="button"
            >
              <ShoppingBag size={24} />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FBBE01] text-black text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative group w-full">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#FBBE01] transition-colors"
              size={18}
            />

            <input
              id="search-input"
              type="text"
              placeholder="O que vamos beber hoje?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-4 bg-gray-50 rounded-[1.5rem] text-sm font-bold border-none focus:ring-2 ring-[#FBBE01] outline-none"
              aria-label="Buscar produtos"
            />

            {!!searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-white transition-colors"
                aria-label="Limpar busca"
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>

          {/* Controles rápidos (Sort + Ocultar esgotados) */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-2">
              <ArrowUpDown size={14} className="text-gray-300" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:outline-none appearance-none text-[10px] font-black uppercase tracking-widest text-gray-400"
                aria-label="Ordenar produtos"
              >
                <option value="relevance">Relevância</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
                <option value="name_asc">A–Z</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setHideOutOfStock((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                hideOutOfStock
                  ? "bg-black text-white border-black"
                  : "bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200"
              }`}
              aria-pressed={hideOutOfStock}
              aria-label="Ocultar itens esgotados"
            >
              <EyeOff size={14} className={hideOutOfStock ? "text-[#FBBE01]" : "text-gray-300"} />
              Ocultar esgotados
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="ml-auto px-4 py-2 rounded-2xl bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-black hover:text-white transition-colors"
              >
                Limpar tudo
              </button>
            )}
          </div>

          {/* Chips de filtros ativos */}
          {(activeCategory !== "Todos" || !!searchTerm.trim()) && (
            <div className="flex flex-wrap gap-2">
              {activeCategory !== "Todos" && (
                <button
                  type="button"
                  onClick={() => setActiveCategory("Todos")}
                  className="px-4 py-2 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-transform"
                  aria-label="Limpar categoria"
                >
                  Categoria: {activeCategory}
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                    <X size={12} className="text-white" />
                  </span>
                </button>
              )}

              {!!searchTerm.trim() && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="px-4 py-2 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 active:scale-95 transition-transform"
                  aria-label="Limpar busca"
                >
                  Busca: {searchTerm.trim()}
                  <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center border border-gray-100">
                    <X size={12} className="text-gray-400" />
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {!storeOpen && (
        <div className="bg-red-50 text-red-600 py-3 px-6 flex items-center justify-center gap-2 border-b border-red-100">
          <AlertCircle size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Loja fechada - Compras desabilitadas
          </span>
        </div>
      )}

      <section className="max-w-7xl mx-auto px-6 mt-6">
        <CategoryBar activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
      </section>

      <section className="px-6 mt-8 max-w-7xl mx-auto pb-40">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-[#FBBE01]" />
            <h2 className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400">
              {searchTerm ? `Resultados: ${searchTerm}` : activeCategory}
            </h2>
          </div>

          {!isLoading && (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
              {filteredProducts.length} itens
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)
          ) : (
            <div className="col-span-full py-20 text-center">
              {loadError ? (
                <div className="space-y-4">
                  <p className="text-red-500 font-black">Erro ao carregar produtos: {loadError}</p>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => mutate('products')} className="px-6 py-3 bg-black text-white rounded-full font-black">Tentar novamente</button>
                    <button onClick={clearAllFilters} className="px-6 py-3 bg-gray-50 rounded-full border border-gray-100 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Limpar filtros</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-400 font-bold italic mb-4">Nenhum item encontrado com esses filtros.</p>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="px-6 py-3 bg-gray-50 rounded-full border border-gray-100 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {mounted && (
        <footer className="mb-24 flex flex-col items-center gap-6 border-t border-gray-100 pt-10 px-6">
          <Link
            href="/admin/login"
            className="group flex items-center gap-2 px-6 py-3 bg-gray-50 rounded-full border border-gray-100"
          >
            <span className="w-2 h-2 bg-[#FBBE01] rounded-full animate-pulse group-hover:bg-white transition-colors"></span>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-black transition-colors">
              Portal do Parceiro
            </span>
          </Link>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 text-center">
            © 2026 Help Gela Conveniência
          </p>
        </footer>
      )}

      <CartDrawer />
      <TabBar />
    </main>
  );
}
