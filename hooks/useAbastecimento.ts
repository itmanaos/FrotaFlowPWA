
import { useState, useEffect, useCallback, useRef } from 'react';
import { RequisicaoAbastecimento, RequisicaoStatus, UserRole, AbastecimentoRealizado } from '../types';
import { 
  fetchRequests, 
  createNewRequest, 
  updateRequestStatus, 
  fetchCompletedFuelings, 
  registerFueling,
  addRequestLog,
  supabase 
} from '../supabase';

const KNOWN_STATUSES_KEY = 'frotaflow_known_statuses';
const NOTIFICATIONS_HISTORY_KEY = 'frotaflow_notifications_history';

export interface Notification {
  id: string;
  requestId: string;
  oldStatus: string;
  newStatus: RequisicaoStatus;
  message: string;
  timestamp: number;
  read: boolean;
}

export const useAbastecimento = (currentUserRole?: UserRole, currentUserId?: string) => {
  const [requests, setRequests] = useState<RequisicaoAbastecimento[]>([]);
  const [completedFuelings, setCompletedFuelings] = useState<AbastecimentoRealizado[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isFirstLoad = useRef(true);

  const getNotificationHistory = (): Notification[] => {
    const data = localStorage.getItem(NOTIFICATIONS_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  };

  const saveNotificationHistory = (notes: Notification[]) => {
    localStorage.setItem(NOTIFICATIONS_HISTORY_KEY, JSON.stringify(notes.slice(0, 50)));
  };

  const getKnownStatuses = (): Record<string, RequisicaoStatus> => {
    const data = localStorage.getItem(KNOWN_STATUSES_KEY);
    return data ? JSON.parse(data) : {};
  };

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [allRequests, allFuelings] = await Promise.all([
        fetchRequests(),
        fetchCompletedFuelings()
      ]);

      if (currentUserRole === 'motorista' && currentUserId) {
        const known = getKnownStatuses();
        const history = getNotificationHistory();
        const newNotifications: Notification[] = [];
        const updatedKnown = { ...known };

        allRequests.forEach(req => {
          if (req.motorista_id === currentUserId) {
            const lastStatus = known[req.id];
            
            if (lastStatus && lastStatus !== req.status && !isFirstLoad.current) {
              const statusLabels: Record<string, string> = {
                pendente_secretario: 'aprovada pelo Gestor',
                autorizado: 'autorizada para abastecimento',
                concluido: 'concluída com sucesso',
                recusado: 'reprovada'
              };

              const newNote: Notification = {
                id: Math.random().toString(36).substr(2, 9),
                requestId: req.id,
                oldStatus: lastStatus,
                newStatus: req.status,
                message: `Sua requisição #${req.id.slice(0,4)} foi ${statusLabels[req.status] || req.status}.`,
                timestamp: Date.now(),
                read: false
              };
              newNotifications.push(newNote);
            }
            updatedKnown[req.id] = req.status;
          }
        });

        if (newNotifications.length > 0) {
          const updatedHistory = [...newNotifications, ...history];
          saveNotificationHistory(updatedHistory);
          setNotifications(updatedHistory);
        } else {
          setNotifications(history);
        }
        
        localStorage.setItem(KNOWN_STATUSES_KEY, JSON.stringify(updatedKnown));
      }

      setRequests(allRequests);
      setCompletedFuelings(allFuelings);
      isFirstLoad.current = false;
      setError(null);
    } catch (err: any) {
      let errorMsg = err.message || JSON.stringify(err);
      if (errorMsg === 'Failed to fetch') {
        errorMsg = 'Erro de conexão com o Supabase. Verifique se o projeto não está pausado ou se a URL está correta.';
        
        // Adiciona aviso sobre a chave se parecer estar errada
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PhLommsswSMLOgaHDqGFNw_zgQQ9A2N';
        if (key.startsWith('sb_publishable_')) {
          errorMsg += ' AVISO: Sua chave parece ser do Stripe, não do Supabase.';
        }
      }
      console.error('Erro ao buscar dados:', errorMsg);
      setError(`Falha ao sincronizar: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [currentUserRole, currentUserId]);

  useEffect(() => {
    refreshData();
    
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requisicoes' },
        () => refreshData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'abastecimentos' },
        () => refreshData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData]);

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotificationHistory(updated);
    setNotifications(updated);
  };

  const clearNotifications = () => {
    localStorage.removeItem(NOTIFICATIONS_HISTORY_KEY);
    setNotifications([]);
  };

  const createRequest = async (data: Partial<RequisicaoAbastecimento>) => {
    setLoading(true);
    setError(null);
    try {
      // VALIDAÇÃO CRÍTICA: Verifica se o veículo já tem requisição ativa (não concluída nem recusada)
      const activeRequest = requests.find(r => 
        r.veiculo_id === data.veiculo_id && 
        !['concluido', 'recusado'].includes(r.status)
      );

      if (activeRequest) {
        const errorMsg = `O veículo ${activeRequest.veiculo?.placa || ''} já possui uma requisição em aberto (Status: ${activeRequest.status.replace('_', ' ')}).`;
        throw new Error(errorMsg);
      }

      const isAutoAuthorize = currentUserRole === 'secretario' || currentUserRole === 'admin';
      const status: RequisicaoStatus = isAutoAuthorize ? 'autorizado' : 'pendente_gestor';
      const qrCode = isAutoAuthorize ? Math.random().toString(36).substring(7).toUpperCase() : null;

      const newReq = await createNewRequest({
        motorista_id: data.motorista_id || currentUserId,
        veiculo_id: data.veiculo_id,
        quantidade_solicitada: data.quantidade_solicitada,
        tipo_combustivel: data.tipo_combustivel,
        status,
        qr_code_token: qrCode || undefined,
        gestor_id: isAutoAuthorize ? currentUserId : undefined,
        secretario_id: isAutoAuthorize ? currentUserId : undefined
      });

      await addRequestLog({
        requisicao_id: newReq.id,
        perfil_id: currentUserId!,
        acao: isAutoAuthorize ? 'Criação e Autorização Direta' : 'Criação da Solicitação',
        status_novo: status
      });

      if (newReq.motorista_id === currentUserId) {
        const known = getKnownStatuses();
        known[newReq.id] = newReq.status;
        localStorage.setItem(KNOWN_STATUSES_KEY, JSON.stringify(known));
      }
      
      await refreshData();
      return newReq;
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err);
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const approveGestor = async (id: string) => {
    if (currentUserRole !== 'gestor' && currentUserRole !== 'admin') return;
    setLoading(true);
    try {
      await updateRequestStatus(id, { 
        status: 'pendente_secretario', 
        gestor_id: currentUserId 
      });

      await addRequestLog({
        requisicao_id: id,
        perfil_id: currentUserId!,
        acao: 'Aprovação Técnica (Gestor)',
        status_anterior: 'pendente_gestor',
        status_novo: 'pendente_secretario'
      });

      await refreshData();
    } finally {
      setLoading(false);
    }
  };

  const approveSecretario = async (id: string) => {
    if (currentUserRole !== 'secretario' && currentUserRole !== 'admin') return;
    setLoading(true);
    try {
      const qrCode = Math.random().toString(36).substring(7).toUpperCase();
      await updateRequestStatus(id, { 
        status: 'autorizado', 
        secretario_id: currentUserId,
        qr_code_token: qrCode
      });

      await addRequestLog({
        requisicao_id: id,
        perfil_id: currentUserId!,
        acao: 'Autorização Administrativa (Secretaria)',
        status_anterior: 'pendente_secretario',
        status_novo: 'autorizado'
      });

      await refreshData();
    } finally {
      setLoading(false);
    }
  };

  const rejectRequest = async (id: string) => {
    if (!['gestor', 'secretario', 'admin'].includes(currentUserRole || '')) return;
    setLoading(true);
    try {
      const currentReq = requests.find(r => r.id === id);
      await updateRequestStatus(id, { status: 'recusado' });

      await addRequestLog({
        requisicao_id: id,
        perfil_id: currentUserId!,
        acao: 'Solicitação Rejeitada',
        status_anterior: currentReq?.status,
        status_novo: 'recusado'
      });

      await refreshData();
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err);
      setError(`Erro ao rejeitar requisição: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const completeAbastecimento = async (id: string, completionData: Omit<AbastecimentoRealizado, 'id'>) => {
    setLoading(true);
    try {
      await registerFueling(completionData);
      await updateRequestStatus(id, { status: 'concluido' });

      await addRequestLog({
        requisicao_id: id,
        perfil_id: completionData.frentista_id,
        acao: 'Abastecimento Concluído (Frentista)',
        status_anterior: 'autorizado',
        status_novo: 'concluido'
      });

      await refreshData();
    } finally {
      setLoading(false);
    }
  };

  return {
    requests,
    completedFuelings,
    notifications,
    markAllAsRead,
    clearNotifications,
    loading,
    error,
    setError,
    createRequest,
    approveGestor,
    approveSecretario,
    rejectRequest,
    completeAbastecimento,
    refreshData
  };
};
