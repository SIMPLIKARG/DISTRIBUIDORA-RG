import React from 'react';
import { TrendingUp, Package, Users, DollarSign, ShoppingCart, AlertCircle, Calendar, BarChart3 } from 'lucide-react';
import { useData } from '../hooks/useData';

const Dashboard: React.FC = () => {
  const { pedidos, productos, clientes } = useData();

  // Calcular estadísticas
  const pedidosConfirmados = pedidos.filter(p => p.estado === 'CONFIRMADO');
  const totalVentas = pedidosConfirmados.reduce((sum, p) => sum + p.total, 0);
  const pedidosHoy = pedidosConfirmados.filter(p => {
    const hoy = new Date().toDateString();
    const fechaPedido = new Date(p.fecha_hora).toDateString();
    return hoy === fechaPedido;
  });
  const ventasHoy = pedidosHoy.reduce((sum, p) => sum + p.total, 0);
  const productosActivos = productos.filter(p => p.activo === 'SI').length;
  const pedidosPendientes = pedidos.filter(p => p.estado === 'BORRADOR').length;

  // Datos para el gráfico de ventas de los últimos 7 días
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date;
  }).reverse();

  const salesByDay = last7Days.map(date => {
    const dayPedidos = pedidosConfirmados.filter(p => {
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
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Resumen general de tu distribuidora</p>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ventas Totales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${totalVentas.toLocaleString('es-ES')}
              </p>
              <p className="text-sm text-green-600 mt-1">+12.5% vs mes anterior</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pedidos Confirmados</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {pedidosConfirmados.length}
              </p>
              <p className="text-sm text-blue-600 mt-1">+8.2% vs mes anterior</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Productos Activos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {productosActivos}
              </p>
              <p className="text-sm text-purple-600 mt-1">+2 nuevos</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Clientes Registrados</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {clientes.length}
              </p>
              <p className="text-sm text-orange-600 mt-1">+5.1% vs mes anterior</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Ventas de Hoy */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Ventas de Hoy</h3>
            <p className="text-3xl font-bold mt-1">${ventasHoy.toLocaleString('es-ES')}</p>
            <p className="text-blue-100 mt-1">{pedidosHoy.length} pedidos confirmados</p>
          </div>
          <TrendingUp className="w-12 h-12 text-blue-200" />
        </div>
      </div>

      {/* Alertas */}
      {pedidosPendientes > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div>
              <h4 className="font-semibold text-yellow-800">Pedidos Pendientes</h4>
              <p className="text-yellow-700">
                Tienes {pedidosPendientes} pedidos en borrador que necesitan confirmación.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gráficos y Tablas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Ventas */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
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
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(day.total / maxTotal) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pedidos Recientes */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pedidos Recientes</h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {pedidosConfirmados.slice(0, 5).map((pedido) => (
              <div key={pedido.pedido_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">#{pedido.pedido_id}</p>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Users className="w-3 h-3" />
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
            ))}
          </div>

          {pedidosConfirmados.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay pedidos recientes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;