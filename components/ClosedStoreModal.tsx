"use client";
import { useEffect, useRef, useState } from "react";
import { isStoreOpen } from "@/lib/utils";
import { SHOP_CONFIG } from "@/lib/config";
import { Clock, X, Moon } from "lucide-react";

export default function ClosedStoreModal() {
  const [isOpen, setIsOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isStoreOpen()) setIsOpen(true);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Aviso: loja fechada"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={() => setIsOpen(false)}
      />

      <div className="relative w-full max-w-sm bg-white rounded-[3rem] p-10 text-center shadow-2xl animate-in zoom-in-95 duration-300">
        <button
          ref={closeBtnRef}
          onClick={() => setIsOpen(false)}
          className="absolute top-6 right-6 p-2 bg-gray-50 rounded-full text-gray-400 hover:text-black transition-colors"
          aria-label="Fechar"
          type="button"
        >
          <X size={20} />
        </button>

        <div className="w-20 h-20 bg-yellow-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
          <Moon size={40} className="text-[#FBBE01] fill-[#FBBE01]" />
        </div>

        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-black mb-2">
          Estamos descansando!
        </h2>

        <p className="text-gray-400 text-sm font-bold leading-relaxed mb-8">
          A Help Gela está fechada agora. Mas não se preocupe, logo mais a gelada estará liberada!
        </p>

        <div className="bg-gray-50 rounded-3xl p-6 mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock size={14} className="text-black" />
            <span className="text-[10px] font-black uppercase tracking-widest text-black">
              Horário de Abertura
            </span>
          </div>
          <p className="text-2xl font-black text-black">Hoje às {SHOP_CONFIG.openingTime}</p>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          className="w-full bg-black text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-[#FBBE01] hover:text-black transition-all"
          type="button"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
