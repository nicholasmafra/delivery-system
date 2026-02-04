"use client";
import { useEffect, useMemo, useState } from "react";
import { Neighborhood } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import {
  MapPin,
  User,
  Phone,
  Search,
  Banknote,
  AlertTriangle,
  ChevronRight,
  Info,
} from "lucide-react";

export default function CheckoutForm({
  itemsTotal,
  onSubmit,
  loading = false,
}: {
  itemsTotal: number;
  onSubmit: (data: any) => void;
  loading?: boolean;
}) {
  const { state } = useCart();

  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [selectedNb, setSelectedNb] = useState<Neighborhood | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [pagamento, setPagamento] = useState("Dinheiro");

  const [loadingCep, setLoadingCep] = useState(false);
  const [nbQuery, setNbQuery] = useState("");
  const [showNbList, setShowNbList] = useState(false);
  const [cepNbNotFound, setCepNbNotFound] = useState(false);

  // 🔧 garante texto/placeholder corretos mesmo se o container pai for "dark"
  const inputBase =
    "w-full px-5 py-4 bg-gray-50 rounded-3xl font-bold text-sm outline-none " +
    "focus:ring-2 ring-[#FBBE01] text-gray-900 placeholder-gray-400";

  const inputWithIcon =
    "w-full pl-12 pr-5 py-4 bg-gray-50 rounded-3xl font-bold text-sm outline-none " +
    "focus:ring-2 ring-[#FBBE01] text-gray-900 placeholder-gray-400";

  const normalize = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  useEffect(() => {
    async function fetchFees() {
      const { data } = await supabase.from("delivery_fees").select("*");
      if (data) {
        setNeighborhoods(
          data.map((n: any) => ({
            id: n.id,
            name: n.neighborhood_name,
            fee: n.fee,
          }))
        );
      }
    }
    fetchFees();
  }, []);

  // Máscara de Telefone
  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
    setTelefone(v);
  };

  const handleCep = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 8) v = v.slice(0, 8);

    setCep(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);

    // ao mudar CEP, resetamos o bairro (porque a taxa depende dele)
    setCepNbNotFound(false);
    setSelectedNb(null);

    if (v.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${v}/json/`);
        const data = await res.json();

        if (!data.erro) {
          if (data.logradouro) setEndereco(data.logradouro);

          const viaCepBairro = String(data.bairro || "").trim();

          // tenta casar bairro automaticamente (removendo acentos etc)
          const found = neighborhoods.find(
            (n) => normalize(n.name) === normalize(viaCepBairro)
          );

          if (found) {
            // ✅ achou: seleciona automaticamente e NÃO abre lista
            setSelectedNb(found);
            setNbQuery(found.name);
            setShowNbList(false);
            setCepNbNotFound(false);
          } else {
            // ❌ não achou: não seleciona e abre lista como fallback
            setSelectedNb(null);
            setNbQuery(viaCepBairro);
            setShowNbList(true);
            setCepNbNotFound(true);
          }
        }
      } catch {
        // Se falhar, apenas não trava o usuário
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const filteredNeighborhoods = useMemo(() => {
    const q = nbQuery.trim().toLowerCase();
    if (!q) return neighborhoods.slice(0, 12);
    return neighborhoods.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 12);
  }, [nbQuery, neighborhoods]);

  const taxaEntrega = selectedNb?.fee || 0;
  const totalFinal = itemsTotal - state.discount + taxaEntrega;

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!nome.trim()) m.push("Seu nome");
    if (telefone.replace(/\D/g, "").length < 10) m.push("Telefone válido");
    if (!endereco.trim()) m.push("Endereço");
    if (!numero.trim()) m.push("Número");
    if (!selectedNb) m.push("Bairro");
    return m;
  }, [nome, telefone, endereco, numero, selectedNb]);

  const canSubmit = missing.length === 0;

  const handleSubmit = () => {
    if (!canSubmit) return;

    onSubmit({
      nome,
      telefone,
      cep,
      endereco,
      numero,
      bairro: selectedNb?.name || "",
      taxaEntrega,
      pagamento,
      subtotal: itemsTotal,
      desconto: state.discount,
      total: totalFinal,
    });
  };

  return (
    <div className="space-y-10 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Dados */}
      <section className="space-y-4">
        <header className="flex items-center gap-2">
          <User size={16} className="text-[#FBBE01]" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Seus dados
          </h3>
        </header>

        <div className="space-y-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            className={inputBase}
          />

          <div className="relative">
            <Phone
              size={16}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300"
            />
            <input
              value={telefone}
              onChange={handlePhone}
              placeholder="Telefone (WhatsApp)"
              className={inputWithIcon}
            />
          </div>
        </div>
      </section>

      {/* Endereço */}
      <section className="space-y-4">
        <header className="flex items-center gap-2">
          <MapPin size={16} className="text-[#FBBE01]" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Endereço de entrega
          </h3>
        </header>

        <div className="space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300"
            />
            <input
              value={cep}
              onChange={handleCep}
              placeholder="CEP"
              className={inputWithIcon}
            />
            {loadingCep && (
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">
                ...
              </span>
            )}
          </div>

          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua / Avenida"
            className={inputBase}
          />

          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Número"
            className={inputBase}
          />

          {/* Bairro */}
          <div className="bg-gray-50 rounded-3xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
              <Info size={14} className="text-[#FBBE01]" /> Bairro
            </p>

            {/* Se já tem bairro selecionado (via CEP ou manual), mostra read-only + botão trocar */}
            {selectedNb && !showNbList ? (
              <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden flex items-stretch">
                <input
                  value={selectedNb.name}
                  readOnly
                  className="
                    flex-1
                    px-5 py-4
                    bg-transparent
                    font-bold
                    text-sm
                    text-gray-900
                    outline-none
                    cursor-not-allowed
                  "
                />
                <div className="w-px bg-gray-100" />
                <button
                    type="button"
                    onClick={() => setShowNbList(true)}
                    className="
                      px-5
                      py-4
                      bg-gray-50
                      text-[10px]
                      font-black
                      uppercase
                      tracking-widest
                      text-gray-500
                      hover:bg-gray-100
                      active:scale-95
                      transition-all
                      whitespace-nowrap
                    "
                  >
                    Trocar
                  </button>
                </div>
            ) : (
              <div className="relative">
                <input
                  value={nbQuery}
                  onChange={(e) => {
                    setNbQuery(e.target.value);
                    setShowNbList(true);
                    setSelectedNb(null); // se o usuário começou a buscar manualmente, desmarca
                    setCepNbNotFound(false);
                  }}
                  onFocus={() => setShowNbList(true)}
                  placeholder="Digite para buscar bairro"
                  className={
                    "w-full px-5 py-4 bg-white rounded-3xl font-bold text-sm outline-none " +
                    "focus:ring-2 ring-[#FBBE01] text-gray-900 placeholder-gray-400"
                  }
                />

                {showNbList && (
                  <div className="mt-2 bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                    {filteredNeighborhoods.length === 0 ? (
                      <div className="p-4 text-sm font-bold text-gray-300">
                        Nenhum bairro encontrado.
                      </div>
                    ) : (
                      filteredNeighborhoods.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setSelectedNb(n);
                            setNbQuery(n.name);
                            setShowNbList(false);
                          }}
                          className="w-full text-left px-5 py-4 hover:bg-gray-50 flex items-center justify-between"
                        >
                          <span className="font-black text-sm text-gray-900">
                            {n.name}
                          </span>
                          <span className="text-sm font-black text-gray-400">
                            {formatCurrency(n.fee)}
                          </span>
                        </button>
                      ))
                    )}

                    <button
                      type="button"
                      onClick={() => setShowNbList(false)}
                      className="w-full px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 hover:bg-gray-100"
                    >
                      Fechar lista
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* aviso quando ViaCEP não conseguiu casar com sua tabela */}
            {cepNbNotFound && (
              <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
                <AlertTriangle size={12} /> Não identificamos o bairro automaticamente — selecione na lista.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Pagamento */}
      <section className="space-y-4">
        <header className="flex items-center gap-2">
          <Banknote size={16} className="text-[#FBBE01]" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Pagamento
          </h3>
        </header>

        <select
          value={pagamento}
          onChange={(e) => setPagamento(e.target.value)}
          className={
            "w-full px-5 py-4 bg-gray-50 rounded-3xl font-black text-sm outline-none " +
            "focus:ring-2 ring-[#FBBE01] text-gray-900"
          }
        >
          <option>Dinheiro</option>
          <option>Pix</option>
          <option>Cartão de crédito</option>
          <option>Cartão de débito</option>
        </select>
      </section>

      {/* Resumo */}
      <section className="bg-gray-50 rounded-[2.5rem] p-6 space-y-2">
        <div className="flex justify-between text-sm font-bold text-gray-400">
          <span>Subtotal</span>
          <span>{formatCurrency(itemsTotal)}</span>
        </div>

        {state.discount > 0 && (
          <div className="flex justify-between text-sm font-bold text-green-600">
            <span>Desconto</span>
            <span>- {formatCurrency(state.discount)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm font-bold text-gray-400">
          <span>Entrega</span>
          <span>{selectedNb ? formatCurrency(taxaEntrega) : "--"}</span>
        </div>

        <div className="pt-3 border-t border-gray-100 flex justify-between text-base font-black text-gray-900">
          <span>Total</span>
          <span>{formatCurrency(totalFinal)}</span>
        </div>
      </section>

      {/* Ação */}
      <section className="space-y-3">
        <button
          disabled={!canSubmit || loading}
          onClick={handleSubmit}
          className="w-full bg-[#FBBE01] text-black py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] disabled:opacity-30 transition-all"
        >
          {loading ? "Salvando pedido..." : "Finalizar pedido"}
        </button>


        {!canSubmit && (
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">
            Falta: {missing.join(" • ")}
          </div>
        )}
      </section>
    </div>
  );
}
