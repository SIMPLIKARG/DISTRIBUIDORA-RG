import express from 'express';
import cors from 'cors';
import { Telegraf } from 'telegraf';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración de Google Sheets
const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

// Bot de Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'dummy_token');

// Estado del usuario (en memoria - en producción usar base de datos)
const userStates = new Map();
const userCarts = new Map();

// Datos de ejemplo (fallback si no hay Google Sheets)
const datosEjemplo = {
  clientes: [
    { cliente_id: 1, nombre: 'Juan Pérez', lista: 1 },
    { cliente_id: 2, nombre: 'María González', lista: 2 },
    { cliente_id: 3, nombre: 'Carlos Rodríguez', lista: 1 },
    { cliente_id: 4, nombre: 'Ana Martínez', lista: 3 },
    { cliente_id: 5, nombre: 'Luis Fernández', lista: 2 }
  ],
  categorias: [
    { categoria_id: 1, categoria_nombre: 'Galletitas' },
    { categoria_id: 2, categoria_nombre: 'Bebidas' },
    { categoria_id: 3, categoria_nombre: 'Lácteos' },
    { categoria_id: 4, categoria_nombre: 'Panadería' },
    { categoria_id: 5, categoria_nombre: 'Conservas' }
  ],
  productos: [
    { producto_id: 1, categoria_id: 1, producto_nombre: 'Oreo Original 117g', precio1: 450, precio2: 420, precio3: 400, precio4: 380, precio5: 360, activo: 'SI' },
    { producto_id: 2, categoria_id: 1, producto_nombre: 'Pepitos Chocolate 100g', precio1: 380, precio2: 360, precio3: 340, precio4: 320, precio5: 300, activo: 'SI' },
    { producto_id: 3, categoria_id: 2, producto_nombre: 'Coca Cola 500ml', precio1: 350, precio2: 330, precio3: 310, precio4: 290, precio5: 270, activo: 'SI' },
    { producto_id: 4, categoria_id: 3, producto_nombre: 'Leche Entera 1L', precio1: 280, precio2: 260, precio3: 240, precio4: 220, precio5: 200, activo: 'SI' },
    { producto_id: 5, categoria_id: 4, producto_nombre: 'Pan Lactal 500g', precio1: 320, precio2: 300, precio3: 280, precio4: 260, precio5: 240, activo: 'SI' }
  ]
};

// Funciones auxiliares
function getUserState(userId) {
  return userStates.get(userId) || { step: 'idle' };
}

function setUserState(userId, state) {
  userStates.set(userId, state);
}

function getUserCart(userId) {
  return userCarts.get(userId) || [];
}

function setUserCart(userId, cart) {
  userCarts.set(userId, cart);
}

// Función para obtener datos de Google Sheets
async function obtenerDatosSheet(nombreHoja) {
  try {
    if (!SPREADSHEET_ID) {
      console.log(`⚠️ Google Sheets no configurado, usando datos de ejemplo para ${nombreHoja}`);
      return datosEjemplo[nombreHoja.toLowerCase()] || [];
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombreHoja}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return data;
  } catch (error) {
    console.error(`❌ Error obteniendo datos de ${nombreHoja}:`, error.message);
    return datosEjemplo[nombreHoja.toLowerCase()] || [];
  }
}

// Función para agregar datos a Google Sheets
async function agregarDatosSheet(nombreHoja, datos) {
  try {
    if (!SPREADSHEET_ID) {
      console.log(`⚠️ Google Sheets no configurado, simulando inserción en ${nombreHoja}`);
      return true;
    }

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
    console.error(`❌ Error agregando datos a ${nombreHoja}:`, error.message);
    return false;
  }
}

// Función para calcular precio según lista del cliente
function calcularPrecio(producto, listaCliente) {
  const precioKey = `precio${listaCliente}`;
  return producto[precioKey] || producto.precio1 || 0;
}

// Comandos del bot
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'Usuario';
  
  console.log(`🚀 Usuario ${userName} (${userId}) inició el bot`);
  
  setUserState(userId, { step: 'idle' });
  setUserCart(userId, []);
  
  const mensaje = `¡Hola ${userName}! 👋\n\n🛒 Bienvenido al sistema de pedidos\n\n¿Qué te gustaría hacer?`;
  
  await ctx.reply(mensaje, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛒 Hacer pedido', callback_data: 'hacer_pedido' }],
        [{ text: '📋 Ver mis pedidos', callback_data: 'ver_pedidos' }],
        [{ text: '❓ Ayuda', callback_data: 'ayuda' }]
      ]
    }
  });
});

bot.command('ayuda', async (ctx) => {
  const mensaje = `📋 *Comandos disponibles:*\n\n` +
    `🛒 /start - Iniciar nuevo pedido\n` +
    `📋 /pedidos - Ver mis pedidos\n` +
    `❓ /ayuda - Mostrar esta ayuda\n\n` +
    `💡 *Cómo hacer un pedido:*\n` +
    `1. Presiona "Hacer pedido"\n` +
    `2. Selecciona tu cliente\n` +
    `3. Elige categorías y productos\n` +
    `4. Agrega al carrito\n` +
    `5. Confirma tu pedido`;
  
  await ctx.reply(mensaje, { parse_mode: 'Markdown' });
});

// Manejo de callbacks
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'Usuario';
  const callbackData = ctx.callbackQuery.data;
  
  console.log(`🔘 Callback de ${userName}: ${callbackData}`);
  
  try {
    await ctx.answerCbQuery();
    
    if (callbackData === 'hacer_pedido') {
      console.log(`🛒 ${userName} inicia nuevo pedido`);
      
      const clientes = await obtenerDatosSheet('Clientes');
      
      if (clientes.length === 0) {
        await ctx.reply('❌ No hay clientes disponibles');
        return;
      }
      
      setUserState(userId, { step: 'seleccionar_cliente' });
      
      const keyboard = clientes.map(cliente => [{
        text: `👤 ${cliente.nombre}`,
        callback_data: `cliente_${cliente.cliente_id}`
      }]);
      
      await ctx.editMessageText('👤 Selecciona el cliente:', {
        reply_markup: { inline_keyboard: keyboard }
      });
      
    } else if (callbackData.startsWith('cliente_')) {
      const clienteId = parseInt(callbackData.split('_')[1]);
      console.log(`👤 Cliente seleccionado: ${clienteId}`);
      
      const clientes = await obtenerDatosSheet('Clientes');
      const cliente = clientes.find(c => c.cliente_id == clienteId);
      
      if (!cliente) {
        await ctx.reply('❌ Cliente no encontrado');
        return;
      }
      
      setUserState(userId, { 
        step: 'seleccionar_categoria', 
        cliente: cliente,
        pedido_id: `PED${Date.now()}`
      });
      
      const categorias = await obtenerDatosSheet('Categorias');
      
      const keyboard = categorias.map(cat => [{
        text: `📂 ${cat.categoria_nombre}`,
        callback_data: `categoria_${cat.categoria_id}`
      }]);
      
      keyboard.push([{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }]);
      
      await ctx.editMessageText(`✅ Cliente: ${cliente.nombre}\n\n📂 Selecciona una categoría:`, {
        reply_markup: { inline_keyboard: keyboard }
      });
      
    } else if (callbackData.startsWith('categoria_')) {
      const categoriaId = parseInt(callbackData.split('_')[1]);
      console.log(`📂 Categoría seleccionada: ${categoriaId}`);
      
      const productos = await obtenerDatosSheet('Productos');
      const productosCategoria = productos.filter(p => p.categoria_id == categoriaId && p.activo === 'SI');
      
      if (productosCategoria.length === 0) {
        await ctx.reply('❌ No hay productos disponibles en esta categoría');
        return;
      }
      
      const categorias = await obtenerDatosSheet('Categorias');
      const categoria = categorias.find(c => c.categoria_id == categoriaId);
      const nombreCategoria = categoria ? categoria.categoria_nombre : 'Categoría';
      
      const keyboard = productosCategoria.map(producto => [{
        text: `🛍️ ${producto.producto_nombre}`,
        callback_data: `producto_${producto.producto_id}`
      }]);
      
      keyboard.push([{ text: '📂 Ver categorías', callback_data: 'hacer_pedido' }]);
      keyboard.push([{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }]);
      
      await ctx.editMessageText(`📂 Categoría: ${nombreCategoria}\n\n🛍️ Selecciona un producto:`, {
        reply_markup: { inline_keyboard: keyboard }
      });
      
    } else if (callbackData.startsWith('producto_')) {
      const productoId = parseInt(callbackData.split('_')[1]);
      console.log(`🛍️ Producto seleccionado: ${productoId}`);
      
      const productos = await obtenerDatosSheet('Productos');
      const producto = productos.find(p => p.producto_id == productoId);
      
      if (!producto) {
        await ctx.reply('❌ Producto no encontrado');
        return;
      }
      
      const userState = getUserState(userId);
      const cliente = userState.cliente;
      const precio = calcularPrecio(producto, cliente.lista || 1);
      
      const keyboard = [
        [
          { text: '1️⃣ x1', callback_data: `cantidad_${productoId}_1` },
          { text: '2️⃣ x2', callback_data: `cantidad_${productoId}_2` },
          { text: '3️⃣ x3', callback_data: `cantidad_${productoId}_3` }
        ],
        [
          { text: '4️⃣ x4', callback_data: `cantidad_${productoId}_4` },
          { text: '5️⃣ x5', callback_data: `cantidad_${productoId}_5` },
          { text: '🔢 Otra cantidad', callback_data: `cantidad_custom_${productoId}` }
        ],
        [{ text: '🔙 Volver', callback_data: `categoria_${producto.categoria_id}` }]
      ];
      
      await ctx.editMessageText(
        `🛍️ ${producto.producto_nombre}\n💰 Precio: $${precio.toLocaleString()}\n\n¿Cuántas unidades?`,
        { reply_markup: { inline_keyboard: keyboard } }
      );
      
    } else if (callbackData.startsWith('cantidad_')) {
      const parts = callbackData.split('_');
      
      if (parts[1] === 'custom') {
        const productoId = parseInt(parts[2]);
        setUserState(userId, { 
          ...getUserState(userId), 
          step: 'cantidad_custom', 
          producto_id: productoId 
        });
        
        await ctx.editMessageText('🔢 Escribe la cantidad que deseas:');
        return;
      }
      
      const productoId = parseInt(parts[1]);
      const cantidad = parseInt(parts[2]);
      
      console.log(`📦 Agregando al carrito: Producto ${productoId}, Cantidad ${cantidad}`);
      
      const productos = await obtenerDatosSheet('Productos');
      const producto = productos.find(p => p.producto_id == productoId);
      
      if (!producto) {
        await ctx.reply('❌ Producto no encontrado');
        return;
      }
      
      const userState = getUserState(userId);
      const cliente = userState.cliente;
      const precio = calcularPrecio(producto, cliente.lista || 1);
      const importe = precio * cantidad;
      
      const cart = getUserCart(userId);
      cart.push({
        producto_id: productoId,
        producto_nombre: producto.producto_nombre,
        categoria_id: producto.categoria_id,
        cantidad: cantidad,
        precio_unitario: precio,
        importe: importe
      });
      setUserCart(userId, cart);
      
      await ctx.editMessageText(
        `✅ Agregado al carrito:\n🛍️ ${producto.producto_nombre}\n📦 Cantidad: ${cantidad}\n💰 Subtotal: $${importe.toLocaleString()}\n\n¿Qué más necesitas?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Seguir comprando', callback_data: 'hacer_pedido' }],
              [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
              [{ text: '✅ Finalizar pedido', callback_data: 'finalizar_pedido' }]
            ]
          }
        }
      );
      
    } else if (callbackData === 'ver_carrito') {
      const cart = getUserCart(userId);
      
      if (cart.length === 0) {
        await ctx.editMessageText('🛒 Tu carrito está vacío', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛍️ Empezar a comprar', callback_data: 'hacer_pedido' }]
            ]
          }
        });
        return;
      }
      
      let mensaje = '🛒 *Tu carrito:*\n\n';
      let total = 0;
      
      cart.forEach((item, index) => {
        mensaje += `${index + 1}. ${item.producto_nombre}\n`;
        mensaje += `   📦 Cantidad: ${item.cantidad}\n`;
        mensaje += `   💰 $${item.precio_unitario.toLocaleString()} c/u = $${item.importe.toLocaleString()}\n\n`;
        total += item.importe;
      });
      
      mensaje += `💰 *Total: $${total.toLocaleString()}*`;
      
      await ctx.editMessageText(mensaje, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Seguir comprando', callback_data: 'hacer_pedido' }],
            [{ text: '✅ Finalizar pedido', callback_data: 'finalizar_pedido' }],
            [{ text: '🗑️ Vaciar carrito', callback_data: 'vaciar_carrito' }]
          ]
        }
      });
      
    } else if (callbackData === 'finalizar_pedido') {
      const cart = getUserCart(userId);
      
      if (cart.length === 0) {
        await ctx.reply('❌ Tu carrito está vacío');
        return;
      }
      
      await confirmarPedido(ctx, userId);
      
    } else if (callbackData === 'vaciar_carrito') {
      setUserCart(userId, []);
      await ctx.editMessageText('🗑️ Carrito vaciado', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍️ Empezar a comprar', callback_data: 'hacer_pedido' }]
          ]
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error en callback:', error);
    await ctx.reply('❌ Ocurrió un error. Intenta nuevamente.');
  }
});

// Manejo de mensajes de texto
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'Usuario';
  const userState = getUserState(userId);
  const text = ctx.message.text;
  
  console.log(`💬 Mensaje de ${userName}: "${text}" (Estado: ${userState.step})`);
  
  try {
    if (userState.step === 'cantidad_custom') {
      const cantidad = parseInt(text);
      
      if (isNaN(cantidad) || cantidad <= 0) {
        await ctx.reply('❌ Por favor ingresa un número válido mayor a 0');
        return;
      }
      
      const productoId = userState.producto_id;
      const productos = await obtenerDatosSheet('Productos');
      const producto = productos.find(p => p.producto_id == productoId);
      
      if (!producto) {
        await ctx.reply('❌ Producto no encontrado');
        return;
      }
      
      const cliente = userState.cliente;
      const precio = calcularPrecio(producto, cliente.lista || 1);
      const importe = precio * cantidad;
      
      const cart = getUserCart(userId);
      cart.push({
        producto_id: productoId,
        producto_nombre: producto.producto_nombre,
        categoria_id: producto.categoria_id,
        cantidad: cantidad,
        precio_unitario: precio,
        importe: importe
      });
      setUserCart(userId, cart);
      
      setUserState(userId, { ...userState, step: 'seleccionar_categoria' });
      
      await ctx.reply(
        `✅ Agregado al carrito:\n🛍️ ${producto.producto_nombre}\n📦 Cantidad: ${cantidad}\n💰 Subtotal: $${importe.toLocaleString()}\n\n¿Qué más necesitas?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Seguir comprando', callback_data: 'hacer_pedido' }],
              [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
              [{ text: '✅ Finalizar pedido', callback_data: 'finalizar_pedido' }]
            ]
          }
        }
      );
      
    } else {
      // Mensaje no reconocido
      await ctx.reply(
        '❓ No entiendo ese mensaje. Usa /start para comenzar o los botones del menú.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Menú principal', callback_data: 'start' }]
            ]
          }
        }
      );
    }
    
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    await ctx.reply('❌ Ocurrió un error. Intenta nuevamente.');
  }
});

// Función para confirmar pedido
async function confirmarPedido(ctx, userId) {
  try {
    const userState = getUserState(userId);
    const cart = getUserCart(userId);
    const cliente = userState.cliente;
    const pedidoId = userState.pedido_id;
    
    if (!cliente || cart.length === 0) {
      await ctx.reply('❌ Error: No hay cliente o carrito vacío');
      return;
    }
    
    console.log(`✅ Confirmando pedido ${pedidoId} para ${cliente.nombre}`);
    
    // Calcular totales
    const itemsTotal = cart.reduce((sum, item) => sum + item.cantidad, 0);
    const montoTotal = cart.reduce((sum, item) => sum + item.importe, 0);
    
    // Crear pedido en Google Sheets
    const fechaHora = new Date().toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const pedidoData = [
      pedidoId,
      fechaHora,
      cliente.cliente_id,
      cliente.nombre,
      itemsTotal,
      montoTotal,
      'CONFIRMADO'
    ];
    
    await agregarDatosSheet('Pedidos', pedidoData);
    
    // Crear detalles del pedido
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const detalleId = `${pedidoId}_${i + 1}`;
      
      const detalleData = [
        detalleId,
        pedidoId,
        item.producto_id,
        item.producto_nombre,
        item.categoria_id,
        item.cantidad,
        item.precio_unitario,
        item.importe
      ];
      
      await agregarDatosSheet('DetallePedidos', detalleData);
    }
    
    // Limpiar estado del usuario
    setUserState(userId, { step: 'idle' });
    setUserCart(userId, []);
    
    // Mensaje de confirmación
    let mensaje = `✅ *Pedido confirmado*\n\n`;
    mensaje += `📋 ID: ${pedidoId}\n`;
    mensaje += `👤 Cliente: ${cliente.nombre}\n`;
    mensaje += `📅 Fecha: ${fechaHora}\n`;
    mensaje += `📦 Items: ${itemsTotal}\n`;
    mensaje += `💰 Total: $${montoTotal.toLocaleString()}\n\n`;
    mensaje += `🎉 ¡Gracias por tu pedido!`;
    
    await ctx.reply(mensaje, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 Nuevo pedido', callback_data: 'hacer_pedido' }],
          [{ text: '🏠 Menú principal', callback_data: 'start' }]
        ]
      }
    });
    
    console.log(`✅ Pedido ${pedidoId} guardado exitosamente`);
    
  } catch (error) {
    console.error('❌ Error confirmando pedido:', error);
    await ctx.reply('❌ Error al confirmar el pedido. Intenta nuevamente.');
  }
}

// Configurar webhook
app.post('/webhook', (req, res) => {
  try {
    console.log('📨 Webhook recibido:', JSON.stringify(req.body, null, 2));
    bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(500).send('Error');
  }
});

// API Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'Sistema Distribuidora Bot',
    version: '1.0.0',
    status: 'running',
    features: [
      'Bot de Telegram',
      'Integración Google Sheets',
      'Sistema de pedidos',
      'Carrito de compras'
    ]
  });
});

app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await obtenerDatosSheet('Clientes');
    res.json({ success: true, clientes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/productos', async (req, res) => {
  try {
    const productos = await obtenerDatosSheet('Productos');
    res.json({ success: true, productos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/detalles-pedidos', async (req, res) => {
  try {
    const detalles = await obtenerDatosSheet('DetallePedidos');
    res.json({ success: true, detalles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`🤖 Bot de Telegram configurado`);
  console.log(`📊 Google Sheets: ${SPREADSHEET_ID ? 'Configurado' : 'No configurado'}`);
});

// Manejo de errores
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});