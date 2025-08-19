import React, { useState } from 'react';
import { Search, Plus, Edit, Trash2, User, Phone, Mail, MapPin } from 'lucide-react';
import { useData } from '../hooks/useData';

const GestionClientes: React.FC = () => {
  const { clientes, pedidos } = useData();
  const [busqueda, setBusqueda] = useState('');

  const clientesFiltrados = clientes.filter(cliente =>
    cliente.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const getPedidosCliente = (clienteId: number) => {
    return pedidos.filter(p => p.cliente_id === clienteId && p.estado === 'CONFIRMADO');
  };

  const getTotalComprasCliente = (clienteId: number) => {
    const pedidosCliente = getPedidosCliente(clienteId);
    return pedidosCliente.reduce((sum, p) => sum + p.total, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h1>
          <p className="text-gray-600">Administra la base de datos de clientes</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Búsqueda */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Clientes</p>
              <p className="text-2xl font-bold text-gray-900">{clientes.length}</p>
            </div>
            <User className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Clientes Activos</p>
              <p className="text-2xl font-bold text-green-600">
                {clientes.filter(c => getPedidosCliente(c.cliente_id).length > 0).length}
              </p>
            </div>
            <User className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Nuevos Este Mes</p>
              <p className="text-2xl font-bold text-purple-600">
                {Math.floor(clientes.length * 0.1)}
              </p>
            </div>
            <User className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Lista de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clientesFiltrados.map((cliente) => {
          const pedidosCliente = getPedidosCliente(cliente.cliente_id);
          const totalCompras = getTotalComprasCliente(cliente.cliente_id);
          
          return (
            <div key={cliente.cliente_id} className="bg-white rounded-lg p-6 shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{cliente.nombre}</h3>
                    <p className="text-sm text-gray-500">ID: {cliente.cliente_id}</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    className="text-blue-600 hover:text-blue-900 p-1 rounded"
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
              </div>

              {/* Información de Contacto */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2" />
                  <span>{cliente.nombre.toLowerCase().replace(' ', '.')}@email.com</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2" />
                  <span>+54 9 11 {Math.floor(Math.random() * 90000000) + 10000000}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span>Buenos Aires, Argentina</span>
                </div>
              </div>

              {/* Estadísticas del Cliente */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Pedidos</p>
                    <p className="font-semibold text-gray-900">{pedidosCliente.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Compras</p>
                    <p className="font-semibold text-gray-900">
                      ${totalCompras.toLocaleString('es-ES')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Estado del Cliente */}
              <div className="mt-4">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  pedidosCliente.length > 0 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {pedidosCliente.length > 0 ? 'Cliente Activo' : 'Sin Pedidos'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {clientesFiltrados.length === 0 && (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No se encontraron clientes</p>
        </div>
      )}
    </div>
  );
};

export default GestionClientes;