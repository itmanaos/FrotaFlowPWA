
import React from 'react';
import { UserRole } from '../types';
import { LogOut, Fuel, Bell } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  userRole: UserRole;
  userName: string;
  onLogout: () => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  userRole, 
  userName, 
  onLogout, 
  notificationCount = 0,
  onNotificationClick 
}) => {
  // Fix: Added missing 'admin' role to the roleLabels Record
  const roleLabels: Record<UserRole, string> = {
    gestor: 'Gestor de Frota',
    secretario: 'Secretaria',
    motorista: 'Motorista',
    frentista: 'Frentista',
    admin: 'Administrador'
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Fuel className="w-8 h-8 text-yellow-400" />
            <span className="text-xl font-bold tracking-tight">FrotaFlow</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex flex-col items-end text-sm">
              <span className="font-semibold">{userName}</span>
              <span className="text-blue-200 text-xs">{roleLabels[userRole]}</span>
            </div>
            
            {userRole === 'motorista' && (
              <button 
                onClick={onNotificationClick}
                className="relative p-2 rounded-full hover:bg-blue-600 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-blue-700 animate-bounce">
                    {notificationCount}
                  </span>
                )}
              </button>
            )}

            <button 
              onClick={onLogout}
              className="p-2 rounded-full hover:bg-blue-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 py-6 w-full">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-500">
        © 2024 FrotaFlow - Sistema de Gestão de Abastecimento
      </footer>
    </div>
  );
};

export default Layout;
