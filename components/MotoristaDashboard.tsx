
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAbastecimento } from '../hooks/useAbastecimento';
import { fetchVehicles } from '../supabase';
import { 
  PlusCircle, Clock, CheckCircle2, QrCode as QrIcon, 
  Share2, X, Truck, Fuel, Ban, UserCircle, 
  Search, ShieldAlert, ListChecks, History, Calendar, ArrowRight, AlertTriangle, MessageSquare, FileText
} from 'lucide-react';
import { RequisicaoAbastecimento, Veiculo, Perfil, RequisicaoStatus } from '../types';

interface Props {
  user: Perfil;
}

type DriverTab = 'analise' | 'autorizado' | 'concluido' | 'recusado';

const MotoristaDashboard: React.FC<Props> = ({ user }) => {
  const { requests, completedFuelings, createRequest, loading, error, setError } = useAbastecimento('motorista', user.id);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<DriverTab>('autorizado');
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [formData, setFormData] = useState({
    veiculo_id: '',
    quantidade_solicitada: 0,
    tipo_combustivel: 'Diesel',
    observacoes: ''
  });

  const qrRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    fetchVehicles().then(data => {
      setVehicles(data);
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, veiculo_id: data[0].id }));
      }
    });
  }, []);

  const myRequests = useMemo(() => {
    return requests.filter(r => r.motorista_id === user.id);
  }, [requests, user.id]);

  const groupedRequests = useMemo(() => {
    return {
      analise: myRequests.filter(r => r.status === 'pendente_gestor' || r.status === 'pendente_secretario'),
      autorizado: myRequests.filter(r => r.status === 'autorizado'),
      concluido: myRequests.filter(r => r.status === 'concluido'),
      recusado: myRequests.filter(r => r.status === 'recusado'),
    };
  }, [myRequests]);

  const handleShare = async (req: RequisicaoAbastecimento) => {
    const canvas = qrRefs.current[req.id];
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      const file = new File([blob], `qrcode-abastecimento-${req.id.slice(0, 4)}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'QR Code de Abastecimento',
          text: `Token de abastecimento para o veículo ${req.veiculo?.placa}`,
        });
      } else {
        const link = document.createElement('a');
        link.download = `qrcode-${req.id.slice(0, 4)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (error) {
      console.error('Erro ao compartilhar QR Code:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRequest(formData);
      setShowModal(false);
      setFormData({ veiculo_id: vehicles[0]?.id || '', quantidade_solicitada: 0, tipo_combustivel: 'Diesel', observacoes: '' });
      setActiveTab('analise');
    } catch (err) {
      // Erro já é tratado pelo hook e exibido via estado 'error'
    }
  };

  const isListView = activeTab === 'concluido' || activeTab === 'recusado';

  // Verifica se um veículo está ocupado por outra requisição pendente
  const isVehicleBusy = (vehicleId: string) => {
    return requests.some(r => 
      r.veiculo_id === vehicleId && 
      !['concluido', 'recusado'].includes(r.status)
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho de Boas-Vindas */}
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner">
            <UserCircle className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Olá, {user.nome}</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{user.cargo || 'Motorista'}</p>
          </div>
        </div>
        
        <button 
          onClick={() => {
            setError(null);
            setShowModal(true);
          }}
          className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-100 active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          <span>SOLICITAR ABASTECIMENTO</span>
        </button>
      </div>

      {/* Navegação por Abas */}
      <div className="space-y-6">
        <div className="flex bg-white p-1.5 rounded-[1.5rem] shadow-sm border border-gray-100 overflow-x-auto no-scrollbar">
          <TabButton 
            active={activeTab === 'analise'} 
            onClick={() => setActiveTab('analise')} 
            icon={<Clock className="w-4 h-4" />} 
            label="Análise" 
            count={groupedRequests.analise.length}
            color="yellow"
          />
          <TabButton 
            active={activeTab === 'autorizado'} 
            onClick={() => setActiveTab('autorizado')} 
            icon={<QrIcon className="w-4 h-4" />} 
            label="Autorizados" 
            count={groupedRequests.autorizado.length}
            color="blue"
          />
          <TabButton 
            active={activeTab === 'concluido'} 
            onClick={() => setActiveTab('concluido')} 
            icon={<CheckCircle2 className="w-4 h-4" />} 
            label="Concluídos" 
            count={groupedRequests.concluido.length}
            color="green"
          />
          <TabButton 
            active={activeTab === 'recusado'} 
            onClick={() => setActiveTab('recusado')} 
            icon={<Ban className="w-4 h-4" />} 
            label="Recusados" 
            count={groupedRequests.recusado.length}
            color="red"
          />
        </div>

        {/* Conteúdo das Abas */}
        {isListView ? (
          /* Visualização em Lista (Concluídos e Recusados) */
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-8 py-4">Data</th>
                    <th className="px-8 py-4">Veículo</th>
                    <th className="px-8 py-4">Volume</th>
                    <th className="px-8 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {groupedRequests[activeTab].map((req) => {
                    const fueling = completedFuelings.find(f => f.requisicao_id === req.id);
                    return (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center text-xs font-bold text-gray-800">
                            <Calendar className="w-3.5 h-3.5 text-gray-300 mr-2" />
                            {new Date(req.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center">
                            <Truck className="w-4 h-4 text-gray-300 mr-3" />
                            <div>
                              <div className="text-xs font-black text-gray-900">{req.veiculo?.placa}</div>
                              <div className="text-[9px] text-gray-400 font-bold uppercase">{req.veiculo?.modelo}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center">
                            <Fuel className="w-3.5 h-3.5 text-gray-300 mr-2" />
                            <span className={`text-xs font-black ${activeTab === 'recusado' ? 'text-gray-400 line-through' : 'text-blue-600'}`}>
                              {fueling ? fueling.quantidade_final : req.quantidade_solicitada}L
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <StatusBadge status={req.status} compact />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {groupedRequests[activeTab].length === 0 && <EmptyState />}
            </div>
          </div>
        ) : (
          /* Visualização em Cartões (Análise e Autorizados) */
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {groupedRequests[activeTab].map((req) => (
              <div key={req.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-xl transition-all duration-300 group animate-in slide-in-from-bottom-2">
                <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">REF: {req.id.slice(0, 8)}</span>
                  <StatusBadge status={req.status} />
                </div>
                <div className="p-6 space-y-5 flex-grow">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                      <div className="flex items-center">
                        <Truck className="w-4 h-4 text-gray-300 mr-3 group-hover:text-blue-500 transition" />
                        <span className="text-gray-400 text-[9px] font-black uppercase tracking-wider">Veículo</span>
                      </div>
                      <span className="font-black text-gray-800 text-sm">{req.veiculo?.placa || '...'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                      <div className="flex items-center">
                        <Fuel className="w-4 h-4 text-gray-300 mr-3 group-hover:text-blue-500 transition" />
                        <span className="text-gray-400 text-[9px] font-black uppercase tracking-wider">Volume</span>
                      </div>
                      <span className="font-black text-blue-600 text-sm">{req.quantidade_solicitada}L <span className="text-[9px] font-bold text-gray-400">({req.tipo_combustivel})</span></span>
                    </div>
                    {req.observacoes && (
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
                          <MessageSquare className="w-2.5 h-2.5 mr-1" /> Observações
                        </p>
                        <p className="text-[10px] text-gray-600 font-medium line-clamp-2 italic">"{req.observacoes}"</p>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase">
                      <span>Solicitado em</span>
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {req.status === 'autorizado' && req.qr_code_token && (
                    <div className="mt-4 flex flex-col items-center p-6 bg-blue-50/50 rounded-[1.5rem] border border-blue-100 relative">
                      <div className="flex justify-between w-full mb-4">
                        <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest flex items-center">
                          <QrIcon className="w-3 h-3 mr-2" /> QR CODE PARA FRENTISTA
                        </p>
                        <button 
                          onClick={() => handleShare(req)}
                          className="p-2 bg-white rounded-xl text-blue-600 hover:text-blue-700 transition shadow-sm border border-blue-100 active:scale-90"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="bg-white p-5 rounded-[2rem] shadow-inner border border-blue-100 group-hover:scale-105 transition-transform">
                        <QRCodeCanvas 
                          ref={el => { qrRefs.current[req.id] = el; }}
                          value={req.qr_code_token} 
                          size={160}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      
                      <p className="mt-5 text-[10px] text-gray-400 font-mono font-black tracking-[0.3em] bg-white px-4 py-1.5 rounded-full border border-blue-50 shadow-sm">{req.qr_code_token}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {groupedRequests[activeTab].length === 0 && <EmptyState />}
          </div>
        )}
      </div>

      {/* Modal Nova Requisição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-2">
              <h3 className="text-2xl font-black text-gray-900">Novo Pedido</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition"><X className="w-6 h-6 text-gray-400" /></button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start space-x-3 mb-6 animate-in shake duration-300">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-xs font-bold text-red-600 leading-tight">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Veículo Responsável</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 transition appearance-none"
                  value={formData.veiculo_id}
                  onChange={e => {
                    setFormData({...formData, veiculo_id: e.target.value});
                    setError(null);
                  }}
                  required
                >
                  <option value="" disabled>Selecione um veículo</option>
                  {vehicles.map(v => {
                    const busy = isVehicleBusy(v.id);
                    return (
                      <option key={v.id} value={v.id} disabled={busy}>
                        {v.placa} — {v.modelo} {busy ? '(OCUPADO)' : ''}
                      </option>
                    );
                  })}
                </select>
                {isVehicleBusy(formData.veiculo_id) && (
                  <p className="mt-2 text-[10px] text-orange-500 font-bold flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Este veículo já tem uma requisição em aberto.
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Litros</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-black text-2xl text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.quantidade_solicitada || ''}
                    onChange={e => setFormData({...formData, quantidade_solicitada: Number(e.target.value)})}
                  />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Tipo</label>
                   <select 
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 transition appearance-none"
                    value={formData.tipo_combustivel}
                    onChange={e => setFormData({...formData, tipo_combustivel: e.target.value})}
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Etanol">Etanol</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Observações (Opcional)</label>
                <textarea 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition min-h-[100px] resize-none"
                  placeholder="Instruções para o gestor ou frentista..."
                  value={formData.observacoes}
                  onChange={e => setFormData({...formData, observacoes: e.target.value})}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || isVehicleBusy(formData.veiculo_id)}
                className="w-full mt-4 py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 disabled:opacity-50 transition active:scale-95"
              >
                {loading ? 'Sincronizando...' : 'Confirmar Pedido'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = () => (
  <div className="col-span-full py-24 text-center bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100">
    <ListChecks className="w-16 h-16 text-gray-200 mx-auto mb-6" />
    <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.2em]">Nenhum item nesta categoria</p>
  </div>
);

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  color: 'blue' | 'yellow' | 'green' | 'red';
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label, count, color }) => {
  const colorClasses = {
    blue: active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-blue-600',
    yellow: active ? 'bg-yellow-500 text-white' : 'text-gray-400 hover:text-yellow-600',
    green: active ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-green-600',
    red: active ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-red-600',
  };

  const badgeClasses = {
    blue: active ? 'bg-blue-400/30' : 'bg-gray-100 text-gray-500',
    yellow: active ? 'bg-yellow-400/30' : 'bg-gray-100 text-gray-500',
    green: active ? 'bg-green-400/30' : 'bg-gray-100 text-gray-500',
    red: active ? 'bg-red-400/30' : 'bg-gray-100 text-gray-500',
  };

  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 min-w-[120px] ${colorClasses[color]}`}
    >
      {icon}
      <span>{label}</span>
      {count > 0 && (
        <span className={`px-2 py-0.5 rounded-full text-[10px] ${badgeClasses[color]}`}>
          {count}
        </span>
      )}
    </button>
  );
};

const StatusBadge: React.FC<{ status: RequisicaoStatus, compact?: boolean }> = ({ status, compact = false }) => {
  const configs: Record<RequisicaoStatus, { label: string, color: string, icon: any }> = {
    pendente_gestor: { label: 'PEND. GESTOR', color: 'bg-yellow-50 text-yellow-700 border-yellow-100', icon: Clock },
    pendente_secretario: { label: 'AGUARD. SECR.', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: Clock },
    autorizado: { label: 'AUTORIZADO', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: QrIcon },
    concluido: { label: 'CONCLUÍDO', color: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle2 },
    recusado: { label: 'REPROVADA', color: 'bg-red-50 text-red-700 border-red-100', icon: Ban },
    faturada: { label: 'FATURADA', color: 'bg-gray-50 text-gray-700 border-gray-100', icon: FileText },
  };

  const config = configs[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[7px] font-black border ${config.color} tracking-tighter`}>
        <Icon className="w-2.5 h-2.5 mr-1" />
        {config.label}
      </span>
    );
  }

  return (
    <span className={`flex items-center px-2 py-1.5 rounded-xl text-[8px] font-black border ${config.color} tracking-widest`}>
      <Icon className="w-2.5 h-2.5 mr-1.5" />
      {config.label}
    </span>
  );
};

export default MotoristaDashboard;
