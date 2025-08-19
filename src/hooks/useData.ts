import { useState, useCallback } from 'react';
import { Cliente, Categoria, Producto, Pedido, DetallePedido } from '../types';
import { googleSheetsService } from '../services/googleSheetsService';

// Datos de ejemplo
const clientesIniciales: Cliente[] = [
  { cliente_id: 1, nombre: 'Juan Pérez' },
  { cliente_id: 2, nombre: 'María González' },
  { cliente_id: 3, nombre: 'Carlos Rodríguez' },
  { cliente_id: 4, nombre: 'Ana Martínez' },
  { cliente_id: 5, nombre: 'Luis Fernández' },
  { cliente_id: 6, nombre: 'Carmen López' },
  { cliente_id: 7, nombre: 'Roberto Silva' },
  { cliente_id: 8, nombre: 'Elena Morales' }
];

const categoriasIniciales: Categoria[] = [
  { categoria_id: 1, categoria_nombre: 'Galletitas' },
  { categoria_id: 2, categoria_nombre: 'Bebidas' },
  { categoria_id: 3, categoria_nombre: 'Lácteos' },
  { categoria_id: 4, categoria_nombre: 'Panadería' },
  { categoria_id: 5, categoria_nombre: 'Conservas' }
];

const productosIniciales: Producto[] = [
  // Galletitas
  { producto_id: 1, categoria_id: 1, producto_nombre: 'Oreo Original 117g', precio: 450, activo: 'SI' },
  { producto_id: 2, categoria_id: 1, producto_nombre: 'Pepitos Chocolate 100g', precio: 380, activo: 'SI' },
  { producto_id: 3, categoria_id: 1, producto_nombre: 'Tita Vainilla 168g', precio: 320, activo: 'SI' },
  { producto_id: 4, categoria_id: 1, producto_nombre: 'Chocolinas 170g', precio: 290, activo: 'SI' },
  
  // Bebidas
  { producto_id: 5, categoria_id: 2, producto_nombre: 'Coca Cola 500ml', precio: 350, activo: 'SI' },
  { producto_id: 6, categoria_id: 2, producto_nombre: 'Agua Mineral 500ml', precio: 180, activo: 'SI' },
  { producto_id: 7, categoria_id: 2, producto_nombre: 'Jugo Naranja 1L', precio: 420, activo: 'SI' },
  { producto_id: 8, categoria_id: 2, producto_nombre: 'Sprite 500ml', precio: 340, activo: 'SI' },
  
  // Lácteos
  { producto_id: 9, categoria_id: 3, producto_nombre: 'Leche Entera 1L', precio: 280, activo: 'SI' },
  { producto_id: 10, categoria_id: 3, producto_nombre: 'Yogur Natural 125g', precio: 150, activo: 'SI' },
  { producto_id: 11, categoria_id: 3, producto_nombre: 'Queso Cremoso 200g', precio: 520, activo: 'SI' },
  { producto_id: 12, categoria_id: 3, producto_nombre: 'Manteca 200g', precio: 380, activo: 'SI' },
  
  // Panadería
  { producto_id: 13, categoria_id: 4, producto_nombre: 'Pan Lactal 500g', precio: 320, activo: 'SI' },
  { producto_id: 14, categoria_id: 4, producto_nombre: 'Medialunas x6', precio: 450, activo: 'SI' },
  { producto_id: 15, categoria_id: 4, producto_nombre: 'Pan Hamburguesa x4', precio: 380, activo: 'SI' },
  
  // Conservas
  { producto_id: 16, categoria_id: 5, producto_nombre: 'Atún en Aceite 170g', precio: 420, activo: 'SI' },
  { producto_id: 17, categoria_id: 5, producto_nombre: 'Tomate Triturado 400g', precio: 280, activo: 'SI' },
  { producto_id: 18, categoria_id: 5, producto_nombre: 'Arvejas en Lata 300g', precio: 250, activo: 'SI' }
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
    fecha_hora: new Date().toISOString(), // Hoy
    cliente_id: 3,
    cliente_nombre: 'Carlos Rodríguez',
    items_cantidad: 1,
    total: 450,
    estado: 'BORRADOR'
  }
];

const detallePedidosIniciales: DetallePedido[] = [
  // Pedido PED001
  {
    detalle_id: 'DET001',
    pedido_id: 'PED001',
    producto_id: 1,
    producto_nombre: 'Oreo Original 117g',
    categoria_id: 1,
    cantidad: 2,
    precio_unitario: 450,
    importe: 900
  },
  {
    detalle_id: 'DET002',
    pedido_id: 'PED001',
    producto_id: 9,
    producto_nombre: 'Leche Entera 1L',
    categoria_id: 3,
    cantidad: 1,
    precio_unitario: 280,
    importe: 280
  },
  
  // Pedido PED002
  {
    detalle_id: 'DET003',
    pedido_id: 'PED002',
    producto_id: 5,
    producto_nombre: 'Coca Cola 500ml',
    categoria_id: 2,
    cantidad: 1,
    precio_unitario: 350,
    importe: 350
  },
  {
    detalle_id: 'DET004',
    pedido_id: 'PED002',
    producto_id: 16,
    producto_nombre: 'Atún en Aceite 170g',
    categoria_id: 5,
    cantidad: 1,
    precio_unitario: 420,
    importe: 420
  },
  
  // Pedido PED003
  {
    detalle_id: 'DET005',
    pedido_id: 'PED003',
    producto_id: 1,
    producto_nombre: 'Oreo Original 117g',
    categoria_id: 1,
    cantidad: 1,
    precio_unitario: 450,
    importe: 450
  }
];

export const useData = () => {
  const [clientes] = useState<Cliente[]>(clientesIniciales);
  const [categorias] = useState<Categoria[]>(categoriasIniciales);
  const [productos] = useState<Producto[]>(productosIniciales);
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciales);
  const [detallePedidos, setDetallePedidos] = useState<DetallePedido[]>(detallePedidosIniciales);

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
    addPedido,
    addDetallePedido
  };
};