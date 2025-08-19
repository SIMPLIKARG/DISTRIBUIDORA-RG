export interface Cliente {
  cliente_id: number;
  nombre: string;
}

export interface Categoria {
  categoria_id: number;
  categoria_nombre: string;
}

export interface Producto {
  producto_id: number;
  categoria_id: number;
  producto_nombre: string;
  precio: number;
  activo: 'SI' | 'NO';
}

export interface Pedido {
  pedido_id: string;
  fecha_hora: string;
  cliente_id: number;
  cliente_nombre: string;
  items_cantidad: number;
  total: number;
  estado: 'BORRADOR' | 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO';
}

export interface DetallePedido {
  detalle_id: string;
  pedido_id: string;
  producto_id: number;
  producto_nombre: string;
  categoria_id: number;
  cantidad: number;
  precio_unitario: number;
  importe: number;
}

export interface Message {
  type: 'bot' | 'user';
  text: string;
  timestamp: number;
  buttons?: string[];
  options?: string[];
}