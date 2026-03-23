
export type UserRole = 'gestor' | 'secretario' | 'motorista' | 'frentista' | 'admin';
export type VeiculoTipo = 'carro' | 'moto' | 'lancha' | 'caminhão' | 'avulso';

export interface Grupo {
  id: string;
  nome: string;
  created_at?: string;
}

export interface Perfil {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  role: UserRole;
  senha?: string;
  grupos?: Grupo[]; // Relacionamento muitos-para-muitos
}

export interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  tipo_veiculo: VeiculoTipo;
  tipo_combustivel: string;
  odometro_atual: number;
  proprietario?: string;
}

export type RequisicaoStatus = 'pendente_gestor' | 'pendente_secretario' | 'autorizado' | 'concluido' | 'recusado';

export interface RequisicaoAbastecimento {
  id: string;
  motorista_id: string;
  veiculo_id: string;
  quantidade_solicitada: number;
  tipo_combustivel: string;
  status: RequisicaoStatus;
  gestor_id?: string;
  secretario_id?: string;
  qr_code_token?: string;
  observacoes?: string;
  created_at: string;
  // Joined fields
  veiculo?: Veiculo;
  motorista?: Perfil;
}

export interface RequisicaoLog {
  id: string;
  requisicao_id: string;
  perfil_id: string;
  acao: string;
  status_anterior?: RequisicaoStatus;
  status_novo: RequisicaoStatus;
  created_at: string;
  perfil?: Perfil;
}

export interface AbastecimentoRealizado {
  id: string;
  requisicao_id: string;
  frentista_id: string;
  placa_conferida: string;
  foto_placa_url?: string;
  odometro_bomba: number;
  quantidade_final: number;
  valor_total: number;
  tipo_combustivel_atendido: string;
  geolocalizacao: { lat: number; lng: number };
  data_hora: string;
}
