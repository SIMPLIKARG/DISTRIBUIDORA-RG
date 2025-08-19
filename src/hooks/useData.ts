import { useState, useCallback } from 'react';
import { useEffect } from 'react';
import { Cliente, Categoria, Producto, Pedido, DetallePedido } from '../types';

// Datos de ejemplo realistas para Argentina
const clientesIniciales: Cliente[] = [
  { cliente_id: 1, nombre: 'Juan Pérez' },
  { cliente_id: 2, nombre: 'María González' },
  { cliente_id: 3, nombre: 'Carlos Rodríguez' },
  { cliente_id: 4, nombre: 'Ana Martínez' },
  { cliente_id: 5, nombre: 'Luis Fernández' },
  { cliente_id: 6, nombre: 'Carmen López' },
  { cliente_id: 7, nombre: 'Roberto Silva' },
  { cliente_id: 8, nombre: 'Elena Morales' },
  { cliente_id: 9, nombre: 'Diego Ramírez' },
  { cliente_id: 10, nombre: 'Patricia Herrera' },
  { cliente_id: 11, nombre: 'Miguel Torres' },
  { cliente_id: 12, nombre: 'Sofía Castro' },
  { cliente_id: 13, nombre: 'Andrés Vargas' },
  { cliente_id: 14, nombre: 'Lucía Mendoza' },
  { cliente_id: 15, nombre: 'Fernando Ruiz' }
];

const categoriasIniciales: Categoria[] = [
  { categoria_id: 1, categoria_nombre: 'Galletitas' },
  { categoria_id: 2, categoria_nombre: 'Bebidas' },
  { categoria_id: 3, categoria_nombre: 'Lácteos' },
  { categoria_id: 4, categoria_nombre: 'Panadería' },
  { categoria_id: 5, categoria_nombre: 'Conservas' },
  { categoria_id: 6, categoria_nombre: 'Snacks' },
  { categoria_id: 7, categoria_nombre: 'Dulces' },
  { categoria_id: 8, categoria_nombre: 'Limpieza' },
  { categoria_id: 9, categoria_nombre: 'Higiene Personal' },
  { categoria_id: 10, categoria_nombre: 'Congelados' }
];

const productosIniciales: Producto[] = [
  // Galletitas
  { producto_id: 1, categoria_id: 1, producto_nombre: 'Oreo Original 117g', precio: 450, activo: 'SI' },
  { producto_id: 2, categoria_id: 1, producto_nombre: 'Pepitos Chocolate 100g', precio: 380, activo: 'SI' },
  { producto_id: 3, categoria_id: 1, producto_nombre: 'Tita Vainilla 168g', precio: 320, activo: 'SI' },
  { producto_id: 4, categoria_id: 1, producto_nombre: 'Chocolinas 170g', precio: 290, activo: 'SI' },
  { producto_id: 5, categoria_id: 1, producto_nombre: 'Criollitas Dulces 200g', precio: 350, activo: 'SI' },
  { producto_id: 6, categoria_id: 1, producto_nombre: 'Sonrisas Frutilla 150g', precio: 280, activo: 'SI' },
  
  // Bebidas
  { producto_id: 7, categoria_id: 2, producto_nombre: 'Coca Cola 500ml', precio: 350, activo: 'SI' },
  { producto_id: 8, categoria_id: 2, producto_nombre: 'Agua Mineral 500ml', precio: 180, activo: 'SI' },
  { producto_id: 9, categoria_id: 2, producto_nombre: 'Jugo Naranja 1L', precio: 420, activo: 'SI' },
  { producto_id: 10, categoria_id: 2, producto_nombre: 'Sprite 500ml', precio: 340, activo: 'SI' },
  { producto_id: 11, categoria_id: 2, producto_nombre: 'Fanta 500ml', precio: 340, activo: 'SI' },
  { producto_id: 12, categoria_id: 2, producto_nombre: 'Agua con Gas 500ml', precio: 200, activo: 'SI' },
  
  // Lácteos
  { producto_id: 13, categoria_id: 3, producto_nombre: 'Leche Entera 1L', precio: 280, activo: 'SI' },
  { producto_id: 14, categoria_id: 3, producto_nombre: 'Yogur Natural 125g', precio: 150, activo: 'SI' },
  { producto_id: 15, categoria_id: 3, producto_nombre: 'Queso Cremoso 200g', precio: 520, activo: 'SI' },
  { producto_id: 16, categoria_id: 3, producto_nombre: 'Manteca 200g', precio: 380, activo: 'SI' },
  { producto_id: 17, categoria_id: 3, producto_nombre: 'Dulce de Leche 400g', precio: 450, activo: 'SI' },
  { producto_id: 18, categoria_id: 3, producto_nombre: 'Crema de Leche 200ml', precio: 320, activo: 'SI' },
  
  // Panadería
  { producto_id: 19, categoria_id: 4, producto_nombre: 'Pan Lactal 500g', precio: 320, activo: 'SI' },
  { producto_id: 20, categoria_id: 4, producto_nombre: 'Medialunas x6', precio: 450, activo: 'SI' },
  { producto_id: 21, categoria_id: 4, producto_nombre: 'Pan Hamburguesa x4', precio: 380, activo: 'SI' },
  { producto_id: 22, categoria_id: 4, producto_nombre: 'Tostadas x20', precio: 280, activo: 'SI' },
  { producto_id: 23, categoria_id: 4, producto_nombre: 'Facturas Surtidas x6', precio: 520, activo: 'SI' },
  
  // Conservas
  { producto_id: 24, categoria_id: 5, producto_nombre: 'Atún en Aceite 170g', precio: 420, activo: 'SI' },
  { producto_id: 25, categoria_id: 5, producto_nombre: 'Tomate Triturado 400g', precio: 280, activo: 'SI' },
  { producto_id: 26, categoria_id: 5, producto_nombre: 'Arvejas en Lata 300g', precio: 250, activo: 'SI' },
  { producto_id: 27, categoria_id: 5, producto_nombre: 'Choclo en Lata 300g', precio: 270, activo: 'SI' },
  { producto_id: 28, categoria_id: 5, producto_nombre: 'Mermelada Durazno 450g', precio: 380, activo: 'SI' },
  
  // Snacks
  { producto_id: 29, categoria_id: 6, producto_nombre: 'Papas Fritas 150g', precio: 320, activo: 'SI' },
  { producto_id: 30, categoria_id: 6, producto_nombre: 'Palitos Salados 100g', precio: 180, activo: 'SI' },
  { producto_id: 31, categoria_id: 6, producto_nombre: 'Maní Salado 200g', precio: 250, activo: 'SI' },
  { producto_id: 32, categoria_id: 6, producto_nombre: 'Chizitos 75g', precio: 220, activo: 'SI' },
  
  // Dulces
  { producto_id: 33, categoria_id: 7, producto_nombre: 'Alfajor Havanna', precio: 180, activo: 'SI' },
  { producto_id: 34, categoria_id: 7, producto_nombre: 'Chocolate Milka 100g', precio: 450, activo: 'SI' },
  { producto_id: 35, categoria_id: 7, producto_nombre: 'Caramelos Sugus x10', precio: 120, activo: 'SI' },
  { producto_id: 36, categoria_id: 7, producto_nombre: 'Chicles Beldent x5', precio: 80, activo: 'SI' },
  
  // Limpieza
  { producto_id: 37, categoria_id: 8, producto_nombre: 'Detergente 500ml', precio: 320, activo: 'SI' },
  { producto_id: 38, categoria_id: 8, producto_nombre: 'Lavandina 1L', precio: 180, activo: 'SI' },
  { producto_id: 39, categoria_id: 8, producto_nombre: 'Esponja Cocina x3', precio: 150, activo: 'SI' },
  { producto_id: 40, categoria_id: 8, producto_nombre: 'Papel Higiénico x4', precio: 280, activo: 'SI' },
  
  // Higiene Personal
  { producto_id: 41, categoria_id: 9, producto_nombre: 'Shampoo 400ml', precio: 450, activo: 'SI' },
  { producto_id: 42, categoria_id: 9, producto_nombre: 'Jabón Tocador x3', precio: 220, activo: 'SI' },
  { producto_id: 43, categoria_id: 9, producto_nombre: 'Pasta Dental 90g', precio: 180, activo: 'SI' },
  
  // Congelados
  { producto_id: 44, categoria_id: 10, producto_nombre: 'Hamburguesas x4', precio: 520, activo: 'SI' },
  { producto_id: 45, categoria_id: 10, producto_nombre: 'Papas Congeladas 1kg', precio: 380, activo: 'SI' },
  { producto_id: 46, categoria_id: 10, producto_nombre: 'Helado 1L', precio: 650, activo: 'SI' }
];

const pedidosIniciales: Pedido[] = [
  {
    pedido_id: 'PED001',
    fecha_hora: new Date(Date.now() - 86400000).toISOString(), // Ayer
    cliente_id: 1,
    cliente_nombre: 'Juan Pérez',
    items_cantidad: 3,
    total: 1180,
    estado: 'CONFIRMADO'
  },
  {
    pedido_id: 'PED002',
    fecha_hora: new Date(Date.now() - 172800000).toISOString(), // Hace 2 días
    cliente_id: 2,
    cliente_nombre: 'María González',
    items_cantidad: 2,
    total: 770,
    estado: 'CONFIRMADO'
  },
  {
    pedido_id: 'PED003',
    fecha_hora: new Date(Date.now() - 259200000).toISOString(), // Hace 3 días
    cliente_id: 3,
    cliente_nombre: 'Carlos Rodríguez',
    items_cantidad: 4,
    total: 1520,
    estado: 'CONFIRMADO'
  },
  {
    pedido_id: 'PED004',
    fecha_hora: new Date(Date.now() - 345600000).toISOString(), // Hace 4 días
    cliente_id: 4,
    cliente_nombre: 'Ana Martínez',
    items_cantidad: 2,
    total: 630,
    estado: 'CONFIRMADO'
  },
  {
    pedido_id: 'PED005',
    fecha_hora: new Date(Date.now() - 432000000).toISOString(), // Hace 5 días
    cliente_id: 5,
    cliente_nombre: 'Luis Fernández',
    items_cantidad: 5,
    total: 2150,
    estado: 'CONFIRMADO'
  },
  {
    pedido_id: 'PED006',
    fecha_hora: new Date().toISOString(), // Hoy
    cliente_id: 1,
    cliente_nombre: 'Juan Pérez',
    items_cantidad: 1,
    total: 450,
    estado: 'BORRADOR'
  },
  {
    pedido_id: 'PED007',
    fecha_hora: new Date(Date.now() - 518400000).toISOString(), // Hace 6 días
    cliente_id: 6,
    cliente_nombre: 'Carmen López',
    items_cantidad: 3,
    total: 980,
    estado: 'CONFIRMADO'
  },
  {
    pedido_id: 'PED008',
    fecha_hora: new Date(Date.now() - 604800000).toISOString(), // Hace 7 días
    cliente_id: 7,
    cliente_nombre: 'Roberto Silva',
    items_cantidad: 2,
    total: 700,
    estado: 'CONFIRMADO'
  },
  {
    pedido_id: 'PED009',
    fecha_hora: new Date(Date.now() - 43200000).toISOString(), // Hace 12 horas
    cliente_id: 8,
    cliente_nombre: 'Elena Morales',
    items_cantidad: 4,
    total: 1680,
    estado: 'CONFIRMADO'
  },
  {
    pedido_id: 'PED010',
    fecha_hora: new Date().toISOString(), // Hoy
    cliente_id: 9,
    cliente_nombre: 'Diego Ramírez',
    items_cantidad: 1,
    total: 320,
    estado: 'BORRADOR'
  }
];

const detallePedidosIniciales: DetallePedido[] = [
  // Pedido PED001
  { detalle_id: 'DET001', pedido_id: 'PED001', producto_id: 1, producto_nombre: 'Oreo Original 117g', categoria_id: 1, cantidad: 2, precio_unitario: 450, importe: 900 },
  { detalle_id: 'DET002', pedido_id: 'PED001', producto_id: 13, producto_nombre: 'Leche Entera 1L', categoria_id: 3, cantidad: 1, precio_unitario: 280, importe: 280 },
  
  // Pedido PED002
  { detalle_id: 'DET003', pedido_id: 'PED002', producto_id: 7, producto_nombre: 'Coca Cola 500ml', categoria_id: 2, cantidad: 1, precio_unitario: 350, importe: 350 },
  { detalle_id: 'DET004', pedido_id: 'PED002', producto_id: 24, producto_nombre: 'Atún en Aceite 170g', categoria_id: 5, cantidad: 1, precio_unitario: 420, importe: 420 },
  
  // Pedido PED003
  { detalle_id: 'DET005', pedido_id: 'PED003', producto_id: 1, producto_nombre: 'Oreo Original 117g', categoria_id: 1, cantidad: 1, precio_unitario: 450, importe: 450 },
  { detalle_id: 'DET006', pedido_id: 'PED003', producto_id: 15, producto_nombre: 'Queso Cremoso 200g', categoria_id: 3, cantidad: 1, precio_unitario: 520, importe: 520 },
  { detalle_id: 'DET007', pedido_id: 'PED003', producto_id: 19, producto_nombre: 'Pan Lactal 500g', categoria_id: 4, cantidad: 1, precio_unitario: 320, importe: 320 },
  { detalle_id: 'DET008', pedido_id: 'PED003', producto_id: 29, producto_nombre: 'Papas Fritas 150g', categoria_id: 6, cantidad: 1, precio_unitario: 320, importe: 320 },
  
  // Más detalles para otros pedidos...
  { detalle_id: 'DET009', pedido_id: 'PED004', producto_id: 2, producto_nombre: 'Pepitos Chocolate 100g', categoria_id: 1, cantidad: 1, precio_unitario: 380, importe: 380 },
  { detalle_id: 'DET010', pedido_id: 'PED004', producto_id: 14, producto_nombre: 'Yogur Natural 125g', categoria_id: 3, cantidad: 2, precio_unitario: 150, importe: 300 },
  
  { detalle_id: 'DET011', pedido_id: 'PED005', producto_id: 33, producto_nombre: 'Alfajor Havanna', categoria_id: 7, cantidad: 5, precio_unitario: 180, importe: 900 },
  { detalle_id: 'DET012', pedido_id: 'PED005', producto_id: 7, producto_nombre: 'Coca Cola 500ml', categoria_id: 2, cantidad: 2, precio_unitario: 350, importe: 700 },
  { detalle_id: 'DET013', pedido_id: 'PED005', producto_id: 15, producto_nombre: 'Queso Cremoso 200g', categoria_id: 3, cantidad: 1, precio_unitario: 520, importe: 520 },
  { detalle_id: 'DET014', pedido_id: 'PED005', producto_id: 46, producto_nombre: 'Helado 1L', categoria_id: 10, cantidad: 1, precio_unitario: 650, importe: 650 },
  
  { detalle_id: 'DET015', pedido_id: 'PED006', producto_id: 1, producto_nombre: 'Oreo Original 117g', categoria_id: 1, cantidad: 1, precio_unitario: 450, importe: 450 },
  
  { detalle_id: 'DET016', pedido_id: 'PED007', producto_id: 20, producto_nombre: 'Medialunas x6', categoria_id: 4, cantidad: 1, precio_unitario: 450, importe: 450 },
  { detalle_id: 'DET017', pedido_id: 'PED007', producto_id: 13, producto_nombre: 'Leche Entera 1L', categoria_id: 3, cantidad: 1, precio_unitario: 280, importe: 280 },
  { detalle_id: 'DET018', pedido_id: 'PED007', producto_id: 29, producto_nombre: 'Papas Fritas 150g', categoria_id: 6, cantidad: 1, precio_unitario: 320, importe: 320 },
  
  { detalle_id: 'DET019', pedido_id: 'PED008', producto_id: 34, producto_nombre: 'Chocolate Milka 100g', categoria_id: 7, cantidad: 1, precio_unitario: 450, importe: 450 },
  { detalle_id: 'DET020', pedido_id: 'PED008', producto_id: 29, producto_nombre: 'Papas Fritas 150g', categoria_id: 6, cantidad: 1, precio_unitario: 320, importe: 320 },
  
  { detalle_id: 'DET021', pedido_id: 'PED009', producto_id: 44, producto_nombre: 'Hamburguesas x4', categoria_id: 10, cantidad: 2, precio_unitario: 520, importe: 1040 },
  { detalle_id: 'DET022', pedido_id: 'PED009', producto_id: 45, producto_nombre: 'Papas Congeladas 1kg', categoria_id: 10, cantidad: 1, precio_unitario: 380, importe: 380 },
  { detalle_id: 'DET023', pedido_id: 'PED009', producto_id: 11, producto_nombre: 'Fanta 500ml', categoria_id: 2, cantidad: 1, precio_unitario: 340, importe: 340 },
  
  { detalle_id: 'DET024', pedido_id: 'PED010', producto_id: 19, producto_nombre: 'Pan Lactal 500g', categoria_id: 4, cantidad: 1, precio_unitario: 320, importe: 320 }
];

export const useData = () => {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciales);
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasIniciales);
  const [productos, setProductos] = useState<Producto[]>(productosIniciales);
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciales);
  const [detallePedidos, setDetallePedidos] = useState<DetallePedido[]>(detallePedidosIniciales);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Función para cargar datos desde la API
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar todos los datos en paralelo
      const [
        clientesRes,
        categoriasRes,
        productosRes,
        pedidosRes,
        detallesRes
      ] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/categorias'),
        fetch('/api/productos'),
        fetch('/api/pedidos'),
        fetch('/api/detalle-pedidos')
      ]);

      // Verificar que todas las respuestas sean exitosas
      if (!clientesRes.ok || !categoriasRes.ok || !productosRes.ok || !pedidosRes.ok || !detallesRes.ok) {
        throw new Error('Error cargando datos del servidor');
      }

      // Parsear los datos
      const [
        clientesData,
        categoriasData,
        productosData,
        pedidosData,
        detallesData
      ] = await Promise.all([
        clientesRes.json(),
        categoriasRes.json(),
        productosRes.json(),
        pedidosRes.json(),
        detallesRes.json()
      ]);

      // Actualizar estados
      setClientes(clientesData.length > 0 ? clientesData : clientesIniciales);
      setCategorias(categoriasData.length > 0 ? categoriasData : categoriasIniciales);
      setProductos(productosData.length > 0 ? productosData : productosIniciales);
      setPedidos(pedidosData.length > 0 ? pedidosData : pedidosIniciales);
      setDetallePedidos(detallesData.length > 0 ? detallesData : detallePedidosIniciales);

      console.log('✅ Datos cargados desde API:', {
        clientes: clientesData.length,
        categorias: categoriasData.length,
        productos: productosData.length,
        pedidos: pedidosData.length,
        detalles: detallesData.length
      });

    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      
      // Usar datos iniciales como fallback
      setClientes(clientesIniciales);
      setCategorias(categoriasIniciales);
      setProductos(productosIniciales);
      setPedidos(pedidosIniciales);
      setDetallePedidos(detallePedidosIniciales);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar datos al montar el componente
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Función para actualizar un pedido
  const updatePedido = useCallback(async (pedidoId: string, updates: Partial<Pedido>) => {
    try {
      // Actualizar localmente primero
      setPedidos(prev => prev.map(p => 
        p.pedido_id === pedidoId ? { ...p, ...updates } : p
      ));

      // TODO: Implementar actualización en el servidor
      console.log('📝 Pedido actualizado:', pedidoId, updates);
      
    } catch (error) {
      console.error('❌ Error actualizando pedido:', error);
      // Recargar datos en caso de error
      loadData();
    }
  }, [loadData]);

  const addPedido = useCallback((pedido: Pedido) => {
    setPedidos(prev => {
      const existingIndex = prev.findIndex(p => p.pedido_id === pedido.pedido_id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = pedido;
        return updated;
      }
      return [...prev, pedido];
    });
  }, []);

  const addDetallePedido = useCallback((detalle: DetallePedido) => {
    setDetallePedidos(prev => [...prev, detalle]);
  }, []);

  return {
    clientes,
    categorias,
    productos,
    pedidos,
    detallePedidos,
    loading,
    error,
    loadData,
    updatePedido,
    addPedido,
    addDetallePedido
  };
};