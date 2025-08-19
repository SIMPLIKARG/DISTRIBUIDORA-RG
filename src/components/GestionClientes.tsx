import React, { useState } from 'react';
import { Search, User, ShoppingCart, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useData } from '../hooks/useData';

const GestionClientes: React.FC = () => {
  const { clientes, pedidos, loading, error, loadAllData } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClientes = clientes.filter(cliente =>
    cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getClienteStats = (clienteId: number) => {
    const pedidosCliente = pedidos.filter(p => p.cliente_id === clienteId);
    const pedidosConfirmados = pedidosCliente.filter(p => p.estado === 'CONFIRMADO');
    const totalGastado = pedidosConfirmados.reduce((sum, p) => sum + p.total, 0);
    const ultimoPedido = pedidosCliente.sort((a, b) => 
      new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()
    )[0];

    return {
      totalPedidos: pedidosCliente.length,
      pedidosConfirmados: pedidosConfirmados.length,
      totalGastado,
      ultimoPedido,
      esActivo: pedidosConfirmados.length > 0
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h1>
          <p className="text-gray-600">Administra la base de clientes</p>
        </div>
        <button
          onClick={loadAllData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar clientes por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Grid de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClientes.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg p-8 shadow-sm border text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron clientes</p>
          </div>
        ) : (
          filteredClientes.map((cliente) => {
            const stats = getClienteStats(cliente.cliente_id);
            
            return (
              <div key={cliente.cliente_id} className="bg-white rounded-lg p-6 shadow-sm border hover:shadow-md transition-shadow">
                {/* Header del Cliente */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{cliente.nombre}</h3>
                      <p className="text-sm text-gray-600">ID: {cliente.cliente_id}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    stats.esActivo 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {stats.esActivo ? 'Activo' : 'Sin Pedidos'}
                  </span>
                </div>

                {/* Estadísticas */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ShoppingCart className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Total pedidos</span>
                    </div>
                    <span className="font-semibold text-gray-900">{stats.totalPedidos}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-600">Confirmados</span>
                    </div>
                    <span className="font-semibold text-green-600">{stats.pedidosConfirmados}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-gray-600">Total gastado</span>
                    </div>
                    <span className="font-semibold text-blue-600">
                      ${stats.totalGastado.toLocaleString('es-ES')}
                    </span>
                  </div>

                  {stats.ultimoPedido && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Último pedido</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            ${stats.ultimoPedido.total.toLocaleString('es-ES')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(stats.ultimoPedido.fecha_hora).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          stats.ultimoPedido.estado === 'CONFIRMADO'
                            ? 'bg-green-100 text-green-800'
                            : stats.ultimoPedido.estado === 'PENDIENTE'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {stats.ultimoPedido.estado}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Resumen General */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Clientes</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{clientes.length}</p>
            <p className="text-sm text-gray-600">Total clientes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {clientes.filter(c => getClienteStats(c.cliente_id).esActivo).length}
            </p>
            <p className="text-sm text-gray-600">Clientes activos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {clientes.filter(c => {
                const stats = getClienteStats(c.cliente_id);
                return stats.totalPedidos > 0 && !stats.esActivo;
              }).length}
            </p>
            <p className="text-sm text-gray-600">Con pedidos pendientes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-600">
              {clientes.filter(c => getClienteStats(c.cliente_id).totalPedidos === 0).length}
            </p>
            <p className="text-sm text-gray-600">Sin pedidos</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GestionClientes;