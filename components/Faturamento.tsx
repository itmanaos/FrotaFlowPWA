
import React, { useState, useEffect } from 'react';
import { fetchFaturas, fetchPendingBillingRequests, createFatura, fetchFaturaDetails } from '../supabase';
import { Fatura } from '../types';
import { 
  Receipt, Plus, Calendar, Search, FileText, CheckCircle2, 
  Clock, Loader2, Download, Eye, X, Fuel, 
  TrendingUp, DollarSign, Package
} from 'lucide-react';

interface Props {
  userId: string;
}

const Faturamento: React.FC<Props> = ({ userId }) => {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFatura, setSelectedFatura] = useState<any>(null);
  
  // Form state for new invoice
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadFaturas();
  }, []);

  const loadFaturas = async () => {
    setLoading(true);
    try {
      const data = await fetchFaturas();
      setFaturas(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchPending = async () => {
    if (!startDate || !endDate) return;
    setSearching(true);
    try {
      const data = await fetchPendingBillingRequests(`${startDate}T00:00:00Z`, `${endDate}T23:59:59Z`);
      setPendingRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateFatura = async () => {
    if (pendingRequests.length === 0) return;
    setCreating(true);
    try {
      const totalLitros = pendingRequests.reduce((acc, curr) => acc + Number(curr.quantidade_final), 0);
      const totalValor = pendingRequests.reduce((acc, curr) => acc + Number(curr.valor_total), 0);
      const numeroFatura = `FAT-${Date.now().toString().slice(-6)}`;
      
      const faturaData = {
        numero_fatura: numeroFatura,
        data_inicio: `${startDate}T00:00:00Z`,
        data_fim: `${endDate}T23:59:59Z`,
        total_litros: totalLitros,
        total_valor: totalValor,
        status: 'fechada' as const,
        created_by: userId
      };

      const reqIds = pendingRequests.map(p => p.requisicao_id);
      await createFatura(faturaData, reqIds);
      
      setShowCreateModal(false);
      setPendingRequests([]);
      setStartDate('');
      setEndDate('');
      loadFaturas();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar fatura");
    } finally {
      setCreating(false);
    }
  };

  const handleViewDetails = async (faturaId: string) => {
    try {
      const details = await fetchFaturaDetails(faturaId);
      setSelectedFatura(details);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-gray-900 flex items-center">
            <Receipt className="w-7 h-7 mr-3 text-indigo-600" /> Faturamento
          </h3>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Controle de Emissões e Faturas</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Fatura</span>
        </button>
      </div>

      {/* Faturas List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        </div>
      ) : faturas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {faturas.map(f => (
            <div key={f.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
              
              <div className="relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${f.status === 'fechada' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                    {f.status}
                  </span>
                </div>

                <h4 className="text-lg font-black text-gray-900 mb-1">{f.numero_fatura}</h4>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-4">
                  {new Date(f.data_inicio).toLocaleDateString()} — {new Date(f.data_fim).toLocaleDateString()}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Volume Total</p>
                    <p className="text-base font-black text-gray-900">{f.total_litros}L</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Valor Total</p>
                    <p className="text-base font-black text-indigo-600">R$ {(f.total_valor || 0).toFixed(2)}</p>
                  </div>
                </div>

                <button 
                  onClick={() => handleViewDetails(f.id)}
                  className="w-full py-3 bg-gray-50 text-gray-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition flex items-center justify-center space-x-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Ver Detalhes</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-16 rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-gray-300">
            <Receipt className="w-10 h-10" />
          </div>
          <h4 className="text-xl font-black text-gray-800 mb-2">Nenhuma fatura emitida</h4>
          <p className="text-sm text-gray-400 max-w-xs font-medium">Inicie o processo de faturamento selecionando um período para contabilizar as requisições concluídas.</p>
        </div>
      )}

      {/* Create Fatura Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-900">Emitir Nova Fatura</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Selecione o período de apuração</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-8">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase ml-1">Data Inicial</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase ml-1">Data Final</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>
              <button 
                onClick={handleSearchPending}
                disabled={searching || !startDate || !endDate}
                className="bg-indigo-600 text-white rounded-xl py-3 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center justify-center disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-2" /> Buscar</>}
              </button>
            </div>

            {pendingRequests.length > 0 ? (
              <div className="space-y-6">
                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Total a Faturar</p>
                      <h4 className="text-xl font-black text-gray-900">
                        R$ {pendingRequests.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0).toFixed(2)}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center space-x-8">
                    <div className="text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Itens</p>
                      <p className="text-base font-black text-gray-900">{pendingRequests.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Volume</p>
                      <p className="text-base font-black text-gray-900">
                        {pendingRequests.reduce((acc, curr) => acc + Number(curr.quantidade_final), 0)}L
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={handleCreateFatura}
                    disabled={creating}
                    className="bg-green-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition shadow-lg shadow-green-100 flex items-center space-x-2 disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> <span>Fechar Fatura</span></>}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-black text-gray-400 uppercase text-[9px]">Data</th>
                        <th className="px-4 py-3 font-black text-gray-400 uppercase text-[9px]">Placa</th>
                        <th className="px-4 py-3 font-black text-gray-400 uppercase text-[9px]">Motorista</th>
                        <th className="px-4 py-3 font-black text-gray-400 uppercase text-[9px] text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pendingRequests.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-2 font-bold text-gray-600">{new Date(p.data_hora).toLocaleDateString()}</td>
                          <td className="px-4 py-2 font-black text-gray-900">{p.placa_conferida}</td>
                          <td className="px-4 py-2 font-bold text-gray-600">{p.requisicao?.motorista?.nome}</td>
                          <td className="px-4 py-2 font-black text-indigo-600 text-right">R$ {(p.valor_total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : startDate && endDate && !searching && (
              <div className="bg-gray-50 p-12 rounded-2xl text-center border border-dashed border-gray-200">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h4 className="text-base font-black text-gray-800">Nenhuma requisição pendente</h4>
                <p className="text-xs text-gray-400 font-medium">Não encontramos abastecimentos concluídos e não faturados neste período.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fatura Details Modal */}
      {selectedFatura && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-indigo-600 p-8 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <Receipt className="w-6 h-6" />
                  <h3 className="text-2xl font-black">{selectedFatura.numero_fatura}</h3>
                </div>
                <p className="text-indigo-100 font-bold uppercase tracking-widest text-[9px]">
                  Período: {new Date(selectedFatura.data_inicio).toLocaleDateString()} — {new Date(selectedFatura.data_fim).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition" title="Imprimir">
                  <Download className="w-5 h-5" />
                </button>
                <button onClick={() => setSelectedFatura(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 border-b border-gray-100">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total de Litros</p>
                <div className="flex items-center space-x-2">
                  <Fuel className="w-5 h-5 text-indigo-600" />
                  <span className="text-lg font-black text-gray-900">{selectedFatura.total_litros}L</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor Faturado</p>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-lg font-black text-gray-900">R$ {(selectedFatura.total_valor || 0).toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Itens Faturados</p>
                <div className="flex items-center space-x-2">
                  <Package className="w-5 h-5 text-orange-600" />
                  <span className="text-lg font-black text-gray-900">{selectedFatura.requisicoes?.length || 0}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <h4 className="text-base font-black text-gray-800 mb-4">Detalhamento das Requisições</h4>
              <div className="space-y-3">
                {selectedFatura.requisicoes?.map((req: any) => (
                  <div key={req.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between group hover:border-indigo-200 transition">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                        <Fuel className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-gray-900">{req.veiculo?.placa}</span>
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{req.tipo_combustivel}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold">{req.veiculo?.modelo}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-8">
                      <div className="text-right">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Motorista</p>
                        <p className="text-[10px] font-bold text-gray-700">{req.motorista?.nome}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Volume</p>
                        <p className="text-xs font-black text-gray-900">{req.abastecimento?.[0]?.quantidade_final || req.quantidade_solicitada}L</p>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Subtotal</p>
                        <p className="text-base font-black text-indigo-600">R$ {(req.abastecimento?.[0]?.valor_total || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setSelectedFatura(null)} className="px-8 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Faturamento;
