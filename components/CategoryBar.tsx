"use client";
import { CATEGORIES } from '@/lib/types';

interface CategoryBarProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function CategoryBar({ activeCategory, onCategoryChange }: CategoryBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
      <button
        onClick={() => onCategoryChange('Todos')}
        className={`px-6 py-2 rounded-full text-sm font-semibold transition-all border
          ${activeCategory === 'Todos' 
            ? 'bg-black text-white border-black shadow-md' 
            : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'}`}
      >
        Todos
      </button>
      
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onCategoryChange(cat)}
          className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-semibold transition-all border
            ${activeCategory === cat 
              ? 'bg-black text-white border-black shadow-md' 
              : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'}`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}