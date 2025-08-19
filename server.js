const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del build de Vite
app.use(express.static('dist'));

// Configuración de Google Sheets
let sheets = null;
let SPREADSHEET_ID = null;

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
    console.error('❌ Error configurando Google Sheets:', error.message);
  }
} else {
  console.log('⚠️  Google Sheets no configurado - usando datos en memoria');
}

// Datos en memoria (fallback si no hay Google Sheets)
let clientesMemoria = [
  { cliente_id: 1, nombre: 'Juan Pérez' },
  { cliente_id: 2, nombre: 'María González' },
  { cliente_id: 3, nombre: 'Carlos Rodríguez' },
  { cliente_id: 4, nombre: 'Ana Martínez' },
  { cliente_id: 5, nombre: 'Luis Fernández' },
  { cliente_id: 6, nombre: 'Carmen López' },
  { cliente_id: 7, nombre: 'Roberto Silva' },
  { cliente_id: 8, nombre: 'Elena Morales' }
];

let categoriasMemoria = [
  { categoria_id: 1, categoria_nombre: 'Galletitas' },
  { categoria_id: 2, categoria_nombre: 'Bebidas' },
  { categoria_id: 3, categoria_nombre: 'Lácteos' },
  { categoria_id: 4, categoria_nombre: 'Panadería' },
  { categoria_id: 5, categoria_nombre: 'Conservas' }
];

let productosMemoria = [
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

let pedidosMemoria = [];
let detallePedidosMemoria = [];

// Funciones para Google Sheets
async function getDataFromSheet(sheetName) {
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
    const data = rows.slice(1).map(row => {
      const obj = {};
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
    console.error(`❌ Error obteniendo datos de ${sheetName}:`, error.message);
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

async function appendToSheet(sheetName, data) {
  if (!sheets || !SPREADSHEET_ID) {
    console.log(`⚠️  Guardando en memoria: ${sheetName}`);
    switch (sheetName) {
      case 'Pedidos':
        pedidosMemoria.push(data);
        break;
      case 'DetallePedidos':
        detallePedidosMemoria.push(data);
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
    console.error(`❌ Error guardando en ${sheetName}:`, error.message);
    // Fallback a memoria
    switch (sheetName) {
      case 'Pedidos':
        pedidosMemoria.push(data);
        break;
      case 'DetallePedidos':
        detallePedidosMemoria.push(data);
        break;
    }
  }
}

// Estado del bot por usuario
const userSessions = new Map();

// Funciones del bot
function normalizeText(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function generateId() {
  return 'PED' + Date.now().toString(36).toUpperCase();
}

function generateDetailId() {
  return 'DET' + Date.now().toString(36).toUpperCase();
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('📱 [SIMULADO] Mensaje a', chatId, ':', text);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        ...options
      })
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('❌ Error enviando mensaje:', result);
    } else {
      console.log('✅ Mensaje enviado a', chatId);
    }
  } catch (error) {
    console.error('❌ Error en sendTelegramMessage:', error);
  }
}

async function handleBotMessage(chatId, message, userName = 'Usuario') {
  const userId = chatId.toString();
  let session = userSessions.get(userId) || {
    step: 'inicio',
    pedidoId: null,
    clienteSeleccionado: null,
    categoriaSeleccionada: null,
    productoSeleccionado: null,
    carrito: [],
    total: 0
  };

  const input = message.toLowerCase().trim();
  console.log(`💬 ${userName} (${chatId}): ${message} [Paso: ${session.step}]`);

  try {
    switch (session.step) {
      case 'inicio':
        if (input === '/start' || input === 'start') {
          await sendTelegramMessage(chatId, 
            `¡Hola ${userName}! 👋\n\nSoy tu asistente para pedidos de la distribuidora.\n\n¿Listo para crear un nuevo pedido?\n\nEscribe "iniciar" para comenzar.`
          );
          session.step = 'esperando_inicio';
        } else if (input === 'iniciar') {
          const clientes = await getDataFromSheet('Clientes');
          const clientesTexto = clientes.slice(0, 8).map(c => `• ${c.nombre}`).join('\n');
          await sendTelegramMessage(chatId, 
            `¿Para qué cliente es el pedido?\n\n*Clientes disponibles:*\n${clientesTexto}\n\nEscribe el nombre del cliente:`
          );
          session.step = 'seleccion_cliente';
        } else {
          await sendTelegramMessage(chatId, 
            'Escribe /start para comenzar o "iniciar" para crear un pedido.'
          );
        }
        break;

      case 'esperando_inicio':
        if (input === 'iniciar') {
          const clientes = await getDataFromSheet('Clientes');
          const clientesTexto = clientes.slice(0, 8).map(c => `• ${c.nombre}`).join('\n');
          await sendTelegramMessage(chatId, 
            `¿Para qué cliente es el pedido?\n\n*Clientes disponibles:*\n${clientesTexto}\n\nEscribe el nombre del cliente:`
          );
          session.step = 'seleccion_cliente';
        } else {
          await sendTelegramMessage(chatId, 
            'Escribe "iniciar" para crear un nuevo pedido.'
          );
        }
        break;

      case 'seleccion_cliente':
        const clientes = await getDataFromSheet('Clientes');
        const clientesEncontrados = clientes.filter(cliente => 
          normalizeText(cliente.nombre).includes(normalizeText(message))
        );
        
        if (clientesEncontrados.length === 1) {
          const cliente = clientesEncontrados[0];
          session.pedidoId = generateId();
          session.clienteSeleccionado = cliente;
          
          const categorias = await getDataFromSheet('Categorias');
          const categoriasTexto = categorias.map(c => `• ${c.categoria_nombre}`).join('\n');
          await sendTelegramMessage(chatId, 
            `✅ Cliente seleccionado: *${cliente.nombre}*\n\nAhora elige una categoría:\n\n${categoriasTexto}`
          );
          session.step = 'seleccion_categoria';
        } else if (clientesEncontrados.length > 1) {
          const opcionesTexto = clientesEncontrados.slice(0, 8).map(c => `• ${c.nombre}`).join('\n');
          await sendTelegramMessage(chatId, 
            `Encontré varios clientes:\n${opcionesTexto}\n\n¿Cuál elegís?`
          );
        } else {
          const clientesTexto = clientes.slice(0, 8).map(c => `• ${c.nombre}`).join('\n');
          await sendTelegramMessage(chatId, 
            `No encontré ese cliente. Probá con:\n${clientesTexto}`
          );
        }
        break;

      case 'seleccion_categoria':
        const categorias = await getDataFromSheet('Categorias');
        const categoria = categorias.find(c => 
          normalizeText(c.categoria_nombre) === normalizeText(message)
        );

        if (categoria) {
          const productos = await getDataFromSheet('Productos');
          const productosCategoria = productos.filter(p => 
            p.categoria_id === categoria.categoria_id && p.activo === 'SI'
          );

          session.categoriaSeleccionada = categoria;

          if (productosCategoria.length > 0) {
            const productosTexto = productosCategoria.slice(0, 10).map(p => 
              `• ${p.producto_nombre} - $${p.precio.toLocaleString('es-ES')}`
            ).join('\n');
            
            await sendTelegramMessage(chatId, 
              `📦 *${categoria.categoria_nombre}*\n\nProductos disponibles:\n${productosTexto}\n\n¿Cuál querés agregar?`
            );
            session.step = 'seleccion_producto';
          } else {
            const categoriasTexto = categorias.map(c => `• ${c.categoria_nombre}`).join('\n');
            await sendTelegramMessage(chatId, 
              `No hay productos disponibles en esa categoría. Elegí otra:\n${categoriasTexto}`
            );
          }
        } else {
          const categoriasTexto = categorias.map(c => `• ${c.categoria_nombre}`).join('\n');
          await sendTelegramMessage(chatId, 
            `Esa categoría no existe. Elegí una de la lista:\n${categoriasTexto}`
          );
        }
        break;

      case 'seleccion_producto':
        const productos = await getDataFromSheet('Productos');
        const nombreProducto = message.split(' - $')[0];
        const productosEncontrados = productos.filter(producto => 
          producto.categoria_id === session.categoriaSeleccionada.categoria_id &&
          producto.activo === 'SI' &&
          normalizeText(producto.producto_nombre).includes(normalizeText(nombreProducto))
        );

        if (productosEncontrados.length === 1) {
          const producto = productosEncontrados[0];
          session.productoSeleccionado = producto;

          await sendTelegramMessage(chatId, 
            `🛒 *${producto.producto_nombre}*\nPrecio: $${producto.precio.toLocaleString('es-ES')}\n\n¿Qué cantidad querés agregar?\n\n(Ejemplo: 2 o 1.5)`
          );
          session.step = 'ingreso_cantidad';
        } else if (productosEncontrados.length > 1) {
          const opcionesTexto = productosEncontrados.slice(0, 8).map(p => 
            `• ${p.producto_nombre} - $${p.precio.toLocaleString('es-ES')}`
          ).join('\n');
          await sendTelegramMessage(chatId, 
            `Encontré varios productos:\n${opcionesTexto}\n\n¿Cuál elegís?`
          );
        } else {
          const productosCategoria = productos.filter(p => 
            p.categoria_id === session.categoriaSeleccionada.categoria_id && p.activo === 'SI'
          );
          const productosTexto = productosCategoria.slice(0, 10).map(p => 
            `• ${p.producto_nombre} - $${p.precio.toLocaleString('es-ES')}`
          ).join('\n');
          
          await sendTelegramMessage(chatId, 
            `Producto no encontrado. Elegí uno de la lista:\n${productosTexto}`
          );
        }
        break;

      case 'ingreso_cantidad':
        const cantidad = parseFloat(message.replace(',', '.'));
        
        if (isNaN(cantidad) || cantidad <= 0) {
          await sendTelegramMessage(chatId, 'Por favor ingresá un número mayor a 0.\n\nEjemplo: 2 o 1.5');
          break;
        }

        const importe = cantidad * session.productoSeleccionado.precio;
        const nuevoDetalle = {
          detalle_id: generateDetailId(),
          pedido_id: session.pedidoId,
          producto_id: session.productoSeleccionado.producto_id,
          producto_nombre: session.productoSeleccionado.producto_nombre,
          categoria_id: session.productoSeleccionado.categoria_id,
          cantidad,
          precio_unitario: session.productoSeleccionado.precio,
          importe
        };

        session.carrito.push(nuevoDetalle);
        session.total = session.carrito.reduce((sum, item) => sum + item.importe, 0);

        await sendTelegramMessage(chatId, 
          `✅ *Agregado al carrito:*\n${cantidad} × ${session.productoSeleccionado.producto_nombre} = $${importe.toLocaleString('es-ES')}\n\n💰 *Total parcial: $${session.total.toLocaleString('es-ES')}*\n\n¿Qué querés hacer?\n\n• Escribe "agregar" para más productos\n• Escribe "finalizar" para confirmar el pedido\n• Escribe "ver" para ver el carrito`
        );
        session.step = 'carrito';
        break;

      case 'carrito':
        if (input === 'agregar') {
          const categorias = await getDataFromSheet('Categorias');
          const categoriasTexto = categorias.map(c => `• ${c.categoria_nombre}`).join('\n');
          await sendTelegramMessage(chatId, 
            `Elegí una categoría para agregar más productos:\n\n${categoriasTexto}`
          );
          session.step = 'seleccion_categoria';
        } else if (input === 'ver') {
          if (session.carrito.length === 0) {
            await sendTelegramMessage(chatId, 'Tu carrito está vacío.');
          } else {
            const carritoTexto = session.carrito.map((item, index) => 
              `${index + 1}. ${item.cantidad} × ${item.producto_nombre} = $${item.importe.toLocaleString('es-ES')}`
            ).join('\n');
            
            await sendTelegramMessage(chatId, 
              `🛒 *Tu carrito:*\n\n${carritoTexto}\n\n💰 *Total: $${session.total.toLocaleString('es-ES')}*\n\nEscribe "agregar" para más productos o "finalizar" para confirmar.`
            );
          }
        } else if (input === 'finalizar') {
          if (session.carrito.length === 0) {
            await sendTelegramMessage(chatId, 'No podés finalizar un pedido vacío.\n\nEscribe "agregar" para agregar productos.');
            break;
          }

          // Guardar pedido
          const pedidoFinal = {
            pedido_id: session.pedidoId,
            fecha_hora: new Date().toISOString(),
            cliente_id: session.clienteSeleccionado.cliente_id,
            cliente_nombre: session.clienteSeleccionado.nombre,
            items_cantidad: session.carrito.length,
            total: session.total,
            estado: 'CONFIRMADO'
          };

          // Guardar en Google Sheets o memoria
          await appendToSheet('Pedidos', pedidoFinal);
          
          // Guardar detalles
          for (const detalle of session.carrito) {
            await appendToSheet('DetallePedidos', detalle);
          }

          const carritoTexto = session.carrito.map((item, index) => 
            `${index + 1}. ${item.cantidad} × ${item.producto_nombre} = $${item.importe.toLocaleString('es-ES')}`
          ).join('\n');

          await sendTelegramMessage(chatId, 
            `🎉 *¡Pedido Confirmado!*\n\n👤 *Cliente:* ${session.clienteSeleccionado.nombre}\n📦 *Productos:*\n${carritoTexto}\n\n💰 *Total: $${session.total.toLocaleString('es-ES')}*\n🆔 *ID:* ${session.pedidoId}\n\n✅ Tu pedido ha sido guardado exitosamente.\n\n¡Gracias por tu compra!\n\nEscribe /start para crear otro pedido.`
          );
          
          // Resetear sesión
          session = {
            step: 'inicio',
            pedidoId: null,
            clienteSeleccionado: null,
            categoriaSeleccionada: null,
            productoSeleccionado: null,
            carrito: [],
            total: 0
          };
        } else {
          await sendTelegramMessage(chatId, 
            'Opciones disponibles:\n• "agregar" - Más productos\n• "finalizar" - Confirmar pedido\n• "ver" - Ver carrito'
          );
        }
        break;
    }
  } catch (error) {
    console.error('❌ Error en handleBotMessage:', error);
    await sendTelegramMessage(chatId, 
      'Ocurrió un error. Por favor intenta nuevamente escribiendo /start'
    );
    // Resetear sesión en caso de error
    session = {
      step: 'inicio',
      pedidoId: null,
      clienteSeleccionado: null,
      categoriaSeleccionada: null,
      productoSeleccionado: null,
      carrito: [],
      total: 0
    };
  }

  userSessions.set(userId, session);
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
      message: error.message
    });
  }
});

// Webhook de Telegram
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    console.log('📱 Webhook recibido:', JSON.stringify(update, null, 2));

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const userName = update.message.from.first_name || 'Usuario';

      console.log(`💬 Mensaje de ${userName} (${chatId}): ${text}`);
      
      // Procesar mensaje del bot
      await handleBotMessage(chatId, text, userName);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Configurar webhook automáticamente
async function setupWebhook() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const RAILWAY_STATIC_URL = process.env.RAILWAY_STATIC_URL;
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN no configurado');
    return;
  }

  if (!RAILWAY_STATIC_URL) {
    console.log('⚠️  RAILWAY_STATIC_URL no disponible aún');
    return;
  }

  try {
    const webhookUrl = `${RAILWAY_STATIC_URL}/webhook`;
    console.log('🔧 Configurando webhook:', webhookUrl);
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: webhookUrl,
        allowed_updates: ["message"]
      })
    });
    
    const result = await response.json();
    if (result.ok) {
      console.log('✅ Webhook configurado exitosamente');
      
      // Verificar configuración
      const infoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      const info = await infoResponse.json();
      
      if (info.ok) {
        console.log('📋 Info del webhook:');
        console.log('   URL:', info.result.url);
        console.log('   Pendientes:', info.result.pending_update_count);
        if (info.result.last_error_date) {
          console.log('   ⚠️  Último error:', new Date(info.result.last_error_date * 1000).toLocaleString());
        }
      }
    } else {
      console.error('❌ Error configurando webhook:', result);
    }
  } catch (error) {
    console.error('❌ Error en setupWebhook:', error);
  }
}

// Servir la aplicación React para todas las rutas no API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ========================================');
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log('🚀 ========================================');
  console.log(`📱 Webhook endpoint: /webhook`);
  console.log(`🌐 Health check: /health`);
  console.log(`📊 API Info: /api/info`);
  console.log(`🧪 Test Sheets: /api/test/sheets`);
  console.log('🚀 ========================================');
  
  // Configurar webhook después de 10 segundos
  setTimeout(setupWebhook, 10000);
});