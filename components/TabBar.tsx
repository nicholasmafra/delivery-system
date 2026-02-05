"use client";
import { Home, Search, User, Heart, ShoppingCart } from "lucide-react";
import { useToast } from '@/components/ToastProvider';
import { useCart } from '@/context/CartContext';

function focusSearch() {
  const el = document.getElementById("search-input") as HTMLInputElement | null;
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Delay ajuda o teclado abrir no mobile
    setTimeout(() => el.focus(), 120);
    return true;
  }
  return false;
}

export default function TabBar() {
  const { showToast } = useToast();
  const { state, dispatch } = useCart();

  const cartCount = state.items.reduce((acc, item) => acc + item.quantity, 0);

  const handleHome = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSearch = () => {
    if (!focusSearch()) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setTimeout(() => focusSearch(), 220);
    }
  };

  const handleProfile = () => {
    // Padrão útil: portal/parceiro
    if (typeof window !== "undefined") {
      window.location.href = "/admin/login";
    }
  };

  const handleSoon = () => {
    showToast('Em breve 🙂');
  };

  const handleCart = () => {
    dispatch({ type: "TOGGLE_CART" });
  };

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-black/90 backdrop-blur-xl rounded-[2.5rem] px-8 py-4 flex justify-between items-center z-50 shadow-2xl border border-white/10">
      <button
        type="button"
        onClick={handleHome}
        aria-label="Voltar para o início"
        className="flex flex-col items-center gap-1 text-[#FBBE01] transition-transform active:scale-90"
      >
        <Home size={22} />
        <span className="text-[8px] font-black uppercase tracking-tighter">Início</span>
      </button>

      <button
        type="button"
        onClick={handleSearch}
        aria-label="Buscar produtos"
        className="flex flex-col items-center gap-1 text-white/80 transition-transform active:scale-90"
      >
        <Search size={22} />
        <span className="text-[8px] font-black uppercase tracking-tighter">Busca</span>
      </button>

      <button
        type="button"
        onClick={handleSoon}
        aria-label="Favoritos (em breve)"
        className="flex flex-col items-center gap-1 text-white/40 transition-transform active:scale-90"
      >
        <Heart size={22} />
        <span className="text-[8px] font-black uppercase tracking-tighter">Favoritos</span>
      </button>

      <button
        type="button"
        onClick={handleCart}
        aria-label={`Carrinho com ${cartCount} itens`}
        className="flex flex-col items-center gap-1 relative text-white/80 hover:text-[#FBBE01] transition-transform active:scale-90"
      >
        <div className="relative">
          <ShoppingCart size={22} />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#FBBE01] text-black text-[10px] font-black rounded-full flex items-center justify-center animate-bounce border border-black">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </div>
        <span className="text-[8px] font-black uppercase tracking-tighter">Carrinho</span>
      </button>

      <button
        type="button"
        onClick={handleProfile}
        aria-label="Perfil / Portal do parceiro"
        className="flex flex-col items-center gap-1 text-white/40 transition-transform active:scale-90"
      >
        <User size={22} />
        <span className="text-[8px] font-black uppercase tracking-tighter">Perfil</span>
      </button>
    </div>
  );
}
