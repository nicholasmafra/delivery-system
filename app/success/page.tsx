"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  MessageCircle,
  Home,
  Package,
  MapPin,
  AlertCircle,
  Copy,
  Clock,
} from "lucide-react";

import { useCart } from "@/context/CartContext";
import { SHOP_CONFIG } from "@/lib/config";
import { formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/lib/types";

type OrderSnapshot = {
  ref: string;
  createdAt: string;
  items: CartItem[];
  discount: number;
  appliedCoupon: string | null;
  customer: any | null;
};

const STORAGE_LAST_ORDER = "help_gela_last_order_snapshot";

function generateOrderRef() {
  // Ex: HG-8F3A21 (curto e bom pro WhatsApp)
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `HG-${rand}`;
}

export default function SuccessPage() {
  const { state, dispatch } = useCart();

  const [snapshot, setSnapshot] = useState<OrderSnapshot | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1) tenta recuperar snapshot salvo (se usuário recarregar a página)
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_LAST_ORDER) : null;
    if (saved) {
      try {
        const parsed: OrderSnapshot = JSON.parse(saved);
        setSnapshot(parsed);
      } catch {}
    }

    // 2) se o carrinho ainda tem info agora, captura e salva
    const hasLiveData =
      (state.items && state.items.length > 0) ||
      !!state.customer ||
      !!state.appliedCoupon ||
      (state.discount ?? 0) > 0;

    if (hasLiveData) {
      const next: OrderSnapshot = {
        ref: generateOrderRef(),
        createdAt: new Date().toISOString(),
        items: state.items || [],
        discount: state.discount || 0,
        appliedCoupon: state.appliedCoupon || null,
        customer: state.customer || null,
      };

      setSnapshot(next);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_LAST_ORDER, JSON.stringify(next));
      }

      // ✅ limpa o carrinho DEPOIS de capturar
      dispatch({ type: "CLEAR_CART" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customer = snapshot?.customer || null;

  const itemsCount = useMemo(() => {
    const items = snapshot?.items || [];
    return items.reduce((acc, i) => acc + (i.quantity || 0), 0);
  }, [snapshot]);

  const subtotal = useMemo(() => {
    const items = snapshot?.items || [];
    return items.reduce((acc, i) => acc + Number(i.price || 0) * Number(i.quantity || 0), 0);
  }, [snapshot]);

  const deliveryFee = Number(customer?.taxaEntrega || 0);

  const totalEstimated = useMemo(() => {
    // Se seu CheckoutForm já envia total fechado, usamos
    if (typeof customer?.total === "number") return customer.total;

    // senão calculamos estimado com o snapshot
    const discount = Number(snapshot?.discount || 0);
    return Math.max(0, subtotal - discount + deliveryFee);
  }, [customer?.total, deliveryFee, snapshot?.discount, subtotal]);

  const orderRef = snapshot?.ref || "HG-??????";
  const phoneDigits = String(SHOP_CONFIG.phone || "").replace(/\D/g, "");

  const itemsPreviewLines = useMemo(() => {
    const items = snapshot?.items || [];
    // mostra até 6 linhas (pra não ficar enorme)
    return items.slice(0, 6).map((i) => `• ${i.name} ×${i.quantity}`);
  }, [snapshot]);

  const whatsappMessage = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Olá! Acabei de fazer um pedido (${orderRef}). 🙂`);

    if (customer?.nome) lines.push(`Cliente: ${customer.nome}`);
    if (customer?.telefone) lines.push(`Contato: ${customer.telefone}`);

    if (customer?.endereco || customer?.numero || customer?.bairro) {
      lines.push(
        `Entrega: ${customer?.endereco || ""}${customer?.numero ? `, ${customer.numero}` : ""}${
          customer?.bairro ? ` - ${customer.bairro}` : ""
        }`.trim()
      );
    }

    if (itemsPreviewLines.length) {
      lines.push("");
      lines.push("Itens:");
      lines.push(...itemsPreviewLines);
      if ((snapshot?.items?.length || 0) > 6) lines.push("• ...");
    }

    lines.push("");
    lines.push(`Total estimado: ${formatCurrency(totalEstimated)}`);

    if (snapshot?.appliedCoupon) lines.push(`Cupom: ${snapshot.appliedCoupon}`);

    return encodeURIComponent(lines.join("\n"));
  }, [customer, itemsPreviewLines, orderRef, snapshot?.appliedCoupon, snapshot?.items?.length, totalEstimated]);

  const whatsappHref = `https://wa.me/${phoneDigits}?text=${whatsappMessage}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback silencioso
    }
  };

  const PRIMARY_COLOR = "#FBBE01";

  const showOrderSummary = !!snapshot && (itemsCount > 0 || !!customer);

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      {/* Sucesso */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20" />
        <div className="relative w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
          <CheckCircle2 size={46} className="text-green-500" />
        </div>
      </div>

      <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic leading-tight">
        PEDIDO <span style={{ color: PRIMARY_COLOR }}>ENVIADO!</span>
      </h1>

      <p className="text-gray-500 font-medium max-w-sm mt-3 leading-relaxed">
        Você pode fechar esta página com segurança.
        <br />
        O atendente da{" "}
        <span className="text-black font-bold uppercase">{SHOP_CONFIG.name}</span> já recebeu seu pedido.
      </p>

      {/* Referência */}
      <div className="mt-5 flex items-center gap-2">
        <span className="px-4 py-2 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500">
          Pedido <span className="text-black">{orderRef}</span>
        </span>

        <button
          type="button"
          onClick={handleCopy}
          className="px-4 py-2 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center gap-2"
          aria-label="Copiar referência do pedido"
        >
          <Copy size={14} />
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>

      {/* Tempo médio */}
      <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
        <Clock size={12} />
        Tempo médio de resposta: 2–5 min
      </div>

      {/* Resumo */}
      {showOrderSummary ? (
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-7 border border-gray-100 mt-8 text-left space-y-4 shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Resumo do pedido
          </h3>

          <div className="space-y-2">
            {customer?.nome && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-bold">Cliente</span>
                <span className="font-black text-gray-900">{customer.nome}</span>
              </div>
            )}

            {customer?.pagamento && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-bold">Pagamento</span>
                <span className="font-black text-gray-900">{customer.pagamento}</span>
              </div>
            )}

            {(customer?.endereco || customer?.bairro) && (
              <div className="text-sm">
                <p className="text-gray-400 font-bold mb-1">Entrega</p>
                <p className="font-black text-gray-900 leading-snug">
                  {customer?.endereco ? customer.endereco : ""}
                  {customer?.numero ? `, ${customer.numero}` : ""}
                  {customer?.bairro ? (
                    <>
                      <br />
                      <span className="text-gray-500 font-bold">{customer.bairro}</span>
                    </>
                  ) : null}
                </p>
              </div>
            )}

            {!!snapshot?.appliedCoupon && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-bold">Cupom</span>
                <span className="font-black text-green-600">{snapshot.appliedCoupon}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400 font-bold">Itens</span>
              <span className="font-black text-gray-900">{itemsCount}</span>
            </div>
          </div>

          {/* Lista de itens */}
          {snapshot?.items?.length ? (
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Package size={14} className="text-[#FBBE01]" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Itens do pedido
                </p>
              </div>

              <div className="space-y-2">
                {snapshot.items.slice(0, 6).map((i) => (
                  <div key={i.id} className="flex justify-between items-start gap-3">
                    <p className="font-bold text-gray-900 leading-snug">
                      {i.name} <span className="text-gray-400 font-black">×{i.quantity}</span>
                    </p>
                    <p className="text-gray-500 font-black">
                      {formatCurrency(Number(i.price || 0) * Number(i.quantity || 0))}
                    </p>
                  </div>
                ))}
                {snapshot.items.length > 6 && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                    + {snapshot.items.length - 6} item(ns)
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {/* Total */}
          <div className="pt-5 border-t border-gray-100 flex justify-between items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Total estimado
              </p>
              <p className="text-[10px] font-bold text-gray-400 italic flex items-center gap-2 mt-2">
                <AlertCircle size={12} />
                Pode mudar se ajustarem entrega/itens.
              </p>
            </div>
            <p className="text-3xl font-black text-gray-900 italic">{formatCurrency(totalEstimated)}</p>
          </div>
        </div>
      ) : null}

      {/* O que acontece agora */}
      <div className="w-full max-w-md bg-gray-50 rounded-[2.5rem] p-7 border border-gray-100 mt-6 text-left space-y-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
          O que acontece agora?
        </h3>

        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <MessageCircle size={18} className="text-green-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Confirmação no WhatsApp</p>
            <p className="text-xs text-gray-500">
              Se quiser agilizar, clique abaixo e confirme com a referência do pedido.
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <MapPin size={18} style={{ color: PRIMARY_COLOR }} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Preparo e Entrega</p>
            <p className="text-xs text-gray-500">
              Seus itens serão separados e enviados assim que a confirmação estiver ok.
            </p>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="w-full max-w-md space-y-3 mt-7">
        <Link
          href={whatsappHref}
          target="_blank"
          className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <MessageCircle size={18} />
          Confirmar no WhatsApp
        </Link>

        <Link
          href="/"
          className="flex items-center justify-center gap-2 w-full bg-black text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-gray-800 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Home size={18} />
          Fazer outro pedido
        </Link>
      </div>

      <footer className="mt-14 flex flex-col items-center gap-2 opacity-40">
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">{SHOP_CONFIG.name}</p>
        <div className="flex items-center gap-1 text-[8px] font-bold uppercase">
          <MapPin size={10} /> {SHOP_CONFIG.address}
        </div>
      </footer>
    </main>
  );
}
