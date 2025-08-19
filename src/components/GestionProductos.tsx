import React, { useState } from 'react';
import { Search, Filter, Package, Tag } from 'lucide-react';
import { useData } from '../hooks/useData';

const GestionProductos: React.FC = () => {
  const { productos, categorias, loading, error, loadAllData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<number | 'TODAS'>('TODAS');
  const [filterEstado, setFilterEstado] = useState<'TODOS' | 'SI' | 'NO'>('TODOS');

  const filteredProductos = productos.filter(producto => {
    const matchesSearch = producto.producto_nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = filterCategoria === 'TODAS' || producto.categoria_id === filterCategoria;
    const matchesEstado = filterEstado === 'TODOS' || producto.activo === filterEstado;
    return matchesSearch && matchesCategoria && matchesEstado;
  });

  // Agrupar productos por categoría
  const productosAgrupados = categorias.map(categoria => ({
    categoria,
    productos: filteredProductos.filter(p => p.categoria_id === categoria.categoria_id)
  })).filter(grupo => grupo.productos.length > 0);

  const getCategoriaName = (categoriaId: number) => {
    const categoria = categorias.find(c => c.categoria_id === categoriaId);
    return categoria ? categoria.categoria_nombre : 'Sin categoría';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Productos</h1>
          <p className="text-gray-600">Administra el catálogo de productos</p>
        </div>
        <button
          onClick={loadAllData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value === 'TODAS' ? 'TODAS' : parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="TODAS">Todas las categorías</option>
                {categorias.map(categoria => (
                  <option key={categoria.categoria_id} value={categoria.categoria_id}>
                    {categoria.categoria_nombre}
                  </option>
                ))}
              </select>
            </div>
            
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="SI">Activos</option>
              <option value="NO">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Productos Agrupados por Categoría */}
      <div className="space-y-8">
        {productosAgrupados.length === 0 ? (
          <div className="bg-white rounded-lg p-8 shadow-sm border text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron productos</p>
          </div>
        ) : (
          productosAgrupados.map(({ categoria, productos: productosCategoria }) => (
            <div key={categoria.categoria_id} className="space-y-4">
              {/* Header de Categoría */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Tag className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{categoria.categoria_nombre}</h2>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  {productosCategoria.length} productos
                </span>
              </div>

              {/* Grid de Productos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {productosCategoria.map((producto) => (
                  <div key={producto.producto_id} className="bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{producto.producto_nombre}</h3>
                        <p className="text-sm text-gray-600">ID: {producto.producto_id}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        producto.activo === 'SI' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {producto.activo === 'SI' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{categoria.categoria_nombre}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          ${producto.precio.toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resumen */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{productos.length}</p>
            <p className="text-sm text-gray-600">Total productos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{productos.filter(p => p.activo === 'SI').length}</p>
            <p className="text-sm text-gray-600">Productos activos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{productos.filter(p => p.activo === 'NO').length}</p>
            <p className="text-sm text-gray-600">Productos inactivos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{categorias.length}</p>
            <p className="text-sm text-gray-600">Categorías</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GestionProductos;