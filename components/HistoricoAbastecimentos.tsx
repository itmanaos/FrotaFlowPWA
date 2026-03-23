
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAbastecimento } from '../hooks/useAbastecimento';
import { fetchRequestLogs, fetchRequestsPaginated, getSession } from '../supabase';
import { 
  Calendar, MapPin, Fuel, User, ExternalLink, 
  Image as ImageIcon, Search, Truck, Info, X, CheckCircle2, 
  Archive, ChevronDown, ChevronUp, Clock, Droplets,
  Loader2, Ban, Activity, QrCode, FileText, AlertCircle, Eye, EyeOff, MessageSquare, ChevronRight, History, DollarSign, Camera
} from 'lucide-react';
import { AbastecimentoRealizado, RequisicaoAbastecimento, RequisicaoLog, UserRole, RequisicaoStatus } from '../types';

interface Props {
  role?: UserRole;
}

const PAGE_SIZE = 20;

const STATUS_GROUP_CONFIG: Record<RequisicaoStatus, { label: string, color: string, icon: any, bgColor: string, borderColor: string }> = {
  concluido: { label: 'Concluídos', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-100', icon: CheckCircle2 },
  autorizado: { label: 'Autorizados', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-100', icon: QrCode },
  pendente_gestor: { label: 'Pendente Gestor', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-100', icon: Clock },
  pendente_secretario: { label: 'Pendente Secretaria', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-100', icon: Clock },
  recusado: { label: 'Recusados', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-100', icon: Ban },
  faturada: { label: 'Faturados', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-100', icon: FileText },
};

const HistoricoAbastecimentos: React.FC<Props> = ({ role }) => {
  const { completedFuelings } = useAbastecimento();
  
  const [pagedRequests, setPagedRequests] = useState<RequisicaoAbastecimento[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMoreLoading, setIsMoreLoading] = useState(false);

  const [filterDate, setFilterDate] = useState('');
  const [filterPlate, setFilterPlate] = useState('');
  const [filterStatus, setFilterStatus] = useState<RequisicaoStatus | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    concluido: true,
    autorizado: true,
    pendente_gestor: false,
    pendente_secretario: false,
    recusado: false
  });
  
  const [selectedItem, setSelectedItem] = useState<{ fueling?: AbastecimentoRealizado, request: RequisicaoAbastecimento | undefined } | null>(null);
  const [logs, setLogs] = useState<RequisicaoLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const isManagementProfile = role === 'admin' || role === 'gestor' || role === 'secretario';
  const session = getSession();

  const loadRequests = useCallback(async (reset: boolean = false) => {
    const currentPage = reset ? 0 : page;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (reset) setIsLoading(true);
    else setIsMoreLoading(true);

    try {
      const filters: any = {
        placa: filterPlate || undefined,
        data: filterDate || undefined,
        status: filterStatus !== 'all' ? [filterStatus] : undefined,
        archived: showArchived || undefined
      };

      if (!isManagementProfile && session) {
        filters.motorista_id = session.id;
        if (filterStatus === 'all') {
          filters.status = ['concluido', 'autorizado', 'recusado'];
        }
      }

      const { data, count } = await fetchRequestsPaginated(from, to, filters);
      
      if (reset) {
        setPagedRequests(data);
        setPage(0);
      } else {
        setPagedRequests(prev => [...prev, ...data]);
      }
      setTotalCount(count);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setIsLoading(false);
      setIsMoreLoading(false);
    }
  }, [page, filterPlate, filterDate, isManagementProfile, session]);

  useEffect(() => {
    loadRequests(true);
  }, [filterPlate, filterDate, filterStatus, showArchived]);

  useEffect(() => {
    if (selectedItem?.request) {
      setLoadingLogs(true);
      fetchRequestLogs(selectedItem.request.id)
        .then(setLogs)
        .finally(() => setLoadingLogs(false));
    }
  }, [selectedItem]);

  const groupedData = useMemo(() => {
    const groups: Record<string, RequisicaoAbastecimento[]> = {
      concluido: [],
      autorizado: [],
      pendente_gestor: [],
      pendente_secretario: [],
      recusado: [],
      faturada: []
    };
    pagedRequests.forEach(req => {
      if (groups[req.status]) groups[req.status].push(req);
    });
    return groups;
  }, [pagedRequests]);

  const toggleGroup = (status: string) => {
    setExpandedGroups(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const handleLoadMore = () => setPage(prev => prev + 1);

  useEffect(() => {
    if (page > 0) loadRequests(false);
  }, [page]);

  const hasMore = (pagedRequests?.length || 0) < totalCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center">
            <Archive className="w-7 h-7 mr-2 text-blue-600" />
            Histórico e Auditoria
          </h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">
            {isManagementProfile ? "Controle total de fluxo e registros" : "Meus atendimentos e solicitações"}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition" />
            <input 
              type="text" 
              placeholder="Filtrar por placa..."
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-48 shadow-sm transition-all"
              value={filterPlate}
              onChange={e => setFilterPlate(e.target.value.toUpperCase())}
            />
          </div>
          <div className="relative group">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition" />
            <input 
              type="date" 
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
          </div>
          
          <div className="relative group">
            <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition" />
            <select 
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all appearance-none cursor-pointer"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
            >
              <option value="all">Todos Status</option>
              <option value="concluido">Concluídos</option>
              <option value="autorizado">Autorizados</option>
              <option value="pendente_gestor">Pendente Gestor</option>
              <option value="pendente_secretario">Pendente Secretaria</option>
              <option value="recusado">Recusados</option>
            </select>
          </div>

          <button 
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border ${
              showArchived 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-500 hover:text-blue-600'
            }`}
          >
            {showArchived ? <Archive className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            <span>{showArchived ? "Ver Recentes" : "Ver Arquivo"}</span>
          </button>

          {(filterPlate || filterDate || filterStatus !== 'all' || showArchived) && (
            <button 
              onClick={() => { 
                setFilterPlate(''); 
                setFilterDate(''); 
                setFilterStatus('all');
                setShowArchived(false);
              }} 
              className="p-2.5 text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Consultando Banco de Dados...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(STATUS_GROUP_CONFIG).map(([status, config]) => {
            const items = groupedData[status] || [];
            if (items.length === 0) return null;

            const isExpanded = expandedGroups[status];

            return (
              <div key={status} className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <button 
                  onClick={() => toggleGroup(status)}
                  className={`w-full flex items-center justify-between px-8 py-5 transition ${config.bgColor} border-b border-gray-100`}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-xl bg-white shadow-sm border ${config.borderColor} mr-4`}>
                      <config.icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="text-left">
                      <span className={`font-black text-xs uppercase tracking-widest ${config.color}`}>
                        {config.label}
                      </span>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">
                        {items.length} registros nesta fase
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-6 h-6 text-gray-400" /> : <ChevronDown className="w-6 h-6 text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          <th className="px-8 py-4">Data / Hora</th>
                          <th className="px-8 py-4">Veículo</th>
                          <th className="px-8 py-4">Condutor</th>
                          <th className="px-8 py-4">Volume (L)</th>
                          <th className="px-8 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items.map(req => {
                          const fueling = completedFuelings.find(f => f.requisicao_id === req.id);
                          return (
                            <tr 
                              key={req.id} 
                              onClick={() => setSelectedItem({ fueling, request: req })}
                              className="transition-colors cursor-pointer group hover:bg-blue-50/30"
                            >
                              <td className="px-8 py-5">
                                <div className="text-xs font-bold text-gray-800">{new Date(req.created_at).toLocaleDateString()}</div>
                                <div className="text-[10px] text-gray-400 font-medium">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex items-center">
                                  <Truck className="w-4 h-4 text-gray-300 mr-3 group-hover:text-blue-500 transition" />
                                  <div>
                                    <div className="text-xs font-black text-gray-900">{req.veiculo?.placa}</div>
                                    <div className="text-[9px] text-gray-400 font-bold uppercase">{req.veiculo?.modelo}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex items-center">
                                  <User className="w-3.5 h-3.5 text-gray-300 mr-2" />
                                  <span className="text-xs font-bold text-gray-700">{req.motorista?.nome || '...'}</span>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-blue-600">
                                    {fueling ? fueling.quantidade_final : req.quantidade_solicitada}L
                                  </span>
                                  {fueling && (
                                    <span className="text-[8px] font-bold text-gray-400 uppercase leading-none mt-0.5">Realizado</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem({ fueling, request: req });
                                  }}
                                  className="flex items-center ml-auto space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-sm transition-all group/btn"
                                >
                                  <Eye className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                  <span>Detalhes</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {hasMore && (
            <div className="flex justify-center pt-8">
              <button 
                onClick={handleLoadMore}
                disabled={isMoreLoading}
                className="flex items-center space-x-3 bg-white border-2 border-gray-100 px-10 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isMoreLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sincronizando Lote...</span>
                  </>
                ) : (
                  <>
                    <History className="w-4 h-4" />
                    <span>Carregar Mais Registros</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 p-8 flex justify-between items-center z-10">
              <div>
                <h3 className="text-2xl font-black text-gray-900 flex items-center">
                  <Info className="w-6 h-6 mr-2 text-blue-600" />
                  Dossiê de Registro
                </h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Protocolo: {selectedItem.request?.id}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => window.print()} 
                  className="p-3 hover:bg-gray-100 rounded-full transition text-gray-400 hover:text-blue-600"
                  title="Imprimir Dossiê"
                >
                  <FileText className="w-6 h-6" />
                </button>
                <button onClick={() => setSelectedItem(null)} className="p-3 hover:bg-gray-100 rounded-full transition">
                  <X className="w-7 h-7 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-8">
               {/* Seção do Veículo */}
               <div>
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                    <Truck className="w-4 h-4 mr-2 text-blue-500" /> Especificações do Veículo
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <DetailBox label="Placa" value={selectedItem.request?.veiculo?.placa || 'N/A'} bold />
                    <DetailBox label="Modelo / Versão" value={selectedItem.request?.veiculo?.modelo || 'N/A'} />
                    <DetailBox label="Combustível Padrão" value={selectedItem.request?.veiculo?.tipo_combustivel || 'N/A'} />
                  </div>
               </div>

               {/* Seção do Abastecimento */}
               <div>
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                    <Droplets className="w-4 h-4 mr-2 text-indigo-500" /> Dados do Abastecimento
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <DetailBox label="Status Atual" value={selectedItem.request?.status.toUpperCase() || 'N/A'} bold color="text-indigo-600" />
                    <DetailBox label="Data / Hora" value={new Date(selectedItem.request?.created_at || '').toLocaleString()} />
                    <DetailBox label="Solicitado por" value={selectedItem.request?.motorista?.nome || 'N/A'} />
                    <DetailBox label="Combustível Solicitado" value={selectedItem.request?.tipo_combustivel || 'N/A'} />
                    <DetailBox label="Volume Solicitado" value={`${selectedItem.request?.quantidade_solicitada}L`} bold color="text-indigo-600" />
                    
                    {selectedItem.request?.qr_code_token && (
                      <DetailBox label="Token QR Code" value={selectedItem.request.qr_code_token} bold color="text-blue-600" />
                    )}

                    {selectedItem.request?.observacoes && (
                      <div className="col-span-2 md:col-span-3">
                        <DetailBox label="Observações da Solicitação" value={selectedItem.request.observacoes} />
                      </div>
                    )}
                    
                    {selectedItem.fueling && (
                      <>
                        <DetailBox label="Combustível Atendido" value={selectedItem.fueling.tipo_combustivel_atendido || 'N/A'} bold color={selectedItem.fueling.tipo_combustivel_atendido !== selectedItem.request?.tipo_combustivel ? 'text-orange-600' : 'text-gray-900'} />
                        <DetailBox label="Volume Total Abastecido" value={`${selectedItem.fueling.quantidade_final}L`} bold color="text-green-600" />
                        <DetailBox label="Valor Total" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedItem.fueling.valor_total || 0)} bold color="text-blue-600" />
                        <DetailBox label="Odômetro Bomba" value={`${selectedItem.fueling.odometro_bomba} KM`} />
                        <DetailBox label="Atendido por" value={`Frentista #${selectedItem.fueling.frentista_id.slice(0, 4)}`} />
                      </>
                    )}
                  </div>
               </div>

               {/* Seção de Evidência Fotográfica */}
               {selectedItem.fueling?.foto_placa_url && (
                 <div className="pt-6 border-t border-gray-100">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                      <Camera className="w-4 h-4 mr-2 text-blue-500" /> Evidência Fotográfica (Placa)
                    </p>
                    <div className="relative group aspect-video rounded-3xl overflow-hidden border-4 border-gray-50 shadow-inner bg-gray-100">
                      <img 
                        // FIX: Removed reference to non-existent property fuel_images_url
                        src={selectedItem.fueling.foto_placa_url} 
                        alt="Foto da Placa" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <a 
                          href={selectedItem.fueling.foto_placa_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-white/95 px-6 py-3 rounded-2xl text-blue-600 font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center transform scale-90 group-hover:scale-100 transition-transform"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" /> Ampliar Imagem
                        </a>
                      </div>
                    </div>
                 </div>
               )}

               <div className="pt-6 border-t border-gray-100">
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-indigo-500" /> Linha do Tempo da Operação
                  </p>
                  
                  {loadingLogs ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-blue-300" /></div>
                  ) : (
                    <div className="space-y-6 ml-2">
                      {logs.map((log) => (
                        <div key={log.id} className="relative pl-8 pb-4 border-l-2 border-gray-100 last:border-l-transparent">
                          <div className={`absolute -left-[11px] top-0 w-5 h-5 rounded-full border-4 border-white shadow-sm ${
                            log.status_novo === 'concluido' ? 'bg-green-500' : 
                            log.status_novo === 'recusado' ? 'bg-red-500' : 
                            log.status_novo === 'autorizado' ? 'bg-blue-500' : 'bg-gray-300'
                          }`}></div>
                          
                          <div className="flex flex-col bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-black text-gray-800">{log.acao}</span>
                              <span className="text-[10px] font-bold text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center mt-2">
                              <User className="w-3.5 h-3.5 text-gray-400 mr-2" />
                              <span className="text-xs text-gray-600 font-bold">{log.perfil?.nome || 'Sistema'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>

               {selectedItem.fueling?.geolocalizacao && (
                 <div className="pt-6 border-t border-gray-100">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Evidência Geográfica</p>
                    <div className="bg-gray-50 p-5 rounded-3xl flex items-center justify-between border border-gray-100">
                       <div className="flex items-center">
                          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mr-4">
                             <MapPin className="w-6 h-6 text-red-500" />
                          </div>
                          <div>
                             <p className="text-sm font-black text-gray-800">Local de Abastecimento</p>
                             <p className="text-[10px] font-mono text-gray-500 font-bold">
                                {selectedItem.fueling.geolocalizacao.lat.toFixed(6)}, {selectedItem.fueling.geolocalizacao.lng.toFixed(6)}
                             </p>
                          </div>
                       </div>
                       <a 
                        href={`https://www.google.com/maps?q=${selectedItem.fueling.geolocalizacao.lat},${selectedItem.fueling.geolocalizacao.lng}`} 
                        target="_blank" 
                        className="bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-gray-200 hover:bg-gray-50 transition flex items-center text-xs font-black text-blue-600"
                       >
                          <ExternalLink className="w-4 h-4 mr-2" /> ABRIR MAPS
                       </a>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailBox: React.FC<{ label: string, value: string, bold?: boolean, color?: string }> = ({ label, value, bold, color = "text-gray-900" }) => (
  <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-sm hover:bg-white transition-colors">
    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
    <p className={`text-sm ${bold ? 'font-black' : 'font-bold'} ${color} truncate`}>{value}</p>
  </div>
);

export default HistoricoAbastecimentos;
