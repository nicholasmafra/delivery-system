import { SHOP_CONFIG } from "./config";
import { Product, CartItem } from "./types";

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

export const isStoreOpen = () => {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  return currentTime >= SHOP_CONFIG.openingTime && currentTime <= SHOP_CONFIG.closingTime;
};

export const STORAGE_KEY = "help_gela_products";
export const NEIGHBORHOOD_KEY = "help_gela_neighborhoods";
export const ORDERS_KEY = "help_gela_orders";
export const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Sugestões inteligentes (cross-sell):
 * - Baseado nos itens atuais do carrinho
 * - Regras tipo: cerveja/refrigerante/energético -> gelo
 *               destilado -> energético / tônica / limão / gelo
 *               petisco -> cerveja/refrigerante
 * - Mistura com sinal de mesma categoria + produtos em destaque
 */
export const getSmartSuggestions = (
  allProducts: Product[],
  cartItems: CartItem[],
  limit: number = 4
): Product[] => {
  const activeProducts = allProducts.filter((p) => p.is_active && (p.stock_quantity ?? 0) > 0);

  const cartIds = new Set(cartItems.map((i) => i.id));
  const cartProducts = activeProducts.filter((p) => cartIds.has(p.id));

  // Se carrinho vazio: sugere destaques primeiro, depois mais baratos como fallback
  if (cartItems.length === 0) {
    return [...activeProducts]
      .sort((a, b) => {
        const fa = a.is_featured ? 1 : 0;
        const fb = b.is_featured ? 1 : 0;
        if (fb !== fa) return fb - fa;
        return (a.price ?? 0) - (b.price ?? 0);
      })
      .slice(0, limit);
  }

  // Helpers
  const normalize = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const productText = (p: Product) => normalize(`${p.name} ${p.category ?? ""}`);

  const includesAny = (text: string, keywords: string[]) => {
    const t = normalize(text);
    return keywords.some((k) => t.includes(normalize(k)));
  };

  // Sinais do carrinho
  const cartText = cartProducts.map(productText).join(" | ");
  const cartCategories = new Set(cartProducts.map((p) => normalize(p.category ?? "")));

  const hasBeer =
    includesAny(cartText, ["cerveja", "lager", "pilsen", "ipa", "heineken", "brahma", "skol", "bud"]) ||
    cartCategories.has("cervejas");

  const hasSpirits =
    includesAny(cartText, ["whisky", "vodka", "gin", "rum", "tequila", "destil"]) ||
    cartCategories.has("destilados");

  const hasSoftDrink =
    includesAny(cartText, [
      "refrigerante",
      "refri",
      "coca",
      "guarana",
      "fanta",
      "sprite",
      "energetico",
      "energético",
      "agua",
      "água",
      "suco",
    ]) || cartCategories.has("conveniencia");

  const hasSnacks =
    includesAny(cartText, ["petisco", "salgadinho", "amendoim", "batata", "chips", "aperitivo"]) ||
    cartCategories.has("petiscos");

  const hasIceCoal = cartCategories.has(normalize("Gelo & Carvão")) || includesAny(cartText, ["gelo", "carvao", "carvão"]);

  // Pool elegível para sugerir (não está no carrinho)
  const pool = activeProducts.filter((p) => !cartIds.has(p.id));

  // Motor de pontuação
  const scoreMap = new Map<string, number>();
  const addScore = (p: Product, points: number) => {
    scoreMap.set(p.id, (scoreMap.get(p.id) ?? 0) + points);
  };

  // Regras (cross-sell)
  // 1) Bebidas -> Gelo (principal)
  if (hasBeer || hasSoftDrink || hasSpirits) {
    for (const p of pool) {
      const txt = productText(p);
      // Prioriza itens com "gelo" ou categoria Gelo & Carvão
      if (txt.includes("gelo") || normalize(p.category ?? "") === normalize("Gelo & Carvão")) addScore(p, 120);
    }
  }

  // 2) Destilados -> mixers
  if (hasSpirits) {
    for (const p of pool) {
      const txt = productText(p);
      if (includesAny(txt, ["energetico", "energético", "tonica", "tônica", "agua", "água", "refrigerante", "limão", "limao"])) {
        addScore(p, 90);
      }
      // gelo já ganha acima; aqui dá um reforço leve pra categoria "Conveniência"
      if (normalize(p.category ?? "") === "conveniencia") addScore(p, 10);
    }
  }

  // 3) Petiscos -> bebida
  if (hasSnacks) {
    for (const p of pool) {
      const txt = productText(p);
      if (normalize(p.category ?? "") === "cervejas") addScore(p, 40);
      if (includesAny(txt, ["refrigerante", "refri", "energetico", "energético", "agua", "água"])) addScore(p, 35);
    }
  }

  // 4) Cerveja -> petiscos (combo)
  if (hasBeer) {
    for (const p of pool) {
      if (normalize(p.category ?? "") === "petiscos") addScore(p, 35);
    }
  }

  // 5) Gelo/Carvão -> bebidas (pra quem tá comprando gelo, geralmente compra bebida também)
  if (hasIceCoal) {
    for (const p of pool) {
      if (normalize(p.category ?? "") === "cervejas") addScore(p, 25);
      if (includesAny(productText(p), ["refrigerante", "refri", "agua", "água", "energetico", "energético"])) addScore(p, 20);
    }
  }

  // Sinal secundário: mesma categoria do carrinho
  for (const p of pool) {
    if (cartCategories.has(normalize(p.category ?? ""))) addScore(p, 18);
  }

  // Destaque (vitrine) como desempate
  for (const p of pool) {
    if (p.is_featured) addScore(p, 6);
  }

  // Desempate leve por preço (evita ficar sempre “os mais caros”)
  // - sem pontuação alta: favorece itens mais baratos como “complemento”
  const ranked = [...pool]
    .map((p) => ({ p, score: scoreMap.get(p.id) ?? 0 }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // desempate: featured, depois mais barato
      const fa = a.p.is_featured ? 1 : 0;
      const fb = b.p.is_featured ? 1 : 0;
      if (fb !== fa) return fb - fa;
      return (a.p.price ?? 0) - (b.p.price ?? 0);
    })
    .map((x) => x.p);

  // Se por algum motivo todas as pontuações forem 0, ainda assim retorna algo útil
  const hasAnyScore = ranked.some((p) => (scoreMap.get(p.id) ?? 0) > 0);
  if (!hasAnyScore) {
    return [...pool]
      .sort((a, b) => {
        const fa = a.is_featured ? 1 : 0;
        const fb = b.is_featured ? 1 : 0;
        if (fb !== fa) return fb - fa;
        return (a.price ?? 0) - (b.price ?? 0);
      })
      .slice(0, limit);
  }

  return ranked.slice(0, limit);
};
