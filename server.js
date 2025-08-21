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

// Configuración de Google Sheets (opcional)
if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && SPREADSHEET_ID) {
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
    console.error('❌ Error configurando Google Sheets:', error.message);
    sheets = null;
  }
} else {
  console.log('⚠️ Google Sheets no configurado - usando datos de ejemplo');
}

// Función para leer de Google Sheets con detección automática de headers
async function leerSheet(nombreHoja) {
  console.log(`🔍 DEBUG - Intentando leer hoja: "${nombreHoja}"`);
  
  if (!sheets || !SPREADSHEET_ID) {
    console.log(`⚠️ Google Sheets no disponible, usando datos de ejemplo para ${nombreHoja}`);
    return [];
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${nombreHoja}!A:Z`,
    });

    const rows = response.data.values || [];
    console.log(`📊 DEBUG - ${nombreHoja}: ${rows.length} filas obtenidas de Google Sheets`);
    
    if (rows.length === 0) return [];

    // Los headers están SIEMPRE en la fila 5 (índice 4)
    const headerRowIndex = 4;
    
    if (rows.length <= headerRowIndex) {
      console.log(`⚠️ ${nombreHoja} no tiene suficientes filas`);
      return [];
    }
    
    const headers = rows[headerRowIndex];
    console.log(`🔧 DEBUG - Headers en ${nombreHoja}:`, headers);

    console.log(`✅ Headers encontrados en ${nombreHoja} fila ${headerRowIndex + 1}:`, headers);

    // Procesar datos desde la siguiente fila
    const dataRows = rows.slice(headerRowIndex + 1);
    console.log(`📋 DEBUG - ${nombreHoja}: ${dataRows.length} filas de datos para procesar`);
    const result = [];

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;
      
      // Verificar que la fila tenga datos útiles
      const hasData = row.some(cell => cell && cell.toString().trim() !== '');
      if (!hasData) continue;

      const obj = {};
      headers.forEach((header, index) => {
        if (header) {
          obj[header] = row[index] || '';
        }
      });
      
      // Solo agregar si tiene datos mínimos requeridos
      if (nombreHoja === 'LISTADO CLIENTES' && obj['Activo'] === 'SI' && obj['Código'] && obj['Razón Social'] && obj['Localidad']) {
        // Solo incluir clientes con Razón Social y Localidad válidas
        const cliente = {
          Código: obj['Código'],
          'Razón Social': obj['Razón Social'],
          Localidad: obj['Localidad']
        };
        result.push(cliente);
      } else if (nombreHoja === 'LISTADO PRODUCTO' && obj['Código'] && obj['Artículo'] && obj['Rubro']) {
        result.push(obj);
      }
    }

    console.log(`✅ DEBUG - ${nombreHoja}: ${result.length} registros válidos procesados`);
    if (result.length > 0) {
      console.log(`📝 DEBUG - Primer registro de ${nombreHoja}:`, result[0]);
    }
    console.log(`✅ ${nombreHoja}: ${result.length} registros procesados`);
    return result;

  } catch (error) {
    console.error(`❌ Error leyendo ${nombreHoja}:`, error.message);
    console.log(`🔄 DEBUG - Usando datos de ejemplo para ${nombreHoja}`);
    return [];
  }
}

// Función para escribir a Google Sheets
async function escribirSheet(nombreHoja, datos) {
  if (!sheets || !SPREADSHEET_ID) {
    console.log('⚠️ Google Sheets no disponible para escribir');
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
    console.error(`❌ Error escribiendo en ${nombreHoja}:`, error.message);
    return false;
  }
}

// Datos de ejemplo (fallback)
const datosEjemplo = {
  clientes: [
    { Código: '65', 'Razón Social': 'A Y M' },
    { Código: '56', 'Razón Social': 'ADRIANA NONINO' },
    { Código: '98', 'Razón Social': 'ALAN HUALLPARUCA' },
    { Código: '122', 'Razón Social': 'ALICIA REBOLA' },
    { Código: '68', 'Razón Social': 'AMBORDT STELLA MARIS' }
  ],
  productos: [
    { Código: '1', Descripción: 'Oreo Original 117g', Rubro: 'Galletitas', Precio: '450' },
    { Código: '2', Descripción: 'Pepitos Chocolate 100g', Rubro: 'Galletitas', Precio: '380' },
    { Código: '3', Descripción: 'Coca Cola 500ml', Rubro: 'Bebidas', Precio: '350' },
    { Código: '4', Descripción: 'Leche Entera 1L', Rubro: 'Lácteos', Precio: '280' }
  ]
};

// API Routes
app.get('/api/clientes', async (req, res) => {
  try {
    let clientes = await leerSheet('LISTADO CLIENTES');
    if (clientes.length === 0) {
      clientes = datosEjemplo.clientes;
    }
    res.json(clientes);
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.json(datosEjemplo.clientes);
  }
});

app.get('/api/productos', async (req, res) => {
  try {
    let productos = await leerSheet('LISTADO PRODUCTO');
    if (productos.length === 0) {
      productos = datosEjemplo.productos;
    }
    res.json(productos);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.json(datosEjemplo.productos);
  }
});

app.get('/api/pedidos', async (req, res) => {
  try {
    // Por ahora solo devolvemos pedidos en memoria
    res.json(pedidosEnMemoria);
  } catch (error) {
    console.error('Error obteniendo pedidos:', error);
    res.json([]);
  }
});

app.get('/api/rubros', async (req, res) => {
  try {
    let productos = await leerSheet('LISTADO PRODUCTO');
    if (productos.length === 0) {
      productos = datosEjemplo.productos;
    }
    
    // Extraer rubros únicos
    const rubros = [...new Set(productos.map(p => p.Rubro || p.rubro).filter(r => r))];
    res.json(rubros.sort());
  } catch (error) {
    console.error('Error obteniendo rubros:', error);
    const rubros = [...new Set(datosEjemplo.productos.map(p => p.Rubro))];
    res.json(rubros.sort());
  }
});

app.get('/api/productos/:rubro', async (req, res) => {
  try {
    const rubro = req.params.rubro;
    let productos = await leerSheet('LISTADO PRODUCTO');
    if (productos.length === 0) {
      productos = datosEjemplo.productos;
    }
    
    const productosFiltrados = productos.filter(p => (p.Rubro || p.rubro) === rubro);
    res.json(productosFiltrados);
  } catch (error) {
    console.error('Error obteniendo productos por rubro:', error);
    const productosFiltrados = datosEjemplo.productos.filter(p => p.Rubro === req.params.rubro);
    res.json(productosFiltrados);
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    let clientes = await leerSheet('LISTADO CLIENTES');
    let productos = await leerSheet('LISTADO PRODUCTO');
    
    if (clientes.length === 0) clientes = datosEjemplo.clientes;
    if (productos.length === 0) productos = datosEjemplo.productos;
    
    const stats = {
      totalClientes: clientes.length,
      totalProductos: productos.length,
      totalPedidos: pedidosEnMemoria.length,
      ventasTotal: pedidosEnMemoria.reduce((sum, p) => sum + (parseInt(p.total) || 0), 0)
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.json({
      totalClientes: datosEjemplo.clientes.length,
      totalProductos: datosEjemplo.productos.length,
      totalPedidos: 0,
      ventasTotal: 0
    });
  }
});

// Ruta de información de la API
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Sistema Distribuidora Bot',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      clientes: '/api/clientes',
      productos: '/api/productos',
      rubros: '/api/rubros',
      pedidos: '/api/pedidos',
      stats: '/api/stats',
      health: '/health'
    },
    integrations: {
      googleSheets: !!sheets,
      telegram: !!TELEGRAM_BOT_TOKEN
    }
  });
});

// Test endpoints
app.get('/api/test/clientes', async (req, res) => {
  try {
    const clientes = await leerSheet('LISTADO CLIENTES');
    res.json({
      success: true,
      count: clientes.length,
      sample: clientes.slice(0, 3),
      message: 'Clientes cargados correctamente'
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      fallback: datosEjemplo.clientes.length
    });
  }
});

app.get('/api/test/productos', async (req, res) => {
  try {
    const productos = await leerSheet('LISTADO PRODUCTO');
    res.json({
      success: true,
      count: productos.length,
      sample: productos.slice(0, 3),
      message: 'Productos cargados correctamente'
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      fallback: datosEjemplo.productos.length
    });
  }
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
    console.log('📨 DEBUG - Webhook recibido:', JSON.stringify(req.body, null, 2));
    
    const { message, callback_query } = req.body;
    
    if (message) {
      console.log(`💬 DEBUG - Mensaje recibido de ${message.from.id}: "${message.text}"`);
      await manejarMensaje(message);
    }
    
    if (callback_query) {
      console.log(`🔘 DEBUG - Callback recibido de ${callback_query.from.id}: "${callback_query.data}"`);
      await manejarCallback(callback_query);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook:', error);
    console.log('🚨 DEBUG - Error completo:', error.stack);
    res.status(500).send('Error');
  }
});

// Manejar mensajes
async function manejarMensaje(message) {
  const chatId = message.chat.id;
  const texto = message.text;
  const userId = message.from.id;
  
  console.log(`🎯 DEBUG - Procesando mensaje: chatId=${chatId}, userId=${userId}, texto="${texto}"`);
  
  const sesion = sesionesBot.get(userId) || { 
    estado: 'inicio', 
    pedido: { items: [], total: 0 },
    clienteSeleccionado: null,
    rubroSeleccionado: null,
    productoSeleccionado: null
  };
  
  if (texto === '/start') {
    sesionesBot.set(userId, { 
      estado: 'inicio', 
      pedido: { items: [], total: 0 },
      clienteSeleccionado: null,
      rubroSeleccionado: null,
      productoSeleccionado: null
    });
    
    console.log('🚀 DEBUG - Enviando mensaje de bienvenida');
    await enviarMensaje(chatId, '🛒 ¡Bienvenido a RG Distribuciones!\n\nSelecciona una opción:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '📋 Ver Productos', callback_data: 'ver_productos' }],
          [{ text: '❓ Ayuda', callback_data: 'ayuda' }]
        ]
      }
    });
  }
  
  // Manejar cantidad de producto
  if (sesion.estado === 'esperando_cantidad' && /^\d+$/.test(texto)) {
    const cantidad = parseInt(texto);
    const producto = sesion.productoSeleccionado;
    
    if (cantidad > 0 && cantidad <= 100) {
      const precio = parseFloat(producto['Lista 1'] || 0);
      const importe = precio * cantidad;
      
      sesion.pedido.items.push({
        codigo: producto.Código,
        nombre: producto.Artículo,
        precio: precio,
        cantidad: cantidad,
        importe: importe
      });
      sesion.pedido.total += importe;
      sesion.estado = 'pedido_activo';
      
      await enviarMensaje(chatId, `✅ Agregado: ${cantidad}x ${producto.Artículo}\nPrecio: $${precio}\nSubtotal: $${importe}\nTotal del pedido: $${sesion.pedido.total}\n\n¿Qué deseas hacer?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Agregar más productos', callback_data: 'seleccionar_rubro' }],
            [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
            [{ text: '✅ Finalizar pedido', callback_data: 'finalizar_pedido' }],
            [{ text: '🔙 Volver al inicio', callback_data: 'inicio' }]
          ]
        }
      });
      
      sesionesBot.set(userId, sesion);
    } else {
      await enviarMensaje(chatId, '❌ Cantidad inválida. Ingresa un número entre 1 y 100:');
    }
  }
}

// Manejar callbacks
async function manejarCallback(callback_query) {
  const chatId = callback_query.message.chat.id;
  const data = callback_query.data;
  const userId = callback_query.from.id;
  
  console.log(`🎯 DEBUG - Procesando callback: chatId=${chatId}, userId=${userId}, data="${data}"`);
  
  const sesion = sesionesBot.get(userId) || { 
    estado: 'inicio', 
    pedido: { items: [], total: 0 },
    clienteSeleccionado: null,
    rubroSeleccionado: null,
    productoSeleccionado: null
  };
  
  try {
    if (data === 'hacer_pedido') {
      console.log('🛍️ DEBUG - Procesando "hacer_pedido"');
      // Mostrar lista de clientes
      let clientes = await leerSheet('LISTADO CLIENTES');
      console.log(`👥 DEBUG - Clientes obtenidos: ${clientes.length}`);
      
      if (clientes.length === 0) {
        console.log('🔄 DEBUG - Usando datos de ejemplo para clientes');
        clientes = datosEjemplo.clientes;
      }
      
      // Agrupar clientes por localidad
      const clientesPorLocalidad = {};
      clientes.forEach(cliente => {
        const localidad = cliente.Localidad || 'Sin Localidad';
        if (!clientesPorLocalidad[localidad]) {
          clientesPorLocalidad[localidad] = [];
        }
        clientesPorLocalidad[localidad].push(cliente);
      });
      
      console.log(`🏘️ DEBUG - Localidades encontradas:`, Object.keys(clientesPorLocalidad));
      
      // Crear teclado con localidades
      const keyboard = Object.keys(clientesPorLocalidad).sort().slice(0, 15).map(localidad => [{ 
        text: `📍 ${localidad} (${clientesPorLocalidad[localidad].length})`, 
        callback_data: `localidad_${localidad}` 
      }]);
      
      console.log(`⌨️ DEBUG - Teclado generado con ${keyboard.length} opciones`);
      await enviarMensaje(chatId, '📍 Selecciona una localidad:', {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    
    if (data.startsWith('localidad_')) {
      const localidad = data.split('_')[1];
      console.log(`📍 DEBUG - Localidad seleccionada: ${localidad}`);
      
      let clientes = await leerSheet('LISTADO CLIENTES');
      if (clientes.length === 0) {
        clientes = datosEjemplo.clientes;
      }
      
      const clientesFiltrados = clientes.filter(c => (c.Localidad || 'Sin Localidad') === localidad);
      console.log(`👥 DEBUG - Clientes en ${localidad}: ${clientesFiltrados.length}`);
      
      const keyboard = clientesFiltrados.slice(0, 20).map(cliente => [{ 
        text: cliente['Razón Social'], 
        callback_data: `cliente_${cliente.Código}` 
      }]);
      
      // Agregar botón para volver
      keyboard.push([{ text: '🔙 Volver a localidades', callback_data: 'hacer_pedido' }]);
      
      await enviarMensaje(chatId, `👤 Clientes en ${localidad}:\n\nSelecciona un cliente:`, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    
    if (data.startsWith('cliente_')) {
      const clienteCodigo = data.split('_')[1];
      console.log(`👤 DEBUG - Cliente seleccionado: ${clienteCodigo}`);
      
      let clientes = await leerSheet('LISTADO CLIENTES');
      if (clientes.length === 0) {
        clientes = datosEjemplo.clientes;
      }
      
      const cliente = clientes.find(c => c.Código == clienteCodigo);
      console.log(`🔍 DEBUG - Cliente encontrado:`, cliente);
      
      if (cliente) {
        sesion.clienteSeleccionado = cliente;
        sesion.estado = 'cliente_seleccionado';
        sesionesBot.set(userId, sesion);
        
        // Mostrar rubros
        let productos = await leerSheet('LISTADO PRODUCTO');
        console.log(`📦 DEBUG - Productos obtenidos: ${productos.length}`);
        
        if (productos.length === 0) {
          productos = datosEjemplo.productos;
        }
        
        const rubros = [...new Set(productos.map(p => p.Rubro).filter(r => r))];
        console.log(`📂 DEBUG - Rubros encontrados:`, rubros);
        
        const keyboard = rubros.sort().map(rubro => [{ 
          text: rubro, 
          callback_data: `rubro_${rubro}` 
        }]);
        
        console.log(`⌨️ DEBUG - Teclado de rubros con ${keyboard.length} opciones`);
        await enviarMensaje(chatId, `✅ Cliente: ${cliente['Razón Social']}\n📍 Localidad: ${cliente.Localidad}\n\n📂 Selecciona una categoría:`, {
          reply_markup: { inline_keyboard: keyboard }
        });
      }
    }
    
    if (data.startsWith('rubro_')) {
      const rubro = data.split('_')[1];
      sesion.rubroSeleccionado = rubro;
      sesionesBot.set(userId, sesion);
      
      let productos = await leerSheet('LISTADO PRODUCTO');
      if (productos.length === 0) {
        productos = datosEjemplo.productos;
      }
      
      const productosFiltrados = productos.filter(p => p.Rubro === rubro);
      const keyboard = productosFiltrados.slice(0, 15).map(prod => [{ 
        text: `${prod.Artículo} - $${prod['Lista 1'] || 'S/P'}`, 
        callback_data: `producto_${prod.Código}` 
      }]);
      
      keyboard.push([{ text: '🔙 Volver a categorías', callback_data: 'seleccionar_rubro' }]);
      
      await enviarMensaje(chatId, `📂 ${rubro}\n🛍️ Selecciona un producto:`, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    
    if (data === 'seleccionar_rubro') {
      if (!sesion.clienteSeleccionado) {
        await enviarMensaje(chatId, '❌ Primero debes seleccionar un cliente', {
          reply_markup: {
            inline_keyboard: [[{ text: '👤 Seleccionar Cliente', callback_data: 'hacer_pedido' }]]
          }
        });
        return;
      }
      
      let productos = await leerSheet('LISTADO PRODUCTO');
      if (productos.length === 0) {
        productos = datosEjemplo.productos;
      }
      
      const rubros = [...new Set(productos.map(p => p.Rubro).filter(r => r))];
      const keyboard = rubros.sort().map(rubro => [{ 
        text: rubro, 
        callback_data: `rubro_${rubro}` 
      }]);
      
      await enviarMensaje(chatId, `✅ Cliente: ${sesion.clienteSeleccionado['Razón Social']}\n\n📂 Selecciona una categoría:`, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    
    if (data.startsWith('producto_')) {
      const productoCodigo = data.split('_')[1];
      let productos = await leerSheet('LISTADO PRODUCTO');
      if (productos.length === 0) {
        productos = datosEjemplo.productos;
      }
      
      const producto = productos.find(p => p.Código == productoCodigo);
      if (producto) {
        sesion.estado = 'esperando_cantidad';
        sesion.productoSeleccionado = producto;
        sesionesBot.set(userId, sesion);
        
        const precio = producto['Lista 1'] || 'Consultar';
        await enviarMensaje(chatId, `📦 ${producto.Artículo}\n💰 Precio: $${precio}\n\n¿Cuántas unidades quieres? (1-100)`);
      }
    }
    
    if (data === 'ver_carrito') {
      if (sesion.pedido.items.length === 0) {
        await enviarMensaje(chatId, '🛒 Tu carrito está vacío\n\n¿Deseas agregar productos?', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }]
            ]
          }
        });
      } else {
        let mensaje = '🛒 TU CARRITO:\n\n';
        if (sesion.clienteSeleccionado) {
          mensaje += `👤 Cliente: ${sesion.clienteSeleccionado['Razón Social']}\n\n`;
        }
        
        sesion.pedido.items.forEach((item, index) => {
          mensaje += `${index + 1}. ${item.nombre}\n   ${item.cantidad}x $${item.precio} = $${item.importe}\n\n`;
        });
        mensaje += `💰 TOTAL: $${sesion.pedido.total}`;
        
        await enviarMensaje(chatId, mensaje, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Agregar más', callback_data: 'seleccionar_rubro' }],
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
            [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }]
          ]
        }
      });
    }
    
    if (data === 'finalizar_pedido') {
      if (sesion.pedido.items.length === 0) {
        await enviarMensaje(chatId, '❌ No tienes productos en el carrito');
        return;
      }
      
      if (!sesion.clienteSeleccionado) {
        await enviarMensaje(chatId, '❌ No has seleccionado un cliente');
        return;
      }
      
      // Crear pedido
      const pedidoId = `PED${String(contadorPedidos++).padStart(3, '0')}`;
      const fechaHora = new Date().toLocaleString('es-AR');
      
      const nuevoPedido = {
        pedido_id: pedidoId,
        fecha_hora: fechaHora,
        cliente_codigo: sesion.clienteSeleccionado.Código,
        cliente_nombre: sesion.clienteSeleccionado['Razón Social'],
        items_cantidad: sesion.pedido.items.length,
        total: sesion.pedido.total,
        estado: 'CONFIRMADO',
        items: sesion.pedido.items
      };
      
      // Guardar en memoria
      pedidosEnMemoria.push(nuevoPedido);
      
      // Limpiar sesión
      sesionesBot.set(userId, { 
        estado: 'inicio', 
        pedido: { items: [], total: 0 },
        clienteSeleccionado: null,
        rubroSeleccionado: null,
        productoSeleccionado: null
      });
      
      let mensaje = `✅ PEDIDO CONFIRMADO\n\n`;
      mensaje += `📋 Pedido: ${pedidoId}\n`;
      mensaje += `👤 Cliente: ${nuevoPedido.cliente_nombre}\n`;
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
      let productos = await leerSheet('LISTADO PRODUCTO');
      if (productos.length === 0) {
        productos = datosEjemplo.productos;
      }
      
      let mensaje = '📦 PRODUCTOS DISPONIBLES:\n\n';
      productos.slice(0, 20).forEach(prod => {
        const precio = prod['Lista 1'] || 'Consultar';
      mensaje += `• ${prod.Artículo} - $${precio}\n`;
      });
      
      if (productos.length > 20) {
        mensaje += `\n... y ${productos.length - 20} productos más`;
      }
      
      await enviarMensaje(chatId, mensaje);
    }
    
    if (data === 'ayuda') {
      const mensaje = `❓ AYUDA - RG Distribuciones\n\n` +
        `🛍️ Hacer Pedido: Selecciona cliente, categoría y productos\n` +
        `📋 Ver Productos: Lista completa de productos\n` +
        `🛒 Ver Carrito: Revisa tu pedido actual\n\n` +
        `Para hacer un pedido:\n` +
        `1. Selecciona un cliente\n` +
        `2. Elige una categoría\n` +
        `3. Selecciona productos\n` +
        `4. Ingresa la cantidad\n` +
        `5. Finaliza el pedido`;
      
      console.log('❓ DEBUG - Enviando mensaje de ayuda:', mensaje);
      await enviarMensaje(chatId, mensaje);
    }
    
    if (data === 'inicio') {
      sesionesBot.set(userId, { 
        estado: 'inicio', 
        pedido: { items: [], total: 0 },
        clienteSeleccionado: null,
        rubroSeleccionado: null,
        productoSeleccionado: null
      });
      
      await enviarMensaje(chatId, '🛒 ¡Bienvenido a RG Distribuciones!\n\nSelecciona una opción:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
            [{ text: '📋 Ver Productos', callback_data: 'ver_productos' }],
            [{ text: '❓ Ayuda', callback_data: 'ayuda' }]
          ]
        }
      });
    }
    
  } catch (error) {
    console.error('Error en callback:', error);
    console.log('🚨 DEBUG - Error completo en callback:', error.stack);
    await enviarMensaje(chatId, '❌ Error procesando solicitud. Intenta nuevamente.');
  }
}

// Enviar mensaje a Telegram
async function enviarMensaje(chatId, texto, opciones = {}) {
  console.log(`📤 DEBUG - Intentando enviar mensaje:`);
  console.log(`   chatId: ${chatId}`);
  console.log(`   texto: "${texto}"`);
  console.log(`   opciones:`, JSON.stringify(opciones, null, 2));
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.log(`[SIMULADO] Mensaje a ${chatId}: ${texto}`);
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    console.log(`🌐 DEBUG - URL de Telegram: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        ...opciones
      })
    });
    
    console.log(`📡 DEBUG - Respuesta de Telegram: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ DEBUG - Error enviando mensaje:', errorText);
    } else {
      const responseData = await response.json();
      console.log('✅ DEBUG - Mensaje enviado exitosamente:', responseData.ok);
    }
  } catch (error) {
    console.error('Error en enviarMensaje:', error);
    console.log('🚨 DEBUG - Error completo en enviarMensaje:', error.stack);
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
    const clientes = await leerSheet('LISTADO CLIENTES');
    const productos = await leerSheet('LISTADO PRODUCTO');
    
    res.json({
      connected: !!sheets,
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
    <title>RG Distribuciones - Sistema Bot</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-6">
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-gray-800 mb-2">🤖 RG Distribuciones</h1>
            <p class="text-gray-600">Sistema de gestión con Bot de Telegram</p>
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

        <!-- Test Buttons -->
        <div class="bg-white rounded-lg shadow p-6 mb-8">
            <h2 class="text-xl font-bold mb-4">🧪 Pruebas</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onclick="testClientes()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    Probar Clientes
                </button>
                <button onclick="testProductos()" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                    Probar Productos
                </button>
                <button onclick="testRubros()" class="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
                    Probar Rubros
                </button>
            </div>
            <div id="testResults" class="mt-4 p-4 bg-gray-100 rounded hidden">
                <h3 class="font-bold mb-2">Resultados:</h3>
                <pre id="testOutput" class="text-sm overflow-auto"></pre>
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
                
            } catch (error) {
                console.error('Error cargando datos:', error);
            }
        }

        async function testClientes() {
            try {
                const response = await fetch('/api/clientes');
                const data = await response.json();
                showTestResult('Clientes', data);
            } catch (error) {
                showTestResult('Error Clientes', error.message);
            }
        }

        async function testProductos() {
            try {
                const response = await fetch('/api/productos');
                const data = await response.json();
                showTestResult('Productos', data);
            } catch (error) {
                showTestResult('Error Productos', error.message);
            }
        }

        async function testRubros() {
            try {
                const response = await fetch('/api/rubros');
                const data = await response.json();
                showTestResult('Rubros', data);
            } catch (error) {
                showTestResult('Error Rubros', error.message);
            }
        }

        function showTestResult(title, data) {
            const resultsDiv = document.getElementById('testResults');
            const outputPre = document.getElementById('testOutput');
            
            resultsDiv.classList.remove('hidden');
            outputPre.textContent = title + ':\\n' + JSON.stringify(data, null, 2);
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
  
  // Debug: Verificar configuración de Telegram
  console.log('🔧 DEBUG - Configuración de Telegram:');
  console.log(`   TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? 'CONFIGURADO' : 'NO CONFIGURADO'}`);
  console.log(`   WEBHOOK_URL: ${WEBHOOK_URL || 'NO CONFIGURADO'}`);
  
  // Configurar webhook después de un delay
  setTimeout(configurarWebhook, 5000);
});