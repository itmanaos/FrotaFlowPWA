
import { createClient } from '@supabase/supabase-js';
import { RequisicaoAbastecimento, Veiculo, Perfil, AbastecimentoRealizado, RequisicaoLog, Grupo, RequisicaoStatus } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://swxiffwdoynektwkmdcm.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PhLommsswSMLOgaHDqGFNw_zgQQ9A2N';

// Validação básica da chave
if (SUPABASE_ANON_KEY.startsWith('sb_publishable_')) {
  console.warn("AVISO: A chave SUPABASE_ANON_KEY parece ser uma chave do Stripe (começa com 'sb_publishable_'). Verifique suas configurações no Supabase Dashboard.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_KEY = 'frotaflow_session';

// Auth Logic
export const signIn = async (cpf: string, password: string, remember: boolean): Promise<Perfil> => {
  try {
    const { data, error } = await supabase
      .from('perfis')
      .select(`
        *,
        grupos:perfis_grupos(grupo:grupos(*))
      `)
      .eq('cpf', cpf)
      .single();

    if (error || !data) {
      // Fallback para quando o join de grupos falha ou não existe
      const { data: simpleData, error: simpleError } = await supabase
        .from('perfis')
        .select('*')
        .eq('cpf', cpf)
        .single();
      
      if (simpleError) {
        if (simpleError.message.includes('relation "perfis" does not exist')) {
          throw new Error("O banco de dados não foi inicializado. Por favor, execute o script SQL ou clique em 'Configurar Banco de Dados'.");
        }
        throw simpleError;
      }
      
      if (!simpleData) throw new Error("Usuário não encontrado com este CPF.");
      
      // Verifica senha se existir no banco
      if (simpleData.senha && simpleData.senha !== password) {
        throw new Error("Senha incorreta.");
      }
      
      const perfil = { ...simpleData, grupos: [] } as Perfil;
      if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify(perfil));
      return perfil;
    }
    
    // Verifica senha
    if (data.senha && data.senha !== password) {
      throw new Error("Senha incorreta.");
    }
    
    // Flatten grupos
    const perfil = {
      ...data,
      grupos: data.grupos?.map((g: any) => g.grupo) || []
    } as Perfil;

    if (remember) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(perfil));
    }
    return perfil;
  } catch (err: any) {
    console.error("Erro no SignIn:", err);
    throw err;
  }
};

export const signOut = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const seedDatabase = async () => {
  try {
    // 1. Criar Grupos
    const { data: groups, error: gError } = await supabase
      .from('grupos')
      .upsert([
        { nome: 'Logística Sul' },
        { nome: 'Manutenção Central' }
      ])
      .select();
    
    if (gError) throw gError;

    // 2. Criar Perfis de Teste
    const testProfiles = [
      { cpf: '111', nome: 'João Motorista', role: 'motorista', senha: '123' },
      { cpf: '222', nome: 'Maria Gestora', role: 'gestor', senha: '123' },
      { cpf: '333', nome: 'Carlos Secretário', role: 'secretario', senha: '123' },
      { cpf: '444', nome: 'Pedro Frentista', role: 'frentista', senha: '123' },
      { cpf: '555', nome: 'Administrador', role: 'admin', senha: '123' }
    ];

    const { data: profiles, error: pError } = await supabase
      .from('perfis')
      .upsert(testProfiles)
      .select();

    if (pError) throw pError;

    // 3. Criar Veículos
    const { error: vError } = await supabase
      .from('veiculos')
      .upsert([
        { placa: 'ABC-1234', modelo: 'Volvo FH 540', tipo_combustivel: 'Diesel', odometro_atual: 150000, proprietario: 'Secretaria de Obras' },
        { placa: 'XYZ-9876', modelo: 'Scania R450', tipo_combustivel: 'Diesel', odometro_atual: 85000, proprietario: 'Secretaria de Obras' },
        { placa: 'KGB-0007', modelo: 'Toyota Hilux', tipo_combustivel: 'Diesel', odometro_atual: 12000, proprietario: 'Gabinete' }
      ]);

    if (vError) throw vError;

    return { success: true };
  } catch (err) {
    console.error("Erro ao semear banco de dados:", err);
    throw err;
  }
};

export const getSession = (): Perfil | null => {
  const data = localStorage.getItem(SESSION_KEY);
  return data ? JSON.parse(data) : null;
};

// Database logic - Requests
export const fetchRequests = async (): Promise<RequisicaoAbastecimento[]> => {
  try {
    const { data, error } = await supabase
      .from('requisicoes_abastecimento')
      .select(`
        *,
        veiculo:veiculo_id (*),
        motorista:motorista_id (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("Erro ao buscar requisições com joins, tentando busca simples:", error.message);
      const { data: simpleData, error: simpleError } = await supabase
        .from('requisicoes_abastecimento')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (simpleError) throw simpleError;
      return simpleData || [];
    }
    return data || [];
  } catch (err) {
    console.error("Erro fatal em fetchRequests:", err);
    throw err;
  }
};

export const fetchRequestsPaginated = async (
  from: number,
  to: number,
  filters?: { 
    status?: RequisicaoStatus[]; 
    placa?: string; 
    data?: string; 
    motorista_id?: string;
    archived?: boolean;
  }
): Promise<{ data: RequisicaoAbastecimento[]; count: number }> => {
  try {
    let query = supabase
      .from('requisicoes_abastecimento')
      .select(`
        *,
        veiculo:veiculo_id!inner(*),
        motorista:motorista_id(*)
      `, { count: 'exact' });

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters?.placa) {
      query = query.ilike('veiculo.placa', `%${filters.placa}%`);
    }

    if (filters?.motorista_id) {
      query = query.eq('motorista_id', filters.motorista_id);
    }

    if (filters?.data) {
      query = query
        .gte('created_at', `${filters.data}T00:00:00`)
        .lte('created_at', `${filters.data}T23:59:59`);
    }

    if (filters?.archived) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      query = query.lte('created_at', sixMonthsAgo.toISOString());
    } else if (filters?.archived === false) {
      // Se explicitamente falso, mostra apenas os recentes (últimos 6 meses)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      query = query.gt('created_at', sixMonthsAgo.toISOString());
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.warn("Erro em fetchRequestsPaginated com joins, tentando busca simples:", error.message);
      let simpleQuery = supabase
        .from('requisicoes_abastecimento')
        .select('*', { count: 'exact' });
      
      if (filters?.status && filters.status.length > 0) {
        simpleQuery = simpleQuery.in('status', filters.status);
      }
      if (filters?.motorista_id) {
        simpleQuery = simpleQuery.eq('motorista_id', filters.motorista_id);
      }
      if (filters?.data) {
        simpleQuery = simpleQuery
          .gte('created_at', `${filters.data}T00:00:00`)
          .lte('created_at', `${filters.data}T23:59:59`);
      }
      if (filters?.archived) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        simpleQuery = simpleQuery.lte('created_at', sixMonthsAgo.toISOString());
      } else if (filters?.archived === false) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        simpleQuery = simpleQuery.gt('created_at', sixMonthsAgo.toISOString());
      }
      
      const { data: simpleData, error: simpleError, count: simpleCount } = await simpleQuery
        .order('created_at', { ascending: false })
        .range(from, to);
        
      if (simpleError) throw simpleError;
      return { data: simpleData || [], count: simpleCount || 0 };
    }
    return { data: data || [], count: count || 0 };
  } catch (err) {
    console.error("Erro fatal em fetchRequestsPaginated:", err);
    throw err;
  }
};

export const createNewRequest = async (request: Partial<RequisicaoAbastecimento>) => {
  const { data, error } = await supabase
    .from('requisicoes_abastecimento')
    .insert([request])
    .select(`
      *,
      veiculo:veiculo_id (*),
      motorista:motorista_id (*)
    `)
    .single();

  if (error) throw error;
  return data;
};

export const updateRequestStatus = async (id: string, updates: Partial<RequisicaoAbastecimento>) => {
  const { data, error } = await supabase
    .from('requisicoes_abastecimento')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Logs
export const fetchRequestLogs = async (requestId: string): Promise<RequisicaoLog[]> => {
  try {
    const { data, error } = await supabase
      .from('requisicao_logs')
      .select(`
        *,
        perfil:perfil_id (*)
      `)
      .eq('requisicao_id', requestId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn("Erro em fetchRequestLogs com join, tentando busca simples:", error.message);
      const { data: simpleData, error: simpleError } = await supabase
        .from('requisicao_logs')
        .select('*')
        .eq('requisicao_id', requestId)
        .order('created_at', { ascending: true });
      
      if (simpleError) throw simpleError;
      return simpleData || [];
    }
    return data || [];
  } catch (err) {
    console.error("Erro fatal em fetchRequestLogs:", err);
    throw err;
  }
};

export const addRequestLog = async (log: Omit<RequisicaoLog, 'id' | 'created_at' | 'perfil'>) => {
  const { error } = await supabase
    .from('requisicao_logs')
    .insert([log]);
  if (error) console.error("Erro ao registrar log:", error);
};

// Database logic - Completed Fuelings
export const fetchCompletedFuelings = async (): Promise<AbastecimentoRealizado[]> => {
  const { data, error } = await supabase
    .from('abastecimentos_realizados')
    .select('*')
    .order('data_hora', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const registerFueling = async (fueling: Omit<AbastecimentoRealizado, 'id'>) => {
  const { data, error } = await supabase
    .from('abastecimentos_realizados')
    .insert([fueling])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Vehicles
export const fetchVehicles = async (): Promise<Veiculo[]> => {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .order('placa', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createVehicle = async (vehicle: Omit<Veiculo, 'id'>): Promise<Veiculo> => {
  const { data, error } = await supabase
    .from('veiculos')
    .insert([vehicle])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateVehicle = async (id: string, vehicle: Partial<Veiculo>): Promise<Veiculo> => {
  const { data, error } = await supabase
    .from('veiculos')
    .update(vehicle)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteVehicle = async (id: string) => {
  const { error } = await supabase.from('veiculos').delete().eq('id', id);
  if (error) throw error;
};

// Profiles
export const fetchProfiles = async (all: boolean = false): Promise<Perfil[]> => {
  try {
    let query = supabase.from('perfis').select(`
      *,
      grupos:perfis_grupos(grupo:grupos(*))
    `);
    
    if (!all) query = query.eq('role', 'motorista');
    
    const { data, error } = await query.order('nome', { ascending: true });

    if (error) {
      console.warn("Erro em fetchProfiles com join, tentando busca simples:", error.message);
      let simpleQuery = supabase.from('perfis').select('*');
      if (!all) simpleQuery = simpleQuery.eq('role', 'motorista');
      
      const { data: simpleData, error: simpleError } = await simpleQuery.order('nome', { ascending: true });
      if (simpleError) throw simpleError;
      return (simpleData || []).map(p => ({ ...p, grupos: [] })) as Perfil[];
    }
    
    return (data || []).map(p => ({
      ...p,
      grupos: p.grupos?.map((g: any) => g.grupo) || []
    })) as Perfil[];
  } catch (err) {
    console.error("Erro fatal em fetchProfiles:", err);
    throw err;
  }
};

export const createProfile = async (profile: Omit<Perfil, 'id' | 'grupos'>, groupIds: string[] = []): Promise<Perfil> => {
  const { data, error } = await supabase
    .from('perfis')
    .insert([profile])
    .select()
    .single();

  if (error) throw error;

  if (groupIds.length > 0) {
    const associations = groupIds.map(gid => ({
      perfil_id: data.id,
      grupo_id: gid
    }));
    await supabase.from('perfis_grupos').insert(associations);
  }

  return data;
};

export const updateProfile = async (id: string, profile: Partial<Perfil>, groupIds: string[] = []): Promise<Perfil> => {
  const { data, error } = await supabase
    .from('perfis')
    .update(profile)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Atualiza grupos: remove antigos e insere novos
  await supabase.from('perfis_grupos').delete().eq('perfil_id', id);
  if (groupIds.length > 0) {
    const associations = groupIds.map(gid => ({
      perfil_id: id,
      grupo_id: gid
    }));
    await supabase.from('perfis_grupos').insert(associations);
  }

  return data;
};

export const deleteProfile = async (id: string) => {
  const { error } = await supabase.from('perfis').delete().eq('id', id);
  if (error) throw error;
};

// Groups Management
export const fetchGroups = async (): Promise<Grupo[]> => {
  const { data, error } = await supabase
    .from('grupos')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createGroup = async (nome: string): Promise<Grupo> => {
  const { data, error } = await supabase
    .from('grupos')
    .insert([{ nome }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateGroup = async (id: string, nome: string): Promise<Grupo> => {
  const { data, error } = await supabase
    .from('grupos')
    .update({ nome })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteGroup = async (id: string) => {
  const { error } = await supabase.from('grupos').delete().eq('id', id);
  if (error) throw error;
};

export const uploadPlatePhoto = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
  const filePath = `plates/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('fleet-images')
    .upload(filePath, file, {
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error("Erro no Storage do Supabase:", uploadError);
    throw new Error(`Erro ao subir imagem: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from('fleet-images')
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error("Não foi possível gerar a URL pública da imagem.");
  }

  return data.publicUrl;
};
