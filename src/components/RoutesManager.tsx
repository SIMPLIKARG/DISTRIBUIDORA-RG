import React, { useState } from 'react';
import { Truck, MapPin, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { clients } from '../data/mockData';
import { DeliveryRoute } from '../types';

const RoutesManager: React.FC = () => {
  const [routes] = useState<DeliveryRoute[]>([
    {
      id: '1',
      zone: 'Centro',
      day: 'Lunes',
      clients: ['1', '2'],
      status: 'completed'
    },
    {
      id: '2',
      zone: 'Norte',
      day: 'Martes',
      clients: ['3'],
      status: 'completed'
    },
    {
      id: '3',
      zone: 'Oeste',
      day: 'Miércoles',
      clients: ['4'],
      status: 'in_progress'
    },
    {
      id: '4',
      zone: 'Sur',
      day: 'Jueves',
      clients: ['5'],
      status: 'planned'
    },
    {
      id: '5',
      zone: 'Centro',
      day: 'Viernes',
      clients: ['1', '2'],
      status: 'planned'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'planned':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'planned':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En Progreso';
      case 'planned':
        return 'Planificado';
      default:
        return 'Desconocido';
    }
  };

  const getClientsByIds = (clientIds: string[]) => {
    return clients.filter(client => clientIds.includes(client.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Rutas</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>Semana del 15-19 Enero 2024</span>
        </div>
      </div>

      {/* Resumen Semanal */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="bg-green-100 p-2 rounded-lg mr-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completadas</p>
              <p className="text-xl font-bold text-gray-900">
                {routes.filter(r => r.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-2 rounded-lg mr-3">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">En Progreso</p>
              <p className="text-xl font-bold text-gray-900">
                {routes.filter(r => r.status === 'in_progress').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 rounded-lg mr-3">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Planificadas</p>
              <p className="text-xl font-bold text-gray-900">
                {routes.filter(r => r.status === 'planned').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="bg-purple-100 p-2 rounded-lg mr-3">
              <Truck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Rutas</p>
              <p className="text-xl font-bold text-gray-900">{routes.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Rutas */}
      <div className="space-y-4">
        {routes.map((route) => {
          const routeClients = getClientsByIds(route.clients);
          return (
            <div key={route.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-2 rounded-lg mr-4">
                    <Truck className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Ruta {route.zone} - {route.day}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {routeClients.length} cliente{routeClients.length !== 1 ? 's' : ''} programado{routeClients.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(route.status)}`}>
                    {getStatusIcon(route.status)}
                    <span className="ml-1">{getStatusText(route.status)}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {routeClients.map((client, index) => (
                  <div key={client.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-600 text-xs font-medium rounded-full mr-2">
                          {index + 1}
                        </span>
                        <h4 className="font-medium text-gray-900">{client.name}</h4>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span>{client.address}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs">📞 {client.phone}</span>
                      </div>
                    </div>
                    
                    {route.status === 'completed' && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs text-green-600 font-medium">✓ Entregado</span>
                      </div>
                    )}
                    
                    {route.status === 'in_progress' && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          Marcar como entregado
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {route.status === 'planned' && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                      Iniciar Ruta
                    </button>
                    <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm">
                      Editar Ruta
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mapa de Zonas */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Zonas</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {['Centro', 'Norte', 'Sur', 'Oeste', 'Este'].map(zone => {
            const zoneRoutes = routes.filter(route => route.zone === zone);
            const totalClients = zoneRoutes.reduce((sum, route) => sum + route.clients.length, 0);
            
            return (
              <div key={zone} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="mb-2">
                  <MapPin className="h-8 w-8 mx-auto text-gray-400" />
                </div>
                <p className="font-semibold text-gray-900">{zone}</p>
                <p className="text-sm text-gray-600">{totalClients} clientes</p>
                <p className="text-xs text-gray-500">{zoneRoutes.length} rutas</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RoutesManager;