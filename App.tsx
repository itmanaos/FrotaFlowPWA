
import React, { useState, useEffect } from 'react';
import { Perfil } from './types';
import { getSession, signOut } from './supabase';
import Layout from './components/Layout';
import MotoristaDashboard from './components/MotoristaDashboard';
import FrentistaDashboard from './components/FrentistaDashboard';
import WorkflowsDashboard from './components/WorkflowsDashboard';
import LoginForm from './components/LoginForm';
import { useAbastecimento } from './hooks/useAbastecimento';
import { Bell, X, Info, CheckCircle, Clock, Trash2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<Perfil | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const { notifications, markAllAsRead, clearNotifications, error, refreshData } = useAbastecimento(user?.role, user?.id);

  useEffect(() => {
    const sessionUser = getSession();
    if (sessionUser) setUser(sessionUser);
    setInitializing(false);
  }, []);

  const handleLogout = () => {
    signOut();
    setUser(null);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (initializing) return <div className="min-h-screen bg-blue-900 flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full"></div></div>;

  if (!user) return <LoginForm onLoginSuccess={setUser} />;

  return (
    <Layout 
      userRole={user.role} 
      userName={user.nome} 
      onLogout={handleLogout}
      notificationCount={unreadCount}
      onNotificationClick={() => {
        setShowNotifications(true);
        markAllAsRead();
      }}
    >
      {/* Alerta de Erro de Conexão */}
      {error && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center space-x-4">
            <div className="bg-red-100 p-3 rounded-2xl text-red-600">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-red-900 font-black uppercase tracking-tight text-sm">Problema de Sincronização</h4>
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          </div>
          <button 
            onClick={() => refreshData()}
            className="bg-red-600 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-200 active:scale-95"
          >
            Tentar Novamente
          </button>
        </div>
      )}
      {/* Drawer de Notificações */}
      {showNotifications && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)}></div>
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center"><Bell className="w-5 h-5 mr-2 text-blue-600" /> Notificações</h3>
              <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.map((note) => (
                <div key={note.id} className={`p-4 rounded-2xl border ${note.read ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-100'} transition`}>
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-xl ${note.newStatus === 'concluido' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                      {note.newStatus === 'concluido' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{note.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{new Date(note.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-20 opacity-30">
                  <Bell className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-sm font-bold">Nenhuma notificação</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button onClick={clearNotifications} className="w-full py-3 text-red-600 text-sm font-bold flex items-center justify-center space-x-2 hover:bg-red-50 rounded-xl transition">
                <Trash2 className="w-4 h-4" />
                <span>Limpar Histórico</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast flutuante para novas notificações (apenas motorista) */}
      {unreadCount > 0 && !showNotifications && user.role === 'motorista' && (
        <div className="fixed bottom-6 right-6 z-[90] animate-in slide-in-from-bottom-4">
          <button 
            onClick={() => setShowNotifications(true)}
            className="bg-blue-600 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center space-x-3 hover:bg-blue-700 transition"
          >
            <Bell className="w-5 h-5 animate-bounce" />
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-widest opacity-80 leading-none">Novo Alerta</p>
              <p className="text-sm font-bold">Há atualizações em suas requisições</p>
            </div>
          </button>
        </div>
      )}

      {user.role === 'motorista' && <MotoristaDashboard user={user} />}
      {user.role === 'frentista' && <FrentistaDashboard userId={user.id} />}
      {(user.role === 'gestor' || user.role === 'secretario' || user.role === 'admin') && (
        <WorkflowsDashboard role={user.role} userId={user.id} />
      )}
    </Layout>
  );
};

export default App;
