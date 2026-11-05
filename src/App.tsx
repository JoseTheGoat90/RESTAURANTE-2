import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DataProvider, useData } from './context/DataContext';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { NotificationBanner } from './components/NotificationBanner';
import { LoginScreen } from './components/LoginScreen';
import { ResumenTab } from './tabs/ResumenTab';
import { VenderTab } from './tabs/VenderTab';
import { GastosTab } from './tabs/GastosTab';
import { InventarioTab } from './tabs/InventarioTab';
import { ReporteTab } from './tabs/ReporteTab';
import { AsistenteTab } from './tabs/AsistenteTab';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const { ingredientes } = useData();
  const alertCount = ingredientes.filter((i) => i.stock <= i.stock_minimo).length;

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col font-sans transition-colors duration-200">
      <NotificationBanner />
      <Header />
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectTab={setActiveTab}
        alertCount={alertCount}
      />

      <main className={`flex-1 ${activeTab === 'asistente' ? 'overflow-hidden flex flex-col h-[calc(100dvh-112px)] sm:h-[calc(100dvh-120px)]' : 'pb-16 md:pb-8'}`}>
        {activeTab === 'resumen' && <ResumenTab onNavigate={(tab) => setActiveTab(tab as TabType)} />}
        {activeTab === 'vender' && <VenderTab />}
        {activeTab === 'gastos' && <GastosTab />}
        {activeTab === 'inventario' && <InventarioTab />}
        {activeTab === 'reporte' && <ReporteTab />}
        {activeTab === 'asistente' && <AsistenteTab />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
