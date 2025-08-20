import React from 'react';
import { TrendingUp, Users, Package, Calendar, Download } from 'lucide-react';
import { products, clients, sampleOrders } from '../data/mockData';

const Dashboard: React.FC = () => {
  const totalProducts = products.length;
  const totalClients = clients.length;
  const totalOrders = sampleOrders.length;
  const totalRevenue = sampleOrders.reduce((sum, order) => sum + order.total, 0);

  const generateProductionSheet = () => {
    const productSummary = new Map();
    
    sampleOrders.forEach(order => {
      order.products.forEach(item => {
        const current = productSummary.get(item.productId) || { name: item.productName, quantity: 0 };
        current.quantity += item.quantity;
        productSummary.set(item.productId, current);
      });
    });

    const csvContent = [
      ['Producto', 'Cantidad Total', 'Unidad'],
      ...Array.from(productSummary.values()).map(item => {
        const product = products.find(p => p.name === item.name);
        return [item.name, item.quantity, product?.unit || ''];
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilla-produccion-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const stats = [
    {
      name: 'Productos Disponibles',
      value: totalProducts,
      icon: Package,
      color: 'bg-blue-500',
      change: '+2 nuevos'
    },
    {
      name: 'Clientes Activos',
      value: totalClients,
      icon: Users,
      color: 'bg-green-500',
      change: '+1 esta semana'
    },
    {
      name: 'Pedidos Confirmados',
      value: totalOrders,
      icon: Calendar,
      color: 'bg-orange-500',
      change: 'Hoy'
    },
    {
      name: 'Ingresos Estimados',
      value: `$${totalRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      change: '+15% vs semana anterior'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <button
          onClick={generateProductionSheet}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Generar Planilla de Producción
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-green-600">{stat.change}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Productos Más Vendidos</h3>
          <div className="space-y-3">
            {products.slice(0, 5).map((product, index) => (
              <div key={product.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-10 w-10 rounded-lg object-cover mr-3"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-500">{product.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${product.price}</p>
                  <p className="text-sm text-gray-500">/{product.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Entregas de Esta Semana</h3>
          <div className="space-y-3">
            {['Lunes - Centro', 'Martes - Norte', 'Miércoles - Oeste', 'Jueves - Sur', 'Viernes - Centro'].map((delivery, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">{delivery}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  index < 2 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {index < 2 ? 'Completado' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;