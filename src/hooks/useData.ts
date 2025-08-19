import { useState, useEffect, useCallback } from 'react';
import { Cliente, Categoria, Producto, Pedido, DetallePedido } from '../types';

export const useData = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [detallePedidos, setDetallePedidos] = useState<DetallePedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Función para hacer fetch con manejo de errores
  const fetchData = useCallback(async <T>(endpoint: string): Promise<T[]> => {
    try {
      const response = await fetch(`/api/${endpoint}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      throw error;
    }
  }, []);

  // Cargar todos los datos
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [clientesData, categoriasData, productosData, pedidosData, detallesData] = await Promise.all([
        fetchData<Cliente>('clientes'),
        fetchData<Categoria>('categorias'),
        fetchData<Producto>('productos'),
        fetchData<Pedido>('pedidos'),
        fetchData<DetallePedido>('detalle-pedidos')
      ]);

      setClientes(clientesData);
      setCategorias(categoriasData);
      setProductos(productosData);
      setPedidos(pedidosData);
      setDetallePedidos(detallesData);
      
      console.log('✅ Datos cargados:', {
        clientes: clientesData.length,
        categorias: categoriasData.length,
        productos: productosData.length,
        pedidos: pedidosData.length,
        detalles: detallesData.length
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error cargando datos');
      console.error('❌ Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  // Cargar datos al montar el componente
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Función para actualizar estado de pedido
  const updatePedidoEstado = useCallback(async (pedidoId: string, nuevoEstado: 'CONFIRMADO' | 'CANCELADO') => {
    try {
      const response = await fetch(`/api/pedidos/${pedidoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (!response.ok) {
        throw new Error('Error actualizando pedido');
      }

      // Actualizar estado local
      setPedidos(prev => 
        prev.map(pedido => 
          pedido.pedido_id === pedidoId 
            ? { ...pedido, estado: nuevoEstado }
            : pedido
        )
      );

      console.log(`✅ Pedido ${pedidoId} actualizado a ${nuevoEstado}`);
      return true;
    } catch (error) {
      console.error('❌ Error actualizando pedido:', error);
      return false;
    }
  }, []);

  // Función para agregar nuevo pedido (desde el bot)
  const addPedido = useCallback((pedido: Pedido) => {
    setPedidos(prev => [pedido, ...prev]);
  }, []);

  // Función para agregar detalle de pedido
  const addDetallePedido = useCallback((detalle: DetallePedido) => {
    setDetallePedidos(prev => [...prev, detalle]);
  }, []);

  // Estadísticas calculadas
  const stats = {
    totalVentas: pedidos
      .filter(p => p.estado === 'CONFIRMADO')
      .reduce((sum, p) => sum + p.total, 0),
    
    pedidosConfirmados: pedidos.filter(p => p.estado === 'CONFIRMADO').length,
    
    pedidosPendientes: pedidos.filter(p => p.estado === 'PENDIENTE').length,
    
    ventasHoy: pedidos
      .filter(p => {
        const hoy = new Date().toDateString();
        const fechaPedido = new Date(p.fecha_hora).toDateString();
        return fechaPedido === hoy && p.estado === 'CONFIRMADO';
      })
      .reduce((sum, p) => sum + p.total, 0),
    
    clientesActivos: clientes.filter(c => 
      pedidos.some(p => p.cliente_id === c.cliente_id && p.estado === 'CONFIRMADO')
    ).length,
    
    productosActivos: productos.filter(p => p.activo === 'SI').length
  };

  return {
    // Datos
    clientes,
    categorias,
    productos,
    pedidos,
    detallePedidos,
    
    // Estado
    loading,
    error,
    
    // Estadísticas
    stats,
    
    // Acciones
    loadAllData,
    updatePedidoEstado,
    addPedido,
    addDetallePedido
  };
};