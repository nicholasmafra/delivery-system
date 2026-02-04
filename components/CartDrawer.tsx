"use client";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/components/ToastProvider";
import { getSmartSuggestions, formatCurrency, isStoreOpen } from "@/lib/utils";
import { Product } from "@/lib/types";
import {
  Plus,
  Ticket,
  X,
  Minus,
  ArrowLeft,
  ShoppingBag,
  Clock,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import CheckoutForm from "./CheckoutForm";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SHOP_CONFIG } from "@/lib/config";

export default function CartDrawer() {
  const { state, dispatch } = useCart();
  const router = useRouter();
  const { showToast } = useToast();

  const [isCheckout, setIsCheckout] = useState(false);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [loadingCoupon, setLoadingCoupon] = useState(false);

  const storeOpen = isStoreOpen();

  useEffect(() => {
    const loadProductsForSuggestions = async () => {
      try {
        setLoadingSuggestions(true);
        const { data, error } = await supabase
          .from("products")
          .select("*, categories(name)")
          .eq("is_active", true);

        if (error) throw error;

        const formatted = (data || []).map((p: any) => ({
          ...p,
          category: p.categories?.name || "Geral",
        }));

        setDbProducts(formatted);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    loadProductsForSuggestions();
  }, []);

  const subtotal = useMemo(
    () => state.items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [state.items]
  );

  const suggestions = useMemo(() => {
    if (!dbProducts.length) return [];
    // ✅ ordem correta: (allProducts, cartItems)
    return getSmartSuggestions(dbProducts, state.items).slice(0, 4);
  }, [state.items, dbProducts]);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || loadingCoupon) return;

    setLoadingCoupon(true);
    setCouponError("");

    try {
      const code = couponInput.trim().toUpperCase();

      const { data: coupon, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (error) throw error;

      // validações básicas
      if (!coupon) {
        setCouponError("CUPOM INVÁLIDO OU EXPIRADO.");
        setLoadingCoupon(false);
        return;
      }

      // ativo?
      if (!coupon.is_active) {
        setCouponError("CUPOM PAUSADO.");
        setLoadingCoupon(false);
        return;
      }

      // expirado?
      if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
        setCouponError("CUPOM EXPIRADO.");
        setLoadingCoupon(false);
        return;
      }

      // cupom específico de produto
      if (coupon.product_id) {
        const hasProduct = state.items.some((item) => item.id === coupon.product_id);
        if (!hasProduct) {
          setCouponError("CUPOM VÁLIDO APENAS PARA ITENS ESPECÍFICOS.");
          setLoadingCoupon(false);
          return;
        }
      }

      const discountVal =
        coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;

      dispatch({
        type: "SET_DISCOUNT",
        payload: { value: discountVal, code: coupon.code.toUpperCase() },
      });

      setCouponInput("");
    } catch (e) {
      console.error(e);
      setCouponError("ERRO AO VALIDAR CUPOM.");
    } finally {
      setLoadingCoupon(false);
    }
  };

const [savingOrder, setSavingOrder] = useState(false);

const handleFinalizeOrder = async (userData: any) => {
  if (savingOrder) return;

  try {
    setSavingOrder(true);

    // Validação mínima (evita salvar pedido “vazio”)
    if (!state.items?.length) throw new Error("Carrinho vazio.");
    if (!userData?.nome) throw new Error("Nome não informado.");
    if (!userData?.telefone) throw new Error("Telefone não informado.");
    if (!userData?.bairro) throw new Error("Bairro não informado.");

    const payload = {
      customer_name: userData.nome,
      customer_phone: userData.telefone,
      address: userData.endereco,            // string
      neighborhood: userData.bairro,         // string
      items: state.items,                    // jsonb
      subtotal: subtotal,                    // number
      applied_coupon: userData.applied_coupon ?? null,
      discount: Number(userData.discount ?? 0),
      delivery_fee: Number(userData.taxa ?? userData.taxaEntrega ?? 0),
      total_amount: Number(userData.total),
      payment_method: userData.pagamento,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("orders")
      .insert([payload])
      .select("id, created_at")
      .single();
    if (error) {
      showToast(error.message || 'Erro desconhecido ao salvar pedido.', 'error');
      throw new Error(error.message || "Erro desconhecido ao salvar pedido.");
    }

    // ✅ AQUI (por enquanto) você ainda abre WhatsApp.
    // Mas quando você migrar pro fluxo n8n, isso vira webhook/server.
    const itemsList = state.items.map(i => `• ${i.quantity}x ${i.name}`).join("\n");

    const message = encodeURIComponent(
      `*🚀 NOVO PEDIDO - HELP GELA*\n\n` +
      `*CLIENTE:* ${userData.nome}\n` +
      `*ENDEREÇO:* ${userData.endereco}\n` +
      `*BAIRRO:* ${userData.bairro}\n\n` +
      `*ITENS:*\n${itemsList}\n\n` +
      `*TOTAL:* ${formatCurrency(userData.total)}\n` +
      `*PAGAMENTO:* ${userData.pagamento}` +
      (userData.applied_coupon ? `\n*CUPOM:* ${userData.applied_coupon}` : "")
    );

    const phone = SHOP_CONFIG?.phone || '5584988157402';
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");

    dispatch({ type: "CLEAR_CART" });
    router.push("/success");
  } catch (e: any) {
    console.error("[ORDER] failed =>", e);
    alert(`Não foi possível registrar seu pedido.\n\nMotivo: ${e?.message || "erro"}`);
  } finally {
    setSavingOrder(false);
  }
};


  if (!state.isOpen) return null;

  const total = Math.max(0, subtotal - (state.discount || 0));

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => dispatch({ type: "TOGGLE_CART" })}
      />

      <div className="relative bg-white w-full max-w-sm h-full flex flex-col shadow-2xl">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => dispatch({ type: "TOGGLE_CART" })}
            className="p-3 rounded-2xl bg-gray-50 hover:bg-black hover:text-white transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#FBBE01]" />
            <h2 className="text-sm font-black uppercase tracking-widest">Carrinho</h2>
          </div>

          <button
            type="button"
            onClick={() => dispatch({ type: "CLEAR_CART" })}
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            Limpar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!storeOpen && (
            <div className="mb-4 bg-red-50 text-red-600 px-4 py-3 rounded-2xl flex items-center gap-2">
              <AlertCircle size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Loja fechada - compras desabilitadas
              </span>
            </div>
        )}

        {state.items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 font-bold italic">Seu carrinho está vazio.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {state.items.map((item) => (
              <div
                key={item.id}
                className="bg-gray-50 p-4 rounded-[2rem] border border-gray-100 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-12 h-12 rounded-2xl object-cover border border-gray-100"
                  />
                  <div className="min-w-0">
                    <p className="font-black text-black truncate">{item.name}</p>
                    <p className="text-sm font-bold text-gray-400">{formatCurrency(item.price)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    // ✅ ação real do contexto
                    onClick={() => dispatch({ type: "REMOVE_ONE", payload: item.id })}
                    className="p-2 rounded-2xl bg-white hover:bg-gray-100 active:scale-95 transition-transform"
                    aria-label={`Diminuir ${item.name}`}
                    disabled={!storeOpen}
                  >
                    <Minus size={16} />
                  </button>

                  <span className="w-6 text-center font-black">{item.quantity}</span>

                  <button
                    type="button"
                    // ✅ ação real do contexto (ADD_ITEM recebe Product)
                    onClick={() => dispatch({ type: "ADD_ITEM", payload: item })}
                    className="p-2 rounded-2xl bg-white hover:bg-gray-100 active:scale-95 transition-transform"
                    aria-label={`Aumentar ${item.name}`}
                    disabled={!storeOpen}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CUPOM */}
        {state.items.length > 0 && (
          <div className="mt-6 bg-white border border-gray-100 rounded-[2rem] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Ticket size={16} className="text-[#FBBE01]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Cupom de desconto
              </p>
            </div>

            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Digite seu cupom..."
                className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 ring-[#FBBE01]"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={loadingCoupon || !couponInput.trim()}
                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                  loadingCoupon || !couponInput.trim()
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-black text-white hover:bg-[#FBBE01] hover:text-black"
                }`}
              >
                {loadingCoupon ? "..." : "Aplicar"}
              </button>
            </div>

            {!!couponError && (
              <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                <AlertCircle size={12} /> {couponError}
              </p>
            )}

            {/* ✅ agora usa appliedCoupon */}
            {state.appliedCoupon && !couponError && (
              <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-green-600">
                Cupom aplicado: {state.appliedCoupon}
              </p>
            )}
          </div>
        )}

        {/* RESUMO */}
        {state.items.length > 0 && (
          <div className="mt-6 bg-black text-white rounded-[2rem] p-6 space-y-3 shadow-xl">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/60">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            {state.discount > 0 && (
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-green-400">
                <span>Desconto ({state.appliedCoupon || "Cupom"})</span>
                <span>-{formatCurrency(state.discount)}</span>
              </div>
            )}

            <div className="flex justify-between items-end pt-3 border-t border-white/10">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FBBE01] italic">
                Total
              </span>
              <span className="text-3xl font-black tracking-tighter italic">
                {formatCurrency(Math.max(0, subtotal - (state.discount || 0)))}
              </span>
            </div>

            {!isCheckout ? (
              <button
                type="button"
                onClick={() => setIsCheckout(true)}
                disabled={!storeOpen}
                className={`w-full mt-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  !storeOpen
                    ? "bg-white/10 text-white/40 cursor-not-allowed"
                    : "bg-[#FBBE01] text-black hover:bg-white"
                }`}
              >
                Finalizar <ChevronRight size={16} />
              </button>
            ) : (
              <div className="mt-4">
                <CheckoutForm
                  itemsTotal={subtotal}
                  onSubmit={handleFinalizeOrder}
                  loading={savingOrder}
                />
                <button
                  type="button"
                  onClick={() => setIsCheckout(false)}
                  className="w-full mt-3 py-3 rounded-2xl bg-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Clock size={14} /> Voltar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sugestões */}
        {!loadingSuggestions && suggestions.length > 0 && (
          <div className="mt-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-3">
              Sugestões pra você
            </p>
            <div className="grid grid-cols-2 gap-3">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => dispatch({ type: "ADD_ITEM", payload: p })}
                  className="text-left p-4 rounded-[1.5rem] border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                  disabled={!storeOpen}
                >
                  <p className="font-black text-sm truncate">{p.name}</p>
                  <p className="text-xs font-bold text-gray-400">{formatCurrency(p.price)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => dispatch({ type: "TOGGLE_CART" })}
          className="fixed top-5 right-5 p-3 rounded-2xl bg-white border border-gray-100 shadow-lg hover:bg-black hover:text-white transition-colors md:hidden"
          aria-label="Fechar carrinho"
        >
          <X size={18} />
        </button>
      </div>
      </div>
    </div>
  );
}
