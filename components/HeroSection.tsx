"use client";

import React from "react";
import { Zap, Gift } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="bg-gradient-to-r from-black via-[#0a0a0a] to-black text-white px-6 py-8 relative overflow-hidden">
      {/* Efeito de fundo */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FBBE01] rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#FBBE01] rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Conteúdo principal */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-[#FBBE01]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FBBE01]">
                Oferta do dia
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter">
              Bebidas Geladas <br /> com <span className="text-[#FBBE01]">Desconto</span>
            </h2>

            <p className="text-sm text-white/70 max-w-md">
              Aproveite promocões especiais em bebidas selecionadas. Válido apenas hoje!
            </p>

            <div className="pt-2">
              <button
                type="button"
                className="px-6 py-3 bg-[#FBBE01] text-black font-black uppercase tracking-widest rounded-full hover:bg-white transition-colors active:scale-95"
              >
                Ver ofertas
              </button>
            </div>
          </div>

          {/* Destaque visual */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-48 h-48 md:w-56 md:h-56">
              {/* Círculo de destaque animado */}
              <div className="absolute inset-0 rounded-full border-2 border-[#FBBE01] animate-pulse"></div>
              <div className="absolute inset-4 rounded-full border border-white/20"></div>

              {/* Ícone/Texto central */}
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                <Gift size={48} className="text-[#FBBE01]" />
                <div className="text-center">
                  <div className="text-2xl font-black text-[#FBBE01]">-20%</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    Primeira compra
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
