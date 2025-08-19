import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Pedido } from '../types';

interface SalesChartProps {
  pedidos: Pedido[];
}

const SalesChart: React.FC<SalesChartProps> = ({ pedidos }) => {
  // Agrupar ventas por día de los últimos 7 días
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date;
  }).reverse();

  const salesByDay = last7Days.map(date => {
    const dayPedidos = pedidos.filter(p => {
      const pedidoDate = new Date(p.fecha_hora);
      return pedidoDate.toDateString() === date.toDateString();
    });
    
    const total = dayPedidos.reduce((sum, p) => sum + p.total, 0);
    
    return {
      date: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      total,
      count: dayPedidos.length
    };
  });

  const maxTotal = Math.max(...salesByDay.map(d => d.total), 1);

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Ventas de los Últimos 7 Días</h3>
        <BarChart3 className="w-5 h-5 text-gray-400" />
      </div>
      
      <div className="space-y-4">
        {salesByDay.map((day, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div className="w-12 text-sm text-gray-600 font-medium">
              {day.date}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">{day.count} pedidos</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${day.total.toLocaleString('es-ES')}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(day.total / maxTotal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {pedidos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No hay datos de ventas para mostrar</p>
        </div>
      )}
    </div>
  );
};

export default SalesChart;