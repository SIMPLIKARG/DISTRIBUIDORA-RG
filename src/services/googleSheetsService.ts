import { sheets, SPREADSHEET_ID, SHEET_RANGES } from '../config/google-sheets';
import { Cliente, Categoria, Producto, Pedido, DetallePedido } from '../types';

export class GoogleSheetsService {
  private static instance: GoogleSheetsService;
  
  private constructor() {}
  
  public static getInstance(): GoogleSheetsService {
    if (!GoogleSheetsService.instance) {
      GoogleSheetsService.instance = new GoogleSheetsService();
    }
    return GoogleSheetsService.instance;
  }

  // Obtener todos los clientes
  async getClientes(): Promise<Cliente[]> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RANGES.CLIENTES,
      });

      const rows = response.data.values || [];
      // Saltar la primera fila (encabezados)
      return rows.slice(1).map(row => ({
        cliente_id: parseInt(row[0]) || 0,
        nombre: row[1] || ''
      }));
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      throw new Error('No se pudieron obtener los clientes de Google Sheets');
    }
  }

  // Obtener todas las categorías
  async getCategorias(): Promise<Categoria[]> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RANGES.CATEGORIAS,
      });

      const rows = response.data.values || [];
      return rows.slice(1).map(row => ({
        categoria_id: parseInt(row[0]) || 0,
        categoria_nombre: row[1] || ''
      }));
    } catch (error) {
      console.error('Error obteniendo categorías:', error);
      throw new Error('No se pudieron obtener las categorías de Google Sheets');
    }
  }

  // Obtener todos los productos
  async getProductos(): Promise<Producto[]> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RANGES.PRODUCTOS,
      });

      const rows = response.data.values || [];
      return rows.slice(1).map(row => ({
        producto_id: parseInt(row[0]) || 0,
        categoria_id: parseInt(row[1]) || 0,
        producto_nombre: row[2] || '',
        precio: parseFloat(row[3]) || 0,
        activo: (row[4] === 'SI' ? 'SI' : 'NO') as 'SI' | 'NO'
      }));
    } catch (error) {
      console.error('Error obteniendo productos:', error);
      throw new Error('No se pudieron obtener los productos de Google Sheets');
    }
  }

  // Obtener todos los pedidos
  async getPedidos(): Promise<Pedido[]> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RANGES.PEDIDOS,
      });

      const rows = response.data.values || [];
      return rows.slice(1).map(row => ({
        pedido_id: row[0] || '',
        fecha_hora: row[1] || '',
        cliente_id: parseInt(row[2]) || 0,
        cliente_nombre: row[3] || '',
        items_cantidad: parseInt(row[4]) || 0,
        total: parseFloat(row[5]) || 0,
        estado: (row[6] === 'CONFIRMADO' ? 'CONFIRMADO' : 'BORRADOR') as 'BORRADOR' | 'CONFIRMADO'
      }));
    } catch (error) {
      console.error('Error obteniendo pedidos:', error);
      throw new Error('No se pudieron obtener los pedidos de Google Sheets');
    }
  }

  // Obtener detalles de pedidos
  async getDetallePedidos(): Promise<DetallePedido[]> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RANGES.DETALLE_PEDIDOS,
      });

      const rows = response.data.values || [];
      return rows.slice(1).map(row => ({
        detalle_id: row[0] || '',
        pedido_id: row[1] || '',
        producto_id: parseInt(row[2]) || 0,
        producto_nombre: row[3] || '',
        categoria_id: parseInt(row[4]) || 0,
        cantidad: parseFloat(row[5]) || 0,
        precio_unitario: parseFloat(row[6]) || 0,
        importe: parseFloat(row[7]) || 0
      }));
    } catch (error) {
      console.error('Error obteniendo detalle de pedidos:', error);
      throw new Error('No se pudieron obtener los detalles de pedidos de Google Sheets');
    }
  }

  // Guardar un nuevo pedido
  async savePedido(pedido: Pedido): Promise<void> {
    try {
      const values = [[
        pedido.pedido_id,
        pedido.fecha_hora,
        pedido.cliente_id,
        pedido.cliente_nombre,
        pedido.items_cantidad,
        pedido.total,
        pedido.estado
      ]];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RANGES.PEDIDOS,
        valueInputOption: 'RAW',
        requestBody: { values }
      });

      console.log('Pedido guardado exitosamente:', pedido.pedido_id);
    } catch (error) {
      console.error('Error guardando pedido:', error);
      throw new Error('No se pudo guardar el pedido en Google Sheets');
    }
  }

  // Actualizar un pedido existente
  async updatePedido(pedido: Pedido): Promise<void> {
    try {
      // Primero encontrar la fila del pedido
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RANGES.PEDIDOS,
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row, index) => 
        index > 0 && row[0] === pedido.pedido_id
      );

      if (rowIndex === -1) {
        throw new Error('Pedido no encontrado');
      }

      // Actualizar la fila específica (rowIndex + 1 porque las filas empiezan en 1)
      const range = `Pedidos!A${rowIndex + 1}:G${rowIndex + 1}`;
      const values = [[
        pedido.pedido_id,
        pedido.fecha_hora,
        pedido.cliente_id,
        pedido.cliente_nombre,
        pedido.items_cantidad,
        pedido.total,
        pedido.estado
      ]];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        requestBody: { values }
      });

      console.log('Pedido actualizado exitosamente:', pedido.pedido_id);
    } catch (error) {
      console.error('Error actualizando pedido:', error);
      throw new Error('No se pudo actualizar el pedido en Google Sheets');
    }
  }

  // Guardar detalle de pedido
  async saveDetallePedido(detalle: DetallePedido): Promise<void> {
    try {
      const values = [[
        detalle.detalle_id,
        detalle.pedido_id,
        detalle.producto_id,
        detalle.producto_nombre,
        detalle.categoria_id,
        detalle.cantidad,
        detalle.precio_unitario,
        detalle.importe
      ]];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RANGES.DETALLE_PEDIDOS,
        valueInputOption: 'RAW',
        requestBody: { values }
      });

      console.log('Detalle de pedido guardado exitosamente:', detalle.detalle_id);
    } catch (error) {
      console.error('Error guardando detalle de pedido:', error);
      throw new Error('No se pudo guardar el detalle del pedido en Google Sheets');
    }
  }

  // Método para probar la conexión
  async testConnection(): Promise<boolean> {
    try {
      if (!SPREADSHEET_ID) {
        console.log('⚠️  GOOGLE_SHEETS_ID no configurado - usando datos locales');
        return false;
      }
      
      const response = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
      });
      
      console.log('Conexión exitosa con Google Sheets:', response.data.properties?.title);
      return true;
    } catch (error) {
      console.log('⚠️  Google Sheets no disponible - usando datos locales');
      return false;
    }
  }
}

export const googleSheetsService = GoogleSheetsService.getInstance();