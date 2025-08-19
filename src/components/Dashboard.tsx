import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';
import { google, sheets_v4 } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// Middleware
const corsOrigins: (string | RegExp)[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  /^https:\/\/.*\.railway\.app$/,
  /^https:\/\/.*\.vercel\.app$/
].filter((origin): origin is string | RegExp => origin !== undefined);

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());

// Servir archivos estáticos del build de Vite
app.use(express.static('dist'));

// Configuración de Google Sheets
let sheets: sheets_v4.Sheets | null = null;
let SPREADSHEET_ID: string | null = null;

// Inicializar Google Sheets si las credenciales están disponibles
if (process.env.GOOGLE_SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheets = google.sheets({ version: 'v4', auth });
    SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
    console.log('✅ Google Sheets configurado correctamente');
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error configurando Google Sheets:', error.message);
    } else {
      console.error('❌ Error configurando Google Sheets:', error);
    }
  }
} else {
  console.log('⚠️  Google Sheets no configurado - usando datos en memoria');
}

// Tipos para datos en memoria
interface ClienteMemoria {
  cliente_id: number;
  nombre: string;
}

interface CategoriaMemoria {
  categoria_id: number;
  categoria_nombre: string;
}

interface ProductoMemoria {
  producto_id: number;
  categoria_id: number;
  producto_nombre: string;
  precio: number;
  activo: string;
}

interface PedidoMemoria {
  pedido_id: string;
  fecha_hora: string;
  cliente_id: number;
  cliente_nombre: string;
  items_cantidad: number;
  total: number;
  estado: string;
}

interface DetallePedidoMemoria {
  detalle_id: string;
  pedido_id: string;
  producto_id: number;
  producto_nombre: string;
  categoria_id: number;
  cantidad: number;
  precio_unitario: number;
  importe: number;
}

// Datos en memoria (fallback si no hay Google Sheets)
let clientesMemoria: ClienteMemoria[] = [
  { cliente_id: 1, nombre: 'Juan Pérez' },
  { cliente_id: 2, nombre: 'María González' },
  { cliente_id: 3, nombre: 'Carlos Rodríguez' },
  { cliente_id: 4, nombre: 'Ana Martínez' },
  { cliente_id: 5, nombre: 'Luis Fernández' },
  { cliente_id: 6, nombre: 'Carmen López' },
  { cliente_id: 7, nombre: 'Roberto Silva' },
  { cliente_id: 8, nombre: 'Elena Morales' }
];

let categoriasMemoria: CategoriaMemoria[] = [
  { categoria_id: 1, categoria_nombre: 'Galletitas' },
  { categoria_id: 2, categoria_nombre: 'Bebidas' },
  { categoria_id: 3, categoria_nombre: 'Lácteos' },
  { categoria_id: 4, categoria_nombre: 'Panadería' },
  { categoria_id: 5, categoria_nombre: 'Conservas' }
];

let productosMemoria: ProductoMemoria[] = [
  { producto_id: 1, categoria_id: 1, producto_nombre: 'Oreo Original 117g', precio: 450, activo: 'SI' },
  { producto_id: 2, categoria_id: 1, producto_nombre: 'Pepitos Chocolate 100g', precio: 380, activo: 'SI' },
  { producto_id: 3, categoria_id: 1, producto_nombre: 'Tita Vainilla 168g', precio: 320, activo: 'SI' },
  { producto_id: 4, categoria_id: 2, producto_nombre: 'Coca Cola 500ml', precio: 350, activo: 'SI' },
  { producto_id: 5, categoria_id: 2, producto_nombre: 'Agua Mineral 500ml', precio: 180, activo: 'SI' },
  { producto_id: 6, categoria_id: 2, producto_nombre: 'Sprite 500ml', precio: 340, activo: 'SI' },
  { producto_id: 7, categoria_id: 3, producto_nombre: 'Leche Entera 1L', precio: 280, activo: 'SI' },
  { producto_id: 8, categoria_id: 3, producto_nombre: 'Yogur Natural 125g', precio: 150, activo: 'SI' },
  { producto_id: 9, categoria_id: 3, producto_nombre: 'Queso Cremoso 200g', precio: 520, activo: 'SI' },
  { producto_id: 10, categoria_id: 4, producto_nombre: 'Pan Lactal 500g', precio: 320, activo: 'SI' },
  { producto_id: 11, categoria_id: 4, producto_nombre: 'Medialunas x6', precio: 450, activo: 'SI' },
  { producto_id: 12, categoria_id: 5, producto_nombre: 'Atún en Aceite 170g', precio: 420, activo: 'SI' }
];

let pedidosMemoria: PedidoMemoria[] = [];
let detallePedidosMemoria: DetallePedidoMemoria[] = [];

// Funciones para Google Sheets
async function getDataFromSheet(sheetName: string): Promise<Record<string, string | number>[]> {
  if (!sheets || !SPREADSHEET_ID) {
    console.log(`⚠️  Usando datos en memoria para ${sheetName}`);
    switch (sheetName) {
      case 'Clientes': return clientesMemoria;
      case 'Categorias': return categoriasMemoria;
      case 'Productos': return productosMemoria;
      case 'Pedidos': return pedidosMemoria;
      case 'DetallePedidos': return detallePedidosMemoria;
      default: return [];
    }
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const headers = rows[0];
    const data = rows.slice(1).map((row: string[]) => {
      const obj: Record<string, string | number> = {};
      headers.forEach((header, index) => {
        let value = row[index] || '';
        
        // Convertir números
        if (header.includes('id') || header === 'precio' || header === 'cantidad' || 
            header === 'precio_unitario' || header === 'importe' || header === 'total' || 
            header === 'items_cantidad') {
          value = parseFloat(value) || 0;
        }
        
        obj[header] = value;
      });
      return obj;
    });

    console.log(`✅ Obtenidos ${data.length} registros de ${sheetName}`);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error obteniendo datos de ${sheetName}:`, error.message);
    } else {
      console.error(`❌ Error obteniendo datos de ${sheetName}:`, error);
    }
    // Fallback a datos en memoria
    switch (sheetName) {
      case 'Clientes': return clientesMemoria;
      case 'Categorias': return categoriasMemoria;
      case 'Productos': return productosMemoria;
      case 'Pedidos': return pedidosMemoria;
      case 'DetallePedidos': return detallePedidosMemoria;
      default: return [];
    }
  }
}

async function appendToSheet(sheetName: string, data: Record<string, string | number>): Promise<void> {
  if (!sheets || !SPREADSHEET_ID) {
    console.log(`⚠️  Guardando en memoria: ${sheetName}`);
    switch (sheetName) {
      case 'Pedidos':
        pedidosMemoria.push(data as PedidoMemoria);
        break;
      case 'DetallePedidos':
        detallePedidosMemoria.push(data as DetallePedidoMemoria);
        break;
    }
    return;
  }

  try {
    const values = Object.values(data);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [values],
      },
    });
    console.log(`✅ Datos guardados en ${sheetName}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error guardando en ${sheetName}:`, error.message);
    } else {
      console.error(`❌ Error guardando en ${sheetName}:`, error);
    }
    // Fallback a memoria
    switch (sheetName) {
      case 'Pedidos':
        pedidosMemoria.push(data as PedidoMemoria);
        break;
      case 'DetallePedidos':
        detallePedidosMemoria.push(data as DetallePedidoMemoria);
        break;
    }
  }
}

// Rutas API
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Sistema Distribuidora API',
    version: '2.0.0',
    status: 'OK',
    timestamp: new Date().toISOString(),
    features: {
      telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
      google_sheets: !!sheets,
      webhook_configured: !!process.env.RAILWAY_STATIC_URL
    },
    endpoints: ['/api/clientes', '/api/productos', '/api/pedidos', '/webhook', '/health']
  });
});

app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await getDataFromSheet('Clientes');
    res.json(clientes);
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.status(500).json({ error: 'Error obteniendo clientes' });
  }
});

app.get('/api/categorias', async (req, res) => {
  try {
    const categorias = await getDataFromSheet('Categorias');
    res.json(categorias);
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ error: 'Error obteniendo categorías' });
  }
});

app.get('/api/productos', async (req, res) => {
  try {
    const productos = await getDataFromSheet('Productos');
    res.json(productos);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ error: 'Error obteniendo productos' });
  }
});

app.get('/api/pedidos', async (req, res) => {
  try {
    const pedidos = await getDataFromSheet('Pedidos');
    res.json(pedidos);
  } catch (error) {
    console.error('Error obteniendo pedidos:', error);
    res.status(500).json({ error: 'Error obteniendo pedidos' });
  }
});

app.get('/api/detalle-pedidos', async (req, res) => {
  try {
    const detalles = await getDataFromSheet('DetallePedidos');
    res.json(detalles);
  } catch (error) {
    console.error('Error obteniendo detalles:', error);
    res.status(500).json({ error: 'Error obteniendo detalles' });
  }
});

// Actualizar estado de pedido
app.put('/api/pedidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado }: { estado: string } = req.body;
    
    // En memoria, actualizar el pedido
    const pedidoIndex = pedidosMemoria.findIndex(p => p.pedido_id === id);
    if (pedidoIndex !== -1) {
      pedidosMemoria[pedidoIndex].estado = estado;
      res.json({ success: true, message: 'Pedido actualizado' });
    } else {
      res.status(404).json({ error: 'Pedido no encontrado' });
    }
  } catch (error) {
    console.error('Error actualizando pedido:', error);
    res.status(500).json({ error: 'Error actualizando pedido' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    telegram_configured: !!process.env.TELEGRAM_BOT_TOKEN,
    sheets_configured: !!sheets
  });
});

// Test endpoint para Google Sheets
app.get('/api/test/sheets', async (req, res) => {
  if (!sheets || !SPREADSHEET_ID) {
    return res.json({
      status: 'NOT_CONFIGURED',
      message: 'Google Sheets no configurado - usando datos en memoria',
      using_memory: true
    });
  }

  try {
    const clientes = await getDataFromSheet('Clientes');
    res.json({
      status: 'OK',
      message: 'Google Sheets funcionando correctamente',
      clientes_count: clientes.length,
      sample_data: clientes.slice(0, 3)
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Servir la aplicación React para todas las rutas no API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ========================================');
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log('🚀 ========================================');
  console.log(`🌐 Health check: /health`);
  console.log(`📊 API Info: /api/info`);
  console.log(`🧪 Test Sheets: /api/test/sheets`);
  console.log('🚀 ========================================');
});