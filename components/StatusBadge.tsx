"use client";
import { SHOP_CONFIG } from "@/lib/config";

interface StatusBadgeProps {
  isOpen: boolean;
}

export default function StatusBadge({ isOpen }: StatusBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full animate-pulse ${isOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
        {isOpen ? 'Aberto Agora' : `Fechado (Abre às ${SHOP_CONFIG.openingTime})`}
      </span>
    </div>
  );
}