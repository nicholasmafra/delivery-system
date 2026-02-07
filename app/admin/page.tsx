"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Product, Neighborhood, Coupon } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import AdminProductForm from '@/components/AdminProductForm';
import Modal from '@/components/Modal';
import useDebounce from '@/lib/useDebounce';
import { useToast } from '@/components/ToastProvider';
import { useLoading } from '@/components/LoadingProvider';
import {
  LayoutDashboard, Package, Truck, Trash2, TrendingUp,
  Ticket, Plus, Search, BarChart3, Edit3, Calendar,
  Zap, X, MapPin, ChevronLeft, ChevronRight, LogOut,
  ShoppingBag, Clock, User, CreditCard, AlertTriangle, Filter
} from 'lucide-react';

interface AISuggestion extends Partial<Product> {
  name: string;
  totalSold?: number;
  type: 'estoque' | 'sazonal';
  desc?: string;
  id?: string;
}

export default function AdminPage() {
  const [tab, setTab] = useState<'metrics' | 'products' | 'fees' | 'promotions' | 'sales' | 'categories' | 'abc'>('metrics');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Vendas (UX)
  const [salesSearch, setSalesSearch] = useState('');
  const debouncedSalesSearch = useDebounce(salesSearch, 300);
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<'all' | 'pix' | 'cash' | 'card'>('all');
  const [salesStatusFilter, setSalesStatusFilter] = useState<'all' | 'pending' | 'out_for_delivery' | 'delivered' | 'cancelled'>('all');
  const [salesPage, setSalesPage] = useState(1);
  const [paginatedSales, setPaginatedSales] = useState<any[]>([]);
  const [salesCount, setSalesCount] = useState(0);
  const [salesLoading, setSalesLoading] = useState(false);

  // Estados de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [orderStatusUpdating, setOrderStatusUpdating] = useState(false);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewingCoupon, setViewingCoupon] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean, table: string, id: string } | null>(null);

  const { showToast } = useToast();
  const { startLoading, stopLoading } = useLoading();
  const router = useRouter();

  const [forecastDays, setForecastDays] = useState(2);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<any>({
    name: '', fee: '', code: '', value: '', type: 'percent', end_date: '', product_id: ''
  });

  // Bulk selection for products
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  

  const loadData = async () => {
    startLoading();
    const { data: p } = await supabase.from('products').select('*, categories(name)').order('name');
    const { data: cat } = await supabase.from('categories').select('*').order('name');
    const { data: n } = await supabase.from('delivery_fees').select('*').order('neighborhood_name');
    const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const { data: c } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });

    if (p) {
      const formatted = p.map((item: any) => ({ ...item, category: item.categories?.name || 'Geral' }));
      setProducts(formatted);
      if (o) generateAISuggestions(formatted, o);
    }
    if (cat) setCategories(cat);
    if (n) setNeighborhoods(n.map((item: any) => ({ id: item.id, name: item.neighborhood_name, fee: item.fee })));
    if (o) setOrders(o);
    if (c) setCoupons(c);
    stopLoading();
  };

  // helper: audit log
  const logAudit = async (action: string, table: string, recordId: string | null, meta: any = null) => {
    try {
      await supabase.from('admin_audit').insert([{ action, table, record_id: recordId, meta }]);
    } catch (e) {
      // non-blocking
    }
  };

  useEffect(() => { loadData(); }, []);

  // Protege rota: redireciona para /admin/login se usuário não autenticado
  useEffect(() => {
    const check = async () => {
      startLoading();
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        stopLoading();
        router.push('/admin/login');
      } else {
        stopLoading();
      }
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualização em tempo real (novos pedidos / mudanças de status)
  useEffect(() => {
    const fetchOrdersOnly = async () => {
      startLoading();
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setOrders(data);
        // Recalcula sugestões quando entra pedido novo
        generateAISuggestions(products, data);
      }
      stopLoading();
    };

    const channel = supabase
      .channel('admin-orders-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          // refetch simples = confiável (evita bugs com payload parcial)
          fetchOrdersOnly();
        }
      )
      .subscribe();

    const onFocus = () => fetchOrdersOnly();
    if (typeof window !== "undefined") {
      window.addEventListener('focus', onFocus);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener('focus', onFocus);
      }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const generateAISuggestions = (allProducts: Product[], allOrders: any[]) => {
    // Objetivo: sugestões úteis e NÃO estáticas
    // 1) Baseado em vendas (últimos 30 dias)
    // 2) Baseado em sazonalidade (carnaval, páscoa, são joão, natal, ano novo, verão)

    const normalize = (s: string) =>
      (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const txt = (p: any) => normalize(`${p?.name || ''} ${p?.category || ''}`);
    const has = (p: any, keywords: string[]) => {
      const t = txt(p);
      return keywords.some((k) => t.includes(normalize(k)));
    };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = (allOrders || []).filter((o) => new Date(o.created_at) >= thirtyDaysAgo);

    // quantity vendida por produto
    const soldById: Record<string, number> = {};
    recentOrders.forEach((o) => {
      (o.items || []).forEach((it: any) => {
        const pid = String(it.id);
        soldById[pid] = (soldById[pid] || 0) + (Number(it.quantity) || 0);
      });
    });

    const activeProducts = (allProducts || []).filter((p) => (p.stock_quantity ?? 0) > 0);

    // 1) Produtos parados (com estoque) = bons candidatos para promoção
    const slowMovers: AISuggestion[] = activeProducts
      .filter((p) => (soldById[p.id] || 0) < 5)
      .sort((a, b) => (soldById[a.id] || 0) - (soldById[b.id] || 0))
      .slice(0, 12)
      .map((p) => ({ ...p, totalSold: soldById[p.id] || 0, type: 'estoque' }));

    // 2) Sugestões de combos (cross-sell) usando o que mais vendeu
    const topSoldIds = Object.entries(soldById)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);

    const topProducts = activeProducts.filter((p) => topSoldIds.includes(p.id));

    const findProductByKeywords = (keywords: string[]) => {
      return activeProducts.find((p) => has(p, keywords));
    };

    const comboCards: AISuggestion[] = [];

    const topHasBeer = topProducts.some((p) => has(p, ['cerveja', 'heineken', 'brahma', 'skol', 'bud']));
    const topHasSpirits = topProducts.some((p) => has(p, ['whisky', 'vodka', 'gin', 'destil']));

    if (topHasBeer) {
      const ice = findProductByKeywords(['gelo']);
      comboCards.push({
        name: 'Combo cerveja + gelo',
        desc: ice ? `Sugestão: cupom em ${ice.name} (gelo) para aumentar o ticket.` : 'Sugestão: crie cupom para GELO (2kg/5kg) para aumentar o ticket.',
        type: 'sazonal',
        id: ice?.id || 'combo-cerveja-gelo',
      });
    }

    if (topHasSpirits) {
      const energy = findProductByKeywords(['energetico', 'energético']);
      const tonic = findProductByKeywords(['tonica', 'tônica']);
      comboCards.push({
        name: 'Combo destilado + mixer',
        desc: energy || tonic ? 'Sugestão: desconto em MIXERS (energético/tônica) para vender junto.' : 'Sugestão: incluir Energético/Tônica no catálogo e rodar cupom combo.',
        type: 'sazonal',
        id: (energy || tonic)?.id || 'combo-destilado-mixer',
      });
    }

    // 3) Sazonalidade (Brasil) — janelas simples e úteis
    const now = new Date();
    const m = now.getMonth() + 1;

    const seasonalCards: AISuggestion[] = [];

    // Verão (dez a mar)
    if (m === 12 || m === 1 || m === 2 || m === 3) {
      seasonalCards.push({
        name: 'Promoção de Verão',
        desc: 'Foco em bebidas geladas: cervejas, água, refrigerantes e energéticos + gelo.',
        type: 'sazonal',
        id: 'sazonal-verao',
      });
    }

    // Carnaval (fev/mar)
    if (m === 2 || m === 3) {
      seasonalCards.push({
        name: 'Especial Carnaval',
        desc: 'Sugestão: combos (cerveja + gelo) e desconto progressivo em packs.',
        type: 'sazonal',
        id: 'sazonal-carnaval',
      });
    }

    // Páscoa (mar/abr)
    if (m === 3 || m === 4) {
      seasonalCards.push({
        name: 'Ação Páscoa',
        desc: 'Sugestão: combos de bebidas + snacks. Se vender chocolate/vinho, destaque aqui.',
        type: 'sazonal',
        id: 'sazonal-pascoa',
      });
    }

    // São João (jun)
    if (m === 6) {
      seasonalCards.push({
        name: 'Especial São João',
        desc: 'Sugestão: combos de churrasco (carvão + gelo + bebidas) e destilados.',
        type: 'sazonal',
        id: 'sazonal-saojoao',
      });
    }

    // Natal/Ano Novo (dez)
    if (m === 12) {
      seasonalCards.push({
        name: 'Natal & Ano Novo',
        desc: 'Sugestão: destaque bebidas premium + gelo e desconto em combos para confraternização.',
        type: 'sazonal',
        id: 'sazonal-natal',
      });
    }

    // Monta lista final (sazonal + combos + slow movers)
    const finalList: AISuggestion[] = [...seasonalCards, ...comboCards, ...slowMovers].slice(0, 18);
    setSuggestions(finalList);
  };

  // keep selectedOrderStatus in sync when modal opens
  useEffect(() => {
    setSelectedOrderStatus(viewingOrder?.status ?? null);
  }, [viewingOrder]);

  const scrollSuggestions = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes((debouncedSearchTerm || '').toLowerCase()));
  }, [products, debouncedSearchTerm]);

  // ---------- Vendas: filtros / paginação ----------
  const normalizeText = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const paymentKey = (paymentMethod: string) => {
    const v = normalizeText(paymentMethod);
    if (v.includes('pix')) return 'pix';
    if (v.includes('dinheiro') || v.includes('cash')) return 'cash';
    if (v.includes('cart')) return 'card';
    return 'other';
  };

  const filteredSales = useMemo(() => {
    const q = normalizeText(debouncedSalesSearch);
    return orders.filter((o) => {
      // filtro pagamento
      if (salesPaymentFilter !== 'all' && paymentKey(o.payment_method) !== salesPaymentFilter) return false;

      // busca
      if (!q) return true;
      const blob = normalizeText(`${o.customer_name || ''} ${o.payment_method || ''} ${o.id || ''} ${o.applied_coupon || ''}`);
      return blob.includes(q);
    });
  }, [orders, debouncedSalesSearch, salesPaymentFilter]);

  const SALES_PAGE_SIZE = 12;
  const salesTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(salesCount / SALES_PAGE_SIZE));
  }, [salesCount]);

  useEffect(() => {
    // reset página quando filtros mudarem
    setSalesPage(1);
    fetchOrdersPage(1);
  }, [debouncedSalesSearch, salesPaymentFilter, salesStatusFilter]);

  const salesPageItems = useMemo(() => {
    return paginatedSales;
  }, [paginatedSales]);

  const paymentFilterToCondition = (filter: string) => {
    if (filter === 'pix') return { column: 'payment_method', op: 'ilike', value: '%pix%' };
    if (filter === 'cash') return { column: 'payment_method', op: 'ilike', value: '%dinheiro%' };
    if (filter === 'card') return { column: 'payment_method', op: 'ilike', value: '%cart%' };
    return null;
  };

  const fetchOrdersPage = async (pageNum: number = 1) => {
    try {
      setSalesLoading(true);
      const start = (pageNum - 1) * SALES_PAGE_SIZE;
      const end = start + SALES_PAGE_SIZE - 1;
      const q = debouncedSalesSearch.trim();

      let query: any = supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(start, end);

      // payment filter
      const cond = paymentFilterToCondition(salesPaymentFilter);
      if (cond) query = query.filter(cond.column, cond.op, cond.value);

      // status filter
      if (salesStatusFilter && salesStatusFilter !== 'all') {
        query = query.eq('status', salesStatusFilter);
      }

      // search across some fields using or
      if (q) {
        const pattern = `%${q}%`;
        query = query.or(`customer_name.ilike.${pattern},payment_method.ilike.${pattern},id.ilike.${pattern},applied_coupon.ilike.${pattern}`);
      }

      const res = await query;
      if (!res.error) {
        setPaginatedSales(res.data || []);
        setSalesCount(res.count || 0);
      }
    } finally {
      setSalesLoading(false);
    }
  };

  const exportSalesCSV = () => {
    if (!filteredSales.length) return;
    const headers = ['id', 'created_at', 'customer_name', 'payment_method', 'subtotal', 'delivery_fee', 'discount', 'total_amount', 'applied_coupon'];
    const rows = filteredSales.map((o) => headers.map(h => JSON.stringify(o[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vendas_export_${new Date().toISOString()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Handlers CRUD
  const handleSaveFee = async () => {
    try {
      startLoading();
      const payload = { neighborhood_name: formData.name, fee: parseFloat(formData.fee) };
      const { error } = editingItem
        ? await supabase.from('delivery_fees').update(payload).eq('id', editingItem.id)
        : await supabase.from('delivery_fees').insert([payload]);

      if (error) throw error;
      showToast(editingItem ? "Bairro atualizado!" : "Bairro cadastrado!");
      setIsModalOpen(false); loadData();
    } catch (e) { showToast("Erro ao processar bairro", "error"); }
    finally { stopLoading(); }
  };

  const handleSaveCoupon = async () => {
    try {
      startLoading();
      const payload = {
        code: formData.code.toUpperCase(),
        value: parseFloat(formData.value),
        type: formData.type || 'percent',
        is_active: true,
        end_date: formData.end_date || null,
        product_id: formData.product_id || null
      };
      const { error } = await supabase.from('coupons').insert([payload]);
      if (error) throw error;
      showToast("Cupom criado com sucesso!");
      setIsModalOpen(false); loadData();
    } catch (e) { showToast("Erro ao criar cupom", "error"); }
    finally { stopLoading(); }
  };

  const updateCouponExpiry = async (id: string, newDate: string) => {
    startLoading();
    const { error } = await supabase.from('coupons').update({ end_date: newDate, is_active: true }).eq('id', id);
    if (!error) {
      showToast("Vencimento atualizado!");
      setViewingCoupon(null);
      loadData();
    } else showToast("Erro ao atualizar vencimento", "error");
    stopLoading();
  };

  const toggleCoupon = async (id: string, currentStatus: boolean) => {
    startLoading();
    const { error } = await supabase.from('coupons').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      showToast(!currentStatus ? "Cupom ativado!" : "Cupom pausado!");
      loadData();
    } else showToast("Erro ao atualizar cupom", "error");
    stopLoading();
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    startLoading();
    const { error } = await supabase.from(confirmDelete.table).delete().eq('id', confirmDelete.id);
    if (!error) {
      showToast("Removido do sistema!");
      // log audit
      try { await supabase.from('admin_audit').insert([{ action: 'delete', table: confirmDelete.table, record_id: confirmDelete.id, meta: null }]); } catch (e) {}
      loadData();
    } else {
      showToast("Erro ao excluir", "error");
    }
    setConfirmDelete(null);
    stopLoading();
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProducts((s) => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  };

  const executeBulkDelete = async () => {
    if (selectedProducts.length === 0) return;
    startLoading();
    try {
      const { error } = await supabase.from('products').delete().in('id', selectedProducts);
      if (error) throw error;
      // log each deleted id
      try {
        for (const id of selectedProducts) {
          await supabase.from('admin_audit').insert([{ action: 'delete', table: 'products', record_id: id, meta: null }]);
        }
      } catch (e) {}
      showToast('Produtos removidos com sucesso!');
      setSelectedProducts([]);
      loadData();
    } catch (e) {
      showToast('Erro ao excluir produtos', 'error');
    } finally {
      setConfirmBulkDelete(false);
      stopLoading();
    }
  };

  const updateOrderStatus = async () => {
    if (!viewingOrder || !selectedOrderStatus) return;
    const previousStatus = viewingOrder.status;
    try {
      setOrderStatusUpdating(true);

      // Optimistic UI: update local lists and viewing item
      setOrders((s) => s.map((o) => (o.id === viewingOrder.id ? { ...o, status: selectedOrderStatus } : o)));
      setPaginatedSales((s) => s.map((o) => (o.id === viewingOrder.id ? { ...o, status: selectedOrderStatus } : o)));
      setViewingOrder((v: any) => (v ? { ...v, status: selectedOrderStatus } : v));

      const { error } = await supabase.from('orders').update({ status: selectedOrderStatus }).eq('id', viewingOrder.id);
      if (error) throw error;

      // Audit log (non-blocking)
      try {
        await logAudit('update_order_status', 'orders', viewingOrder.id, { from: previousStatus, to: selectedOrderStatus });
      } catch (e) {}

      showToast('Status do pedido atualizado!');
      setViewingOrder(null);
      // refresh current page to ensure consistency
      fetchOrdersPage(salesPage);
    } catch (e) {
      console.error(e);
      // revert optimistic changes
      setOrders((s) => s.map((o) => (o.id === viewingOrder.id ? { ...o, status: previousStatus } : o)));
      setPaginatedSales((s) => s.map((o) => (o.id === viewingOrder.id ? { ...o, status: previousStatus } : o)));
      setViewingOrder((v: any) => (v ? { ...v, status: previousStatus } : v));
      showToast('Erro ao atualizar status', 'error');
    } finally {
      setOrderStatusUpdating(false);
    }
  };

  const getForecast = (currentStock: number, productId: string) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const totalSold = orders
      .filter(o => new Date(o.created_at) >= thirtyDaysAgo)
      .reduce((acc, o) => {
        const item = o.items?.find((i: any) => i.id === productId);
        return acc + (Number(item?.quantity) || 0);
      }, 0);
    const dailyAvg = totalSold / 30;
    const prediction = currentStock - (dailyAvg * forecastDays);
    return isNaN(prediction) ? currentStock : Math.max(0, prediction).toFixed(1);
  };

  // Curva ABC: calcula faturamento de cada produto e classifica em A/B/C
  const abcAnalysis = useMemo(() => {
    const productRevenue: { id: string; name: string; quantity: number; revenue: number; stock: number }[] = [];

    // Calcula faturamento por produto
    orders.forEach((o) => {
      (o.items || []).forEach((item: any) => {
        const prod = products.find((p) => p.id === item.id);
        if (prod) {
          const existing = productRevenue.find((p) => p.id === item.id);
          const itemRevenue = Number(item.quantity || 0) * Number(prod.price || 0);
          if (existing) {
            existing.quantity += Number(item.quantity || 0);
            existing.revenue += itemRevenue;
          } else {
            productRevenue.push({
              id: item.id,
              name: prod.name,
              quantity: Number(item.quantity || 0),
              revenue: itemRevenue,
              stock: prod.stock_quantity || 0,
            });
          }
        }
      });
    });

    // Ordena por faturamento (maior primeiro)
    productRevenue.sort((a, b) => b.revenue - a.revenue);

    // Calcula percentuais acumulados e classifica
    const totalRevenue = productRevenue.reduce((acc, p) => acc + p.revenue, 0);
    let accumulatedRevenue = 0;

    const classified = productRevenue.map((p) => {
      accumulatedRevenue += p.revenue;
      const percentageOfTotal = (p.revenue / totalRevenue) * 100;
      const accumulatedPercentage = (accumulatedRevenue / totalRevenue) * 100;

      let classification: 'A' | 'B' | 'C' = 'C';
      if (accumulatedPercentage <= 80) classification = 'A';
      else if (accumulatedPercentage <= 95) classification = 'B';

      return {
        ...p,
        percentageOfTotal,
        accumulatedPercentage,
        classification,
      };
    });

    return {
      items: classified,
      total: totalRevenue,
      countA: classified.filter((p) => p.classification === 'A').length,
      countB: classified.filter((p) => p.classification === 'B').length,
      countC: classified.filter((p) => p.classification === 'C').length,
    };
  }, [products, orders]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex font-sans antialiased text-slate-900">
      {/* Toasts rendered by ToastProvider */}

      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col p-4 lg:p-6 sticky h-screen top-0 z-50 transition-all">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-[#FBBE01] shrink-0 shadow-lg"><Package size={20} /></div>
          <span className="font-black text-xl tracking-tighter italic hidden lg:block uppercase text-black">Help Gela</span>
        </div>
        <nav className="space-y-2 flex-1">
          {[
            { id: 'metrics', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'products', icon: Package, label: 'Estoque' },
            { id: 'categories', icon: MapPin, label: 'Categorias' },
            { id: 'fees', icon: Truck, label: 'Entregas' },
            { id: 'promotions', icon: Ticket, label: 'Promoções' },
            { id: 'sales', icon: BarChart3, label: 'Vendas' },
            { id: 'abc', icon: TrendingUp, label: 'Curva ABC' },
          ].map((nav) => (
            <button key={nav.id} onClick={() => setTab(nav.id as any)} className={`w-full flex items-center gap-3 p-3 rounded-2xl font-bold transition-all ${tab === nav.id ? 'bg-black text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
              <nav.icon size={20} className={tab === nav.id ? 'text-[#FBBE01]' : ''} />
              <span className="hidden lg:block text-sm">{nav.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 lg:p-10 max-w-7xl mx-auto w-full overflow-x-hidden">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tighter capitalize">{tab === 'fees' ? 'Entregas' : tab === 'abc' ? 'Curva ABC' : tab}</h1>
            <p className="text-slate-400 text-sm font-semibold italic">Gestão Administrativa</p>
          </div>
          {tab !== 'metrics' && tab !== 'sales' && tab !== 'abc' && (
            <button onClick={() => { setEditingItem(null); setFormData({ type: 'percent' }); setIsModalOpen(true); }} className="bg-black text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-[#FBBE01] hover:text-black transition-all shadow-2xl active:scale-95">
              <Plus size={18} /> <span>Novo {tab === 'products' ? 'Produto' : tab === 'fees' ? 'Bairro' : tab === 'promotions' ? 'Cupom' : tab === 'categories' ? 'Categoria' : 'Registro'}</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <button onClick={async () => { startLoading(); await supabase.auth.signOut(); stopLoading(); showToast('Desconectado'); router.push('/'); }} className="p-3 bg-slate-50 rounded-2xl text-sm font-black hover:bg-slate-100 transition-all flex items-center gap-2">
              <LogOut size={16} /> <span className="hidden lg:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* ABAS */}
        {tab === 'metrics' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4 italic">Faturamento (30d)</p>
                <h3 className="text-4xl font-black">{formatCurrency(orders.reduce((acc, o) => acc + Number(o.total_amount), 0))}</h3>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4 italic text-right">Previsão Inteligente</p>
                <div className="flex items-center gap-4 justify-end">
                  <input type="number" value={forecastDays} onChange={(e) => setForecastDays(Number(e.target.value))} className="w-16 p-2 bg-slate-50 rounded-xl border-none font-black text-center" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dias</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest px-8">
                  <tr>
                    <th className="px-8 py-6">Produto</th>
                    <th className="px-8 py-6 text-center">Estoque</th>
                    <th className="px-8 py-6 text-center">Previsão</th>
                    <th className="px-8 py-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {products.slice(0, 8).map(p => {
                    const forecasted = getForecast(p.stock_quantity, p.id);
                    const isRisk = Number(forecasted) <= p.min_stock;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6 font-black text-sm text-slate-800">{p.name}</td>
                        <td className="px-8 py-6 text-center font-bold text-slate-400">{p.stock_quantity} un</td>
                        <td className="px-8 py-6 text-center font-black text-lg text-black">{forecasted} un</td>
                        <td className="px-8 py-6 text-center">
                          <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase ${isRisk ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{isRisk ? 'Crítico' : 'Estável'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {confirmBulkDelete && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={32} /></div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Excluir produtos selecionados?</h3>
                <p className="text-slate-500 text-sm font-medium mt-2 italic tracking-tight">Esta ação é permanente e removerá os itens selecionados do banco de dados.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmBulkDelete(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                <button onClick={executeBulkDelete} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all">Excluir</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'sales' && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in">
            {/* Filtros */}
            <div className="p-8 border-b flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="relative flex-1 group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#FBBE01] transition-colors" size={20} />
                <input
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  placeholder="Buscar por cliente, pagamento, cupom..."
                  className="w-full pl-16 p-5 bg-slate-50 rounded-[2rem] border-none text-sm font-bold outline-none focus:ring-2 ring-black transition-all"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                  <Filter size={16} /> Pagamento
                </div>
                <select
                  value={salesPaymentFilter}
                  onChange={(e) => setSalesPaymentFilter(e.target.value as any)}
                  className="p-4 bg-slate-50 rounded-[1.5rem] border-none font-black text-xs outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="pix">Pix</option>
                  <option value="card">Cartão</option>
                  <option value="cash">Dinheiro</option>
                </select>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest">Status</div>
                  <select
                    value={salesStatusFilter}
                    onChange={(e) => setSalesStatusFilter(e.target.value as any)}
                    className="p-4 bg-slate-50 rounded-[1.5rem] border-none font-black text-xs outline-none"
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendente</option>
                    <option value="out_for_delivery">A caminho</option>
                    <option value="delivered">Entregue</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <button onClick={exportSalesCSV} className="ml-2 p-3 bg-slate-50 rounded-xl text-slate-600 text-xs font-black hover:bg-slate-100">Exportar CSV</button>
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest px-8">
                <tr>
                  <th className="px-8 py-6">Data</th>
                  <th className="px-8 py-6">Cliente</th>
                  <th className="px-8 py-6 text-center">Pagamento</th>
                  <th className="px-8 py-6 text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {salesLoading ? (
                  Array.from({ length: SALES_PAGE_SIZE }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-8 py-6 text-xs font-bold text-slate-600"><div className="h-3 w-24 bg-slate-100 rounded"/></td>
                      <td className="px-8 py-6 text-xs font-black uppercase tracking-tighter flex items-center gap-2"><div className="h-3 w-48 bg-slate-100 rounded"/></td>
                      <td className="px-8 py-6 text-center font-bold"><div className="h-3 w-20 bg-slate-100 rounded mx-auto"/></td>
                      <td className="px-8 py-6 text-right font-black text-lg"><div className="h-3 w-20 bg-slate-100 rounded ml-auto"/></td>
                    </tr>
                  ))
                ) : (
                  paginatedSales.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                      onClick={() => setViewingOrder(o)}
                    >
                      <td className="px-8 py-6 text-xs font-bold text-slate-600">
                        {new Date(o.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-8 py-6 text-xs font-black uppercase tracking-tighter flex items-center gap-2">
                        {o.customer_name}
                        <ChevronRight
                          size={14}
                          className="opacity-0 group-hover:opacity-100 text-[#FBBE01] transition-all"
                        />
                      </td>
                      <td className="px-8 py-6 text-center font-bold">
                        <span className="px-3 py-1 bg-yellow-50 text-[#FBBE01] rounded-full text-[9px] font-black">
                          {o.payment_method}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-lg">{formatCurrency(o.total_amount)}</td>
                    </tr>
                  ))
                )}

                {!salesLoading && paginatedSales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-10 text-center text-slate-400 font-bold">
                      Nenhuma venda encontrada com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Paginação */}
              <div className="p-6 border-t flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {salesCount} venda(s)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const next = Math.max(1, salesPage - 1); setSalesPage(next); fetchOrdersPage(next); }}
                    disabled={salesPage <= 1}
                    className="p-3 rounded-xl border bg-white text-slate-400 disabled:opacity-40"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="px-4 py-2 rounded-xl bg-slate-50 text-slate-600 font-black text-xs">
                    {salesPage} / {salesTotalPages}
                  </div>
                  <button
                    onClick={() => { const next = Math.min(salesTotalPages, salesPage + 1); setSalesPage(next); fetchOrdersPage(next); }}
                    disabled={salesPage >= salesTotalPages}
                    className="p-3 rounded-xl border bg-white text-slate-400 disabled:opacity-40"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
          </div>
        )}

        {tab === 'products' && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="p-8 border-b flex items-center gap-6">
              <div className="relative flex-1 group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#FBBE01] transition-colors" size={20} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Procurar no estoque..." className="w-full pl-16 p-5 bg-slate-50 rounded-[2rem] border-none text-sm font-bold outline-none focus:ring-2 ring-black transition-all" />
              </div>
            </div>

            {selectedProducts.length > 0 && (
              <div className="px-8 py-4 border-b bg-slate-50 flex items-center justify-between">
                <div className="font-black text-sm">{selectedProducts.length} selecionado(s)</div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedProducts([])} className="py-2 px-4 bg-slate-100 rounded-2xl font-bold text-sm">Limpar</button>
                  <button onClick={() => setConfirmBulkDelete(true)} className="py-2 px-4 bg-red-600 text-white rounded-2xl font-bold text-sm">Excluir Selecionados</button>
                </div>
              </div>
            )}

            <table className="w-full text-left">
              <thead className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest px-8">
                <tr>
                  <th className="px-6 py-6">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedProducts(filteredProducts.map(p => p.id));
                        else setSelectedProducts([]);
                      }}
                    />
                  </th>
                  <th className="px-8 py-6">Mercadoria</th>
                  <th className="px-8 py-6 text-center">Venda</th>
                  <th className="px-8 py-6 text-center">Qtd</th>
                  <th className="px-8 py-6 text-right pr-12">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-all group cursor-pointer" onClick={() => setViewingProduct(p)}>
                    <td className="px-6 py-6" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={() => toggleSelectProduct(p.id)} />
                    </td>
                    <td className="px-8 py-6 flex items-center gap-4"><img src={p.image_url} className="w-12 h-12 rounded-2xl object-cover border" alt="" /><span className="font-black text-sm tracking-tight">{p.name}</span></td>
                    <td className="px-8 py-6 text-center font-black text-black">{formatCurrency(p.price)}</td>
                    <td className="px-8 py-6 text-center"><span className={`px-4 py-2 rounded-2xl text-[10px] font-black ${p.stock_quantity <= p.min_stock ? 'bg-red-50 text-red-600 shadow-sm' : 'bg-slate-100 text-slate-600'}`}>{p.stock_quantity} un</span></td>
                    <td className="px-8 py-6 text-right pr-8 flex justify-end gap-3">
                      <button onClick={(e) => { e.stopPropagation(); setEditingItem(p); setIsModalOpen(true); }} className="p-3 bg-white shadow-sm border rounded-xl text-slate-400 hover:text-black transition-all"><Edit3 size={18} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ table: 'products', id: p.id, show: true }); }} className="p-3 bg-white shadow-sm border rounded-xl text-slate-400 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'categories' && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-8 border-b flex items-center gap-6">
              <div className="relative flex-1 group">
                <input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Procurar categoria..." className="w-full pl-4 p-4 bg-slate-50 rounded-[2rem] border-none text-sm font-bold outline-none focus:ring-2 ring-black transition-all" />
              </div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest px-8">
                <tr><th className="px-8 py-6">Categoria</th><th className="px-8 py-6 text-right pr-12">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {categories.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6 font-black text-sm">{c.name}</td>
                    <td className="px-8 py-6 text-right pr-8 flex justify-end gap-3">
                      <button onClick={() => { setEditingItem(c); setFormData({ name: c.name }); setIsModalOpen(true); }} className="p-3 text-slate-400 hover:text-black transition-all"><Edit3 size={18} /></button>
                      <button onClick={() => setConfirmDelete({ table: 'categories', id: c.id, show: true })} className="p-3 text-slate-400 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'fees' && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in">
            <table className="w-full text-left">
              <thead className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest px-8">
                <tr><th className="px-8 py-6">Bairro</th><th className="px-8 py-6 text-center">Taxa de Entrega</th><th className="px-8 py-6 text-right pr-12">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {neighborhoods.map(n => (
                  <tr key={n.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6 font-black text-sm">{n.name}</td>
                    <td className="px-8 py-6 text-center font-black text-lg text-[#FBBE01]">{formatCurrency(n.fee)}</td>
                    <td className="px-8 py-6 text-right pr-8 flex justify-end gap-3">
                      <button onClick={() => { setEditingItem(n); setFormData({ name: n.name, fee: n.fee }); setIsModalOpen(true); }} className="p-3 text-slate-400 hover:text-black transition-all"><Edit3 size={18} /></button>
                      <button onClick={() => setConfirmDelete({ table: 'delivery_fees', id: n.id, show: true })} className="p-3 text-slate-400 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'promotions' && (
          <div className="space-y-10 animate-in fade-in">
            {/* IA Suggestions */}
            <div className="bg-amber-50/50 p-8 rounded-[3.5rem] border border-amber-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 text-amber-900 italic"><Zap size={18} className="fill-amber-500" /> Inteligência Help Gela</h3>
                <div className="flex gap-2">
                  <button onClick={() => scrollSuggestions('left')} className="p-2 bg-white rounded-full text-amber-900 shadow-sm"><ChevronLeft size={20} /></button>
                  <button onClick={() => scrollSuggestions('right')} className="p-2 bg-white rounded-full text-amber-900 shadow-sm"><ChevronRight size={20} /></button>
                </div>
              </div>
              <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-6 no-scrollbar snap-x snap-mandatory touch-pan-x">
                {suggestions.map((s, idx) => (
                  <div key={idx} className={`min-w-[280px] p-6 rounded-[2.5rem] border relative group shadow-sm snap-start ${s.type === 'sazonal' ? 'bg-black text-white border-black shadow-xl' : 'bg-white border-amber-200'}`}>
                    <p className="font-black text-xs mb-1 uppercase tracking-tighter">{s.name}</p>
                    <p className={`text-[10px] font-bold uppercase italic ${s.type === 'sazonal' ? 'text-[#FBBE01]' : 'text-amber-600'}`}>{s.type === 'sazonal' ? s.desc : `Vendas (30d): ${s.totalSold} un`}</p>
                    <button onClick={() => { setFormData({ code: `OFF-${s.name.split(' ')[0].toUpperCase()}`, type: 'percent', value: 10, product_id: s.id }); setIsModalOpen(true); }} className={`mt-4 w-full py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${s.type === 'sazonal' ? 'bg-[#FBBE01] text-black shadow-lg' : 'bg-amber-500 text-white'}`}>Ativar Oferta</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coupons.map(c => {
                const isExpired = c.end_date && new Date(c.end_date) < new Date();
                const usages = orders.filter(o => o.applied_coupon === c.code).length;

                return (
                  <div key={c.id} onClick={() => setViewingCoupon({ ...c, usages })} className={`p-8 rounded-[2.5rem] border shadow-sm transition-all cursor-pointer hover:scale-[1.02] ${!c.is_active || isExpired ? 'bg-slate-50 opacity-60 grayscale' : 'bg-white border-slate-100 shadow-xl shadow-slate-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className="font-black text-lg tracking-tighter uppercase italic tracking-[0.1em]">{c.code}</span>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${isExpired ? 'bg-red-100 text-red-600' : c.is_active ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                        {isExpired ? 'Expirado' : c.is_active ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>
                    <p className="text-4xl font-black mb-1 italic tracking-tighter">{c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value)}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{usages} usos realizados</p>
                    <div className="mt-8 flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); toggleCoupon(c.id, c.is_active); }} className="flex-1 py-3 bg-black text-white rounded-xl font-black text-[9px] uppercase tracking-widest">{isExpired || !c.is_active ? 'Reativar' : 'Pausar'}</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ table: 'coupons', id: c.id, show: true }); }} className="p-3 bg-red-50 text-red-500 rounded-xl transition-colors hover:bg-red-500 hover:text-white"><Trash2 size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'abc' && (
          <div className="space-y-8 animate-in fade-in">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 italic">Total de Faturamento</p>
                <h3 className="text-3xl font-black">{formatCurrency(abcAnalysis.total)}</h3>
              </div>
              <div className="bg-green-50 p-8 rounded-[2.5rem] border border-green-100 shadow-sm">
                <p className="text-green-600 text-[10px] font-black uppercase tracking-widest mb-2 italic">Classe A</p>
                <h3 className="text-3xl font-black text-green-600">{abcAnalysis.countA}</h3>
                <p className="text-[10px] font-bold text-green-400 mt-2">~80% do faturamento</p>
              </div>
              <div className="bg-yellow-50 p-8 rounded-[2.5rem] border border-yellow-100 shadow-sm">
                <p className="text-yellow-600 text-[10px] font-black uppercase tracking-widest mb-2 italic">Classe B</p>
                <h3 className="text-3xl font-black text-yellow-600">{abcAnalysis.countB}</h3>
                <p className="text-[10px] font-bold text-yellow-400 mt-2">~15% do faturamento</p>
              </div>
              <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 shadow-sm">
                <p className="text-red-600 text-[10px] font-black uppercase tracking-widest mb-2 italic">Classe C</p>
                <h3 className="text-3xl font-black text-red-600">{abcAnalysis.countC}</h3>
                <p className="text-[10px] font-bold text-red-400 mt-2">~5% do faturamento</p>
              </div>
            </div>

            {/* Tabela de Curva ABC */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-6">Produto</th>
                    <th className="px-8 py-6 text-center">Quantidade Vendida</th>
                    <th className="px-8 py-6 text-right">Faturamento</th>
                    <th className="px-8 py-6 text-center">% do Total</th>
                    <th className="px-8 py-6 text-center">% Acumulado</th>
                    <th className="px-8 py-6 text-center">Classe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {abcAnalysis.items.slice(0, 30).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10">
                            {products.find((p) => p.id === item.id) && (
                              <img
                                src={products.find((p) => p.id === item.id)?.image_url}
                                alt=""
                                className="w-full h-full rounded-lg object-cover border border-slate-100"
                              />
                            )}
                          </div>
                          <span className="font-black text-sm">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center font-bold text-slate-600">{item.quantity} un</td>
                      <td className="px-8 py-6 text-right font-black text-lg">{formatCurrency(item.revenue)}</td>
                      <td className="px-8 py-6 text-center">
                        <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-600">
                          {item.percentageOfTotal.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-8 py-6 text-center font-bold text-slate-600">{item.accumulatedPercentage.toFixed(1)}%</td>
                      <td className="px-8 py-6 text-center">
                        <span
                          className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              item.classification === 'A'
                                ? 'bg-green-100 text-green-600'
                                : item.classification === 'B'
                                ? 'bg-yellow-100 text-yellow-600'
                                : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {item.classification}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legenda */}
            <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Legenda da Curva ABC</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="font-black text-green-600 mb-2">Classe A - Produtos Estratégicos</p>
                  <p className="text-[10px] text-slate-600 font-semibold">Representa aproximadamente 80% do faturamento. Recomenda-se manter sempre em estoque e acompanhar de perto.</p>
                </div>
                <div>
                  <p className="font-black text-yellow-600 mb-2">Classe B - Produtos Intermediários</p>
                  <p className="text-[10px] text-slate-600 font-semibold">Representa aproximadamente 15% do faturamento. Controle moderado de estoque é necessário.</p>
                </div>
                <div>
                  <p className="font-black text-red-600 mb-2">Classe C - Produtos com Baixa Venda</p>
                  <p className="text-[10px] text-slate-600 font-semibold">Representa aproximadamente 5% do faturamento. Considerar promoções ou remover do catálogo.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONFIRMAR DELEÇÃO CUSTOMIZADO */}
        {confirmDelete?.show && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={32} /></div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Tem Certeza?</h3>
                <p className="text-slate-500 text-sm font-medium mt-2 italic tracking-tight">Esta ação é permanente e removerá o registro do banco de dados.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                <button onClick={executeDelete} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all">Excluir</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL VISUALIZAR CUPOM */}
        {viewingCoupon && (
          <Modal open={!!viewingCoupon} onClose={() => setViewingCoupon(null)} title={`Cupom ${viewingCoupon.code}`} maxWidth="max-w-lg">
            <div className="space-y-8">
              <div className="flex justify-between items-start border-b pb-6">
                <div>
                  <p className="text-[10px] font-black text-[#FBBE01] uppercase tracking-widest mb-1 italic">Cupom</p>
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase">{viewingCoupon.code}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Usos</p>
                  <p className="font-black text-2xl">{viewingCoupon.usages || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest italic">Tipo</p>
                  <p className="font-black text-xl">{viewingCoupon.type === 'percent' ? 'Percentual' : 'Fixo'}</p>
                </div>
                <div className="p-6 bg-black rounded-[2rem] text-white shadow-xl">
                  <p className="text-[10px] font-black text-[#FBBE01] uppercase mb-2 tracking-widest italic">Valor</p>
                  <p className="font-black text-xl">{viewingCoupon.type === 'percent' ? `${viewingCoupon.value}%` : formatCurrency(viewingCoupon.value)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Expiração</p>
                <input type="date" defaultValue={viewingCoupon.end_date || ''} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="w-full p-5 bg-slate-50 rounded-3xl font-bold outline-none focus:ring-2 ring-black" />
                <button onClick={() => updateCouponExpiry(viewingCoupon.id, formData.end_date)} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[#FBBE01] hover:text-black transition-all">Salvar Expiração</button>
              </div>
            </div>
          </Modal>
        )}

        {/* MODAL VISUALIZAR PEDIDO */}
        {viewingOrder && (
          <Modal open={!!viewingOrder} onClose={() => setViewingOrder(null)} title={`Pedido ${viewingOrder.id}`} maxWidth="max-w-lg">
            <div className="space-y-8">
              <div className="flex justify-between items-end border-b pb-6">
                <div>
                  <p className="text-[10px] font-black text-[#FBBE01] uppercase tracking-widest mb-1 italic">Cupom: {viewingOrder.applied_coupon || 'Nenhum'}</p>
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase">{viewingOrder.customer_name}</h2>
                </div>
                <div className="text-right font-bold text-xs">
                  <p className="text-slate-400 italic">{new Date(viewingOrder.created_at).toLocaleString()}</p>
                  <p className="uppercase">{viewingOrder.payment_method}</p>
                  <p className="mt-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      viewingOrder.status === 'delivered' ? 'bg-green-100 text-green-600' : viewingOrder.status === 'out_for_delivery' ? 'bg-yellow-100 text-yellow-600' : viewingOrder.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {String(viewingOrder.status).replace(/_/g, ' ')}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status do pedido</p>
                  <select value={selectedOrderStatus || ''} onChange={(e) => setSelectedOrderStatus(e.target.value)} className="p-3 rounded-2xl bg-slate-50 font-black">
                    <option value="pending">Pendente</option>
                    <option value="preparing">Preparando</option>
                    <option value="out_for_delivery">Saiu para entrega</option>
                    <option value="delivered">Entregue</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div>
                  <button onClick={updateOrderStatus} disabled={orderStatusUpdating || selectedOrderStatus === viewingOrder.status} className={`py-3 px-4 rounded-2xl font-black ${orderStatusUpdating ? 'bg-slate-200' : 'bg-black text-white hover:bg-[#FBBE01] hover:text-black'}`}>
                    {orderStatusUpdating ? 'Atualizando...' : 'Salvar status'}
                  </button>
                </div>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                {viewingOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4"><div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-black text-xs">{item.quantity}x</div><p className="font-bold text-sm tracking-tight">{item.name}</p></div>
                    <p className="font-black text-sm italic">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-xl space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest"><span>Subtotal</span><span>{formatCurrency(viewingOrder.subtotal)}</span></div>
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest"><span>Entrega</span><span>{formatCurrency(viewingOrder.delivery_fee)}</span></div>
                {viewingOrder.discount > 0 && <div className="flex justify-between text-[10px] font-black uppercase text-green-400 tracking-widest"><span>Desconto ({viewingOrder.applied_coupon})</span><span>-{formatCurrency(viewingOrder.discount)}</span></div>}
                <div className="flex justify-between items-end pt-4 border-t border-white/10"><p className="text-xs font-black text-[#FBBE01] uppercase italic tracking-widest">Total do Pedido</p><p className="text-4xl font-black tracking-tighter italic">{formatCurrency(viewingOrder.total_amount)}</p></div>
              </div>
            </div>
          </Modal>
        )}

        {viewingProduct && (
          <Modal open={!!viewingProduct} onClose={() => setViewingProduct(null)} title={viewingProduct.name} maxWidth="max-w-lg">
            <div className="flex flex-col items-center">
                  <Image src={viewingProduct.image_url} alt={viewingProduct.name} width={160} height={160} className="w-40 h-40 rounded-[2.5rem] object-cover mb-8 shadow-2xl border-8 border-slate-50" unoptimized />
              <h2 className="text-3xl font-black text-center mb-8 uppercase italic tracking-tighter">{viewingProduct.name}</h2>
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center"><p className="text-[10px] font-black text-slate-400 uppercase mb-2 italic">Custo</p><p className="font-black text-xl text-slate-800">{formatCurrency(viewingProduct.cost_price || 0)}</p></div>
                <div className="p-6 bg-white border-2 border-green-100 rounded-[2rem] text-center"><p className="text-[10px] font-black text-green-400 uppercase mb-2 italic">Venda</p><p className="font-black text-xl text-green-600">{formatCurrency(viewingProduct.price)}</p></div>
                <div className="p-6 bg-black rounded-[2rem] col-span-2 flex justify-between items-center shadow-xl">
                  <div className="text-left">
                    <p className="text-[10px] font-black text-[#FBBE01] uppercase mb-1 tracking-widest italic">Margem Bruta</p>
                    <p className="font-black text-2xl text-white">{formatCurrency(viewingProduct.price - (viewingProduct.cost_price || 0))}</p>
                  </div>
                  <TrendingUp size={24} className="text-[#FBBE01]" />
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* MODAL FORMULÁRIO (Slide-over Lateral) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <div className="relative w-full max-w-lg bg-white h-full shadow-2xl animate-in slide-in-from-right duration-500 p-10 lg:p-14 overflow-y-auto">
              <header className="flex justify-between items-center mb-12">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">{editingItem ? 'Editar' : 'Novo'} Registro</h2>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center hover:bg-black hover:text-white transition-all"><X size={24} /></button>
              </header>

              {tab === 'products' && <AdminProductForm onSuccess={() => { showToast("Estoque atualizado!"); loadData(); setIsModalOpen(false); }} initialData={editingItem} />}
              {tab === 'categories' && (
                <div className="space-y-6">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nome da Categoria</label><input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Cervejas" className="w-full p-5 bg-slate-50 rounded-3xl font-bold outline-none focus:ring-2 ring-black" /></div>
                  <button onClick={async () => {
                    // handle save category
                    try {
                      startLoading();
                      const payload = { name: (formData.name || '').trim() };
                      const { error } = editingItem ? await supabase.from('categories').update(payload).eq('id', editingItem.id) : await supabase.from('categories').insert([payload]);
                      if (error) throw error;
                      showToast(editingItem ? 'Categoria atualizada!' : 'Categoria criada!');
                      setIsModalOpen(false); loadData();
                    } catch (e) { showToast('Erro ao salvar categoria', 'error'); }
                    finally { stopLoading(); }
                  }} className="w-full bg-black text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-[#FBBE01] hover:text-black transition-all shadow-xl">Salvar Categoria</button>
                </div>
              )}

              {tab === 'fees' && (
                <div className="space-y-6">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Bairro</label><input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nome do Bairro" className="w-full p-5 bg-slate-50 rounded-3xl font-bold outline-none focus:ring-2 ring-black" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Taxa</label><input value={formData.fee || ''} onChange={e => setFormData({ ...formData, fee: e.target.value })} type="number" placeholder="Taxa R$" className="w-full p-5 bg-slate-50 rounded-3xl font-black outline-none focus:ring-2 ring-black" /></div>
                  <button onClick={handleSaveFee} className="w-full bg-black text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-[#FBBE01] hover:text-black transition-all shadow-xl">Salvar Bairro</button>
                </div>
              )}

              {tab === 'promotions' && (
                <div className="space-y-6">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Código do Cupom</label><input value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="EX: HELP20" className="w-full p-5 bg-slate-50 rounded-3xl font-black uppercase outline-none focus:ring-2 ring-black" /></div>
                  <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2rem]">
                    <button onClick={() => setFormData({ ...formData, type: 'percent' })} className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${formData.type !== 'fixed' ? 'bg-black text-white shadow-lg' : 'text-slate-400'}`}>%</button>
                    <button onClick={() => setFormData({ ...formData, type: 'fixed' })} className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${formData.type === 'fixed' ? 'bg-black text-white shadow-lg' : 'text-slate-400'}`}>R$</button>
                  </div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Valor</label><input value={formData.value || ''} onChange={e => setFormData({ ...formData, value: e.target.value })} type="number" placeholder="0" className="w-full p-5 bg-slate-50 rounded-3xl font-black outline-none focus:ring-2 ring-black" /></div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Vincular a Produto (Opcional)</label>
                    <select value={formData.product_id || ''} onChange={e => setFormData({ ...formData, product_id: e.target.value })} className="w-full p-5 bg-slate-50 rounded-3xl font-bold outline-none focus:ring-2 ring-black border-none appearance-none">
                      <option value="">Todos os Produtos</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest italic">Data de Expiração</label><input type="date" onChange={e => setFormData({ ...formData, end_date: e.target.value })} className="w-full p-5 bg-slate-50 rounded-3xl font-bold outline-none focus:ring-2 ring-black" /></div>
                  <button onClick={handleSaveCoupon} className="w-full bg-black text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-[#FBBE01] hover:text-black transition-all shadow-xl">Ativar Cupom</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
