import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DataProvider, useData } from './context/DataContext';
import { Header } from './components/Header';
import { Navigation, TabType, TabId } from './components/Navigation';
import { NotificationBanner } from './components/NotificationBanner';
import { LoginScreen } from './components/LoginScreen';
import { ResumenTab } from './tabs/ResumenTab';
import { VenderTab } from './tabs/VenderTab';
import { PedidoTab } from './tabs/PedidoTab';
import { GastosTab } from './tabs/GastosTab';
import { InventarioTab } from './tabs/InventarioTab';
import { ReporteTab } from './tabs/ReporteTab';
import { AsistenteTab } from './tabs/AsistenteTab';
import { CocinaTab } from './tabs/CocinaTab';
import { ChecklistsTab } from './tabs/ChecklistsTab';

const AppContent: React.FC = () => {
  const { isAuthenticated, puede, rol } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const { ingredientes, porciones } = useData();
  const alertCount =
    ingredientes.filter((i) => i.stock <= i.stock_minimo).length + porciones.filter((p) => p.total <= p.minimo).length;

  // Cada cargo ve solo los módulos que le corresponden (la base valida de nuevo cada operación)
  const allowedTabs = React.useMemo<TabId[]>(() => {
    const tabs: TabId[] = [];
    if (puede('ver_resumen')) tabs.push('resumen');
    if (puede('vender') || puede('ver_pedidos')) tabs.push('vender');
    if (rol === 'admin' || rol === 'cocina' || rol === 'parrilla') tabs.push('cocina');
    if (rol) tabs.push('checklists');
    if (puede('gastos')) tabs.push('gastos');
    if (puede('ver_inventario')) tabs.push('inventario');
    if (puede('reportes')) tabs.push('reporte');
    if (puede('asistente')) tabs.push('asistente');
    return tabs;
  }, [puede, rol]);

  React.useEffect(() => {
    if (allowedTabs.length && !allowedTabs.includes(activeTab)) setActiveTab(allowedTabs[0]);
  }, [allowedTabs, activeTab]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  const visibleTab: TabId | null = allowedTabs.includes(activeTab) ? activeTab : null;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col font-sans transition-colors duration-200">
      <NotificationBanner />
      <Header />
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectTab={setActiveTab}
        alertCount={alertCount}
        allowedTabs={allowedTabs}
      />

      <main className={`flex-1 ${activeTab === 'asistente' ? 'overflow-hidden flex flex-col h-[calc(100dvh-112px)] sm:h-[calc(100dvh-120px)]' : 'pb-16 md:pb-8'}`}>
        {visibleTab === 'resumen' && <ResumenTab onNavigate={(tab) => setActiveTab(tab as TabType)} />}
        {visibleTab === 'vender' && (puede('vender') ? <PedidoTab /> : <VenderTab />)}
        {visibleTab === 'cocina' && <CocinaTab />}
        {visibleTab === 'checklists' && <ChecklistsTab />}
        {visibleTab === 'gastos' && <GastosTab />}
        {visibleTab === 'inventario' && <InventarioTab />}
        {visibleTab === 'reporte' && <ReporteTab />}
        {visibleTab === 'asistente' && <AsistenteTab />}
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
