
import React, { useState, useEffect } from 'react';
import { fetchFuelingReport, fetchGroups } from '../supabase';
import { Grupo } from '../types';
import { Calendar, Filter, Download, FileText, Loader2, ChevronRight, Fuel, User, MapPin, Clock } from 'lucide-react';

const Relatorios: React.FC = () => {
  const [groups, setGroups] = useState<Grupo[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGroups().then(setGroups);
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      // Adiciona o horário para abranger o dia inteiro
      const start = `${startDate}T00:00:00Z`;
      const end = `${endDate}T23:59:59Z`;
      const data = await fetchFuelingReport(start, end, selectedGroup || undefined);
      setReportData(data);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) return;

    const headers = ['Data/Hora', 'Motorista', 'Veículo', 'Placa', 'Combustível', 'Quantidade (L)', 'Valor Total (R$)', 'Frentista'];
    const rows = reportData.map(item => [
      new Date(item.data_hora).toLocaleString(),
      item.requisicao?.motorista?.nome || 'N/A',
      item.requisicao?.veiculo?.modelo || 'N/A',
      item.placa_conferida,
      item.tipo_combustivel_atendido,
      (item.quantidade_final || 0).toString(),
      (item.valor_total || 0).toFixed(2),
      item.frentista?.nome || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_abastecimento_${startDate}_a_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex items-center mb-8">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mr-4 text-indigo-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-900">Relatórios de Frota</h3>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Histórico de Abastecimentos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase ml-1">Data Inicial</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase ml-1">Data Final</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase ml-1">Grupo Logístico</label>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3 font-bold text-sm appearance-none outline-none focus:ring-2 focus:ring-indigo-500 transition"
              >
                <option value="">Todos os Grupos</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            onClick={handleGenerateReport}
            disabled={loading}
            className="bg-indigo-600 text-white rounded-2xl py-3 font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center justify-center disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gerar Relatório'}
          </button>
        </div>
      </div>

      {reportData.length > 0 ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-4">
            <h4 className="text-lg font-black text-gray-800">Resultados ({reportData.length})</h4>
            <button 
              onClick={handleExportCSV}
              className="flex items-center space-x-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:bg-indigo-50 px-4 py-2 rounded-xl transition"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Data/Hora</th>
                    <th className="px-6 py-4">Motorista</th>
                    <th className="px-6 py-4">Veículo</th>
                    <th className="px-6 py-4">Grupo</th>
                    <th className="px-6 py-4">Combustível</th>
                    <th className="px-6 py-4 text-right">Volume</th>
                    <th className="px-6 py-4 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reportData.map((item) => (
                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-gray-800">{new Date(item.data_hora).toLocaleDateString()}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{new Date(item.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <User className="w-3.5 h-3.5 text-gray-400 mr-2" />
                          <span className="text-xs font-bold text-gray-700">{item.requisicao?.motorista?.nome || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-gray-900">{item.placa_conferida}</div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase">{item.requisicao?.veiculo?.modelo || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 text-gray-400 mr-1" />
                          <span className="text-xs font-bold text-gray-700">
                            {item.requisicao?.motorista?.perfis_grupos?.[0]?.grupo?.nome || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                          {item.tipo_combustivel_atendido}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-black text-indigo-600">{item.quantidade_final}L</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-gray-900">R$ {(item.valor_total || 0).toFixed(2)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="bg-white p-16 rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-gray-300">
              <FileText className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-black text-gray-800 mb-2">Nenhum dado para exibir</h4>
            <p className="text-sm text-gray-400 max-w-xs font-medium">Selecione o período e o grupo desejado para gerar o relatório de abastecimentos.</p>
          </div>
        )
      )}
    </div>
  );
};

export default Relatorios;
