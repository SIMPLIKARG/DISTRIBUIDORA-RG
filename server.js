import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Google Sheets setup
let sheets = null;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const FORCE_SHEETS = false; // Permitir funcionamiento sin Google Sheets

// Configuración opcional de Google Sheets
let sheetsConfigured = false;
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
  console.log('⚠️  Google Sheets no configurado - usando datos de ejemplo');
  console.log('🔗 Para configurar: ver CONFIGURACION.md');
  sheetsConfigured = false;
} else {
  sheetsConfigured = true;
}

// Inicializar Google Sheets
if (sheetsConfigured) {
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets configurado correctamente');
  } catch (error) {
    console.error('⚠️  Error configurando Google Sheets:', error.message);
    console.log('📊 Usando datos de ejemplo');
    sheetsConfigured = false;
  }
}

// Verificar conexión al iniciar
async function verificarGoogleSheets() {
  if (!sheetsConfigured || !sheets) {
    console.log('📊 Funcionando con datos de ejemplo (Google Sheets no configurado)');
    return;
  }
  
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    console.log(`✅ Conectado a Google Sheet: "${response.data.properties?.title}"`);
    
    // Verificar que existan las hojas necesarias
    const existingSheets = response.data.sheets?.map(sheet => sheet.properties?.title) || [];
    const requiredSheets = ['Clientes', 'Categorias', 'Productos', 'Pedidos'];
    
    for (const sheetName of requiredSheets) {
      if (!existingSheets.includes(sheetName)) {
        console.error(`❌ Falta la hoja: "${sheetName}"`);
        console.error('🔧 Crea las hojas: Clientes, Categorias, Productos, Pedidos');
        process.exit(1);
      }
    }
    
    console.log('✅ Todas las hojas requeridas existen');
  } catch (error) {
    console.error('❌ Error verificando Google Sheets:', error.message);
    console.log('📊 Continuando con datos de ejemplo');
    sheetsConfigured = false;
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
  if (!sheetsConfigured || !sheets) {
    console.log(`📊 Usando datos de ejemplo para ${nombreHoja}`);
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
    console.error(`❌ Error leyendo ${nombreHoja}:`, error.message);
    console.log(`📊 Usando datos de ejemplo para ${nombreHoja}`);
    return datosEjemplo[nombreHoja.toLowerCase()] || [];
  }
}

// Función para escribir a Google Sheets
async function escribirSheet(nombreHoja, datos) {
  if (!sheetsConfigured || !sheets) {
    console.log(`📝 Simulando escritura en ${nombreHoja} (Google Sheets no configurado)`);
    return true;
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
    console.error(`❌ Error escribiendo en ${nombreHoja}:`, error.message);
    console.log(`📝 Simulando escritura en ${nombreHoja} (error en Google Sheets)`);
    return true;
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
  let pedidos = await leerSheet('Pedidos');
  
  // Combinar con pedidos en memoria
  if (pedidosEnMemoria.length > 0) {
    pedidos = [...pedidos, ...pedidosEnMemoria];
  }
  
  res.json(pedidos);
});

app.get('/api/stats', async (req, res) => {
  const clientes = await leerSheet('Clientes');
  const productos = await leerSheet('Productos');
  let pedidos = await leerSheet('Pedidos');
  
  // Combinar con pedidos en memoria
  if (pedidosEnMemoria.length > 0) {
    pedidos = [...pedidos, ...pedidosEnMemoria];
  }
  
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
const pedidosEnMemoria = [];
let contadorPedidos = 1;

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
  const sesion = sesionesBot.get(userId) || { estado: 'inicio', pedido: { items: [], total: 0 } };
  
  if (texto === '/start') {
    sesionesBot.set(userId, { estado: 'inicio', pedido: { items: [], total: 0 } });
    
    await enviarMensaje(chatId, '🛒 ¡Bienvenido a la Distribuidora!\n\nSelecciona una opción:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '📋 Ver Productos', callback_data: 'ver_productos' }],
          [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
          [{ text: '❓ Ayuda', callback_data: 'ayuda' }]
        ]
      }
    });
    return;
  }
  
  // Comando para cancelar
  if (texto === '/cancelar') {
    sesion.estado = 'inicio';
    sesion.productoSeleccionado = null;
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '❌ Operación cancelada\n\n¿Qué deseas hacer?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }]
        ]
      }
    });
    return;
  }
  
  // Manejar cantidad de producto
  if (sesion.estado === 'esperando_cantidad' && /^\d+$/.test(texto)) {
    const cantidad = parseInt(texto);
    const producto = sesion.productoSeleccionado;
    
    if (cantidad > 0 && cantidad <= 50) {
      const importe = producto.precio * cantidad;
      sesion.pedido.items.push({
        producto_id: producto.producto_id,
        nombre: producto.producto_nombre,
        precio: producto.precio,
        cantidad: cantidad,
        importe: importe
      });
      sesion.pedido.total += importe;
      sesion.estado = 'inicio';
      sesion.productoSeleccionado = null;
      
      await enviarMensaje(chatId, `✅ Agregado: ${cantidad}x ${producto.producto_nombre}\nSubtotal: $${importe}\nTotal del pedido: $${sesion.pedido.total}\n\n¿Qué deseas hacer?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Agregar más productos', callback_data: 'hacer_pedido' }],
            [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
            [{ text: '✅ Finalizar pedido', callback_data: 'finalizar_pedido' }]
          ]
        }
      });
      
      sesionesBot.set(userId, sesion);
    } else {
      await enviarMensaje(chatId, '❌ Cantidad inválida. Ingresa un número entre 1 y 50:\n\n_O usa /cancelar para volver_', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancelar', callback_data: 'cancelar_producto' }]
          ]
        }
      });
    }
    return;
  }
  
  // Si está esperando cantidad pero no es un número válido
  if (sesion.estado === 'esperando_cantidad') {
    await enviarMensaje(chatId, '❌ Por favor ingresa solo números.\n\nCantidad para el producto (1-50):\n\n_O usa /cancelar para volver_', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancelar', callback_data: 'cancelar_producto' }]
        ]
      }
    });
    return;
  }
  
  // Mensaje por defecto para comandos no reconocidos
  await enviarMensaje(chatId, '❓ No entiendo ese comando.\n\nUsa /start para ver el menú principal.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
      ]
    }
  });
}

// Manejar callbacks
async function manejarCallback(callback_query) {
  const chatId = callback_query.message.chat.id;
  const data = callback_query.data;
  const userId = callback_query.from.id;
  const sesion = sesionesBot.get(userId) || { estado: 'inicio', pedido: { items: [], total: 0 } };
  
  // Responder al callback para evitar el spinner
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callback_query.id
      })
    });
  } catch (error) {
    console.log('Error respondiendo callback:', error.message);
  }
  
  if (data === 'hacer_pedido') {
    const categorias = await leerSheet('Categorias');
    
    if (categorias.length === 0) {
      await enviarMensaje(chatId, '❌ No hay categorías disponibles en este momento.');
      return;
    }
    
    const keyboard = categorias.map(cat => [{
      text: `📂 ${cat.categoria_nombre}`,
      callback_data: `categoria_${cat.categoria_id}`
    }]);
    
    // Agregar botón para volver
    keyboard.push([{ text: '🔙 Volver al menú', callback_data: 'menu_principal' }]);
    
    await enviarMensaje(chatId, '📂 Selecciona una categoría:', {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
  
  if (data.startsWith('categoria_')) {
    const categoriaId = data.split('_')[1];
    const productos = await leerSheet('Productos');
    const productosFiltrados = productos.filter(p => p.categoria_id == categoriaId && p.activo === 'SI');
    
    if (productosFiltrados.length === 0) {
      await enviarMensaje(chatId, '❌ No hay productos disponibles en esta categoría.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Volver a categorías', callback_data: 'hacer_pedido' }]
          ]
        }
      });
      return;
    }
    
    const keyboard = productosFiltrados.map(prod => [{
      text: `🛍️ ${prod.producto_nombre} - $${prod.precio}`,
      callback_data: `producto_${prod.producto_id}`
    }]);
    
    // Agregar botones de navegación
    keyboard.push([
      { text: '🔙 Volver a categorías', callback_data: 'hacer_pedido' },
      { text: '🏠 Menú principal', callback_data: 'menu_principal' }
    ]);
    
    await enviarMensaje(chatId, '🛍️ Selecciona un producto:', {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
  
  if (data.startsWith('producto_')) {
    const productoId = data.split('_')[1];
    const productos = await leerSheet('Productos');
    const producto = productos.find(p => p.producto_id == productoId);
    
    if (producto) {
      sesion.estado = 'esperando_cantidad';
      sesion.productoSeleccionado = producto;
      sesionesBot.set(userId, sesion);
      
      await enviarMensaje(chatId, `📦 **${producto.producto_nombre}**\n💰 Precio: $${producto.precio}\n\n¿Cuántas unidades quieres? (1-50)\n\n_Escribe un número o usa /cancelar para volver_`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancelar', callback_data: 'cancelar_producto' }]
          ]
        }
      });
    } else {
      await enviarMensaje(chatId, '❌ Producto no encontrado.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Volver a productos', callback_data: 'hacer_pedido' }]
          ]
        }
      });
    }
  }
  
  if (data === 'cancelar_producto') {
    sesion.estado = 'inicio';
    sesion.productoSeleccionado = null;
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '❌ Selección cancelada\n\n¿Qué deseas hacer?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }]
        ]
      }
    });
  }
  
  if (data === 'menu_principal') {
    sesion.estado = 'inicio';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '🏠 Menú Principal\n\nSelecciona una opción:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '📋 Ver Productos', callback_data: 'ver_productos' }],
          [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
          [{ text: '❓ Ayuda', callback_data: 'ayuda' }]
        ]
      }
    });
  }
  
  if (data === 'ver_carrito') {
    if (sesion.pedido.items.length === 0) {
      await enviarMensaje(chatId, '🛒 Tu carrito está vacío\n\n¿Deseas agregar productos?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
            [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
          ]
        }
      });
    } else {
      let mensaje = '🛒 TU CARRITO:\n\n';
      sesion.pedido.items.forEach((item, index) => {
        mensaje += `${index + 1}. ${item.nombre}\n   ${item.cantidad}x $${item.precio} = $${item.importe}\n\n`;
      });
      mensaje += `💰 TOTAL: $${sesion.pedido.total}`;
      
      await enviarMensaje(chatId, mensaje, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Agregar más', callback_data: 'hacer_pedido' }],
            [{ text: '🗑️ Vaciar carrito', callback_data: 'vaciar_carrito' }],
            [{ text: '✅ Finalizar Pedido', callback_data: 'finalizar_pedido' }]
          ]
        }
      });
    }
  }
  
  if (data === 'vaciar_carrito') {
    sesion.pedido = { items: [], total: 0 };
    sesion.estado = 'inicio';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '🗑️ Carrito vaciado\n\n¿Deseas hacer un nuevo pedido?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
        ]
      }
    });
  }
  
  if (data === 'finalizar_pedido') {
    if (sesion.pedido.items.length === 0) {
      await enviarMensaje(chatId, '❌ No tienes productos en el carrito');
      return;
    }
    
    // Crear pedido
    const pedidoId = `PED${String(contadorPedidos++).padStart(3, '0')}`;
    const fechaHora = new Date().toLocaleString('es-AR');
    const clienteNombre = callback_query.from.first_name || 'Cliente';
    
    const nuevoPedido = {
      pedido_id: pedidoId,
      fecha_hora: fechaHora,
      cliente_id: userId,
      cliente_nombre: clienteNombre,
      items_cantidad: sesion.pedido.items.length,
      total: sesion.pedido.total,
      estado: 'CONFIRMADO',
      items: sesion.pedido.items
    };
    
    // Guardar en memoria
    pedidosEnMemoria.push(nuevoPedido);
    
    // Intentar guardar en Google Sheets
    await escribirSheet('Pedidos', [
      pedidoId, fechaHora, userId, clienteNombre, 
      sesion.pedido.items.length, sesion.pedido.total, 'CONFIRMADO'
    ]);
    
    // Limpiar sesión
    sesionesBot.set(userId, { estado: 'inicio', pedido: { items: [], total: 0 } });
    
    let mensaje = `✅ PEDIDO CONFIRMADO\n\n`;
    mensaje += `📋 Pedido: ${pedidoId}\n`;
    mensaje += `👤 Cliente: ${clienteNombre}\n`;
    mensaje += `📅 Fecha: ${fechaHora}\n\n`;
    mensaje += `🛒 PRODUCTOS:\n`;
    nuevoPedido.items.forEach((item, index) => {
      mensaje += `${index + 1}. ${item.nombre}\n   ${item.cantidad}x $${item.precio} = $${item.importe}\n`;
    });
    mensaje += `\n💰 TOTAL: $${nuevoPedido.total}`;
    
    await enviarMensaje(chatId, mensaje, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Nuevo Pedido', callback_data: 'hacer_pedido' }]
        ]
      }
    });
  }
  
  if (data === 'ver_productos') {
    const productos = await leerSheet('Productos');
    const productosActivos = productos.filter(p => p.activo === 'SI');
    
    if (productosActivos.length === 0) {
      await enviarMensaje(chatId, '❌ No hay productos disponibles en este momento.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
          ]
        }
      });
      return;
    }
    
    // Agrupar productos por categoría
    const categorias = await leerSheet('Categorias');
    const categoriaMap = {};
    categorias.forEach(cat => {
      categoriaMap[cat.categoria_id] = cat.categoria_nombre;
    });
    
    let mensaje = '📦 PRODUCTOS DISPONIBLES:\n\n';
    let categoriaActual = '';
    
    productosActivos.forEach(prod => {
      const nombreCategoria = categoriaMap[prod.categoria_id] || 'Sin categoría';
      if (nombreCategoria !== categoriaActual) {
        mensaje += `\n📂 **${nombreCategoria}**\n`;
        categoriaActual = nombreCategoria;
      }
      mensaje += `   • ${prod.producto_nombre} - $${prod.precio}\n`;
    });
    
    await enviarMensaje(chatId, mensaje, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
        ]
      }
    });
  }
  
  if (data === 'ayuda') {
    const mensajeAyuda = `❓ **AYUDA - CÓMO USAR EL BOT**

🛍️ **Hacer un pedido:**
1. Presiona "Hacer Pedido"
2. Selecciona una categoría
3. Elige un producto
4. Escribe la cantidad deseada
5. Repite para más productos
6. Finaliza tu pedido

🛒 **Ver carrito:**
- Revisa los productos agregados
- Ve el total de tu pedido
- Vacía el carrito si es necesario

📋 **Ver productos:**
- Lista completa de productos disponibles
- Organizados por categoría
- Con precios actualizados

⚡ **Comandos útiles:**
- /start - Menú principal
- /cancelar - Cancelar operación actual

¿Necesitas más ayuda? Contacta al administrador.`;

    await enviarMensaje(chatId, mensajeAyuda, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
        ]
      }
    });
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

// Test Google Sheets connection
app.get('/test-sheets', async (req, res) => {
  try {
    // Test reading from sheets
    const clientes = await leerSheet('Clientes');
    const productos = await leerSheet('Productos');
    
    res.json({
      connected: true,
      spreadsheetId: SPREADSHEET_ID,
      clientesCount: clientes.length,
      productosCount: productos.length,
      message: 'Google Sheets funcionando correctamente'
    });
    
  } catch (error) {
    res.json({
      connected: false,
      error: error.message,
      solution: 'Verifica configuración de Google Sheets'
    });
  }
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
                    pedidosContainer.innerHTML = pedidos.slice(-10).reverse().map(pedido => \`
                        <div class="flex justify-between items-center p-4 border rounded-lg">
                            <div>
                                <h3 class="font-semibold">\${pedido.pedido_id} - \${pedido.cliente_nombre}</h3>
                                <p class="text-gray-600">\${pedido.fecha_hora} - \${pedido.items_cantidad || 0} items</p>
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
        
        // Recargar cada 10 segundos
        setInterval(cargarDatos, 10000);
    </script>
</body>
</html>
  `);
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Dashboard: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}`);
  
  // Verificar Google Sheets al iniciar
  await verificarGoogleSheets();
  
  // Configurar webhook después de un delay
  setTimeout(configurarWebhook, 5000);
});