// Tipos principales del dominio
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
  activo: string;
}

export interface Pedido {
  pedido_id: string;
  fecha_hora: string;
  cliente_id: number;
  cliente_nombre: string;
  items_cantidad: number;
  total: number;
  estado: string;
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

// Tipos para Google Sheets
export interface SheetData {
  [key: string]: string | number;
}

export interface SheetResponse {
  data: {
    values?: string[][];
  };
}

// Tipos para el servidor
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  telegram_configured: boolean;
  sheets_configured: boolean;
}

// Tipos para datos en memoria
export interface ClienteMemoria {
  cliente_id: number;
  nombre: string;
}

export interface CategoriaMemoria {
  categoria_id: number;
  categoria_nombre: string;
}

export interface ProductoMemoria {
  producto_id: number;
  categoria_id: number;
  producto_nombre: string;
  precio: number;
  activo: string;
}

export interface PedidoMemoria {
  pedido_id: string;
  fecha_hora: string;
  cliente_id: number;
  cliente_nombre: string;
  items_cantidad: number;
  total: number;
  estado: string;
}

export interface DetallePedidoMemoria {
  detalle_id: string;
  pedido_id: string;
  producto_id: number;
  producto_nombre: string;
  categoria_id: number;
  cantidad: number;
  precio_unitario: number;
  importe: number;
}