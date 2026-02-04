"use client";
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import { supabase } from '@/lib/supabase';
import { Product } from '@/lib/types';
import { Camera } from 'lucide-react';

interface AdminProductFormProps {
  onSuccess: () => void;
  initialData?: Product | null;
}

export default function AdminProductForm({ onSuccess, initialData }: AdminProductFormProps) {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '', price: '', cost_price: '', category_id: '',
    image_url: '', stock_quantity: '', min_stock: '5', unit_type: 'un', is_featured: false
  });

  useEffect(() => {
    async function fetchCats() {
      const { data } = await supabase.from('categories').select('*');
      if (data) setCategories(data);
    }
    fetchCats();

    if (initialData) {
      setFormData({
        name: initialData.name,
        price: initialData.price.toString(),
        cost_price: initialData.cost_price?.toString() || '',
        category_id: initialData.category_id,
        image_url: initialData.image_url,
        stock_quantity: initialData.stock_quantity.toString(),
        min_stock: initialData.min_stock.toString(),
        unit_type: initialData.unit_type,
        is_featured: initialData.is_featured
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      price: parseFloat(formData.price),
      cost_price: parseFloat(formData.cost_price) || 0,
      category_id: formData.category_id,
      image_url: formData.image_url,
      stock_quantity: parseInt(formData.stock_quantity),
      min_stock: parseInt(formData.min_stock),
      unit_type: formData.unit_type,
      is_featured: formData.is_featured,
      is_active: true
    };

    const { error } = initialData?.id 
      ? await supabase.from('products').update(data).eq('id', initialData.id)
      : await supabase.from('products').insert([data]);

    if (!error) {
      showToast('Sucesso!');
      onSuccess();
    } else {
      showToast('Erro ao salvar: ' + error.message, 'error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nome do Produto</label>
          <input required className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-yellow-400" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Preço de Venda (R$)</label>
            <input required type="number" step="0.01" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Preço de Custo (R$)</label>
            <input type="number" step="0.01" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Estoque Atual</label>
            <input required type="number" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Limite Mínimo (Alerta)</label>
            <input required type="number" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black" value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: e.target.value})} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Link da Imagem</label>
          <div className="relative">
            <input className="w-full p-4 pl-12 bg-slate-50 rounded-2xl outline-none" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} />
            <Camera className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Categoria</label>
          <select className="w-full p-4 bg-slate-50 rounded-2xl outline-none" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
             {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <button type="submit" className="w-full bg-[#FBBE01] text-black py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-yellow-50 hover:scale-[1.02] active:scale-95 transition-all">
        {initialData ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR PRODUTO'}
      </button>
    </form>
  );
}