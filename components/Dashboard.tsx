
import React, { useMemo, useState } from 'react';
import { useAbastecimento } from '../hooks/useAbastecimento';
import { BarChart3, PieChart as PieIcon, Activity, TrendingUp, CheckCircle, Clock, Droplets, Ban, QrCode } from 'lucide-react';
import { RequisicaoStatus } from '../types';

const Dashboard: React.FC = () => {
  const { requests, completedFuelings } = useAbastecimento();
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = requests.length;
    const byStatus = {
      concluido: requests.filter(r => r.status === 'concluido').length,
      autorizado: requests.filter(r => r.status === 'autorizado').length,
      pendente: requests.filter(r => r.status === 'pendente_gestor' || r.status === 'pendente_secretario').length,
      recusado: requests.filter(r => r.status === 'recusado').length,
    };

    const totalLitros = completedFuelings.reduce((acc, curr) => acc + curr.quantidade_final, 0);

    // Agrupamento mensal (últimos 6 meses)
    const months: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
      months[key] = 0;
    }

    requests.forEach(req => {
      const date = new Date(req.created_at);
      const key = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
      if (months[key] !== undefined) {
        months[key]++;
      }
    });

    const monthlyData = Object.entries(months).map(([name, value]) => ({ name, value }));
    const maxMonthly = Math.max(...monthlyData.map(d => d.value), 1);

    return { total, byStatus, totalLitros, monthlyData, maxMonthly };
  }, [requests, completedFuelings]);

  // Configuração das fatias do gráfico
  const chartData = useMemo(() => {
    const data = [
      { id: 'concluido', label: 'Concluídos', value: stats.byStatus.concluido, color: '#22c55e' }, // green-500
      { id: 'autorizado', label: 'Autorizados', value: stats.byStatus.autorizado, color: '#3b82f6' }, // blue-500
      { id: 'pendente', label: 'Pendentes', value: stats.byStatus.pendente, color: '#f97316' },   // orange-500
      { id: 'recusado', label: 'Recusados', value: stats.byStatus.recusado, color: '#ef4444' },    // red-500
    ];

    let cumulativePercent = 0;
    return data.map(item => {
      const percent = stats.total > 0 ? item.value / stats.total : 0;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;
      return { ...item, percent, startPercent };
    });
  }, [stats]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <BarChart3 className="w-6 h-6 mr-2 text-blue-600" />
          Visão Geral da Frota
        </h2>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Analytics em tempo real</p>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          icon={<Activity className="w-5 h-5" />} 
          label="Total Requisições" 
          value={stats.total} 
          sub="Volume histórico acumulado"
          color="blue"
        />
        <MetricCard 
          icon={<CheckCircle className="w-5 h-5" />} 
          label="Abastecimentos OK" 
          value={stats.byStatus.concluido} 
          sub="Processos finalizados"
          color="green"
        />
        <MetricCard 
          icon={<Droplets className="w-5 h-5" />} 
          label="Litros Totais" 
          value={stats.totalLitros.toFixed(0)} 
          sub="Consumo total registrado"
          color="indigo"
        />
        <MetricCard 
          icon={<Clock className="w-5 h-5" />} 
          label="Pendências" 
          value={stats.byStatus.pendente} 
          sub="Aguardando aprovação"
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza Interativo */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6 flex flex-col items-center">
          <div className="flex items-center justify-between w-full">
            <h3 className="font-bold text-gray-800 flex items-center">
              <PieIcon className="w-5 h-5 mr-2 text-blue-500" />
              Distribuição por Status
            </h3>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-around w-full gap-8">
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90">
                {stats.total === 0 ? (
                  <circle cx="16" cy="16" r="14" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                ) : (
                  chartData.map((slice) => {
                    const dashArray = slice.percent * 88; // 2 * PI * R (R=14)
                    const dashOffset = 88 - (slice.startPercent * 88);
                    
                    return (
                      <circle
                        key={slice.id}
                        cx="16"
                        cy="16"
                        r="14"
                        fill="none"
                        stroke={slice.color}
                        strokeWidth={hoveredSegment === slice.id ? "5" : "4"}
                        strokeDasharray={`${dashArray} 88`}
                        strokeDashoffset={- (slice.startPercent * 88)}
                        className="transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredSegment(slice.id)}
                        onMouseLeave={() => setHoveredSegment(null)}
                        strokeLinecap={slice.percent > 0.02 ? "round" : "butt"}
                      />
                    );
                  })
                )}
              </svg>
              {/* Centro do Gráfico com Informação Dinâmica */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                {hoveredSegment ? (
                  <>
                    <span className="text-[10px] font-black uppercase text-gray-400">
                      {chartData.find(d => d.id === hoveredSegment)?.label}
                    </span>
                    <span className="text-2xl font-black text-gray-900">
                      {chartData.find(d => d.id === hoveredSegment)?.value}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-black uppercase text-gray-400">Total</span>
                    <span className="text-2xl font-black text-gray-900">{stats.total}</span>
                  </>
                )}
              </div>
            </div>

            {/* Legenda Lateral */}
            <div className="flex flex-col space-y-3 w-full md:w-auto">
              {chartData.map((slice) => (
                <div 
                  key={slice.id} 
                  className={`flex items-center justify-between gap-4 p-2 rounded-xl transition-all ${hoveredSegment === slice.id ? 'bg-gray-50' : ''}`}
                  onMouseEnter={() => setHoveredSegment(slice.id)}
                  onMouseLeave={() => setHoveredSegment(null)}
                >
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: slice.color }} />
                    <span className="text-xs font-bold text-gray-600">{slice.label}</span>
                  </div>
                  <span className="text-xs font-black text-gray-400 ml-4">
                    {slice.value} <span className="text-[10px] opacity-60">({(slice.percent * 100).toFixed(0)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tendência Mensal */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
              Volume Mensal (Requisições)
            </h3>
          </div>
          <div className="flex items-end justify-between h-48 pt-4">
            {stats.monthlyData.map((d, i) => (
              <div key={i} className="flex flex-col items-center flex-1 space-y-2">
                <div className="relative group w-full flex justify-center">
                  <div 
                    className="w-8 bg-blue-600 rounded-t-lg transition-all duration-700 ease-out hover:bg-blue-400 cursor-pointer"
                    style={{ height: `${(d.value / stats.maxMonthly) * 120}px` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                      {d.value} reqs
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-black text-gray-400">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ icon: any, label: string, value: string | number, sub: string, color: string }> = ({ icon, label, value, sub, color }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 border ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <h4 className="text-2xl font-black text-gray-900 my-1">{value}</h4>
      <p className="text-[10px] text-gray-400 font-medium">{sub}</p>
    </div>
  );
};

export default Dashboard;
