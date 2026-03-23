
import React, { useState, useEffect } from 'react';
import { useAbastecimento } from '../hooks/useAbastecimento';
import { 
  fetchVehicles, fetchProfiles, createVehicle, updateVehicle, deleteVehicle,
  createProfile, updateProfile, deleteProfile,
  fetchGroups, createGroup, updateGroup, deleteGroup, fetchRequestLogs, clearAllTransactions 
} from '../supabase';
import { UserRole, RequisicaoAbastecimento, Veiculo, Perfil, RequisicaoStatus, Grupo, RequisicaoLog } from '../types';
import { 
  Check, ShieldCheck, UserCheck, AlertCircle, List, 
  History, BarChart3, Settings, Plus, X, Truck, User, Fuel, Ban,
  CarFront, Users, BadgeCheck, Pencil, Trash2, Shield, Activity, Clock, CheckCircle2, QrCode as QrIcon,
  AlertTriangle, ChevronRight, Tags, FolderPlus, MessageSquare, Eye, Share2, MapPin, ExternalLink, Info, Droplets, Loader2, DollarSign, RotateCw
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import HistoricoAbastecimentos from './HistoricoAbastecimentos';
import Dashboard from './Dashboard';

interface Props {
  role: UserRole;
  userId: string;
}

const WorkflowsDashboard: React.FC<Props> = ({ role, userId }) => {
  const { requests, completedFuelings, approveGestor, approveSecretario, rejectRequest, createRequest, refreshData, loading, error, setError } = useAbastecimento(role, userId);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'dashboard' | 'management'>(
    role === 'admin' ? 'pending' : 'dashboard'
  );
  
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Perfil[]>([]);
  const [profiles, setProfiles] = useState<Perfil[]>([]); 
  const [groups, setGroups] = useState<Grupo[]>([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  
  const [editingVehicle, setEditingVehicle] = useState<Veiculo | null>(null);
  const [editingProfile, setEditingProfile] = useState<Perfil | null>(null);
  const [editingGroup, setEditingGroup] = useState<Grupo | null>(null);

  const [selectedQrReq, setSelectedQrReq] = useState<RequisicaoAbastecimento | null>(null);
  const [selectedDetailReq, setSelectedDetailReq] = useState<RequisicaoAbastecimento | null>(null);
  const [detailLogs, setDetailLogs] = useState<RequisicaoLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [vehicleError, setVehicleError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [groupError, setGroupError] = useState('');

  const [formData, setFormData] = useState({
    motorista_id: '',
    veiculo_id: '',
    quantidade_solicitada: 0,
    tipo_combustivel: 'Diesel',
    observacoes: ''
  });

  const [vehicleForm, setVehicleForm] = useState({
    placa: '',
    modelo: '',
    tipo_combustivel: 'Diesel',
    odometro_atual: 0,
    proprietario: ''
  });

  const [profileForm, setProfileForm] = useState({
    nome: '',
    cpf: '',
    cargo: '',
    role: 'motorista' as UserRole,
    senha: '',
    selectedGroups: [] as string[]
  });

  const [groupName, setGroupName] = useState('');

  const loadData = async () => {
    const [vData, pData, allProfiles, gData] = await Promise.all([
      fetchVehicles(),
      fetchProfiles(),
      role === 'admin' ? fetchProfiles(true) : Promise.resolve([]),
      fetchGroups()
    ]);
    setVehicles(vData);
    setMotoristas(pData);
    setGroups(gData);
    if (role === 'admin') setProfiles(allProfiles);
  };

  useEffect(() => {
    loadData();
  }, [role, activeTab]);

  useEffect(() => {
    if (selectedDetailReq) {
      setLoadingLogs(true);
      fetchRequestLogs(selectedDetailReq.id)
        .then(setDetailLogs)
        .finally(() => setLoadingLogs(false));
    }
  }, [selectedDetailReq]);

  useEffect(() => {
    if (showCreateModal && vehicles.length > 0 && motoristas.length > 0) {
      setFormData(prev => ({ 
        ...prev, 
        veiculo_id: prev.veiculo_id || vehicles[0].id, 
        motorista_id: prev.motorista_id || motoristas[0].id 
      }));
    }
  }, [showCreateModal, vehicles, motoristas]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshData(),
        loadData()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isVehicleBusy = (vehicleId: string) => {
    return requests.some(r => 
      r.veiculo_id === vehicleId && 
      !['concluido', 'recusado'].includes(r.status)
    );
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRequest(formData);
      setShowCreateModal(false);
      setFormData({ motorista_id: '', veiculo_id: '', quantidade_solicitada: 0, tipo_combustivel: 'Diesel', observacoes: '' });
    } catch (err) { }
  };

  // --- CRUD VEHICLES COM VALIDAÇÃO DE UNICIDADE ---
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleError('');
    
    const placaNormalizada = vehicleForm.placa.trim().toUpperCase();
    
    // 1. Validação Preventiva Local
    const plateConflict = vehicles.find(v => 
      v.placa.toUpperCase() === placaNormalizada && 
      (!editingVehicle || v.id !== editingVehicle.id)
    );

    if (plateConflict) {
      setVehicleError(`A placa ${placaNormalizada} já está cadastrada para o veículo: ${plateConflict.modelo}.`);
      return;
    }

    try {
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, { ...vehicleForm, placa: placaNormalizada });
      } else {
        await createVehicle({ ...vehicleForm, placa: placaNormalizada });
      }
      setShowVehicleModal(false);
      setEditingVehicle(null);
      setVehicleForm({ placa: '', modelo: '', tipo_combustivel: 'Diesel', odometro_atual: 0, proprietario: '' });
      loadData();
    } catch (err: any) {
      // Captura erro de Unique Constraint do Postgres (Código 23505)
      if (err.code === '23505') {
        setVehicleError(`Erro de integridade: A placa ${placaNormalizada} já existe no banco de dados.`);
      } else {
        setVehicleError(err.message || "Erro inesperado ao salvar veículo.");
      }
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm("Excluir este veículo permanentemente?")) return;
    try {
      await deleteVehicle(id);
      loadData();
    } catch (err) { alert("Não é possível excluir veículos com histórico de abastecimento vinculado."); }
  };

  const startEditVehicle = (v: Veiculo) => {
    setEditingVehicle(v);
    setVehicleForm({
      placa: v.placa,
      modelo: v.modelo,
      tipo_combustivel: v.tipo_combustivel,
      odometro_atual: v.odometro_atual,
      proprietario: v.proprietario || ''
    });
    setVehicleError('');
    setShowVehicleModal(true);
  };

  // --- CRUD PROFILES ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    try {
      const { selectedGroups, ...profileData } = profileForm;
      if (editingProfile) {
        await updateProfile(editingProfile.id, profileData, selectedGroups);
      } else {
        await createProfile(profileData, selectedGroups);
      }
      setShowProfileModal(false);
      setEditingProfile(null);
      setProfileForm({ nome: '', cpf: '', cargo: '', role: 'motorista', senha: '', selectedGroups: [] });
      loadData();
    } catch (err: any) {
      setProfileError(err.message || "Erro ao salvar perfil");
    }
  };

  const startEditProfile = (p: Perfil) => {
    setEditingProfile(p);
    setProfileForm({
      nome: p.nome,
      cpf: p.cpf,
      cargo: p.cargo,
      role: p.role,
      senha: p.senha || '',
      selectedGroups: p.grupos?.map(g => g.id) || []
    });
    setProfileError('');
    setShowProfileModal(true);
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Excluir este perfil permanentemente?")) return;
    try {
      await deleteProfile(id);
      loadData();
    } catch (err) { alert("Este usuário possui registros ativos e não pode ser removido."); }
  };

  // --- CRUD GROUPS ---
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupError('');
    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, groupName);
      } else {
        await createGroup(groupName);
      }
      setShowGroupModal(false);
      setEditingGroup(null);
      setGroupName('');
      loadData();
    } catch (err: any) {
      setGroupError(err.message || "Erro ao salvar grupo");
    }
  };

  const startEditGroup = (g: Grupo) => {
    setEditingGroup(g);
    setGroupName(g.nome);
    setGroupError('');
    setShowGroupModal(true);
  };

  const handleDeleteGroupAction = async (id: string) => {
    if (!confirm("Deseja realmente excluir este grupo?")) return;
    try {
      await deleteGroup(id);
      loadData();
    } catch (err) { alert("Existem usuários vinculados a este grupo."); }
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      await clearAllTransactions();
      setShowClearConfirm(false);
      await handleRefresh();
      alert("Dados transacionais limpos com sucesso!");
    } catch (err: any) {
      alert("Erro ao limpar dados: " + err.message);
    } finally {
      setClearing(false);
    }
  };

  // QR Share
  const handleShareQr = async (req: RequisicaoAbastecimento) => {
    const canvas = document.getElementById(`qr-admin-${req.id}`) as HTMLCanvasElement;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const file = new File([blob], `qrcode-${req.id.slice(0, 4)}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'QR Code de Abastecimento' });
      } else {
        const link = document.createElement('a');
        link.download = `qrcode-${req.id.slice(0, 4)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (err) { console.error(err); }
  };

  const pendingGestor = requests.filter(r => r.status === 'pendente_gestor');
  const pendingSecretario = requests.filter(r => ['pendente_secretario', 'autorizado'].includes(r.status));
  const adminMonitoring = requests.filter(r => !['concluido', 'recusado'].includes(r.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 max-w-2xl overflow-x-auto no-scrollbar">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<BarChart3 className="w-4 h-4" />} label="Dashboard" />
          <TabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} icon={<List className="w-4 h-4" />} label={role === 'admin' ? "Monitoramento" : "Pendentes"} />
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History className="w-4 h-4" />} label="Histórico" />
          {role === 'admin' && (
            <TabButton active={activeTab === 'management'} onClick={() => setActiveTab('management')} icon={<Shield className="w-4 h-4" />} label="Gestão" />
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="p-2.5 bg-white text-gray-500 rounded-2xl border border-gray-100 shadow-sm hover:text-indigo-600 transition active:scale-95 disabled:opacity-50"
            title="Atualizar Dados"
          >
            <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <button onClick={() => { setError(null); setShowCreateModal(true); }} className="flex items-center justify-center space-x-2 bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 active:scale-95">
            <Plus className="w-5 h-5" />
            <span>Novo Pedido</span>
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' && <Dashboard />}

      {activeTab === 'pending' && (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center mb-6">
              {role === 'gestor' && <><ShieldCheck className="w-7 h-7 mr-2 text-blue-600" /> Aprovações do Gestor</>}
              {role === 'secretario' && <><UserCheck className="w-7 h-7 mr-2 text-purple-600" /> Autorizações da Secretaria</>}
              {role === 'admin' && <><Activity className="w-7 h-7 mr-2 text-indigo-600" /> Monitoramento Geral</>}
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Solicitante</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Veículo</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Quantidade</th>
                      {role === 'admin' && <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>}
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {role === 'gestor' && (
                      pendingGestor.length > 0 ? pendingGestor.map(req => (
                        <TableRow key={req.id} req={req} onAction={() => approveGestor(req.id)} onReject={() => rejectRequest(req.id)} actionText="Aprovar" />
                      )) : <EmptyStateRow />
                    )}
                    {role === 'secretario' && (
                      pendingSecretario.length > 0 ? pendingSecretario.map(req => (
                        <TableRow 
                          key={req.id} 
                          req={req} 
                          onAction={req.status === 'pendente_secretario' ? () => approveSecretario(req.id) : undefined} 
                          onReject={() => rejectRequest(req.id)} 
                          onViewQr={req.qr_code_token ? () => setSelectedQrReq(req) : undefined}
                          actionText={req.status === 'pendente_secretario' ? "Gerar QR" : ""} 
                          color="bg-purple-600 hover:bg-purple-700" 
                        />
                      )) : <EmptyStateRow />
                    )}
                    {role === 'admin' && (
                      adminMonitoring.length > 0 ? adminMonitoring.map(req => {
                        let actionProps = { actionText: '', onAction: undefined as any };
                        if (req.status === 'pendente_gestor') actionProps = { actionText: 'Aprovar Gestor', onAction: () => approveGestor(req.id) };
                        if (req.status === 'pendente_secretario') actionProps = { actionText: 'Gerar QR Code', onAction: () => approveSecretario(req.id) };
                        return (
                          <TableRow key={req.id} req={req} showStatus={true} onAction={actionProps.actionText ? actionProps.onAction : undefined} onReject={['pendente_gestor', 'pendente_secretario', 'autorizado'].includes(req.status) ? () => rejectRequest(req.id) : undefined} onViewQr={req.qr_code_token ? () => setSelectedQrReq(req) : undefined} onViewDetail={() => setSelectedDetailReq(req)} actionText={actionProps.actionText} color={req.status === 'pendente_gestor' ? 'bg-blue-500' : 'bg-purple-500'} />
                        );
                      }) : <EmptyStateRow />
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && <HistoricoAbastecimentos role={role} />}

      {activeTab === 'management' && role === 'admin' && (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mr-4 text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-black text-red-900">Limpeza de Dados</h4>
                <p className="text-sm text-red-600 font-medium">Apaga permanentemente todas as requisições, abastecimentos e logs.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowClearConfirm(true)}
              className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition shadow-lg shadow-red-100 active:scale-95"
            >
              Limpar Transações
            </button>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-800 flex items-center">
                <Tags className="w-6 h-6 mr-2 text-orange-600" /> Grupos Logísticos
              </h3>
              <button onClick={() => { setEditingGroup(null); setGroupName(''); setGroupError(''); setShowGroupModal(true); }} className="p-2 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition shadow-sm">
                <FolderPlus className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {groups.map(g => (
                <div key={g.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-orange-200 transition">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center mr-4 text-orange-600">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-800">{g.nome}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Ativo</p>
                    </div>
                  </div>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => startEditGroup(g)} className="p-2 text-gray-300 hover:text-blue-500 transition"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteGroupAction(g.id)} className="p-2 text-gray-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-800 flex items-center">
                  <CarFront className="w-6 h-6 mr-2 text-blue-600" /> Frota de Veículos
                </h3>
                <button onClick={() => { setEditingVehicle(null); setVehicleForm({placa:'', modelo:'', tipo_combustivel:'Diesel', odometro_atual:0, proprietario: ''}); setVehicleError(''); setShowVehicleModal(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition shadow-sm">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 font-black text-gray-400 uppercase text-[10px]">Placa / Modelo</th>
                      <th className="px-6 py-3 font-black text-gray-400 uppercase text-[10px]">Odômetro</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {vehicles.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{v.placa}</div>
                          <div className="text-xs text-gray-400">{v.modelo}</div>
                          {v.proprietario && <div className="text-[10px] text-indigo-500 font-bold uppercase mt-1">{v.proprietario}</div>}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-blue-600">{v.odometro_atual.toLocaleString()} km</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end space-x-2">
                            <button onClick={() => startEditVehicle(v)} className="p-1.5 text-gray-300 hover:text-blue-600 transition"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteVehicle(v.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-800 flex items-center">
                  <Users className="w-6 h-6 mr-2 text-indigo-600" /> Perfis de Usuários
                </h3>
                <button onClick={() => { setEditingProfile(null); setProfileForm({nome:'', cpf:'', cargo:'', role:'motorista', senha: '', selectedGroups:[]}); setProfileError(''); setShowProfileModal(true); }} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition shadow-sm">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 font-black text-gray-400 uppercase text-[10px]">Nome / Cargo</th>
                      <th className="px-6 py-3 font-black text-gray-400 uppercase text-[10px]">Papel</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {profiles.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{p.nome}</div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase">{p.cargo}</div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                             p.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-600'
                           }`}>{p.role}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end space-x-2">
                            <button onClick={() => startEditProfile(p)} className="p-1.5 text-gray-300 hover:text-blue-600 transition"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteProfile(p.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES (ADMIN) */}
      {selectedDetailReq && (() => {
        const fueling = completedFuelings.find(f => f.requisicao_id === selectedDetailReq.id);
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 p-8 flex justify-between items-center z-10">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 flex items-center">
                    <Info className="w-6 h-6 mr-2 text-blue-600" /> Dossiê Administrativo
                  </h3>
                </div>
                <button onClick={() => setSelectedDetailReq(null)} className="p-3 hover:bg-gray-100 rounded-full transition"><X className="w-7 h-7 text-gray-400" /></button>
              </div>
              <div className="p-8 space-y-8">
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                   <DetailBox label="Veículo" value={selectedDetailReq.veiculo?.placa || 'N/A'} bold />
                   <DetailBox label="Motorista" value={selectedDetailReq.motorista?.nome || 'N/A'} />
                   <DetailBox label="Volume Solicitado" value={`${selectedDetailReq.quantidade_solicitada}L`} bold color="text-indigo-600" />
                   {fueling && <DetailBox label="Volume Realizado" value={`${fueling.quantidade_final}L`} bold color="text-green-600" />}
                   <DetailBox label="Status" value={selectedDetailReq.status.replace('_', ' ').toUpperCase()} bold />
                   <DetailBox label="Data" value={new Date(selectedDetailReq.created_at).toLocaleString()} />
                 </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL VEÍCULO COM VALIDAÇÃO DE PLACA */}
      {showVehicleModal && (
        <Modal title={editingVehicle ? "Editar Veículo" : "Novo Veículo"} onClose={() => setShowVehicleModal(false)}>
          {vehicleError && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded-r-xl flex items-start animate-shake">
              <AlertTriangle className="w-4 h-4 mr-3 shrink-0 mt-0.5" />
              <p>{vehicleError}</p>
            </div>
          )}
          <form onSubmit={handleSaveVehicle} className="space-y-5">
            <InputField 
              label="Placa (Única)" 
              value={vehicleForm.placa} 
              onChange={v => { setVehicleError(''); setVehicleForm({...vehicleForm, placa: v.toUpperCase()}); }} 
              placeholder="ABC-1234" 
              required
            />
            <InputField label="Modelo" value={vehicleForm.modelo} onChange={v => setVehicleForm({...vehicleForm, modelo: v})} placeholder="Modelo" required />
            <InputField label="Proprietário" value={vehicleForm.proprietario} onChange={v => setVehicleForm({...vehicleForm, proprietario: v})} placeholder="Ex: Secretaria de Saúde" />
            <div className="grid grid-cols-2 gap-4">
               <SelectField label="Combustível" value={vehicleForm.tipo_combustivel} onChange={v => setVehicleForm({...vehicleForm, tipo_combustivel: v})} options={[{value:'Diesel', label:'Diesel'}, {value:'Gasolina', label:'Gasolina'}, {value:'Etanol', label:'Etanol'}]} />
               <InputField label="Odômetro" value={vehicleForm.odometro_atual.toString()} onChange={v => setVehicleForm({...vehicleForm, odometro_atual: Number(v)})} type="number" placeholder="0" required />
            </div>
            <SubmitButton loading={false} label={editingVehicle ? "Atualizar Veículo" : "Salvar Veículo"} color="bg-blue-600" />
          </form>
        </Modal>
      )}

      {/* OUTROS MODAIS */}
      {showGroupModal && (
        <Modal title={editingGroup ? "Editar Grupo" : "Novo Grupo"} onClose={() => setShowGroupModal(false)}>
          {groupError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center"><AlertCircle className="w-4 h-4 mr-2" /> {groupError}</div>}
          <form onSubmit={handleSaveGroup} className="space-y-5">
            <InputField label="Nome do Grupo" value={groupName} onChange={setGroupName} placeholder="Ex: Frota Norte" />
            <SubmitButton loading={false} label={editingGroup ? "Atualizar Grupo" : "Salvar Grupo"} color="bg-orange-600" />
          </form>
        </Modal>
      )}

      {showProfileModal && (
        <Modal title={editingProfile ? "Editar Usuário" : "Novo Usuário"} onClose={() => setShowProfileModal(false)}>
          {profileError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center"><AlertCircle className="w-4 h-4 mr-2" /> {profileError}</div>}
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <InputField label="Nome Completo" value={profileForm.nome} onChange={v => setProfileForm({...profileForm, nome: v})} placeholder="Nome" />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="CPF" value={profileForm.cpf} onChange={v => setProfileForm({...profileForm, cpf: v})} placeholder="000.000.000-00" />
              <InputField label="Senha" value={profileForm.senha} onChange={v => setProfileForm({...profileForm, senha: v})} placeholder="Senha" type="password" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Cargo" value={profileForm.cargo} onChange={v => setProfileForm({...profileForm, cargo: v})} placeholder="Cargo" />
              <SelectField label="Papel" value={profileForm.role} onChange={v => setProfileForm({...profileForm, role: v as UserRole})} options={[{value:'motorista', label:'Motorista'}, {value:'frentista', label:'Frentista'}, {value:'gestor', label:'Gestor'}, {value:'secretario', label:'Secretaria'}, {value:'admin', label:'Admin'}]} />
            </div>
            <SubmitButton loading={false} label={editingProfile ? "Atualizar Perfil" : "Salvar Perfil"} color="bg-indigo-600" />
          </form>
        </Modal>
      )}

      {selectedQrReq && (
        <Modal title="QR Code" onClose={() => setSelectedQrReq(null)}>
           <div className="flex flex-col items-center py-6 space-y-6">
              <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 relative">
                <div className="bg-white p-5 rounded-[2rem] shadow-inner border border-blue-100">
                  <QRCodeCanvas id={`qr-admin-${selectedQrReq.id}`} value={selectedQrReq.qr_code_token!} size={200} level="H" includeMargin={true} />
                </div>
              </div>
              <button onClick={() => setSelectedQrReq(null)} className="w-full bg-gray-100 py-4 rounded-2xl font-black text-xs uppercase transition">Fechar</button>
           </div>
        </Modal>
      )}

      {showCreateModal && (
        <Modal title="Novo Pedido" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateRequest} className="space-y-5">
            <SelectField label="Condutor" value={formData.motorista_id} onChange={v => setFormData({...formData, motorista_id: v})} options={motoristas.map(m => ({ value: m.id, label: m.nome }))} />
            <SelectField 
              label="Veículo" 
              value={formData.veiculo_id} 
              onChange={v => setFormData({...formData, veiculo_id: v})} 
              options={vehicles.map(v => ({ 
                value: v.id, 
                label: `${v.placa} — ${v.modelo}${isVehicleBusy(v.id) ? ' (OCUPADO)' : ''}`,
                disabled: isVehicleBusy(v.id)
              }))} 
            />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Combustível" value={formData.tipo_combustivel} onChange={v => setFormData({...formData, tipo_combustivel: v})} options={[{value: 'Diesel', label: 'Diesel'}, {value: 'Gasolina', label: 'Gasolina'}, {value: 'Etanol', label: 'Etanol'}]} />
              <InputField label="Volume (L)" value={formData.quantidade_solicitada.toString()} onChange={v => setFormData({...formData, quantidade_solicitada: Number(v)})} placeholder="0" />
            </div>
            <SubmitButton loading={loading} label="Criar Requisição" />
          </form>
        </Modal>
      )}

      {showClearConfirm && (
        <Modal title="Confirmar Limpeza" onClose={() => setShowClearConfirm(false)}>
          <div className="space-y-6">
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
              <p className="text-sm text-red-800 font-bold leading-relaxed">
                Esta ação é <span className="underline">irreversível</span>. Todas as requisições de abastecimento, históricos e logs de auditoria serão removidos permanentemente do banco de dados.
              </p>
            </div>
            <p className="text-xs text-gray-500 font-medium text-center">
              Os cadastros de veículos, usuários e grupos serão preservados.
            </p>
            <div className="flex flex-col space-y-3">
              <button 
                onClick={handleClearData}
                disabled={clearing}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition disabled:opacity-50"
              >
                {clearing ? 'Limpando...' : 'Sim, Limpar Tudo'}
              </button>
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// --- Reusable UI Components ---
const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: any, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center space-x-2 px-6 py-2 rounded-xl text-xs font-bold uppercase transition min-w-max ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-indigo-600'}`}>
    {icon} <span>{label}</span>
  </button>
);

const TableRow: React.FC<{ req: RequisicaoAbastecimento, onAction?: () => void, onReject?: () => void, onViewQr?: () => void, onViewDetail?: () => void, actionText: string, color?: string, showStatus?: boolean }> = ({ req, onAction, onReject, onViewQr, onViewDetail, actionText, color = 'bg-blue-600', showStatus = false }) => (
  <tr className="hover:bg-gray-50/50 transition">
    <td className="px-6 py-4 text-sm font-bold">{req.motorista?.nome}</td>
    <td className="px-6 py-4 text-sm font-bold">{req.veiculo?.placa}</td>
    <td className="px-6 py-4 text-sm font-black text-indigo-600">{req.quantidade_solicitada}L</td>
    {showStatus && <td className="px-6 py-4"><span className="text-[9px] font-black uppercase text-gray-400 bg-gray-100 px-2 py-1 rounded">{req.status}</span></td>}
    <td className="px-6 py-4 text-right space-x-2">
      {onViewDetail && <button onClick={onViewDetail} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Ver Detalhes"><Eye className="w-4 h-4" /></button>}
      {onViewQr && <button onClick={onViewQr} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver QR Code"><QrIcon className="w-4 h-4" /></button>}
      {onReject && <button onClick={onReject} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Recusar"><Ban className="w-4 h-4" /></button>}
      {onAction && <button onClick={onAction} className={`px-4 py-2 ${color} text-white text-xs font-black rounded-xl`}>{actionText}</button>}
    </td>
  </tr>
);

const EmptyStateRow = () => <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400 italic text-sm">Nenhum registro encontrado</td></tr>;

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
    <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-black text-gray-900">{title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition"><X className="w-5 h-5 text-gray-400" /></button>
      </div>
      {children}
    </div>
  </div>
);

const DetailBox: React.FC<{ label: string, value: string, bold?: boolean, color?: string }> = ({ label, value, bold, color = "text-gray-900" }) => (
  <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-[11px] ${bold ? 'font-black' : 'font-bold'} ${color} truncate`}>{value}</p>
  </div>
);

const InputField: React.FC<{ label: string, value: string, onChange: (v: string) => void, placeholder: string, type?: string, required?: boolean }> = ({ label, value, onChange, placeholder, type = "text", required }) => (
  <div>
    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">{label}</label>
    <input 
      type={type} 
      required={required}
      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder} 
    />
  </div>
);

const SelectField: React.FC<{ label: string, value: string, onChange: (v: string) => void, options: {value: string, label: string, disabled?: boolean}[] }> = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">{label}</label>
    <select className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500 transition" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
    </select>
  </div>
);

const SubmitButton: React.FC<{ loading: boolean, label: string, color?: string, disabled?: boolean }> = ({ loading, label, color = "bg-indigo-600", disabled = false }) => (
  <button type="submit" disabled={loading || disabled} className={`w-full py-4 ${color} text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition`}>{loading ? '...' : label}</button>
);

export default WorkflowsDashboard;
