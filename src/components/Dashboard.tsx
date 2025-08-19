import React from 'react';
import { Users, Package, ShoppingCart, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useData } from '../hooks/useData';
import StatCard from './StatCard';
import SalesChart from './SalesChart';
import RecentOrders from './RecentOrders';

const Dashboard: React.FC = () => {
  const { stats, pedidos, loading, error, loadAllData } = useData();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos desde Google Sheets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error cargando datos</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const pedidosRecientes = pedidos
    .sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Resumen general del sistema</p>
        </div>
        <button
          onClick={loadAllData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Clock className="w-4 h-4" />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Alertas */}
      {stats.pedidosPendientes > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-yellow-800">
              <span className="font-semibold">¡Atención!</span> Tienes {stats.pedidosPendientes} pedidos pendientes de confirmación.
            </p>
          </div>
        </div>
      )}

      {/* Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ventas Totales"
          value={`$${stats.totalVentas.toLocaleString('es-ES')}`}
          icon={TrendingUp}
          color="green"
          trend="+12% vs mes anterior"
        />
        <StatCard
          title="Pedidos Confirmados"
          value={stats.pedidosConfirmados.toString()}
          icon={CheckCircle}
          color="blue"
        />
        <StatCard
          title="Pedidos Pendientes"
          value={stats.pedidosPendientes.toString()}
          icon={AlertCircle}
          color="orange"
        />
        <StatCard
          title="Ventas de Hoy"
          value={`$${stats.ventasHoy.toLocaleString('es-ES')}`}
          icon={ShoppingCart}
          color="purple"
        />
      </div>

      {/* Gráficos y Pedidos Recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart pedidos={pedidos} />
        <RecentOrders pedidos={pedidosRecientes} />
      </div>

      {/* Estadísticas Adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Clientes Activos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.clientesActivos}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Productos Activos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.productosActivos}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Promedio por Pedido</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${stats.pedidosConfirmados > 0 ? Math.round(stats.totalVentas / stats.pedidosConfirmados).toLocaleString('es-ES') : '0'}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;