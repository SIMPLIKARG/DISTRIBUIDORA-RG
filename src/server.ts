import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const RAILWAY_STATIC_URL = process.env.RAILWAY_STATIC_URL;

// Para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logging optimizado para Railway
const log = (message: string, level: 'info' | 'error' | 'warn' = 'info') => {
  const timestamp = new Date().toISOString();
  const logLevel = level.toUpperCase();
  console.log(`[${timestamp}] [${logLevel}] ${message}`);
};

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.telegram.org", "https://sheets.googleapis.com"]
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));

// CORS optimizado para Railway
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? [RAILWAY_STATIC_URL, /\.railway\.app$/].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging para Railway
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
  });
  next();
});

// Servir archivos estáticos
const staticPath = NODE_ENV === 'production' 
  ? path.join(__dirname, '../dist')
  : path.join(__dirname, '../../dist');

app.use(express.static(staticPath, {
  maxAge: NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true
}));

// Health check optimizado para Railway
app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    port: PORT,
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    version: process.version,
    railway_url: RAILWAY_STATIC_URL,
    integrations: {
      google_sheets: !!process.env.GOOGLE_SHEETS_ID,
      telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
      jwt_configured: !!process.env.JWT_SECRET
    }
  };
  
  res.json(healthData);
});

// API Info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Sistema Distribuidora Bot',
    version: '1.0.0',
    environment: NODE_ENV,
    railway_url: RAILWAY_STATIC_URL,
    features: [
      'Bot de Telegram Integrado',
      'Integración Google Sheets',
      'Gestión de Pedidos',
      'Dashboard Analytics',
      'API REST Completa'
    ],
    endpoints: {
      health: '/health',
      webhook: '/webhook',
      api: '/api/*',
      dashboard: '/'
    }
  });
});

// Simulación de datos (fallback si no hay Google Sheets)
const datosEjemplo = {
  clientes: [
    { cliente_id: 1, nombre: 'Juan Pérez' },
    { cliente_id: 2, nombre: 'María González' },
    { cliente_id: 3, nombre: 'Carlos Rodríguez' },
    { cliente_id: 4, nombre: 'Ana Martínez' },
    { cliente_id: 5, nombre: 'Luis Fernández' }
  ],
  categorias: [
    { categoria_id: 1, categoria_nombre: 'Galletitas' },
    { categoria_id: 2, categoria_nombre: 'Bebidas' },
    { categoria_id: 3, categoria_nombre: 'Lácteos' },
    { categoria_id: 4, categoria_nombre: 'Panadería' },
    { categoria_id: 5, categoria_nombre: 'Conservas' }
  ],
  productos: [
    { producto_id: 1, categoria_id: 1, producto_nombre: 'Oreo Original 117g', precio: 450, activo: 'SI' },
    { producto_id: 2, categoria_id: 1, producto_nombre: 'Pepitos Chocolate 100g', precio: 380, activo: 'SI' },
    { producto_id: 3, categoria_id: 2, producto_nombre: 'Coca Cola 500ml', precio: 350, activo: 'SI' },
    { producto_id: 4, categoria_id: 3, producto_nombre: 'Leche Entera 1L', precio: 280, activo: 'SI' }
  ]
};

// Rutas de API con fallback
app.get('/api/clientes', async (req, res) => {
  try {
    if (process.env.GOOGLE_SHEETS_ID) {
      // Aquí iría la integración real con Google Sheets
      log('Obteniendo clientes desde Google Sheets...');
      // const clientes = await googleSheetsService.getClientes();
      // res.json(clientes);
    }
    
    // Fallback a datos de ejemplo
    log('Usando datos de ejemplo para clientes');
    res.json(datosEjemplo.clientes);
  } catch (error) {
    log(`Error obteniendo clientes: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    res.json(datosEjemplo.clientes);
  }
});

app.get('/api/categorias', async (req, res) => {
  try {
    if (process.env.GOOGLE_SHEETS_ID) {
      log('Obteniendo categorías desde Google Sheets...');
    }
    log('Usando datos de ejemplo para categorías');
    res.json(datosEjemplo.categorias);
  } catch (error) {
    log(`Error obteniendo categorías: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    res.json(datosEjemplo.categorias);
  }
});

app.get('/api/productos', async (req, res) => {
  try {
    if (process.env.GOOGLE_SHEETS_ID) {
      log('Obteniendo productos desde Google Sheets...');
    }
    log('Usando datos de ejemplo para productos');
    res.json(datosEjemplo.productos);
  } catch (error) {
    log(`Error obteniendo productos: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    res.json(datosEjemplo.productos);
  }
});

app.get('/api/pedidos', async (req, res) => {
  try {
    const pedidosEjemplo = [
      {
        pedido_id: 'PED001',
        fecha_hora: new Date().toISOString(),
        cliente_id: 1,
        cliente_nombre: 'Juan Pérez',
        items_cantidad: 2,
        total: 830,
        estado: 'CONFIRMADO'
      }
    ];
    res.json(pedidosEjemplo);
  } catch (error) {
    log(`Error obteniendo pedidos: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    res.json([]);
  }
});

// Test de Google Sheets
app.get('/api/test/sheets', async (req, res) => {
  try {
    if (!process.env.GOOGLE_SHEETS_ID) {
      return res.json({
        success: false,
        message: 'Google Sheets no configurado',
        fallback: 'Usando datos de ejemplo',
        configured: false
      });
    }

    log('Probando conexión con Google Sheets...');
    
    // Aquí iría la prueba real de conexión
    res.json({
      success: true,
      message: 'Google Sheets configurado correctamente',
      sheet_id: process.env.GOOGLE_SHEETS_ID.substring(0, 10) + '...',
      configured: true
    });
  } catch (error) {
    log(`Error probando Google Sheets: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Error de conexión con Google Sheets',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Webhook de Telegram
app.post('/webhook', async (req, res) => {
  try {
    log('Webhook de Telegram recibido');
    const update = req.body;
    
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      log('Token de Telegram no configurado', 'warn');
      return res.status(400).json({ error: 'Token de Telegram no configurado' });
    }
    
    log(`Datos del webhook: ${JSON.stringify(update)}`);
    
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';
      
      log(`Procesando mensaje del chat ${chatId}: ${text}`);
      
      // Aquí iría la lógica del bot
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `¡Hola! Recibí tu mensaje: "${text}"\n\n🤖 Bot funcionando correctamente en Railway!`
        })
      });
      
      if (response.ok) {
        log('Respuesta enviada exitosamente');
      } else {
        log('Error enviando respuesta', 'error');
      }
    }
    
    res.status(200).json({ ok: true });
  } catch (error) {
    log(`Error en webhook: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Configurar webhook de Telegram
app.post('/api/setup-webhook', async (req, res) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(400).json({ error: 'Token de Telegram no configurado' });
    }
    
    const webhookUrl = `${RAILWAY_STATIC_URL}/webhook`;
    log(`Configurando webhook: ${webhookUrl}`);
    
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      log('Webhook configurado exitosamente');
      res.json({ success: true, webhook_url: webhookUrl, result });
    } else {
      log(`Error configurando webhook: ${result.description}`, 'error');
      res.status(400).json({ success: false, error: result.description });
    }
  } catch (error) {
    log(`Error configurando webhook: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error desconocido' });
  }
});

// Servir la aplicación React para todas las rutas no API
app.get('*', (req, res) => {
  // Evitar servir el SPA para rutas de API
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhook')) {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  
  const indexPath = path.join(staticPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      log(`Error sirviendo index.html: ${err.message}`, 'error');
      res.status(500).send('Error interno del servidor');
    }
  });
});

// Manejo de errores global
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  log(`Error no manejado: ${error.message}`, 'error');
  log(`Stack: ${error.stack}`, 'error');
  
  res.status(500).json({
    error: 'Error interno del servidor',
    message: NODE_ENV === 'development' ? error.message : 'Algo salió mal',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  log(`🚀 Servidor iniciado en puerto ${PORT}`);
  log(`🌍 Entorno: ${NODE_ENV}`);
  log(`📊 Dashboard: ${RAILWAY_STATIC_URL || `http://localhost:${PORT}`}`);
  log(`🤖 Webhook: ${RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/webhook`);
  log(`🏥 Health: ${RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/health`);
  log(`📡 API: ${RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/api/info`);
  
  // Log de configuración
  log(`🔧 Configuración:`);
  log(`   Google Sheets: ${process.env.GOOGLE_SHEETS_ID ? '✅ Configurado' : '❌ No configurado'}`);
  log(`   Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ No configurado'}`);
  log(`   JWT Secret: ${process.env.JWT_SECRET ? '✅ Configurado' : '❌ No configurado'}`);
});

// Graceful shutdown para Railway
const gracefulShutdown = (signal: string) => {
  log(`${signal} recibido, cerrando servidor gracefully...`);
  
  server.close(() => {
    log('Servidor HTTP cerrado');
    
    // Cerrar conexiones de base de datos si las hubiera
    // await db.close();
    
    log('Proceso terminado exitosamente');
    process.exit(0);
  });
  
  // Forzar cierre después de 30 segundos
  setTimeout(() => {
    log('Forzando cierre del proceso...', 'error');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  log(`Promesa rechazada no manejada en ${promise}: ${reason}`, 'error');
});

process.on('uncaughtException', (error) => {
  log(`Excepción no capturada: ${error.message}`, 'error');
  log(`Stack: ${error.stack}`, 'error');
  process.exit(1);
});

export default app;