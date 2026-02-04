"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ToastProvider';
import { useLoading } from '@/components/LoadingProvider';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { showToast } = useToast();
  const { startLoading, stopLoading } = useLoading();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      startLoading();
      const res = await supabase.auth.signInWithPassword({ email, password });
      if (res.error) {
        setError(res.error.message || 'Erro ao autenticar');
        showToast(res.error.message || 'Erro ao autenticar', 'error');
        setTimeout(() => setError(''), 3000);
        return;
      }
      showToast('Login realizado com sucesso!');
      router.push('/admin');
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado');
      showToast(err?.message || 'Erro inesperado', 'error');
    } finally {
      stopLoading();
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#FBBE01] opacity-10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#FBBE01] opacity-5 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FBBE01] rounded-2xl mb-4 rotate-3 shadow-lg shadow-[#FBBE01]/20">
            <ShieldCheck size={32} className="text-black" />
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">
            Painel <span className="text-[#FBBE01]">Admin</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">Área restrita para gestão da conveniência.</p>
        </div>

        <div className="bg-[#141414] border border-white/5 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail</label>
              <div className="relative group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border-none ring-1 ring-white/10 focus:ring-[#FBBE01] text-white p-4 rounded-2xl outline-none transition-all placeholder:text-gray-700"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#FBBE01] transition-colors" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-black border-none ring-1 ${error ? 'ring-red-500' : 'ring-white/10'} focus:ring-[#FBBE01] text-white p-4 pl-12 rounded-2xl outline-none transition-all placeholder:text-gray-700`}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-red-500 text-[10px] font-bold uppercase tracking-tighter animate-bounce">{error}</p>}
            </div>

            <button
              type="submit"
              className="w-full bg-[#FBBE01] text-black py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#FBBE01]/10"
            >
              Entrar no Sistema
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        <div className="text-center mt-8">
          <Link href="/" className="text-gray-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
            ← Voltar para a Loja
          </Link>
        </div>
      </div>
    </main>
  );
}