import React from 'react';
import { Clock, User, Package } from 'lucide-react';
import { Pedido } from '../types';

interface RecentOrdersProps {
  pedidos: Pedido[];
}

const RecentOrders: React.FC<RecentOrdersProps> = ({ pedidos }) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Pedidos Recientes</h3>
        <Clock className="w-5 h-5 text-gray-400" />
      </div>
      
      <div className="space-y-4">
        {pedidos.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No hay pedidos recientes</p>
        ) : (
          pedidos.map((pedido) => (
            <div key={pedido.pedido_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">#{pedido.pedido_id}</p>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <User className="w-3 h-3" />
                    <span>{pedido.cliente_nombre}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  ${pedido.total.toLocaleString('es-ES')}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(pedido.fecha_hora).toLocaleDateString('es-ES')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentOrders;