import React from 'react';
import { TrendingUp, Package, Users, DollarSign, ShoppingCart, AlertCircle } from 'lucide-react';
import StatCard from './StatCard';
import RecentOrders from './RecentOrders';
import SalesChart from './SalesChart';
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

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Resumen general de tu distribuidora</p>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ventas Totales"
          value={`$${totalVentas.toLocaleString('es-ES')}`}
          icon={DollarSign}
          color="green"
          trend="+12.5%"
        />
        <StatCard
          title="Pedidos Confirmados"
          value={pedidosConfirmados.length.toString()}
          icon={ShoppingCart}
          color="blue"
          trend="+8.2%"
        />
        <StatCard
          title="Productos Activos"
          value={productosActivos.toString()}
          icon={Package}
          color="purple"
          trend="+2"
        />
        <StatCard
          title="Clientes Registrados"
          value={clientes.length.toString()}
          icon={Users}
          color="orange"
          trend="+5.1%"
        />
      </div>

      {/* Ventas de Hoy */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Ventas de Hoy</h3>
            <p className="text-2xl font-bold">${ventasHoy.toLocaleString('es-ES')}</p>
            <p className="text-blue-100">{pedidosHoy.length} pedidos confirmados</p>
          </div>
          <TrendingUp className="w-12 h-12 text-blue-200" />
        </div>
      </div>

      {/* Alertas */}
      {pedidosPendientes > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
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
        <SalesChart pedidos={pedidosConfirmados} />
        <RecentOrders pedidos={pedidosConfirmados.slice(0, 5)} />
      </div>
    </div>
  );
};

export default Dashboard;