import React, { useState } from 'react';
import { Bot, BarChart3, Package, Users, ShoppingCart } from 'lucide-react';
import TelegramBot from './components/TelegramBot';
import Dashboard from './components/Dashboard';
import GestionPedidos from './components/GestionPedidos';
import GestionProductos from './components/GestionProductos';
import GestionClientes from './components/GestionClientes';

type Vista = 'bot' | 'dashboard' | 'pedidos' | 'productos' | 'clientes';

function App() {
  const [vistaActiva, setVistaActiva] = useState<Vista>('dashboard');

  const navegacion = [
    { id: 'dashboard' as Vista, nombre: 'Dashboard', icono: BarChart3 },
    { id: 'bot' as Vista, nombre: 'Bot Telegram', icono: Bot },
    { id: 'pedidos' as Vista, nombre: 'Pedidos', icono: ShoppingCart },
    { id: 'productos' as Vista, nombre: 'Productos', icono: Package },
    { id: 'clientes' as Vista, nombre: 'Clientes', icono: Users },
  ];

  const renderVista = () => {
    switch (vistaActiva) {
      case 'bot':
        return <TelegramBot />;
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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Sistema Distribuidora
                </h1>
                <p className="text-sm text-gray-500">
                  Gestión completa de pedidos y productos
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Sistema Activo</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {navegacion.map((item) => {
              const Icono = item.icono;
              return (
                <button
                  key={item.id}
                  onClick={() => setVistaActiva(item.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    vistaActiva === item.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icono className="w-4 h-4" />
                  <span>{item.nombre}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderVista()}
      </main>
    </div>
  );
}

export default App;