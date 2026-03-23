
import React, { useState, useEffect } from 'react';
import { Truck, Lock, User, Loader2, Database } from 'lucide-react';
import { signIn, seedDatabase } from '../supabase';
import { Perfil } from '../types';

interface LoginFormProps {
  onLoginSuccess: (user: Perfil) => void;
}

const REMEMBERED_CPF_KEY = 'frotaflow_remembered_cpf';

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Carrega o CPF salvo ao montar o componente
  useEffect(() => {
    const savedCpf = localStorage.getItem(REMEMBERED_CPF_KEY);
    if (savedCpf) {
      setCpf(savedCpf);
      setRemember(true);
    }
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setError('');
    setSuccess('');
    try {
      await seedDatabase();
      setSuccess('Banco de dados inicializado com sucesso! Agora você pode entrar com 111, 222, 333 ou 444.');
    } catch (err: any) {
      setError('Falha ao inicializar banco: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const user = await signIn(cpf, password, remember);
      
      // Lógica de persistência do CPF para preenchimento futuro
      if (remember) {
        localStorage.setItem(REMEMBERED_CPF_KEY, cpf);
      } else {
        localStorage.removeItem(REMEMBERED_CPF_KEY);
      }

      onLoginSuccess(user);
    } catch (err: any) {
      let errorMsg = err.message || 'Erro ao autenticar';
      if (errorMsg === 'Failed to fetch') {
        errorMsg = 'Erro de conexão com o servidor. Verifique se o projeto Supabase está ativo.';
        
        // Adiciona aviso sobre a chave se parecer estar errada
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PhLommsswSMLOgaHDqGFNw_zgQQ9A2N';
        if (key.startsWith('sb_publishable_')) {
          errorMsg += ' AVISO: Sua chave parece ser do Stripe, não do Supabase.';
        }
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-2xl mb-2">
            <Truck className="w-10 h-10 text-blue-700" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">FrotaFlow</h1>
          <p className="text-gray-500 font-medium italic">Acesso Restrito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
              {error}
              {(error.includes('Usuário não encontrado') || error.includes('não foi inicializado')) && (
                <button 
                  type="button"
                  onClick={handleSeed}
                  className="block mt-2 text-blue-600 underline font-bold"
                >
                  {error.includes('não foi inicializado') ? 'Inicializar Banco de Dados agora?' : 'Inicializar banco com dados de teste?'}
                </button>
              )}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm font-medium border border-green-100">
              {success}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text"
                required
                placeholder="CPF (ex: 111, 222, 333, 444)"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={cpf}
                onChange={e => setCpf(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="password"
                required
                placeholder="Sua senha"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
              />
              <span className="text-sm text-gray-600 group-hover:text-blue-700 transition">Mantenha-me conectado</span>
            </label>
          </div>

          <button 
            type="submit"
            disabled={loading || seeding}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95 transition disabled:opacity-70 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <span>Entrar</span>
            )}
          </button>

          {seeding && (
            <div className="flex items-center justify-center space-x-2 text-blue-600 text-sm font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Inicializando banco de dados...</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
