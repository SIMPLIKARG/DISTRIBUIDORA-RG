import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Google Sheets setup
let sheets = null;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets conectado');
  } catch (error) {
    console.log('⚠️ Google Sheets no configurado:', error.message);
  }
}

// Datos de ejemplo (fallback)
const datosEjemplo = {
  clientes: [
    { cliente_id: 1, nombre: 'Juan Pérez' },
    { cliente_id: 2, nombre: 'María González' },
    { cliente_id: 3, nombre: 'Carlos Rodríguez' }
  ],
  categorias: [
    { categoria_id: 1, categoria_nombre: 'Galletitas' },
    { categoria_id: 2, categoria_nombre: 'Bebidas' },
    { categoria_id: 3, categoria_nombre: 'Lácteos' }
  ],
  productos: [
    { producto_id: 1, categoria_id: 1, producto_nombre: 'Oreo Original 117g', precio: 450, activo: 'SI' },
    { producto_id: 2, categoria_id: 2, producto_nombre: 'Coca Cola 500ml', precio: 350, activo: 'SI' },
    { producto_id: 3, categoria_id: 3, producto_nombre: 'Leche Entera 1L', precio: 280, activo: 'SI' }
  ],
  pedidos: [
    { pedido_id: 'PED001', fecha_hora: '2024-01-15 10:30:00', cliente_id: 1, cliente_nombre: 'Juan Pérez', items_cantidad: 2, total: 800, estado: 'CONFIRMADO' },
    { pedido_id: 'PED002', fecha_hora: '2024-01-16 14:20:00', cliente_id: 2, cliente_nombre: 'María González', items_cantidad: 1, total: 350, estado: 'PENDIENTE' }
  ]
};

// Función para leer de Google Sheets
async function leerSheet(nombreHoja) {
  if (!sheets || !SPREADSHEET_ID) {
    return datosEjemplo[nombreHoja.toLowerCase()] || [];
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombreHoja}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  } catch (error) {
    console.log(`⚠️ Error leyendo ${nombreHoja}:`, error.message);
    return datosEjemplo[nombreHoja.toLowerCase()] || [];
  }
}

// Función para escribir a Google Sheets
async function escribirSheet(nombreHoja, datos) {
  if (!sheets || !SPREADSHEET_ID) {
    console.log('⚠️ Google Sheets no configurado, usando datos en memoria');
    return false;
  }

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombreHoja}!A:Z`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [datos]
      }
    });
    return true;
  } catch (error) {
    console.log(`⚠️ Error escribiendo en ${nombreHoja}:`, error.message);
    return false;
  }
}

// API Routes
app.get('/api/clientes', async (req, res) => {
  const clientes = await leerSheet('Clientes');
  res.json(clientes);
});

app.get('/api/categorias', async (req, res) => {
  const categorias = await leerSheet('Categorias');
  res.json(categorias);
});

app.get('/api/productos', async (req, res) => {
  const productos = await leerSheet('Productos');
  res.json(productos);
});

app.get('/api/pedidos', async (req, res) => {
  const pedidos = await leerSheet('Pedidos');
  res.json(pedidos);
});

app.get('/api/stats', async (req, res) => {
  const clientes = await leerSheet('Clientes');
  const productos = await leerSheet('Productos');
  const pedidos = await leerSheet('Pedidos');
  
  const stats = {
    totalClientes: clientes.length,
    totalProductos: productos.length,
    totalPedidos: pedidos.length,
    ventasTotal: pedidos.reduce((sum, p) => sum + (parseInt(p.total) || 0), 0)
  };
  
  res.json(stats);
});

// Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.RAILWAY_STATIC_URL ? `${process.env.RAILWAY_STATIC_URL}/webhook` : null;

// Estado del bot (en memoria)
const sesionesBot = new Map();

// Webhook de Telegram
app.post('/webhook', async (req, res) => {
  try {
    const { message, callback_query } = req.body;
    
    if (message) {
      await manejarMensaje(message);
    }
    
    if (callback_query) {
      await manejarCallback(callback_query);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).send('Error');
  }
});

// Manejar mensajes
async function manejarMensaje(message) {
  const chatId = message.chat.id;
  const texto = message.text;
  const userId = message.from.id;
  
  if (texto === '/start') {
    sesionesBot.set(userId, { estado: 'inicio', pedido: {} });
    
    await enviarMensaje(chatId, '🛒 ¡Bienvenido a la Distribuidora!\n\nSelecciona una opción:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '📋 Ver Productos', callback_data: 'ver_productos' }],
          [{ text: '❓ Ayuda', callback_data: 'ayuda' }]
        ]
      }
    });
  }
}

// Manejar callbacks
async function manejarCallback(callback_query) {
  const chatId = callback_query.message.chat.id;
  const data = callback_query.data;
  const userId = callback_query.from.id;
  
  if (data === 'hacer_pedido') {
    const categorias = await leerSheet('Categorias');
    const keyboard = categorias.map(cat => [{ 
      text: cat.categoria_nombre, 
      callback_data: `categoria_${cat.categoria_id}` 
    }]);
    
    await enviarMensaje(chatId, '📂 Selecciona una categoría:', {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
  
  if (data.startsWith('categoria_')) {
    const categoriaId = data.split('_')[1];
    const productos = await leerSheet('Productos');
    const productosFiltrados = productos.filter(p => p.categoria_id == categoriaId && p.activo === 'SI');
    
    const keyboard = productosFiltrados.map(prod => [{ 
      text: `${prod.producto_nombre} - $${prod.precio}`, 
      callback_data: `producto_${prod.producto_id}` 
    }]);
    
    await enviarMensaje(chatId, '🛍️ Selecciona un producto:', {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
  
  if (data.startsWith('producto_')) {
    const productoId = data.split('_')[1];
    const productos = await leerSheet('Productos');
    const producto = productos.find(p => p.producto_id == productoId);
    
    if (producto) {
      await enviarMensaje(chatId, `✅ Producto agregado: ${producto.producto_nombre}\nPrecio: $${producto.precio}\n\n¿Deseas agregar más productos?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Agregar más', callback_data: 'hacer_pedido' }],
            [{ text: '✅ Finalizar Pedido', callback_data: 'finalizar_pedido' }]
          ]
        }
      });
    }
  }
  
  if (data === 'ver_productos') {
    const productos = await leerSheet('Productos');
    const productosActivos = productos.filter(p => p.activo === 'SI');
    
    let mensaje = '📦 PRODUCTOS DISPONIBLES:\n\n';
    productosActivos.forEach(prod => {
      mensaje += `• ${prod.producto_nombre} - $${prod.precio}\n`;
    });
    
    await enviarMensaje(chatId, mensaje);
  }
}

// Enviar mensaje a Telegram
async function enviarMensaje(chatId, texto, opciones = {}) {
  if (!TELEGRAM_BOT_TOKEN) return;
  
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        ...opciones
      })
    });
    
    if (!response.ok) {
      console.error('Error enviando mensaje:', await response.text());
    }
  } catch (error) {
    console.error('Error en enviarMensaje:', error);
  }
}

// Configurar webhook automáticamente
async function configurarWebhook() {
  if (!TELEGRAM_BOT_TOKEN || !WEBHOOK_URL) {
    console.log('⚠️ Telegram no configurado completamente');
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: WEBHOOK_URL })
    });
    
    const result = await response.json();
    if (result.ok) {
      console.log('✅ Webhook configurado:', WEBHOOK_URL);
    } else {
      console.log('⚠️ Error configurando webhook:', result.description);
    }
  } catch (error) {
    console.log('⚠️ Error configurando webhook:', error.message);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    sheets: !!sheets,
    telegram: !!TELEGRAM_BOT_TOKEN
  });
});

// Dashboard web
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema Distribuidora Bot</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-6">
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-gray-800 mb-2">🤖 Sistema Distribuidora Bot</h1>
            <p class="text-gray-600">Dashboard de gestión y estadísticas</p>
        </div>
        
        <!-- Status -->
        <div class="bg-white rounded-lg shadow p-6 mb-8">
            <h2 class="text-xl font-bold mb-4">🔧 Estado del Sistema</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center">
                    <div class="text-2xl mb-2" id="sheets-status">⏳</div>
                    <p class="text-sm text-gray-600">Google Sheets</p>
                </div>
                <div class="text-center">
                    <div class="text-2xl mb-2" id="telegram-status">⏳</div>
                    <p class="text-sm text-gray-600">Telegram Bot</p>
                </div>
                <div class="text-center">
                    <div class="text-2xl mb-2" id="server-status">⏳</div>
                    <p class="text-sm text-gray-600">Servidor</p>
                </div>
            </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">👥 Clientes</h3>
                <p class="text-3xl font-bold text-blue-600" id="totalClientes">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">📦 Productos</h3>
                <p class="text-3xl font-bold text-green-600" id="totalProductos">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">🛒 Pedidos</h3>
                <p class="text-3xl font-bold text-orange-600" id="totalPedidos">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">💰 Ventas</h3>
                <p class="text-3xl font-bold text-purple-600" id="ventasTotal">-</p>
            </div>
        </div>

        <!-- Pedidos -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-2xl font-bold mb-4">📋 Pedidos Recientes</h2>
            <div id="pedidos" class="space-y-4">
                <div class="text-center text-gray-500">Cargando...</div>
            </div>
        </div>
    </div>

    <script>
        async function cargarDatos() {
            try {
                // Health check
                const healthRes = await fetch('/health');
                const health = await healthRes.json();
                
                document.getElementById('sheets-status').textContent = health.sheets ? '✅' : '❌';
                document.getElementById('telegram-status').textContent = health.telegram ? '✅' : '❌';
                document.getElementById('server-status').textContent = health.status === 'OK' ? '✅' : '❌';

                // Stats
                const statsRes = await fetch('/api/stats');
                const stats = await statsRes.json();
                
                document.getElementById('totalClientes').textContent = stats.totalClientes;
                document.getElementById('totalProductos').textContent = stats.totalProductos;
                document.getElementById('totalPedidos').textContent = stats.totalPedidos;
                document.getElementById('ventasTotal').textContent = '$' + stats.ventasTotal.toLocaleString();

                // Pedidos
                const pedidosRes = await fetch('/api/pedidos');
                const pedidos = await pedidosRes.json();
                
                const pedidosContainer = document.getElementById('pedidos');
                if (pedidos.length === 0) {
                    pedidosContainer.innerHTML = '<div class="text-center text-gray-500">No hay pedidos</div>';
                } else {
                    pedidosContainer.innerHTML = pedidos.map(pedido => \`
                        <div class="flex justify-between items-center p-4 border rounded-lg">
                            <div>
                                <h3 class="font-semibold">\${pedido.pedido_id} - \${pedido.cliente_nombre}</h3>
                                <p class="text-gray-600">\${pedido.fecha_hora}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-bold">$\${parseInt(pedido.total || 0).toLocaleString()}</p>
                                <span class="px-2 py-1 rounded text-sm \${pedido.estado === 'CONFIRMADO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                                    \${pedido.estado}
                                </span>
                            </div>
                        </div>
                    \`).join('');
                }
                
            } catch (error) {
                console.error('Error cargando datos:', error);
                document.getElementById('pedidos').innerHTML = '<div class="text-center text-red-500">Error cargando datos</div>';
            }
        }

        // Cargar al inicio
        cargarDatos();
        
        // Recargar cada 30 segundos
        setInterval(cargarDatos, 30000);
    </script>
</body>
</html>
  `);
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  
  // Configurar webhook después de un delay
  setTimeout(configurarWebhook, 5000);
});