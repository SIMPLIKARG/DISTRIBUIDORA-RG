import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import dotenv from 'dotenv';

// Suprimir TODOS los warnings de deprecación
process.removeAllListeners('warning');
process.on('warning', () => {
  // Suprimir completamente todos los warnings
});

// Suprimir warnings específicos de Node.js
process.env.NODE_NO_WARNINGS = '1';
process.env.NODE_OPTIONS = '--no-deprecation --no-warnings';

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
    const requiredSheets = ['LISTADO CLIENTES', 'LISTADO PRODUCTO', 'Pedidos', 'DetallePedidos'];
    
    for (const sheetName of requiredSheets) {
      if (!existingSheets.includes(sheetName)) {
        console.error(`❌ Falta la hoja: "${sheetName}"`);
        console.error('🔧 Crea las hojas: LISTADO CLIENTES, LISTADO PRODUCTO, Pedidos, DetallePedidos');
        process.exit(1);
      }
    }
    
    console.log('✅ Todas las hojas requeridas existen');
  } catch (error) {
    console.error('❌ Error verificando Google Sheets:', error.message);
    console.error('🔧 Verifica que:');
    console.error('   1. El SPREADSHEET_ID sea correcto');
    console.error('   2. La cuenta de servicio tenga acceso');
    console.error('   3. Las hojas LISTADO CLIENTES, LISTADO PRODUCTO, Pedidos, DetallePedidos existan');
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

    // Para LISTADO CLIENTES, los datos empiezan en la fila 6 (índice 5)
    let startRow = 1;
    let headerRow = 0;
    
    if (nombreHoja === 'LISTADO CLIENTES') {
      // Buscar la fila que contiene "Activo,Código,Razón Social"
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i][0] === 'Activo' && rows[i][1] === 'Código') {
          headerRow = i;
          startRow = i + 1;
          break;
        }
      }
    }
    
    const headers = rows[headerRow];
    return rows.slice(startRow).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    }).filter(cliente => cliente.Activo === 'SI' && cliente.Código && cliente['Razón Social']);
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
  try {
    const clientes = await leerSheet('LISTADO CLIENTES');
    res.json(clientes);
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/categorias', async (req, res) => {
  try {
    // Categorías fijas basadas en los productos disponibles
    const categorias = [
      { categoria_id: 1, categoria_nombre: 'Galletitas' },
      { categoria_id: 2, categoria_nombre: 'Bebidas' },
      { categoria_id: 3, categoria_nombre: 'Lácteos' },
      { categoria_id: 4, categoria_nombre: 'Panadería' },
      { categoria_id: 5, categoria_nombre: 'Conservas' },
      { categoria_id: 6, categoria_nombre: 'Snacks' },
      { categoria_id: 7, categoria_nombre: 'Dulces' },
      { categoria_id: 8, categoria_nombre: 'Limpieza' },
      { categoria_id: 9, categoria_nombre: 'Higiene Personal' },
      { categoria_id: 10, categoria_nombre: 'Congelados' }
    ];
    
    res.json(categorias);
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/productos', async (req, res) => {
  try {
    const productos = await leerSheet('LISTADO PRODUCTO');
    res.json(productos);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/pedidos', async (req, res) => {
  const pedidos = await leerSheet('Pedidos');
  res.json(pedidos);
});

app.get('/api/stats', async (req, res) => {
  const clientes = await leerSheet('LISTADO CLIENTES');
  const productos = await leerSheet('LISTADO PRODUCTO');
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
          [{ text: '❓ Ayuda', callback_data: 'ayuda' }]
        ]
      }
    });
  }
  
  // Manejar selección de cliente por nombre
  if (sesion.estado === 'esperando_cliente') {
    const clientes = await leerSheet('LISTADO CLIENTES');
    const clientesEncontrados = clientes.filter(c => 
      (c['Razón Social'] && c['Razón Social'].toLowerCase().includes(texto.toLowerCase())) ||
      (c['Nombre Fantasía'] && c['Nombre Fantasía'].toLowerCase().includes(texto.toLowerCase()))
    );
    
    if (clientesEncontrados.length === 0) {
      await enviarMensaje(chatId, `❌ No encontré ningún cliente con "${texto}"\n\nIntenta con otro nombre o parte del nombre:`);
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
      
      await enviarMensaje(chatId, `✅ Cliente seleccionado: ${clienteEncontrado['Razón Social'] || clienteEncontrado['Nombre Fantasía']}\n\n📂 Selecciona una categoría:`, {
        reply_markup: {
          inline_keyboard: [
            ...keyboard,
            [{ text: '👤 Cambiar Cliente', callback_data: 'seleccionar_cliente' }]
          ]
        }
      });
    } else {
      // Múltiples clientes encontrados, mostrar opciones
      const keyboard = clientesEncontrados.slice(0, 10).map(cliente => [{ 
        text: `👤 ${cliente['Razón Social'] || cliente['Nombre Fantasía']}`, 
        callback_data: `cliente_${cliente['Código']}` 
      }]);
      
      keyboard.push([{ text: '🔍 Buscar de nuevo', callback_data: 'buscar_cliente' }]);
      keyboard.push([{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]);
      
      await enviarMensaje(chatId, `🔍 Encontré ${clientesEncontrados.length} clientes con "${texto}":\n\nSelecciona el correcto:`, {
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
      const clientes = await leerSheet('LISTADO CLIENTES');
      const maxId = Math.max(...clientes.map(c => parseInt(c['Código']) || 0));
      const nuevoId = maxId + 1;
      
      // Agregar cliente a Google Sheets
      await escribirSheet('LISTADO CLIENTES', [
        'SI', // Activo
        nuevoId, // Código
        nombreCliente, // Razón Social
        '', // Nombre Fantasía
        'DNI', // Tipo de Documento
        '99', // CUIT
        '', // Dirección
        '', // Localidad
        '', // Código Postal
        '', // Provincia
        '', // País
        '', // Teléfono 1
        '', // Teléfono 2
        '', // Teléfono 3
        '', // Fax 1
        '', // Fax 2
        '', // Fax 3
        'CONSUMIDOR FINAL', // Condición Frente al IVA
        '', // Tipo de Cliente
        '', // E-Mail
        '1', // Lista de Precios
        '  -   -' // Fecha Nacimiento
      ]);
    const parts = data.split('_');
    const clienteId = parts[1];
    const clienteNombre = decodeURIComponent(parts[2] || 'Cliente');
    
      // Seleccionar el nuevo cliente
      sesion.clienteSeleccionado = {
      nombre: clienteNombre
        'Razón Social': nombreCliente
      };
      sesion.estado = 'cliente_confirmado';
      sesionesBot.set(userId, sesion);
    await enviarMensaje(chatId, `✅ Cliente seleccionado: ${clienteNombre}\n\n📂 Selecciona una categoría:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🍪 Galletitas', callback_data: 'categoria_galletitas' }],
          [{ text: '🥤 Bebidas', callback_data: 'categoria_bebidas' }],
          [{ text: '🥛 Lácteos', callback_data: 'categoria_lacteos' }],
          [{ text: '🍞 Panadería', callback_data: 'categoria_panaderia' }],
          [{ text: '🥫 Conservas', callback_data: 'categoria_conservas' }],
          [{ text: '🍿 Snacks', callback_data: 'categoria_snacks' }],
          [{ text: '🍭 Dulces', callback_data: 'categoria_dulces' }],
          [{ text: '🧽 Limpieza', callback_data: 'categoria_limpieza' }],
          [{ text: '🧴 Higiene', callback_data: 'categoria_higiene' }],
          [{ text: '🧊 Congelados', callback_data: 'categoria_congelados' }]
        ]
      }
    });
    return;
  }
  
  if (data.startsWith('categoria_')) {
    if (!sesion.clienteSeleccionado) {
      await enviarMensaje(chatId, '❌ Primero debes seleccionar un cliente', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 Seleccionar Cliente', callback_data: 'hacer_pedido' }]
          ]
        }
      });
      return;
    }
    
    const categoria = data.split('_')[1];
      
      const categorias = [
    // Filtrar productos por categoría usando palabras clave
    let productosFiltrados = [];
    
    switch(categoria) {
      case 'galletitas':
        productosFiltrados = productos.filter(p => 
          p.Descripción && (
            p.Descripción.toLowerCase().includes('oreo') ||
            p.Descripción.toLowerCase().includes('pepito') ||
            p.Descripción.toLowerCase().includes('galletita') ||
            p.Descripción.toLowerCase().includes('cookie') ||
            p.Descripción.toLowerCase().includes('tita') ||
            p.Descripción.toLowerCase().includes('chocolina')
          )
        );
        break;
      case 'bebidas':
        productosFiltrados = productos.filter(p => 
          p.Descripción && (
            p.Descripción.toLowerCase().includes('coca') ||
            p.Descripción.toLowerCase().includes('sprite') ||
            p.Descripción.toLowerCase().includes('fanta') ||
            p.Descripción.toLowerCase().includes('agua') ||
            p.Descripción.toLowerCase().includes('jugo') ||
            p.Descripción.toLowerCase().includes('gaseosa')
          )
        );
        break;
      case 'lacteos':
        productosFiltrados = productos.filter(p => 
          p.Descripción && (
            p.Descripción.toLowerCase().includes('leche') ||
            p.Descripción.toLowerCase().includes('yogur') ||
            p.Descripción.toLowerCase().includes('queso') ||
            p.Descripción.toLowerCase().includes('manteca') ||
            p.Descripción.toLowerCase().includes('dulce de leche')
          )
        );
        break;
      default:
        productosFiltrados = productos.slice(0, 10); // Mostrar primeros 10 si no hay filtro específico
    }
    
    if (productosFiltrados.length === 0) {
      await enviarMensaje(chatId, `❌ No hay productos disponibles en esta categoría`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Volver a categorías', callback_data: `cliente_${sesion.clienteSeleccionado.id}_${encodeURIComponent(sesion.clienteSeleccionado.nombre)}` }]
          ]
        }
      });
      return;
    }
    
    const keyboard = productosFiltrados.slice(0, 10).map(prod => [{ 
      text: `${prod.Descripción} - $${prod['Precio Venta'] || prod.Precio || '0'}`, 
      callback_data: `producto_${prod.Código}_${encodeURIComponent(prod.Descripción)}_${prod['Precio Venta'] || prod.Precio || 0}` 
    }]);
    
    await enviarMensaje(chatId, `🛍️ Productos disponibles en ${categoria}:\n(Cliente: ${sesion.clienteSeleccionado.nombre})`, {
        { categoria_id: 3, categoria_nombre: 'Lácteos' },
        inline_keyboard: [
          ...keyboard,
          [{ text: '🔙 Volver a categorías', callback_data: `cliente_${sesion.clienteSeleccionado.id}_${encodeURIComponent(sesion.clienteSeleccionado.nombre)}` }]
        ]
      }]);
      
    return;
      await enviarMensaje(chatId, `✅ Cliente "${nombreCliente}" agregado y seleccionado\n\n📂 Selecciona una categoría:`, {
        reply_markup: {
      sesion.estado = 'inicio';
    const parts = data.split('_');
    const productoId = parts[1];
    const productoNombre = decodeURIComponent(parts[2] || 'Producto');
    const productoPrecio = parseFloat(parts[3] || 0);
          inline_keyboard: [
    if (productoId && productoNombre && productoPrecio > 0) {
            [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
            [{ text: '✅ Finalizar pedido', callback_data: 'finalizar_pedido' }]
        id: productoId,
        nombre: productoNombre,
        precio: productoPrecio
      
      sesionesBot.set(userId, sesion);
    } else {
      await enviarMensaje(chatId, `📦 ${productoNombre}\n💰 Precio: $${productoPrecio}\n👤 Cliente: ${sesion.clienteSeleccionado?.nombre || 'No seleccionado'}\n\n¿Cuántas unidades quieres? (1-50)`);
    } else {
      await enviarMensaje(chatId, '❌ Error con el producto seleccionado. Intenta de nuevo.');
    }
    return;
  }
}

// Manejar callbacks
async function manejarCallback(callback_query) {
  const chatId = callback_query.message.chat.id;
  const data = callback_query.data;
  const userId = callback_query.from.id;
  const sesion = sesionesBot.get(userId) || { estado: 'inicio', pedido: { items: [], total: 0 } };
  
  console.log(`📱 Callback recibido: ${data} de usuario ${userId}`);
  
  if (data === 'hacer_pedido') {
    await enviarMensaje(chatId, '👤 Primero, selecciona el cliente para este pedido:', {
    const keyboard = clientes.slice(0, 15).map(cliente => [{ 
      text: cliente['Razón Social'] || cliente.nombre, 
      callback_data: `cliente_${cliente.Código}_${encodeURIComponent(cliente['Razón Social'] || cliente.nombre)}` 
          [{ text: '✍️ Buscar por Nombre', callback_data: 'buscar_cliente' }],
          [{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]
        ]
      }
    });
    return;
  }
  
  if (data === 'nuevo_cliente') {
    sesion.estado = 'esperando_nuevo_cliente';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '➕ Escribe el nombre del nuevo cliente:');
    return;
  }
  
  if (data === 'lista_clientes') {
    try {
      const clientes = await leerSheet('LISTADO CLIENTES');
      console.log(`📊 Clientes encontrados: ${clientes.length}`);
      
      if (clientes.length === 0) {
        await enviarMensaje(chatId, '❌ No hay clientes disponibles. Agrega uno nuevo:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]
            ]
          }
        });
        return;
      }
      
      const keyboard = clientes.slice(0, 10).map(cliente => {
        // Usar las columnas exactas del CSV
        const nombre = cliente['Razón Social'] || cliente['Nombre Fantasía'] || 'Cliente sin nombre';
        const codigo = cliente['Código'] || cliente.codigo || cliente.id;
        
        return [{ 
          text: `👤 ${nombre}`, 
          callback_data: `cliente_${codigo}` 
        }];
      });
      
      keyboard.push([{ text: '✍️ Buscar por Nombre', callback_data: 'buscar_cliente' }]);
      keyboard.push([{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]);
      
      await enviarMensaje(chatId, '👥 Selecciona un cliente:', {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      await enviarMensaje(chatId, '❌ Error obteniendo lista de clientes. Intenta de nuevo.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Reintentar', callback_data: 'lista_clientes' }],
            [{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]
          ]
        }
      });
    }
    return;
  }
  
  if (data === 'buscar_cliente') {
    sesion.estado = 'esperando_cliente';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '✍️ Escribe el nombre del cliente (o parte del nombre):');
    return;
  }
  
  if (data.startsWith('cliente_')) {
    const clienteCodigo = data.split('_')[1];
    try {
      const clientes = await leerSheet('LISTADO CLIENTES');
      const cliente = clientes.find(c => c['Código'] == clienteCodigo);
      
      if (cliente) {
        sesion.clienteSeleccionado = {
          id: cliente['Código'],
          nombre: cliente['Razón Social'] || cliente['Nombre Fantasía'] || 'Cliente'
        };
        sesion.estado = 'cliente_confirmado';
        sesionesBot.set(userId, sesion);
        
        // Categorías fijas
        const categorias = [
          { categoria_id: 1, categoria_nombre: 'Galletitas' },
          { categoria_id: 2, categoria_nombre: 'Bebidas' },
          { categoria_id: 3, categoria_nombre: 'Lácteos' },
          { categoria_id: 4, categoria_nombre: 'Panadería' },
          { categoria_id: 5, categoria_nombre: 'Conservas' },
          { categoria_id: 6, categoria_nombre: 'Snacks' },
          { categoria_id: 7, categoria_nombre: 'Dulces' },
          { categoria_id: 8, categoria_nombre: 'Limpieza' },
          { categoria_id: 9, categoria_nombre: 'Higiene Personal' },
          { categoria_id: 10, categoria_nombre: 'Congelados' }
        ];
        
        const keyboard = categorias.map(cat => [{ 
          text: cat.categoria_nombre, 
          callback_data: `categoria_${cat.categoria_id}` 
        }]);
        
        await enviarMensaje(chatId, `✅ Cliente seleccionado: ${sesion.clienteSeleccionado.nombre}\n\n📂 Selecciona una categoría:`, {
          reply_markup: {
            inline_keyboard: [
              ...keyboard,
              [{ text: '👤 Cambiar Cliente', callback_data: 'seleccionar_cliente' }]
            ]
          }
        });
      } else {
        await enviarMensaje(chatId, '❌ Cliente no encontrado', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Ver Lista', callback_data: 'lista_clientes' }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error seleccionando cliente:', error);
      await enviarMensaje(chatId, '❌ Error seleccionando cliente. Intenta de nuevo.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Ver Lista', callback_data: 'lista_clientes' }]
          ]
        }
      });
    }
    return;
  }
  
  if (data === 'seleccionar_cliente') {
    await enviarMensaje(chatId, '👤 Selecciona el cliente para este pedido:', {
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
  
  if (data.startsWith('categoria_')) {
    const categoriaId = data.split('_')[1];
    console.log(`📂 Buscando productos de categoría: ${categoriaId}`);
    
    try {
      const productos = await leerSheet('LISTADO PRODUCTO');
      console.log(`📦 Productos totales encontrados: ${productos.length}`);
      
      // Mapear categorías a productos específicos del CSV
      let productosFiltrados = [];
      
      if (categoriaId == '1') { // Galletitas
        productosFiltrados = productos.filter(p => 
          p['producto_nombre'] && (
            p['producto_nombre'].toLowerCase().includes('oreo') ||
            p['producto_nombre'].toLowerCase().includes('pepitos') ||
            p['producto_nombre'].toLowerCase().includes('tita') ||
            p['producto_nombre'].toLowerCase().includes('chocolinas') ||
            p['producto_nombre'].toLowerCase().includes('criollitas') ||
            p['producto_nombre'].toLowerCase().includes('sonrisas')
          )
        );
      } else if (categoriaId == '2') { // Bebidas
        productosFiltrados = productos.filter(p => 
          p['producto_nombre'] && (
            p['producto_nombre'].toLowerCase().includes('coca') ||
            p['producto_nombre'].toLowerCase().includes('agua') ||
            p['producto_nombre'].toLowerCase().includes('jugo') ||
            p['producto_nombre'].toLowerCase().includes('sprite') ||
            p['producto_nombre'].toLowerCase().includes('fanta')
          )
        );
      } else if (categoriaId == '3') { // Lácteos
        productosFiltrados = productos.filter(p => 
          p['producto_nombre'] && (
            p['producto_nombre'].toLowerCase().includes('leche') ||
            p['producto_nombre'].toLowerCase().includes('yogur') ||
            p['producto_nombre'].toLowerCase().includes('queso') ||
            p['producto_nombre'].toLowerCase().includes('manteca') ||
            p['producto_nombre'].toLowerCase().includes('dulce de leche') ||
            p['producto_nombre'].toLowerCase().includes('crema')
          )
        );
      } else {
        // Para otras categorías, mostrar algunos productos de ejemplo
        productosFiltrados = productos.slice(0, 5);
      }
      
      console.log(`📦 Productos filtrados: ${productosFiltrados.length}`);
      
      if (productosFiltrados.length === 0) {
        await enviarMensaje(chatId, '❌ No hay productos disponibles en esta categoría', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Volver a Categorías', callback_data: 'continuar_pedido' }]
            ]
          }
        });
        return;
      }
      
      const keyboard = productosFiltrados.map(prod => {
        const nombre = prod['producto_nombre'] || 'Producto';
        const precio = prod['precio'] || '0';
        const id = prod['producto_id'] || Math.random().toString(36).substr(2, 9);
        
        return [{ 
          text: `${nombre} - $${precio}`, 
          callback_data: `producto_${id}` 
        }];
      });
      
      keyboard.push([{ text: '🔙 Volver a Categorías', callback_data: 'continuar_pedido' }]);
      
      await enviarMensaje(chatId, '🛍️ Selecciona un producto:', {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error obteniendo productos:', error);
      await enviarMensaje(chatId, '❌ Error obteniendo productos. Intenta de nuevo.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Reintentar', callback_data: `categoria_${categoriaId}` }],
            [{ text: '🔙 Volver', callback_data: 'continuar_pedido' }]
          ]
        }
      });
    }
    return;
  }
  
  if (data.startsWith('producto_')) {
    const productoId = data.split('_')[1];
    try {
      const productos = await leerSheet('LISTADO PRODUCTO');
      const producto = productos.find(p => p['producto_id'] == productoId);
      
      if (producto) {
        sesion.estado = 'esperando_cantidad';
        sesion.productoSeleccionado = {
          producto_id: producto['producto_id'],
          producto_nombre: producto['producto_nombre'],
          precio: parseInt(producto['precio'] || 0),
          categoria_id: producto['categoria_id'] || 1
        };
        sesionesBot.set(userId, sesion);
        
        await enviarMensaje(chatId, `📦 ${sesion.productoSeleccionado.producto_nombre}\n💰 Precio: $${sesion.productoSeleccionado.precio}\n\n¿Cuántas unidades quieres? (1-50)`);
      } else {
        await enviarMensaje(chatId, '❌ Producto no encontrado', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Volver', callback_data: 'continuar_pedido' }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error obteniendo producto:', error);
      await enviarMensaje(chatId, '❌ Error obteniendo producto. Intenta de nuevo.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Volver', callback_data: 'continuar_pedido' }]
          ]
        }
      });
    }
    return;
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
            [{ text: '✅ Finalizar Pedido', callback_data: 'finalizar_pedido' }]
          ]
        }
      });
    }
    return;
  }
  
  if (data === 'continuar_pedido') {
    if (!sesion.clienteSeleccionado) {
      await enviarMensaje(chatId, '👤 Primero selecciona un cliente:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Ver Lista de Clientes', callback_data: 'lista_clientes' }],
            [{ text: '✍️ Buscar por Nombre', callback_data: 'buscar_cliente' }],
            [{ text: '➕ Agregar Nuevo Cliente', callback_data: 'nuevo_cliente' }]
          ]
        }
      });
    } else {
      // Categorías fijas
      const categorias = [
        { categoria_id: 1, categoria_nombre: 'Galletitas' },
        { categoria_id: 2, categoria_nombre: 'Bebidas' },
        { categoria_id: 3, categoria_nombre: 'Lácteos' },
        { categoria_id: 4, categoria_nombre: 'Panadería' },
        { categoria_id: 5, categoria_nombre: 'Conservas' },
        { categoria_id: 6, categoria_nombre: 'Snacks' },
        { categoria_id: 7, categoria_nombre: 'Dulces' },
        { categoria_id: 8, categoria_nombre: 'Limpieza' },
        { categoria_id: 9, categoria_nombre: 'Higiene Personal' },
        { categoria_id: 10, categoria_nombre: 'Congelados' }
      ];
      
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
    }
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
    return;
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
    const clienteId = sesion.clienteSeleccionado.id;
    
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
    mensaje += `🛒 PRODUCTOS:\n`;
    nuevoPedido.items.forEach((item, index) => {
      mensaje += `${index + 1}. ${item.nombre}\n   ${item.cantidad}x $${item.precio} = $${item.importe}\n`;
    });
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
    return;
  }
  
  if (data === 'ver_productos') {
    try {
      const productos = await leerSheet('LISTADO PRODUCTO');
      console.log(`📦 Productos encontrados para mostrar: ${productos.length}`);
      
      // Mostrar todos los productos disponibles
      const productosActivos = productos.filter(p => p['producto_nombre'] && p['precio']);
      
      console.log(`📦 Productos activos: ${productosActivos.length}`);
      
      let mensaje = '📦 PRODUCTOS DISPONIBLES:\n\n';
      productosActivos.slice(0, 15).forEach(prod => {
        const nombre = prod['producto_nombre'] || 'Producto';
        const precio = prod['precio'] || 0;
        mensaje += `• ${nombre} - $${precio}\n`;
      });
      
      if (productosActivos.length > 15) {
        mensaje += `\n... y ${productosActivos.length - 15} productos más`;
      }
      
      await enviarMensaje(chatId, mensaje, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error obteniendo productos:', error);
      await enviarMensaje(chatId, '❌ Error obteniendo productos. Intenta de nuevo.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Reintentar', callback_data: 'ver_productos' }]
          ]
        }
      });
    }
    return;
  }
  
  if (data === 'ayuda') {
    const mensajeAyuda = `🤖 **AYUDA - Bot Distribuidora**

**Comandos disponibles:**
• /start - Iniciar el bot
• Hacer Pedido - Crear un nuevo pedido
• Ver Productos - Ver catálogo completo

**¿Cómo hacer un pedido?**
1. Selecciona "Hacer Pedido"
2. Elige o agrega un cliente
3. Selecciona categoría de productos
4. Elige productos y cantidades
5. Revisa tu carrito
6. Finaliza el pedido

**¿Problemas?**
Si algo no funciona, usa /start para reiniciar.`;

    await enviarMensaje(chatId, mensajeAyuda, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '📋 Ver Productos', callback_data: 'ver_productos' }]
        ]
      }
    });
    return;
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
    const clientes = await leerSheet('LISTADO CLIENTES');
    const productos = await leerSheet('LISTADO PRODUCTO');
    
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
    await enviarMensaje(chatId, '👤 Selecciona un cliente:\n(Mostrando primeros 15 clientes)', {
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
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log('🚀 Servidor corriendo en puerto ' + PORT);
  console.log('🌐 Dashboard: http://localhost:' + PORT);
  
  // Verificar Google Sheets al iniciar
  await verificarGoogleSheets();
  
  // Configurar webhook después de un delay
  setTimeout(configurarWebhook, 5000);
});