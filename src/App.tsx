import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import GestionPedidos from './components/GestionPedidos';
import GestionProductos from './components/GestionProductos';
import GestionClientes from './components/GestionClientes';
import { BarChart3, Package, Users, ShoppingCart } from 'lucide-react';

type ActiveSection = 'dashboard' | 'pedidos' | 'productos' | 'clientes';

function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'pedidos', name: 'Pedidos', icon: ShoppingCart },
    { id: 'productos', name: 'Productos', icon: Package },
    { id: 'clientes', name: 'Clientes', icon: Users },
  ];

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'pedidos':
        return <GestionPedidos />;
      case 'productos':
        return <GestionProductos />;
      case 'clientes':
        return <GestionClientes />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sistema Distribuidora</h1>
                <p className="text-sm text-gray-500">Panel de Administración</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-sm min-h-screen">
          <div className="p-4">
            <div className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as ActiveSection)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === item.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {renderActiveSection()}
        </main>
      </div>
    </div>
  );
}

export default App;