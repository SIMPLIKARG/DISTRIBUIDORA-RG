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
const FORCE_SHEETS = true; // Forzar uso de Google Sheets

// Configuración obligatoria de Google Sheets
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
  console.error('❌ CONFIGURACIÓN REQUERIDA:');
  console.error('   GOOGLE_SHEETS_ID=tu_sheet_id');
  console.error('   GOOGLE_SERVICE_ACCOUNT_EMAIL=tu_email@proyecto.iam.gserviceaccount.com');
  console.error('   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\ntu_clave\\n-----END PRIVATE KEY-----\\n"');
  console.error('');
  console.error('🔗 Guía completa: https://github.com/tu-repo/CONFIGURACION.md');
  process.exit(1);
}

// Inicializar Google Sheets
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
  process.exit(1);
}

// Verificar conexión al iniciar
async function verificarGoogleSheets() {
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
    console.error('🔧 Verifica que:');
    console.error('   1. El SPREADSHEET_ID sea correcto');
    console.error('   2. La cuenta de servicio tenga acceso');
    console.error('   3. Las hojas Clientes, Categorias, Productos, Pedidos existan');
    process.exit(1);
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
    throw error;
  }
}

// Función para escribir a Google Sheets
async function escribirSheet(nombreHoja, datos) {
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
    throw error;
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

// API para cambiar estado de pedido
app.put('/api/pedidos/:pedidoId/estado', async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { estado } = req.body;
    
    if (!['PENDIENTE', 'CONFIRMADO', 'CANCELADO'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    
    // Leer todos los pedidos
    const pedidos = await leerSheet('Pedidos');
    const pedidoIndex = pedidos.findIndex(p => p.pedido_id === pedidoId);
    
    if (pedidoIndex === -1) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    
    // Actualizar estado en Google Sheets
    const rowNumber = pedidoIndex + 2; // +2 porque: +1 para header, +1 para índice base 0
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Pedidos!G${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[estado]]
      }
    });
    
    res.json({ success: true, pedidoId, estado });
    
  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// API para obtener detalle de un pedido específico
app.get('/api/pedidos/:pedidoId/detalle', async (req, res) => {
  try {
    const { pedidoId } = req.params;
    
    // Obtener pedido
    const pedidos = await leerSheet('Pedidos');
    const pedido = pedidos.find(p => p.pedido_id === pedidoId);
    
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    
    // Obtener detalles del pedido
    const detalles = await leerSheet('DetallePedidos');
    const detallesPedido = detalles.filter(d => d.pedido_id === pedidoId);
    
    res.json({
      pedido: pedido,
      detalles: detallesPedido
    });
    
  } catch (error) {
    console.error('Error obteniendo detalle del pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.RAILWAY_STATIC_URL ? `${process.env.RAILWAY_STATIC_URL}/webhook` : null;

// Estado del bot (en memoria)
const sesionesBot = new Map();
let contadorPedidos = 1;

// Webhook de Telegram
app.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook recibido:', JSON.stringify(req.body, null, 2));
    
    const { message, callback_query } = req.body;
    
    if (message) {
      console.log('💬 Procesando mensaje de:', message.from.first_name);
      await manejarMensaje(message);
    }
    
    if (callback_query) {
      console.log('🔘 Procesando callback:', callback_query.data);
      await manejarCallback(callback_query);
    }
    
    console.log('✅ Webhook procesado exitosamente');
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error en webhook:', error.message);
    console.error('Stack:', error.stack);
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
          [{ text: '❓ Ayuda', callback_data: 'ayuda' }]
        ]
      }
    });
  }
  
  // Manejar selección de cliente por nombre
  if (sesion.estado === 'esperando_cliente') {
    const clientes = await leerSheet('Clientes');
    
    // Si hay localidad seleccionada, filtrar solo en esa localidad
    let clientesParaBuscar = clientes;
    if (sesion.localidadSeleccionada) {
      clientesParaBuscar = clientes.filter(c => c.localidad === sesion.localidadSeleccionada);
      console.log(`🔍 Buscando en localidad: ${sesion.localidadSeleccionada}`);
      console.log(`📊 Clientes en localidad: ${clientesParaBuscar.length}`);
    }
    
    const clientesEncontrados = clientesParaBuscar.filter(c => 
      c.nombre && c.nombre.toLowerCase().includes(texto.toLowerCase())
    );
    
    console.log(`🔍 Búsqueda "${texto}": ${clientesEncontrados.length} resultados`);
    
    if (clientesEncontrados.length === 0) {
      const localidadTexto = sesion.localidadSeleccionada ? ` en ${sesion.localidadSeleccionada}` : '';
      await enviarMensaje(chatId, `❌ No encontré ningún cliente con "${texto}"${localidadTexto}\n\nIntenta con otro nombre o parte del nombre:`);
    } else if (clientesEncontrados.length === 1) {
      // Solo un cliente encontrado, seleccionarlo automáticamente
      const clienteEncontrado = clientesEncontrados[0];
      sesion.clienteSeleccionado = clienteEncontrado;
      sesion.estado = 'cliente_confirmado';
      sesionesBot.set(userId, sesion);
      
      const categorias = await leerSheet('Categorias');
      const keyboard = categorias.map(cat => [{ 
        text: cat.categoria_nombre, 
        callback_data: `categoria_${cat.categoria_id}` 
      }]);
      
      await enviarMensaje(chatId, `✅ Cliente seleccionado: ${clienteEncontrado.nombre}\n\n📂 Selecciona una categoría:`, {
        reply_markup: {
          inline_keyboard: [
            ...keyboard,
            [{ text: '👤 Cambiar Cliente', callback_data: 'seleccionar_cliente' }]
          ]
        }
      });
    } else {
      // Múltiples clientes encontrados, mostrar opciones
      const keyboard = clientesEncontrados.map(cliente => [{ 
        text: `👤 ${cliente.nombre}`, 
        callback_data: `cliente_${cliente.cliente_id}` 
      }]);
      
      keyboard.push([{ text: '🔍 Buscar de nuevo', callback_data: 'buscar_cliente' }]);
      keyboard.push([{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]);
      
      const localidadTexto = sesion.localidadSeleccionada ? ` en ${sesion.localidadSeleccionada}` : '';
      await enviarMensaje(chatId, `🔍 Encontré ${clientesEncontrados.length} clientes con "${texto}"${localidadTexto}:\n\nSelecciona el correcto:`, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }
    return;
  }
  
  // Manejar nuevo cliente
  if (sesion.estado === 'esperando_nuevo_cliente') {
    const nombreCliente = texto.trim();
    
    if (nombreCliente.length < 2) {
      await enviarMensaje(chatId, '❌ El nombre debe tener al menos 2 caracteres. Intenta de nuevo:');
      return;
    }
    
    try {
      // Obtener el próximo ID de cliente
      const clientes = await leerSheet('Clientes');
      const maxId = Math.max(...clientes.map(c => parseInt(c.cliente_id) || 0));
      const nuevoId = maxId + 1;
      
      // Agregar cliente a Google Sheets
      await escribirSheet('Clientes', [nuevoId, nombreCliente]);
      
      // Seleccionar el nuevo cliente
      sesion.clienteSeleccionado = {
        cliente_id: nuevoId,
        nombre: nombreCliente
      };
      sesion.estado = 'cliente_confirmado';
      sesionesBot.set(userId, sesion);
      
      const categorias = await leerSheet('Categorias');
      const keyboard = categorias.map(cat => [{ 
        text: cat.categoria_nombre, 
        callback_data: `categoria_${cat.categoria_id}` 
      }]);
      
      await enviarMensaje(chatId, `✅ Cliente "${nombreCliente}" agregado y seleccionado\n\n📂 Selecciona una categoría:`, {
        reply_markup: {
          inline_keyboard: [
            ...keyboard,
            [{ text: '👤 Cambiar Cliente', callback_data: 'seleccionar_cliente' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('Error agregando cliente:', error);
      await enviarMensaje(chatId, '❌ Error agregando cliente. Intenta de nuevo:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Reintentar', callback_data: 'nuevo_cliente' }],
            [{ text: '📋 Ver Lista Existente', callback_data: 'lista_clientes' }]
          ]
        }
      });
    }
    return;
  }
  
  // Manejar búsqueda de productos
  if (sesion.estado === 'esperando_busqueda_producto') {
    const productos = await leerSheet('Productos');
    const productosActivos = productos.filter(p => p.activo === 'SI');
    
    const productosEncontrados = productosActivos.filter(p => 
      p.producto_nombre && p.producto_nombre.toLowerCase().includes(texto.toLowerCase())
    );
    
    console.log(`🔍 Búsqueda de productos "${texto}": ${productosEncontrados.length} resultados`);
    
    if (productosEncontrados.length === 0) {
      await enviarMensaje(chatId, `❌ No encontré productos con "${texto}"\n\nIntenta con otro término de búsqueda:`);
    } else if (productosEncontrados.length > 20) {
      await enviarMensaje(chatId, `🔍 Encontré ${productosEncontrados.length} productos con "${texto}"\n\nSé más específico para ver menos resultados:`);
    } else {
      // Ordenar productos encontrados alfabéticamente
      productosEncontrados.sort((a, b) => a.producto_nombre.localeCompare(b.producto_nombre));
      
      const keyboard = productosEncontrados.map(prod => [{ 
        text: `${prod.producto_nombre} - $${prod.precio}`, 
        callback_data: `producto_${prod.producto_id}` 
      }]);
      
      keyboard.push([{ text: '🔍 Buscar de nuevo', callback_data: 'buscar_producto' }]);
      keyboard.push([{ text: '📂 Ver por Categorías', callback_data: 'ver_categorias' }]);
      
      await enviarMensaje(chatId, `🔍 Encontré ${productosEncontrados.length} productos con "${texto}":`, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }
    
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
        categoria_id: producto.categoria_id,
        nombre: producto.producto_nombre,
        precio: producto.precio,
        cantidad: cantidad,
        importe: importe
      });
      sesion.pedido.total += importe;
      sesion.estado = 'inicio';
      
      await enviarMensaje(chatId, `✅ Agregado: ${cantidad}x ${producto.producto_nombre}\nSubtotal: $${importe}\nTotal del pedido: $${sesion.pedido.total}\n\n¿Qué deseas hacer?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Agregar más productos', callback_data: 'continuar_pedido' }],
            [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
            [{ text: '✅ Finalizar pedido', callback_data: 'finalizar_pedido' }]
          ]
        }
      });
      
      sesionesBot.set(userId, sesion);
    } else {
      await enviarMensaje(chatId, '❌ Cantidad inválida. Ingresa un número entre 1 y 50:');
    }
  }
}

// Manejar callbacks
async function manejarCallback(callback_query) {
  const chatId = callback_query.message.chat.id;
  const data = callback_query.data;
  const userId = callback_query.from.id;
  const sesion = sesionesBot.get(userId) || { estado: 'inicio', pedido: { items: [], total: 0 } };
  
  // Prevenir procesamiento múltiple del mismo callback
  const callbackId = callback_query.id;
  if (sesion.lastCallbackId === callbackId) {
    console.log('🔄 Callback duplicado ignorado:', callbackId);
    await answerCallbackQuery(callbackId);
    return;
  }
  sesion.lastCallbackId = callbackId;
  sesionesBot.set(userId, sesion);
  
  console.log('🔘 Procesando callback:', data, 'para usuario:', userId);
  
  // Responder inmediatamente al callback para quitar el loading
  await answerCallbackQuery(callbackId);
  
  if (data === 'hacer_pedido') {
    // Si ya hay un cliente seleccionado, ir directo a categorías
    if (sesion.clienteSeleccionado) {
      const categorias = await leerSheet('Categorias');
      const keyboard = categorias.map(cat => [{ 
        text: cat.categoria_nombre, 
        callback_data: `categoria_${cat.categoria_id}` 
      }]);
      
      await enviarMensaje(chatId, `👤 Cliente: ${sesion.clienteSeleccionado.nombre}\n\n📂 Selecciona una categoría:`, {
        reply_markup: { 
          inline_keyboard: [
            ...keyboard,
            [{ text: '👤 Cambiar Cliente', callback_data: 'seleccionar_cliente' }]
          ]
        }
      });
    } else {
      // Mostrar localidades primero
      const clientes = await leerSheet('Clientes');
      console.log('📊 Clientes obtenidos:', clientes.length);
      
      // Obtener localidades únicas
      const localidades = [...new Set(clientes.map(c => c.localidad).filter(l => l && l.trim()))];
      console.log('🏙️ Localidades encontradas:', localidades);
      
      if (localidades.length === 0) {
        await enviarMensaje(chatId, '⚠️ No hay localidades configuradas. Mostrando todos los clientes:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Ver Lista de Clientes', callback_data: 'lista_clientes' }],
              [{ text: '✍️ Buscar por Nombre', callback_data: 'buscar_cliente' }],
              [{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]
            ]
          }
        });
        return;
      }
      
      const keyboard = localidades.sort().map(localidad => [{ 
        text: `📍 ${localidad}`, 
        callback_data: `localidad_${Buffer.from(localidad).toString('base64')}` 
      }]);
      
      await enviarMensaje(chatId, '📍 Primero, selecciona la localidad:', {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }
  }
  
  // Manejar selección de localidad
  if (data.startsWith('localidad_')) {
    console.log('📍 Procesando selección de localidad...');
    const localidadBase64 = data.split('_')[1];
    const localidad = Buffer.from(localidadBase64, 'base64').toString();
    
    console.log(`📍 Localidad seleccionada: ${localidad}`);
    
    const clientes = await leerSheet('Clientes');
    const clientesFiltrados = clientes.filter(c => c.localidad === localidad);
    
    console.log(`👥 Clientes en ${localidad}:`, clientesFiltrados.length);
    console.log('🔍 Clientes encontrados:', clientesFiltrados.map(c => `${c.cliente_id}: ${c.nombre}`));
    
    if (clientesFiltrados.length === 0) {
      await enviarMensaje(chatId, `❌ No hay clientes en ${localidad}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Volver a Localidades', callback_data: 'hacer_pedido' }],
            [{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]
          ]
        }
      });
    } else {
      // Guardar localidad seleccionada en sesión
      sesion.localidadSeleccionada = localidad;
      sesionesBot.set(userId, sesion);
      
      // Mostrar TODOS los clientes de la localidad (sin límite)
      const keyboard = clientesFiltrados.map(cliente => [{ 
        text: `👤 ${cliente.nombre}`, 
        callback_data: `cliente_${cliente.cliente_id}` 
      }]);
      
      keyboard.push([{ text: '🔙 Cambiar Localidad', callback_data: 'hacer_pedido' }]);
      keyboard.push([{ text: '✍️ Buscar por Nombre', callback_data: 'buscar_cliente_localidad' }]);
      keyboard.push([{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]);
      
      await enviarMensaje(chatId, `👥 Clientes en ${localidad} (${clientesFiltrados.length} encontrados):`, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }
    console.log('✅ Localidad procesada exitosamente');
    return;
  }
  
  if (data === 'nuevo_cliente') {
    sesion.estado = 'esperando_nuevo_cliente';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '➕ Escribe el nombre del nuevo cliente:');
  }
  
  if (data === 'lista_clientes') {
    const clientes = await leerSheet('Clientes');
    console.log('📋 Mostrando lista de clientes:', clientes.length);
    
    // Si hay localidad seleccionada, filtrar
    let clientesParaMostrar = clientes;
    if (sesion.localidadSeleccionada) {
      clientesParaMostrar = clientes.filter(c => c.localidad === sesion.localidadSeleccionada);
    }
    
    const keyboard = clientesParaMostrar.map(cliente => [{ 
      text: `👤 ${cliente.nombre}`, 
      callback_data: `cliente_${cliente.cliente_id}` 
    }]);
    
    keyboard.push([{ text: '✍️ Buscar por Nombre', callback_data: 'buscar_cliente' }]);
    keyboard.push([{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]);
    
    const localidadTexto = sesion.localidadSeleccionada ? ` en ${sesion.localidadSeleccionada}` : '';
    await enviarMensaje(chatId, `👥 Selecciona un cliente${localidadTexto} (${clientesParaMostrar.length} disponibles):`, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    return;
  }
  
  if (data === 'buscar_cliente') {
    sesion.estado = 'esperando_cliente';
    sesionesBot.set(userId, sesion);
    
    const localidadTexto = sesion.localidadSeleccionada ? ` en ${sesion.localidadSeleccionada}` : '';
    await enviarMensaje(chatId, `✍️ Escribe el nombre del cliente (o parte del nombre)${localidadTexto}:`);
  }
  
  if (data === 'buscar_cliente_localidad') {
    sesion.estado = 'esperando_cliente';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, `✍️ Escribe el nombre del cliente en ${sesion.localidadSeleccionada}:`);
  }
  
  if (data.startsWith('cliente_')) {
    const clienteId = data.split('_')[1];
    const clientes = await leerSheet('Clientes');
    console.log(`🔍 Buscando cliente ID: ${clienteId}`);
    const cliente = clientes.find(c => c.cliente_id == clienteId);
    console.log('👤 Cliente encontrado:', cliente);
    
    if (cliente) {
      sesion.clienteSeleccionado = cliente;
      sesion.estado = 'cliente_confirmado';
      sesionesBot.set(userId, sesion);
      
      const categorias = await leerSheet('Categorias');
      const keyboard = categorias.map(cat => [{ 
        text: cat.categoria_nombre, 
        callback_data: `categoria_${cat.categoria_id}` 
      }]);
      
      await enviarMensaje(chatId, `✅ Cliente seleccionado: ${cliente.nombre}\n\n📂 Selecciona una categoría:`, {
        reply_markup: {
          inline_keyboard: [
            ...keyboard,
            [{ text: '👤 Cambiar Cliente', callback_data: 'seleccionar_cliente' }],
            [{ text: '📍 Cambiar Localidad', callback_data: 'cambiar_localidad' }],
            [{ text: '🔍 Buscar Producto', callback_data: 'buscar_producto' }]
          ]
        }
      });
    } else {
      await enviarMensaje(chatId, '❌ Cliente no encontrado', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Volver', callback_data: 'hacer_pedido' }]
          ]
        }
      });
    }
    return;
  }
  
  if (data === 'cambiar_localidad') {
    // Limpiar localidad y cliente seleccionados
    sesion.localidadSeleccionada = null;
    sesion.clienteSeleccionado = null;
    sesionesBot.set(userId, sesion);
    
    // Mostrar localidades disponibles
    const clientes = await leerSheet('Clientes');
    const localidades = [...new Set(clientes.map(c => c.localidad).filter(l => l && l.trim()))];
    
    if (localidades.length === 0) {
      await enviarMensaje(chatId, '⚠️ No hay localidades configuradas.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Ver Lista de Clientes', callback_data: 'lista_clientes' }],
            [{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]
          ]
        }
      });
      return;
    }
    
    const keyboard = localidades.sort().map(localidad => [{ 
      text: `📍 ${localidad}`, 
      callback_data: `localidad_${Buffer.from(localidad).toString('base64')}` 
    }]);
    
    await enviarMensaje(chatId, '📍 Selecciona una localidad:', {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    return;
  }
  
  if (data === 'buscar_producto') {
    sesion.estado = 'esperando_busqueda_producto';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '🔍 Escribe el nombre del producto que buscas:\n\n(Ejemplo: "oreo", "coca", "leche", etc.)');
    return;
  }
  
  if (data === 'ver_categorias') {
    const categorias = await leerSheet('Categorias');
    const categoriasOrdenadas = categorias.sort((a, b) => a.categoria_nombre.localeCompare(b.categoria_nombre));
    const keyboard = categoriasOrdenadas.map(cat => [{ 
      text: cat.categoria_nombre, 
      callback_data: `categoria_${cat.categoria_id}` 
    }]);
    
    await enviarMensaje(chatId, `👤 Cliente: ${sesion.clienteSeleccionado?.nombre || 'No seleccionado'}\n\n📂 Selecciona una categoría:`, {
      reply_markup: { 
        inline_keyboard: [
          ...keyboard,
          [{ text: '👤 Cambiar Cliente', callback_data: 'seleccionar_cliente' }],
          [{ text: '📍 Cambiar Localidad', callback_data: 'cambiar_localidad' }],
          [{ text: '🔍 Buscar Producto', callback_data: 'buscar_producto' }]
        ]
      }
    });
    return;
  }
  
  if (data === 'seleccionar_cliente') {
    await enviarMensaje(chatId, '👤 Selecciona el cliente para este pedido:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Ver Lista de Clientes', callback_data: 'lista_clientes' }],
          [{ text: '✍️ Buscar por Nombre', callback_data: 'buscar_cliente' }],
          [{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }],
          [{ text: '📍 Cambiar Localidad', callback_data: 'cambiar_localidad' }]
        ]
      }
    });
    return;
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
      sesion.estado = 'esperando_cantidad';
      sesion.productoSeleccionado = producto;
      sesionesBot.set(userId, sesion);
      
      await enviarMensaje(chatId, `📦 ${producto.producto_nombre}\n💰 Precio: $${producto.precio}\n\n¿Cuántas unidades quieres? (1-50)`);
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
      sesion.pedido.items.forEach((item, index) => {
        mensaje += `${index + 1}. ${item.nombre}\n   ${item.cantidad}x $${item.precio} = $${item.importe}\n\n`;
      });
      mensaje += `💰 TOTAL: $${sesion.pedido.total}`;
      
      await enviarMensaje(chatId, mensaje, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Agregar más', callback_data: 'continuar_pedido' }],
            [{ text: '🗑️ Vaciar carrito', callback_data: 'vaciar_carrito' }],
            [{ text: '✅ Finalizar Pedido', callback_data: 'finalizar_pedido' }],
            [{ text: '🔍 Buscar Producto', callback_data: 'buscar_producto' }]
          ]
        }
      });
    }
    return;
  }
  
  if (data === 'continuar_pedido') {
    const categorias = await leerSheet('Categorias');
    const categoriasOrdenadas = categorias.sort((a, b) => a.categoria_nombre.localeCompare(b.categoria_nombre));
    const keyboard = categoriasOrdenadas.map(cat => [{ 
      text: cat.categoria_nombre, 
      callback_data: `categoria_${cat.categoria_id}` 
    }]);
    
    await enviarMensaje(chatId, `👤 Cliente: ${sesion.clienteSeleccionado?.nombre || 'No seleccionado'}\n\n📂 Selecciona una categoría:`, {
      reply_markup: { 
        inline_keyboard: [
          ...keyboard,
          [{ text: '👤 Cambiar Cliente', callback_data: 'seleccionar_cliente' }],
          [{ text: '📍 Cambiar Localidad', callback_data: 'cambiar_localidad' }],
          [{ text: '🔍 Buscar Producto', callback_data: 'buscar_producto' }]
        ]
      }
    });
    return;
  }
  
  if (data === 'vaciar_carrito') {
    sesion.pedido = { items: [], total: 0 };
    sesion.estado = 'inicio';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '🗑️ Carrito vaciado\n\n¿Deseas hacer un nuevo pedido?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'continuar_pedido' }]
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
      await enviarMensaje(chatId, '❌ Debes seleccionar un cliente primero', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 Seleccionar Cliente', callback_data: 'seleccionar_cliente' }]
          ]
        }
      });
      return;
    }
    
    // Crear pedido
    const pedidoId = `PED${String(contadorPedidos++).padStart(3, '0')}`;
    const fechaHora = new Date().toLocaleString('es-AR');
    const clienteNombre = sesion.clienteSeleccionado.nombre;
    const clienteId = sesion.clienteSeleccionado.cliente_id;
    
    const nuevoPedido = {
      pedido_id: pedidoId,
      fecha_hora: fechaHora,
      cliente_id: clienteId,
      cliente_nombre: clienteNombre,
      items_cantidad: sesion.pedido.items.length,
      total: sesion.pedido.total,
      estado: 'PENDIENTE',
      items: sesion.pedido.items
    };
    
    // Guardar directamente en Google Sheets
    await escribirSheet('Pedidos', [
      pedidoId, fechaHora, clienteId, clienteNombre, 
      sesion.pedido.items.length, sesion.pedido.total, 'PENDIENTE'
    ]);
    
    // Guardar detalles del pedido en DetallePedidos
    for (let i = 0; i < sesion.pedido.items.length; i++) {
      const item = sesion.pedido.items[i];
      const detalleId = `DET${String(contadorPedidos).padStart(3, '0')}_${i + 1}`;
      
      await escribirSheet('DetallePedidos', [
        detalleId,
        pedidoId,
        item.producto_id,
        item.nombre,
        item.categoria_id || 1, // Categoria por defecto si no existe
        item.cantidad,
        item.precio,
        item.importe
      ]);
    }
    
    // Limpiar sesión
    sesionesBot.set(userId, { estado: 'inicio', pedido: { items: [], total: 0 } });
    
    let mensaje = `📋 PEDIDO ENVIADO\n\n`;
    mensaje += `📋 Pedido: ${pedidoId}\n`;
    mensaje += `👤 Cliente: ${clienteNombre}\n`;
    mensaje += `📅 Fecha: ${fechaHora}\n\n`;
    mensaje += `⏳ Estado: PENDIENTE\n\n`;
    
    // Limitar detalles para evitar mensaje muy largo
    if (nuevoPedido.items.length <= 10) {
      mensaje += `🛒 PRODUCTOS:\n`;
      nuevoPedido.items.forEach((item, index) => {
        mensaje += `${index + 1}. ${item.nombre}\n   ${item.cantidad}x $${item.precio} = $${item.importe}\n`;
      });
    } else {
      mensaje += `🛒 PRODUCTOS (${nuevoPedido.items.length} items):\n`;
      nuevoPedido.items.slice(0, 8).forEach((item, index) => {
        mensaje += `${index + 1}. ${item.nombre} - ${item.cantidad}x $${item.precio}\n`;
      });
      mensaje += `... y ${nuevoPedido.items.length - 8} productos más\n`;
    }
    
    mensaje += `\n💰 TOTAL: $${nuevoPedido.total}`;
    mensaje += `\n\n⏳ Tu pedido está pendiente de confirmación`;
    
    await enviarMensaje(chatId, mensaje, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Nuevo Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '👤 Mismo Cliente', callback_data: 'continuar_pedido' }]
        ]
      }
    });
  }
  
  if (data === 'ver_productos') {
    const productos = await leerSheet('Productos');
    const productosActivos = productos.filter(p => p.activo === 'SI');
    
    // Dividir productos por categorías para evitar mensajes muy largos
    const categorias = await leerSheet('Categorias');
    const categoriaMap = {};
    categorias.forEach(cat => {
      categoriaMap[cat.categoria_id] = cat.categoria_nombre;
    });
    
    let mensaje = '📦 PRODUCTOS DISPONIBLES:\n\n';
    
    // Agrupar por categoría
    const productosPorCategoria = {};
    productosActivos.forEach(prod => {
      const catNombre = categoriaMap[prod.categoria_id] || 'Sin categoría';
      if (!productosPorCategoria[catNombre]) {
        productosPorCategoria[catNombre] = [];
      }
      productosPorCategoria[catNombre].push(prod);
    });
    
    // Construir mensaje por categorías (limitado)
    let contador = 0;
    for (const [categoria, productos] of Object.entries(productosPorCategoria)) {
      if (contador >= 20) { // Limitar a 20 productos para evitar mensaje muy largo
        mensaje += `\n... y ${productosActivos.length - contador} productos más`;
        break;
      }
      
      mensaje += `\n🏷️ ${categoria}:\n`;
      productos.slice(0, 5).forEach(prod => { // Máximo 5 por categoría
        mensaje += `• ${prod.producto_nombre} - $${prod.precio}\n`;
        contador++;
      });
    }
    
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

// Responder a callback query
async function answerCallbackQuery(callbackQueryId, texto = '') {
  if (!TELEGRAM_BOT_TOKEN) return;
  
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: texto
      })
    });
    
    if (!response.ok) {
      console.error('Error respondiendo callback:', await response.text());
    }
  } catch (error) {
    console.error('Error en answerCallbackQuery:', error);
  }
}

// Configurar webhook automáticamente
async function configurarWebhook() {
  if (!TELEGRAM_BOT_TOKEN || !WEBHOOK_URL) {
    console.log('⚠️ Telegram no configurado completamente:');
    console.log(`   BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);
    console.log(`   WEBHOOK_URL: ${WEBHOOK_URL ? '✅ Configurado' : '❌ Faltante'}`);
    return;
  }
  
  try {
    console.log('🔧 Configurando webhook de Telegram...');
    console.log(`   URL: https://${WEBHOOK_URL}`);
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `https://${WEBHOOK_URL}`,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true
      })
    });
    
    const result = await response.json();
    if (result.ok) {
      console.log('✅ Webhook configurado:', `https://${WEBHOOK_URL}`);
      
      // Verificar configuración
      const infoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      const info = await infoResponse.json();
      
      if (info.ok) {
        console.log('📋 Info del webhook:');
        console.log(`   URL: ${info.result.url}`);
        console.log(`   Actualizaciones pendientes: ${info.result.pending_update_count}`);
        console.log(`   Certificado SSL: ${info.result.has_custom_certificate ? 'Sí' : 'No'}`);
        if (info.result.last_error_date) {
          const errorDate = new Date(info.result.last_error_date * 1000);
          console.log(`   ⚠️ Último error (${errorDate.toLocaleString()}): ${info.result.last_error_message}`);
        } else {
          console.log('   ✅ Sin errores recientes');
        }
      }
    } else {
      console.error('❌ Error configurando webhook:', result.description);
    }
  } catch (error) {
    console.error('❌ Error configurando webhook:', error.message);
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
  const html = `<!DOCTYPE html>
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

        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-2xl font-bold mb-4">📋 Pedidos Recientes</h2>
            <div id="pedidos" class="space-y-4">
                <div class="text-center text-gray-500">Cargando...</div>
            </div>
        </div>
        
        <!-- Modal para detalle del pedido -->
        <div id="modalDetalle" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
            <div class="flex items-center justify-center min-h-screen p-4">
                <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-bold" id="modalTitulo">Detalle del Pedido</h3>
                            <button onclick="cerrarModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                        </div>
                        <div id="modalContenido" class="space-y-4">
                            <!-- Contenido del pedido se carga aquí -->
                        </div>
                        <div class="mt-6 flex justify-end space-x-2">
                            <button onclick="cerrarModal()" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function cambiarEstado(pedidoId, nuevoEstado) {
            fetch('/api/pedidos/' + pedidoId + '/estado', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado })
            })
            .then(function(response) {
                if (response.ok) {
                    cargarDatos();
                } else {
                    alert('Error cambiando estado');
                }
            })
            .catch(function(error) {
                alert('Error de conexión');
            });
        }

        function verDetallePedido(pedidoId) {
            fetch('/api/pedidos/' + pedidoId + '/detalle')
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (data.error) {
                        alert('Error: ' + data.error);
                        return;
                    }
                    
                    mostrarModalDetalle(data.pedido, data.detalles);
                })
                .catch(function(error) {
                    alert('Error cargando detalle del pedido');
                });
        }
        
        function mostrarModalDetalle(pedido, detalles) {
            var modal = document.getElementById('modalDetalle');
            var titulo = document.getElementById('modalTitulo');
            var contenido = document.getElementById('modalContenido');
            
            titulo.textContent = 'Pedido ' + pedido.pedido_id;
            
            var estadoClass = '';
            if (pedido.estado === 'CONFIRMADO') {
                estadoClass = 'bg-green-100 text-green-800';
            } else if (pedido.estado === 'PENDIENTE') {
                estadoClass = 'bg-yellow-100 text-yellow-800';
            } else {
                estadoClass = 'bg-red-100 text-red-800';
            }
            
            var html = '<div class="bg-gray-50 p-4 rounded-lg mb-4">' +
                      '<div class="grid grid-cols-2 gap-4">' +
                      '<div><strong>Cliente:</strong> ' + pedido.cliente_nombre + '</div>' +
                      '<div><strong>Fecha:</strong> ' + pedido.fecha_hora + '</div>' +
                      '<div><strong>Items:</strong> ' + (pedido.items_cantidad || 0) + '</div>' +
                      '<div><strong>Total:</strong> $' + parseInt(pedido.total || 0).toLocaleString() + '</div>' +
                      '</div>' +
                      '<div class="mt-2">' +
                      '<span class="px-2 py-1 rounded text-sm ' + estadoClass + '">' + pedido.estado + '</span>' +
                      '</div>' +
                      '</div>';
            
            if (detalles && detalles.length > 0) {
                html += '<div class="border-t pt-4">' +
                       '<h4 class="font-semibold mb-3">📦 Productos:</h4>' +
                       '<div class="space-y-2">';
                
                for (var i = 0; i < detalles.length; i++) {
                    var detalle = detalles[i];
                    html += '<div class="flex justify-between items-center p-3 bg-gray-50 rounded">' +
                           '<div>' +
                           '<div class="font-medium">' + detalle.producto_nombre + '</div>' +
                           '<div class="text-sm text-gray-600">Cantidad: ' + detalle.cantidad + ' x $' + parseInt(detalle.precio_unitario || 0).toLocaleString() + '</div>' +
                           '</div>' +
                           '<div class="font-bold">$' + parseInt(detalle.importe || 0).toLocaleString() + '</div>' +
                           '</div>';
                }
                
                html += '</div></div>';
            } else {
                html += '<div class="text-center text-gray-500 py-4">No hay detalles disponibles para este pedido</div>';
            }
            
            contenido.innerHTML = html;
            modal.classList.remove('hidden');
        }
        
        function cerrarModal() {
            var modal = document.getElementById('modalDetalle');
            modal.classList.add('hidden');
        }
        
        // Cerrar modal al hacer clic fuera
        document.getElementById('modalDetalle').addEventListener('click', function(e) {
            if (e.target === this) {
                cerrarModal();
            }
        });
        function cargarDatos() {
            fetch('/health')
                .then(function(r) { return r.json(); })
                .then(function(h) {
                    document.getElementById('sheets-status').textContent = h.sheets ? '✅' : '❌';
                    document.getElementById('telegram-status').textContent = h.telegram ? '✅' : '❌';
                    document.getElementById('server-status').textContent = h.status === 'OK' ? '✅' : '❌';
                });

            fetch('/api/stats')
                .then(function(r) { return r.json(); })
                .then(function(s) {
                    document.getElementById('totalClientes').textContent = s.totalClientes;
                    document.getElementById('totalProductos').textContent = s.totalProductos;
                    document.getElementById('totalPedidos').textContent = s.totalPedidos;
                    document.getElementById('ventasTotal').textContent = '$' + s.ventasTotal.toLocaleString();
                });

            fetch('/api/pedidos')
                .then(function(r) { return r.json(); })
                .then(function(pedidos) {
                    var container = document.getElementById('pedidos');
                    if (pedidos.length === 0) {
                        container.innerHTML = '<div class="text-center text-gray-500">No hay pedidos</div>';
                        return;
                    }
                    
                    var html = '';
                    var recientes = pedidos.slice(-10).reverse();
                    
                    for (var i = 0; i < recientes.length; i++) {
                        var p = recientes[i];
                        var clase = '';
                        var botones = '';
                        
                        if (p.estado === 'CONFIRMADO') {
                            clase = 'bg-green-100 text-green-800';
                        } else if (p.estado === 'PENDIENTE') {
                            clase = 'bg-yellow-100 text-yellow-800';
                            botones = '<button onclick="cambiarEstado(\\'' + p.pedido_id + '\\', \\'CONFIRMADO\\')" class="px-2 py-1 bg-green-500 text-white text-xs rounded mr-1">✓</button>' +
                                     '<button onclick="cambiarEstado(\\'' + p.pedido_id + '\\', \\'CANCELADO\\')" class="px-2 py-1 bg-red-500 text-white text-xs rounded">✗</button>';
                        } else {
                            clase = 'bg-red-100 text-red-800';
                        }
                        
                        html += '<div class="flex justify-between items-center p-4 border rounded-lg">' +
                               '<div><h3 class="font-semibold cursor-pointer text-blue-600 hover:text-blue-800" onclick="verDetallePedido(\\'' + p.pedido_id + '\\')">📋 ' + p.pedido_id + ' - ' + p.cliente_nombre + '</h3>' +
                               '<p class="text-gray-600">' + p.fecha_hora + ' - ' + (p.items_cantidad || 0) + ' items</p></div>' +
                               '<div class="text-right"><p class="font-bold">$' + parseInt(p.total || 0).toLocaleString() + '</p>' +
                               '<div class="flex items-center gap-2 mt-1">' +
                               '<span class="px-2 py-1 rounded text-sm ' + clase + '">' + p.estado + '</span>' +
                               botones + '</div></div></div>';
                    }
                    
                    container.innerHTML = html;
                })
                .catch(function() {
                    document.getElementById('pedidos').innerHTML = '<div class="text-center text-red-500">Error cargando datos</div>';
                });
        }

        cargarDatos();
        setInterval(cargarDatos, 10000);
    </script>
</body>
</html>`;
  
  res.send(html);
  res.send(html);
});

// Iniciar servidor
const server = app.listen(PORT, async () => {
  console.log('🚀 Servidor corriendo en puerto ' + PORT);
  console.log('🌐 Dashboard: http://localhost:' + PORT);
  
  // Verificar Google Sheets al iniciar
  await verificarGoogleSheets();
  
  // Configurar webhook después de un delay
  setTimeout(configurarWebhook, 5000);
});

// Manejo de señales para Railway
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rechazada no manejada:', reason);
  process.exit(1);
});