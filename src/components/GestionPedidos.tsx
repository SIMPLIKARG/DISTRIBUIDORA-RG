import React, { useState } from 'react';
import { Search, Filter, CheckCircle, XCircle, Clock, User, Package, Calendar } from 'lucide-react';
import { useData } from '../hooks/useData';
import { Pedido } from '../types';

const GestionPedidos: React.FC = () => {
  const { pedidos, detallePedidos, loading, error, updatePedidoEstado, loadAllData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<'TODOS' | 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO'>('TODOS');

  const filteredPedidos = pedidos
    .filter(pedido => {
      const matchesSearch = pedido.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           pedido.pedido_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterEstado === 'TODOS' || pedido.estado === filterEstado;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime());

  const handleConfirmarPedido = async (pedidoId: string) => {
    const success = await updatePedidoEstado(pedidoId, 'CONFIRMADO');
    if (success) {
      await loadAllData(); // Recargar datos
    }
  };

  const handleCancelarPedido = async (pedidoId: string) => {
    const success = await updatePedidoEstado(pedidoId, 'CANCELADO');
    if (success) {
      await loadAllData(); // Recargar datos
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CONFIRMADO':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELADO':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE':
        return <Clock className="w-4 h-4" />;
      case 'CONFIRMADO':
        return <CheckCircle className="w-4 h-4" />;
      case 'CANCELADO':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando pedidos...</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Pedidos</h1>
          <p className="text-gray-600">Administra y confirma los pedidos</p>
        </div>
        <button
          onClick={loadAllData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por cliente o ID de pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="CONFIRMADO">Confirmados</option>
              <option value="CANCELADO">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="space-y-4">
        {filteredPedidos.length === 0 ? (
          <div className="bg-white rounded-lg p-8 shadow-sm border text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron pedidos</p>
          </div>
        ) : (
          filteredPedidos.map((pedido) => {
            const detalles = detallePedidos.filter(d => d.pedido_id === pedido.pedido_id);
            
            return (
              <div key={pedido.pedido_id} className="bg-white rounded-lg p-6 shadow-sm border">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">#{pedido.pedido_id}</h3>
                      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getEstadoColor(pedido.estado)}`}>
                        {getEstadoIcon(pedido.estado)}
                        <span>{pedido.estado}</span>
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>{pedido.cliente_nombre}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(pedido.fecha_hora).toLocaleString('es-ES')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4" />
                        <span>{pedido.items_cantidad} productos</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      ${pedido.total.toLocaleString('es-ES')}
                    </p>
                    {pedido.estado === 'PENDIENTE' && (
                      <div className="flex space-x-2 mt-2">
                        <button
                          onClick={() => handleConfirmarPedido(pedido.pedido_id)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors flex items-center space-x-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>Confirmar</span>
                        </button>
                        <button
                          onClick={() => handleCancelarPedido(pedido.pedido_id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors flex items-center space-x-1"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Cancelar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalles del Pedido */}
                {detalles.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Productos:</h4>
                    <div className="space-y-2">
                      {detalles.map((detalle) => (
                        <div key={detalle.detalle_id} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">
                            {detalle.cantidad} × {detalle.producto_nombre}
                          </span>
                          <span className="font-medium">
                            ${detalle.importe.toLocaleString('es-ES')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GestionPedidos;