import React, { useState } from 'react';
import { User, Phone, MapPin, Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import { clients } from '../data/mockData';
import { Client } from '../types';
import { getCategoryName, getCategoryColor } from '../utils/pricing';

const ClientsManager: React.FC = () => {
  const [clientList, setClientList] = useState<Client[]>(clients);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    zone: '',
    category: 1
  });

  const zones = ['Centro', 'Norte', 'Sur', 'Oeste', 'Este'];
  const categories = [
    { value: 1, label: 'Mayorista A' },
    { value: 2, label: 'Mayorista B' },
    { value: 3, label: 'Minorista A' },
    { value: 4, label: 'Minorista B' },
    { value: 5, label: 'Público General' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingClient) {
      // Editar cliente existente
      setClientList(prev => prev.map(client => 
        client.id === editingClient.id 
          ? { ...client, ...formData }
          : client
      ));
      setEditingClient(null);
    } else {
      // Agregar nuevo cliente
      const newClient: Client = {
        id: Date.now().toString(),
        ...formData,
        preferredProducts: [],
        orderHistory: []
      };
      setClientList(prev => [...prev, newClient]);
    }
    
    setFormData({ name: '', phone: '', address: '', zone: '', category: 1 });
    setShowAddForm(false);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      address: client.address,
      zone: client.zone,
      category: client.category
    });
    setShowAddForm(true);
  };

  const handleDelete = (clientId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      setClientList(prev => prev.filter(client => client.id !== clientId));
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingClient(null);
    setFormData({ name: '', phone: '', address: '', zone: '', category: 1 });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Cliente
        </button>
      </div>

      {/* Formulario de Agregar/Editar Cliente */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingClient ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: María González"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: +54 9 11 1234-5678"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Av. Corrientes 1234"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zona
              </label>
              <select
                required
                value={formData.zone}
                onChange={(e) => setFormData(prev => ({ ...prev, zone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar zona</option>
                {zones.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría de Cliente
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    Categoría {category.value} - {category.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                La categoría determina los precios de venta para este cliente
              </p>
            </div>
            
            <div className="md:col-span-2 flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingClient ? 'Actualizar Cliente' : 'Agregar Cliente'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clientList.map((client) => (
          <div key={client.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{client.name}</h3>
                  <div className="flex space-x-1 mt-1">
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {client.zone}
                    </span>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getCategoryColor(client.category)}`}>
                      Cat. {client.category}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => handleEdit(client)}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                <span>{client.phone}</span>
              </div>
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                <span>{client.address}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs font-medium">Categoría: {getCategoryName(client.category)}</span>
              </div>
              {client.lastOrderDate && (
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Último pedido: {client.lastOrderDate}</span>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Productos preferidos:</p>
              <div className="flex flex-wrap gap-1">
                {client.preferredProducts.slice(0, 3).map((productId, index) => (
                  <span key={index} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                    Producto {productId}
                  </span>
                ))}
                {client.preferredProducts.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                    +{client.preferredProducts.length - 3} más
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Estadísticas por Zona */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Zonas</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {zones.map(zone => {
            const count = clientList.filter(client => client.zone === zone).length;
            return (
              <div key={zone} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-600">{zone}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estadísticas por Categoría */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Categorías</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {categories.map(category => {
            const count = clientList.filter(client => client.category === category.value).length;
            return (
              <div key={category.value} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${getCategoryColor(category.value)}`}>
                  Cat. {category.value}
                </div>
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-600">{category.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ClientsManager;