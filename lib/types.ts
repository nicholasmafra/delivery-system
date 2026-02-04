export interface Product {
  id: string;
  name: string;
  price: number;
  cost_price?: number; // Preço de custo
  image_url: string;   // Alterado de 'image' para 'image_url'
  category_id: string; // Referência à tabela de categorias
  category?: string;    // Nome da categoria (vindo do join)
  stock_quantity: number;
  min_stock: number;
  unit_type: string;
  is_active: boolean;
  is_featured: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Neighborhood {
  id: string;
  name: string;
  fee: number;
}

export interface Order {
  id: string;
  date: string;
  total: number;
  itemsCount: number;
}

export interface Coupon {
  id: string;
  code: string;
  value: number;
  type: 'fixed' | 'percent';
  is_active: boolean;
  expiration_date: Date;
  start_date: Date;
  end_date: Date;
}

export interface ShopConfig {
  name: string;
  phone: string;
  primaryColor: string;
  openingTime: string;
  closingTime: string;
  address: string;
}

export const CATEGORIES = ["Cervejas", "Destilados", "Petiscos", "Gelo & Carvão", "Conveniência"];