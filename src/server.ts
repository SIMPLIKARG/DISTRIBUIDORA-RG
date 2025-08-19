import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { googleSheetsService } from './services/googleSheetsService.js';
import { telegramService } from './services/telegramService.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Logging mejorado para Railway
const log = (message: string, level: 'info' | 'error' | 'warn' = 'info') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
};

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: NODE_ENV === 'production' 
    ? [process.env.RAILWAY_STATIC_URL, 'https://*.railway.app'].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging para Railway
app.use((req, res, next) => {
  log(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Servir archivos estáticos
const staticPath = NODE_ENV === 'production' 
  ? path.join(__dirname, '../dist')
  : path.join(__dirname, '../../dist');

app.use(express.static(staticPath));

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// Ruta de información del servicio
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Distribuidora Bot API',
    version: '1.0.0',
    environment: NODE_ENV,
    railway_url: process.env.RAILWAY_STATIC_URL,
    features: [
      'Telegram Bot Integration',
      'Google Sheets Integration', 
      'Order Management',
      'Dashboard Analytics'
    ]
  });
});

// Ruta para probar Google Sheets
app.get('/api/test/sheets', async (req, res) => {
  try {
    log('Testing Google Sheets connection...');
    const isConnected = await googleSheetsService.testConnection();
    if (isConnected) {
      const clientes = await googleSheetsService.getClientes();
      log(`Google Sheets connected successfully. ${clientes.length} clients found.`);
      res.json({ 
        success: true, 
        message: 'Conexión exitosa con Google Sheets',
        clientesCount: clientes.length,
        timestamp: new Date().toISOString()
      });
    } else {
      log('Google Sheets connection failed', 'warn');
      res.status(500).json({ 
        success: false, 
        message: 'Error de conexión con Google Sheets',
        fallback: 'Using local data'
      });
    }
  } catch (error) {
    log(`Google Sheets error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    res.status(500).json({ 
      success: false, 
      message: 'Error al probar Google Sheets',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Ruta para obtener datos
app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await googleSheetsService.getClientes();
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

app.get('/api/categorias', async (req, res) => {
  try {
    const categorias = await googleSheetsService.getCategorias();
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

app.get('/api/productos', async (req, res) => {
  try {
    const productos = await googleSheetsService.getProductos();
    res.json(productos);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

app.get('/api/pedidos', async (req, res) => {
  try {
    const pedidos = await googleSheetsService.getPedidos();
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

// Webhook de Telegram
app.post('/webhook', async (req, res) => {
  try {
    log('Telegram webhook received');
    const update = req.body;
    log(`Webhook data: ${JSON.stringify(update)}`);
    
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      
      log(`Processing message from chat ${chatId}: ${text}`);
      
      await telegramService.sendMessage({
        chat_id: chatId,
        text: `Recibido: ${text}`,
      });
      
      log('Response sent successfully');
    }
    
    res.status(200).json({ ok: true });
  } catch (error) {
    log(`Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para configurar webhook
app.post('/api/setup-webhook', async (req, res) => {
  try {
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || `${process.env.RAILWAY_STATIC_URL}/webhook`;
    if (!webhookUrl) {
      return res.status(400).json({ 
        error: 'No se pudo determinar la URL del webhook' 
      });
    }
    
    log(`Setting up webhook: ${webhookUrl}`);
    const result = await telegramService.setWebhook(webhookUrl);
    log('Webhook configured successfully');
    res.json(result);
  } catch (error) {
    log(`Webhook setup error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

// Servir la aplicación React para todas las rutas no API
app.get('*', (req, res) => {
  // Evitar servir el SPA para rutas de API
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhook')) {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  
  const indexPath = NODE_ENV === 'production'
    ? path.join(__dirname, '../dist/index.html')
    : path.join(__dirname, '../../dist/index.html');
    
  res.sendFile(indexPath);
});

// Manejo de errores global
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  log(`Unhandled error: ${error.message}`, 'error');
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  log(`🚀 Servidor iniciado en puerto ${PORT}`);
  log(`📊 Dashboard: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}`);
  log(`🤖 Webhook: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/webhook`);
  log(`🏥 Health: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/health`);
  log(`🌍 Environment: ${NODE_ENV}`);
});

// Graceful shutdown para Railway
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down gracefully');
  server.close(() => {
    log('Process terminated');
    process.exit(0);
  });
});

export default app;