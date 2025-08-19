import React, { useState } from 'react';
import { Search, Filter, Eye, Edit, Trash2, Package, Calendar, User, DollarSign } from 'lucide-react';
import { useData } from '../hooks/useData';
import { Pedido } from '../types';

const GestionPedidos: React.FC = () => {
  const { pedidos, detallePedidos } = useData();
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);

  const pedidosFiltrados = pedidos.filter(pedido => {
    const coincideBusqueda = pedido.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                            pedido.pedido_id.toString().includes(busqueda);
    const coincideEstado = filtroEstado === 'TODOS' || pedido.estado === filtroEstado;
    return coincideBusqueda && coincideEstado;
  });

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'CONFIRMADO':
        return 'bg-green-100 text-green-800';
      case 'BORRADOR':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const verDetallePedido = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);
  };

  const cerrarDetalle = () => {
    setPedidoSeleccionado(null);
  };

  const detallesPedidoSeleccionado = pedidoSeleccionado 
    ? detallePedidos.filter(d => d.pedido_id === pedidoSeleccionado.pedido_id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Pedidos</h1>
        <p className="text-gray-600">Administra todos los pedidos de tu distribuidora</p>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por cliente o ID de pedido..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="CONFIRMADO">Confirmado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pedido
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pedidosFiltrados.map((pedido) => (
                <tr key={pedido.pedido_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Package className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="font-medium text-gray-900">#{pedido.pedido_id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-900">{pedido.cliente_nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-900">
                        {new Date(pedido.fecha_hora).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {pedido.items_cantidad}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="font-semibold text-gray-900">
                        {pedido.total.toLocaleString('es-ES')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(pedido.estado)}`}>
                      {pedido.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => verDetallePedido(pedido)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="text-green-600 hover:text-green-900 p-1 rounded"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900 p-1 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pedidosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron pedidos</p>
          </div>
        )}
      </div>

      {/* Modal de Detalle del Pedido */}
      {pedidoSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Detalle del Pedido #{pedidoSeleccionado.pedido_id}
                </h2>
                <button
                  onClick={cerrarDetalle}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Información del Pedido */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Cliente</p>
                    <p className="font-semibold">{pedidoSeleccionado.cliente_nombre}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fecha</p>
                    <p className="font-semibold">
                      {new Date(pedidoSeleccionado.fecha_hora).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Estado</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(pedidoSeleccionado.estado)}`}>
                      {pedidoSeleccionado.estado}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="font-semibold text-lg">
                      ${pedidoSeleccionado.total.toLocaleString('es-ES')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detalle de Productos */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Productos</h3>
                <div className="space-y-3">
                  {detallesPedidoSeleccionado.map((detalle) => (
                    <div key={detalle.detalle_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{detalle.producto_nombre}</p>
                        <p className="text-sm text-gray-600">
                          {detalle.cantidad} × ${detalle.precio_unitario.toLocaleString('es-ES')}
                        </p>
                      </div>
                      <p className="font-semibold">
                        ${detalle.importe.toLocaleString('es-ES')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionPedidos;