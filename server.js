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

// Cache para mejorar rendimiento
let cacheClientes = new Map();
let cacheProductos = new Map();
let cacheCategorias = new Map();
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Función para actualizar cache
async function actualizarCache() {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_DURATION && cacheClientes.size > 0) {
    return; // Cache aún válido
  }

  try {
    console.log('🔄 Actualizando cache...');
    
    // Cargar datos en paralelo
    const [clientesData, productosData, categoriasData] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Clientes!A:C'
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Productos!A:I'
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Categorias!A:B'
      })
    ]);

    // Actualizar cache de clientes
    cacheClientes.clear();
    if (clientesData.data.values) {
      clientesData.data.values.slice(1).forEach(row => {
        if (row[0]) {
          cacheClientes.set(parseInt(row[0]), {
            cliente_id: parseInt(row[0]),
            nombre: row[1] || '',
            lista: parseInt(row[2]) || 1
          });
        }
      });
    }

    // Actualizar cache de productos
    cacheProductos.clear();
    if (productosData.data.values) {
      productosData.data.values.slice(1).forEach(row => {
        if (row[0]) {
          cacheProductos.set(parseInt(row[0]), {
            producto_id: parseInt(row[0]),
            categoria_id: parseInt(row[1]),
            producto_nombre: row[2] || '',
            precio1: parseFloat(row[3]) || 0,
            precio2: parseFloat(row[4]) || 0,
            precio3: parseFloat(row[5]) || 0,
            precio4: parseFloat(row[6]) || 0,
            precio5: parseFloat(row[7]) || 0,
            activo: row[8] === 'SI'
          });
        }
      });
    }

    // Actualizar cache de categorías
    cacheCategorias.clear();
    if (categoriasData.data.values) {
      categoriasData.data.values.slice(1).forEach(row => {
        if (row[0]) {
          cacheCategorias.set(parseInt(row[0]), {
            categoria_id: parseInt(row[0]),
            categoria_nombre: row[1] || ''
          });
        }
      });
    }

    lastCacheUpdate = now;
    console.log(`✅ Cache actualizado: ${cacheClientes.size} clientes, ${cacheProductos.size} productos`);
    
  } catch (error) {
    console.error('❌ Error actualizando cache:', error.message);
  }
}

// Configuración opcional de Google Sheets
let sheetsConfigured = false;
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
  console.log('⚠️  Google Sheets no configurado - usando datos de ejemplo');
  console.log('🔗 Para configurar: ver CONFIGURACION.md');
  sheetsConfigured = false;
} else {
  sheetsConfigured = true;
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
    
    // MANEJO DE CALLBACKS - ESTA ES LA PARTE CRÍTICA
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const userName = callbackQuery.from.first_name;
      
      console.log(`🔘 Callback de ${userName}: ${data}`);
      
      // RESPONDER INMEDIATAMENTE AL CALLBACK
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: '⏳ Procesando...'
        })
      });
      
      // PROCESAR EL CALLBACK
      try {
        if (data === 'hacer_pedido') {
          console.log('🛒 Iniciando pedido...');
          await mostrarClientes(chatId);
          
        } else if (data.startsWith('cliente_')) {
          const clienteId = parseInt(data.replace('cliente_', ''));
          console.log(`👤 Cliente seleccionado: ${clienteId}`);
          await seleccionarCliente(chatId, clienteId);
          
        } else if (data.startsWith('categoria_')) {
          const categoriaId = parseInt(data.replace('categoria_', ''));
          console.log(`📂 Categoría seleccionada: ${categoriaId}`);
          await mostrarProductosPorCategoria(chatId, categoriaId);
          
        } else if (data.startsWith('producto_')) {
          const productoId = parseInt(data.replace('producto_', ''));
          console.log(`🛍️ Producto seleccionado: ${productoId}`);
          await mostrarOpcionesCantidad(chatId, productoId);
          
        } else if (data.startsWith('cantidad_')) {
          const [_, productoId, cantidad] = data.split('_');
          console.log(`📦 Agregando ${cantidad} del producto ${productoId}`);
          await agregarProductoAlCarrito(chatId, parseInt(productoId), parseInt(cantidad));
          
        } else if (data === 'cantidad_manual') {
          console.log('✏️ Solicitando cantidad manual');
          estadosUsuarios[chatId].estado = 'esperando_cantidad';
          await enviarMensaje(chatId, '✏️ Escribe la cantidad que deseas:');
          
        } else if (data === 'ver_carrito') {
          console.log('🛒 Mostrando carrito');
          await mostrarCarrito(chatId);
          
        } else if (data === 'continuar_comprando') {
          console.log('🛍️ Continuando compras');
          await mostrarCategorias(chatId);
          
        } else if (data === 'finalizar_pedido') {
          console.log('✅ Finalizando pedido');
          await finalizarPedido(chatId);
          
        } else if (data === 'buscar_producto') {
          console.log('🔍 Iniciando búsqueda');
          estadosUsuarios[chatId].estado = 'esperando_busqueda';
          await enviarMensaje(chatId, '🔍 Escribe el nombre del producto que buscas:');
          
        } else if (data === 'menu_principal') {
          console.log('🏠 Volviendo al menú principal');
          await mostrarMenuPrincipal(chatId);
          
        } else {
          console.log(`❓ Callback no reconocido: ${data}`);
          await enviarMensaje(chatId, '❌ Opción no válida');
        }
        
        console.log(`✅ Callback ${data} procesado exitosamente`);
        
      } catch (error) {
        console.error(`❌ Error procesando callback ${data}:`, error);
        await enviarMensaje(chatId, '❌ Error procesando la solicitud. Intenta nuevamente.');
      }
    }
    
    console.log('✅ Todas las hojas requeridas existen');
  } catch (error) {
    console.error('❌ Error verificando Google Sheets:', error.message);
    console.log('📊 Continuando con datos de ejemplo');
    sheetsConfigured = false;
  }
}

// Configurar webhook de Telegram
async function configurarWebhook() {
  console.log('🔧 Iniciando configuración de webhook...');
  console.log('📋 Variables de entorno:');
  console.log(`   TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? 'Configurado ✅' : 'NO CONFIGURADO ❌'}`);
  console.log(`   RAILWAY_STATIC_URL: ${process.env.RAILWAY_STATIC_URL || 'NO DISPONIBLE'}`);
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('❌ TELEGRAM_BOT_TOKEN no configurado');
    console.log('🔧 Para configurar:');
    console.log('   1. Ve al dashboard de Railway');
    console.log('   2. Variables → Add Variable');
    console.log('   3. TELEGRAM_BOT_TOKEN = tu_token_aqui');
    return;
  }

  try {
    const webhookUrl = process.env.RAILWAY_STATIC_URL
      ? `${process.env.RAILWAY_STATIC_URL}/webhook`
      : null;

    if (!webhookUrl) {
      console.log('⚠️  RAILWAY_STATIC_URL no disponible aún');
      console.log('🔄 El webhook se configurará automáticamente cuando esté disponible');
      return;
    }

    console.log(`🔧 Configurando webhook: ${webhookUrl}`);

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log('✅ Webhook configurado exitosamente');
      
      // Verificar configuración
      const infoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      const info = await infoResponse.json();
      
      if (info.ok && info.result.url) {
        console.log(`✅ Webhook activo: ${info.result.url}`);
        console.log(`📊 Actualizaciones pendientes: ${info.result.pending_update_count || 0}`);
      }
    } else {
      console.error(`❌ Error configurando webhook: ${result.description}`);
    }
  } catch (error) {
    console.error('❌ Error configurando webhook:', error.message);
  }
}

// Datos de ejemplo (fallback)
const datosEjemplo = {
  clientes: [
    { cliente_id: 1, nombre: 'Juan Pérez', lista: 1 },
    { cliente_id: 2, nombre: 'María González', lista: 2 },
    { cliente_id: 3, nombre: 'Carlos Rodríguez', lista: 1 }
  ],
  categorias: [
    { categoria_id: 1, categoria_nombre: 'Galletitas' },
    { categoria_id: 2, categoria_nombre: 'Bebidas' },
    { categoria_id: 3, categoria_nombre: 'Lácteos' }
  ],
  productos: [
    { producto_id: 1, categoria_id: 1, producto_nombre: 'Oreo Original 117g', precio1: 450, precio2: 420, precio3: 400, precio4: 380, precio5: 360, activo: 'SI' },
    { producto_id: 2, categoria_id: 2, producto_nombre: 'Coca Cola 500ml', precio1: 350, precio2: 330, precio3: 310, precio4: 290, precio5: 270, activo: 'SI' },
    { producto_id: 3, categoria_id: 3, producto_nombre: 'Leche Entera 1L', precio1: 280, precio2: 260, precio3: 240, precio4: 220, precio5: 200, activo: 'SI' }
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

// API Routes para el dashboard

// Obtener todos los pedidos con detalles
app.get('/api/pedidos', async (req, res) => {
  try {
    if (!SPREADSHEET_ID) {
      return res.json({ 
        success: false, 
        message: 'Google Sheets no configurado',
        pedidos: []
      });
    }

    // Obtener datos de DetallePedidos
    const detallesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'DetallePedidos!A:I', // A hasta I para incluir cliente_nombre
    });

    // Obtener datos de Pedidos
    const pedidosResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pedidos!A:G',
    });

    const detallesData = detallesResponse.data.values || [];
    const pedidosData = pedidosResponse.data.values || [];

    if (detallesData.length === 0 || pedidosData.length === 0) {
      return res.json({ success: true, pedidos: [] });
    }

    // Procesar detalles (saltar encabezado)
    const detalles = detallesData.slice(1).map(row => ({
      detalle_id: row[0] || '',
      pedido_id: row[1] || '',
      producto_id: row[2] || '',
      producto_nombre: row[3] || '',
      categoria_id: row[4] || '',
      cantidad: parseInt(row[5]) || 0,
      precio_unitario: parseFloat(row[6]) || 0,
      importe: parseFloat(row[7]) || 0,
      cliente_nombre: row[8] || ''
    }));

    // Procesar pedidos (saltar encabezado)
    const pedidos = pedidosData.slice(1).map(row => ({
      pedido_id: row[0] || '',
      fecha_hora: row[1] || '',
      cliente_id: row[2] || '',
      cliente_nombre: row[3] || '',
      items_cantidad: parseInt(row[4]) || 0,
      total: parseFloat(row[5]) || 0,
      estado: row[6] || 'PENDIENTE'
    }));

    // Combinar datos: agrupar detalles por pedido
    const pedidosConDetalles = pedidos.map(pedido => {
      const detallesPedido = detalles.filter(detalle => 
        detalle.pedido_id === pedido.pedido_id
      );
      
      return {
        ...pedido,
        detalles: detallesPedido
      };
    });

    // Ordenar por fecha más reciente primero
    pedidosConDetalles.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

    res.json({ 
      success: true, 
      pedidos: pedidosConDetalles 
    });

  } catch (error) {
    console.error('Error obteniendo pedidos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error obteniendo pedidos: ' + error.message,
      pedidos: []
    });
  }
});

// Endpoint para obtener detalles de pedidos
app.get('/api/detalles-pedidos', async (req, res) => {
  try {
    console.log('📋 Obteniendo detalles de pedidos...');
    
    if (!sheetsConfigured || !sheets) {
      console.log('📊 Usando datos de ejemplo (Google Sheets no configurado)');
      return res.json({
        success: true,
        detalles: [
          {
            detalle_id: 'DET001',
            pedido_id: 'PED001',
            producto_id: 1,
            producto_nombre: 'Oreo Original 117g',
            categoria_id: 1,
            cantidad: 2,
            precio_unitario: 450,
            importe: 900,
            nombre: 'Juan Pérez',
            fecha_hora: '2024-01-15 10:30:00'
          },
          {
            detalle_id: 'DET002',
            pedido_id: 'PED001',
            producto_id: 2,
            producto_nombre: 'Coca Cola 500ml',
            categoria_id: 2,
            cantidad: 1,
            precio_unitario: 350,
            importe: 350,
            nombre: 'Juan Pérez',
            fecha_hora: '2024-01-15 10:30:00'
          },
          {
            detalle_id: 'DET003',
            pedido_id: 'PED002',
            producto_id: 3,
            producto_nombre: 'Leche Entera 1L',
            categoria_id: 3,
            cantidad: 1,
            precio_unitario: 280,
            importe: 280,
            nombre: 'María González',
            fecha_hora: '2024-01-15 14:20:00'
          }
        ]
      });
    }
    
    // Si Google Sheets no está configurado, usar datos de ejemplo
    if (!sheetsConfigured || !SPREADSHEET_ID) {
      console.log('📊 Usando datos de ejemplo para DetallePedidos');
      const datosEjemplo = [
        {
          detalle_id: 'DET001',
          pedido_id: 'PED001',
          producto_id: 1,
          producto_nombre: 'Oreo Original 117g',
          categoria_id: 1,
          cantidad: 2,
          precio_unitario: 450,
          importe: 900,
          nombre: 'Juan Pérez',
          fecha_hora: '2024-01-15 10:30:00'
        },
        {
          detalle_id: 'DET002',
          pedido_id: 'PED001',
          producto_id: 13,
          producto_nombre: 'Leche Entera 1L',
          categoria_id: 3,
          cantidad: 1,
          precio_unitario: 280,
          importe: 280,
          nombre: 'Juan Pérez',
          fecha_hora: '2024-01-15 10:30:00'
        },
        {
          detalle_id: 'DET003',
          pedido_id: 'PED002',
          producto_id: 7,
          producto_nombre: 'Coca Cola 500ml',
          categoria_id: 2,
          cantidad: 1,
          precio_unitario: 350,
          importe: 350,
          nombre: 'María González',
          fecha_hora: '2024-01-15 14:20:00'
        }
      ];
      
      return res.json({
        success: true,
        detalles: datosEjemplo
      });
    }
    
    // Intentar obtener datos reales de Google Sheets
    try {
      // Obtener detalles de pedidos
      const detallesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DetallePedidos!A:I'
      });
      
      const detallesRows = detallesResponse.data.values || [];
      if (detallesRows.length <= 1) {
        return res.json({
          success: true,
          detalles: []
        });
      }
      
      // Obtener clientes para el nombre
      const clientesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Clientes!A:B'
      });
      
      const clientesRows = clientesResponse.data.values || [];
      const clientesMap = {};
      
      // Crear mapa de clientes
      for (let i = 1; i < clientesRows.length; i++) {
        const [cliente_id, nombre] = clientesRows[i];
        if (cliente_id && nombre) {
          clientesMap[cliente_id] = nombre;
        }
      }
      
      // Obtener pedidos para obtener cliente_id
      const pedidosResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Pedidos!A:G'
      });
      
      const pedidosRows = pedidosResponse.data.values || [];
      const pedidosMap = {};
      
      // Crear mapa de pedidos
      for (let i = 1; i < pedidosRows.length; i++) {
        const [pedido_id, fecha_hora, cliente_id] = pedidosRows[i];
        if (pedido_id && cliente_id) {
          pedidosMap[pedido_id] = {
            cliente_id: cliente_id,
            fecha_hora: fecha_hora
          };
        }
      }
      
      // Procesar detalles
      const detalles = [];
      for (let i = 1; i < detallesRows.length; i++) {
        const [detalle_id, pedido_id, producto_id, producto_nombre, categoria_id, cantidad, precio_unitario, importe, cliente_nombre] = detallesRows[i];
        
        if (detalle_id && pedido_id) {
          const pedidoInfo = pedidosMap[pedido_id];
          const nombreCliente = cliente_nombre || (pedidoInfo ? clientesMap[pedidoInfo.cliente_id] : '') || 'Cliente desconocido';
          
          detalles.push({
            detalle_id: detalle_id,
            pedido_id: pedido_id,
            producto_id: parseInt(producto_id) || 0,
            producto_nombre: producto_nombre || '',
            categoria_id: parseInt(categoria_id) || 0,
            cantidad: parseInt(cantidad) || 0,
            precio_unitario: parseFloat(precio_unitario) || 0,
            importe: parseFloat(importe) || 0,
            nombre: nombreCliente,
            fecha_hora: pedidoInfo ? pedidoInfo.fecha_hora : ''
          });
        }
      }
      
      // Ordenar por fecha más reciente
      detalles.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
      
      console.log(`✅ ${detalles.length} detalles obtenidos de Google Sheets`);
      
      res.json({
        success: true,
        detalles: detalles
      });
      
    } catch (sheetsError) {
      console.error('❌ Error accediendo a Google Sheets:', sheetsError.message);
      console.log('📊 Fallback a datos de ejemplo');
      
      // Fallback a datos de ejemplo
      const datosEjemplo = [
        {
          detalle_id: 'DET001',
          pedido_id: 'PED001',
          producto_id: 1,
          producto_nombre: 'Oreo Original 117g',
          categoria_id: 1,
          cantidad: 2,
          precio_unitario: 450,
          importe: 900,
          nombre: 'Juan Pérez',
          fecha_hora: '2024-01-15 10:30:00'
        }
      ];
      
      res.json({
        success: true,
        detalles: datosEjemplo
      });
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo detalles:', error);
    res.status(500).json({
      success: false,
      detalles: [],
      error: error.message
    });
  }
});

// Cambiar estado de un pedido
app.put('/api/pedidos/:pedidoId/estado', async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { estado } = req.body;

    if (!SPREADSHEET_ID) {
      return res.status(400).json({ 
        success: false, 
        message: 'Google Sheets no configurado' 
      });
    }

    if (!['PENDIENTE', 'CONFIRMADO', 'CANCELADO'].includes(estado)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Estado inválido' 
      });
    }

    // Obtener datos actuales de Pedidos
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pedidos!A:G',
    });

    const data = response.data.values || [];
    if (data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No se encontraron pedidos' 
      });
    }

    // Encontrar la fila del pedido (empezando desde fila 2, índice 1)
    let filaEncontrada = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === pedidoId) {
        filaEncontrada = i + 1; // +1 porque las filas en Sheets empiezan en 1
        break;
      }
    }

    if (filaEncontrada === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pedido no encontrado' 
      });
    }

    // Actualizar el estado en la columna G (índice 6)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Pedidos!G${filaEncontrada}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[estado]]
      }
    });

    res.json({ 
      success: true, 
      message: `Pedido ${pedidoId} actualizado a ${estado}` 
    });

  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error actualizando estado: ' + error.message 
    });
  }
});

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

// Endpoint de diagnóstico
app.get('/api/diagnostico', async (req, res) => {
  const diagnostico = {
    servidor: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    variables: {
      NODE_ENV: process.env.NODE_ENV || 'no configurado',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'Configurado ✅' : 'NO CONFIGURADO ❌',
      RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL || 'NO DISPONIBLE',
      GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID ? 'Configurado ✅' : 'NO CONFIGURADO ❌'
    },
    telegram: {
      token_valido: false,
      webhook_configurado: false,
      bot_info: null
    }
  };

  // Verificar token de Telegram
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
      const data = await response.json();
      
      if (data.ok) {
        diagnostico.telegram.token_valido = true;
        diagnostico.telegram.bot_info = {
          username: data.result.username,
          first_name: data.result.first_name,
          id: data.result.id
        };
        
        // Verificar webhook
        const webhookResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
        const webhookData = await webhookResponse.json();
        
        if (webhookData.ok) {
          diagnostico.telegram.webhook_configurado = !!webhookData.result.url;
          diagnostico.telegram.webhook_url = webhookData.result.url;
          diagnostico.telegram.pending_updates = webhookData.result.pending_update_count;
        }
      }
    } catch (error) {
      diagnostico.telegram.error = error.message;
    }
  }

  res.json(diagnostico);
});

// Endpoint para configurar webhook manualmente
app.post('/api/setup-webhook', async (req, res) => {
  try {
    await configurarWebhook();
    res.json({ success: true, message: 'Webhook configurado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Función para enviar mensajes de Telegram
async function enviarMensaje(chatId, texto, opciones = {}) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN no configurado - simulando envío de mensaje');
    return { ok: true, result: { message_id: Date.now() } };
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
        ...opciones
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      console.error('❌ Error enviando mensaje:', result.description);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error en enviarMensaje:', error.message);
    return { ok: false, error: error.message };
  }
}

// Estado del bot (en memoria)
const sesionesBot = new Map();
const pedidosEnMemoria = [];
let contadorPedidos = 1;

// Estados de usuario para el bot
const userStates = new Map();
const userObservations = new Map();

// Función para agregar producto al carrito
async function agregarProductoAlCarrito(chatId, productoId, cantidad) {
  try {
    console.log(`🛒 Agregando al carrito: producto ${productoId}, cantidad ${cantidad}`);
    
    const producto = productosCache.find(p => p.producto_id == productoId);
    const clienteActual = sesionesUsuarios[chatId]?.cliente;
    
    if (!producto || !clienteActual) {
      await enviarMensaje(chatId, '❌ Error agregando producto. Intenta de nuevo.');
      return;
    }
    
    // Calcular precio
    const lista = clienteActual.lista || 1;
    const precioUnitario = obtenerPrecioProducto(producto, lista);
    const importe = precioUnitario * cantidad;
    
    // Inicializar carrito si no existe
    if (!sesionesUsuarios[chatId].carrito) {
      sesionesUsuarios[chatId].carrito = [];
    }
    
    // Verificar si el producto ya está en el carrito
    const itemExistente = sesionesUsuarios[chatId].carrito.find(item => item.producto_id == productoId);
    
    if (itemExistente) {
      // Actualizar cantidad
      itemExistente.cantidad += cantidad;
      itemExistente.importe = itemExistente.precio_unitario * itemExistente.cantidad;
      console.log(`📦 Cantidad actualizada: ${itemExistente.cantidad} unidades`);
    } else {
      // Agregar nuevo item
      sesionesUsuarios[chatId].carrito.push({
        producto_id: productoId,
        producto_nombre: producto.producto_nombre,
        categoria_id: producto.categoria_id,
        cantidad: cantidad,
        precio_unitario: precioUnitario,
        importe: importe
      });
      console.log(`✅ Producto agregado al carrito`);
    }
    
    // Calcular total del carrito
    const totalCarrito = sesionesUsuarios[chatId].carrito.reduce((sum, item) => sum + item.importe, 0);
    const itemsCarrito = sesionesUsuarios[chatId].carrito.reduce((sum, item) => sum + item.cantidad, 0);
    
    const mensaje = `✅ **Producto agregado al carrito**\n\n` +
                   `🛍️ ${producto.producto_nombre}\n` +
                   `📦 Cantidad: ${cantidad}\n` +
                   `💰 Subtotal: $${importe.toLocaleString()}\n\n` +
                   `🛒 **Resumen del carrito:**\n` +
                   `📦 Items: ${itemsCarrito}\n` +
                   `💰 Total: $${totalCarrito.toLocaleString()}\n\n` +
                   `¿Qué quieres hacer ahora?`;
    
    const teclado = {
      inline_keyboard: [
        [
          { text: '➕ Agregar más productos', callback_data: 'hacer_pedido' },
          { text: '🛒 Ver carrito', callback_data: 'ver_carrito' }
        ],
        [
          { text: '✅ Finalizar pedido', callback_data: 'finalizar_pedido' },
          { text: '🏠 Menú principal', callback_data: 'menu_principal' }
        ]
      ]
    };
    
    await enviarMensaje(chatId, mensaje, teclado);
    
  } catch (error) {
    console.error('❌ Error agregando al carrito:', error);
    await enviarMensaje(chatId, '❌ Error agregando producto al carrito.');
  }
}

// Función para solicitar cantidad manual
async function solicitarCantidadManual(chatId, productoId) {
  try {
    console.log(`📦 Mostrando opciones de cantidad para producto ${productoId}...`);
    
    const producto = productosCache.find(p => p.producto_id == productoId);
    
    if (!producto) {
      console.log(`❌ Producto ${productoId} no encontrado`);
      await enviarMensaje(chatId, '❌ Producto no encontrado.');
      return;
    }
    
    console.log(`🛍️ Producto encontrado: ${producto.producto_nombre}`);
    
    await enviarMensaje(chatId, `✏️ **${producto.producto_nombre}**\n\nEscribe la cantidad que deseas (solo números):`);
    
    // Cambiar estado para esperar cantidad
    if (!sesionesUsuarios[chatId]) {
      sesionesUsuarios[chatId] = {};
    }
    sesionesUsuarios[chatId].esperandoCantidad = productoId;
    
  } catch (error) {
    console.error('❌ Error solicitando cantidad:', error);
    await enviarMensaje(chatId, '❌ Error. Intenta de nuevo.');
  }
}

// Función para obtener el precio según la lista del cliente
function obtenerPrecioProducto(producto, listaCliente) {
  const lista = parseInt(listaCliente) || 1;
  
  switch (lista) {
    case 1: return parseInt(producto.precio1) || 0;
    case 2: return parseInt(producto.precio2) || 0;
    case 3: return parseInt(producto.precio3) || 0;
    case 4: return parseInt(producto.precio4) || 0;
    case 5: return parseInt(producto.precio5) || 0;
    default: return parseInt(producto.precio1) || 0;
  }
}

// Webhook de Telegram
app.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook recibido:', JSON.stringify(req.body, null, 2));
    
    const { message, callback_query } = req.body;
    
    if (message) {
      console.log(`📱 Mensaje de ${message.from.first_name}: ${message.text}`);
      await manejarMensaje(message);
    }
    
    if (callback_query) {
      console.log(`🔘 Callback de ${callback_query.from.first_name}: ${callback_query.data}`);
      await manejarCallback(callback_query);
    }
    
    // Manejo de callback queries (botones inline)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const firstName = callbackQuery.from.first_name;
      
      console.log(`🔘 Callback de ${firstName}: ${data}`);
      
      try {
        // Responder inmediatamente al callback para quitar el loading
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id
          })
        });
        
        // Procesar el callback según el tipo
        if (data === 'hacer_pedido') {
          console.log('🛒 Iniciando proceso de pedido...');
          await mostrarClientes(chatId);
        } else if (data.startsWith('cliente_')) {
          const clienteId = parseInt(data.split('_')[1]);
          console.log(`👤 Cliente seleccionado: ${clienteId}`);
          await seleccionarCliente(chatId, clienteId);
        } else if (data.startsWith('categoria_')) {
          const categoriaId = parseInt(data.split('_')[1]);
          console.log(`📂 Categoría seleccionada: ${categoriaId}`);
          await mostrarProductosPorCategoria(chatId, categoriaId);
        } else if (data.startsWith('producto_')) {
          const productoId = parseInt(data.split('_')[1]);
          console.log(`🛍️ Producto seleccionado: ${productoId}`);
          await mostrarOpcionesCantidad(chatId, productoId);
        } else if (data.startsWith('cantidad_')) {
          const [_, productoId, cantidad] = data.split('_');
          console.log(`📦 Agregando ${cantidad} del producto ${productoId}`);
          await agregarAlCarrito(chatId, parseInt(productoId), parseInt(cantidad));
        } else if (data === 'buscar_producto') {
          console.log('🔍 Iniciando búsqueda de productos...');
          await iniciarBusquedaProducto(chatId);
        } else if (data === 'ver_carrito') {
          console.log('🛒 Mostrando carrito...');
          await mostrarCarrito(chatId);
        } else if (data === 'finalizar_pedido') {
          console.log('✅ Finalizando pedido...');
          await finalizarPedido(chatId);
        } else if (data === 'menu_principal') {
          console.log('🏠 Volviendo al menú principal...');
          await mostrarMenuPrincipal(chatId, firstName);
        } else {
          console.log(`⚠️ Callback no reconocido: ${data}`);
        }
        
        console.log(`✅ Callback ${data} procesado exitosamente`);
        
      } catch (error) {
        console.error(`❌ Error procesando callback ${data}:`, error);
        await enviarMensaje(chatId, '❌ Error procesando la solicitud. Intenta nuevamente.');
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error en webhook:', error.message);
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
          [{ text: '🔍 Buscar Producto', callback_data: 'buscar_producto' }],
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
    sesion.categoriaSeleccionada = null;
    sesion.clienteSeleccionado = null;
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '❌ Operación cancelada\n\n¿Qué deseas hacer?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '🔍 Buscar Producto', callback_data: 'buscar_producto' }],
          [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }]
        ]
      }
    });
    return;
  }
  
  // Manejar selección de cliente por nombre
  if (sesion.estado === 'esperando_cliente') {
    const termino = texto.trim().toLowerCase();
    
    if (termino.length < 2) {
      await enviarMensaje(chatId, '❌ Escribe al menos 2 letras para buscar.\n\n_O usa /cancelar para volver_', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancelar búsqueda', callback_data: 'cancelar_busqueda_cliente' }]
          ]
        }
      });
      return;
    }
    
    const clientes = await leerSheet('Clientes');
    const clientesFiltrados = clientes.filter(c => 
      c.nombre && 
      c.nombre.toLowerCase().includes(termino)
    );
    
    if (clientesFiltrados.length === 0) {
      await enviarMensaje(chatId, `❌ No encontré clientes con "${texto}".\n\n¿Qué deseas hacer?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Buscar de nuevo', callback_data: 'buscar_cliente' }],
            [{ text: '📋 Ver lista completa', callback_data: 'lista_clientes' }],
            [{ text: '➕ Agregar nuevo cliente', callback_data: 'nuevo_cliente' }],
            [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
          ]
        }
      });
      return;
    }
    
    // Mostrar resultados (máximo 10)
    const resultados = clientesFiltrados.slice(0, 10);
    const keyboard = resultados.map(cliente => [{
      text: `👤 ${cliente.nombre}`,
      callback_data: `cliente_${cliente.cliente_id}`
    }]);
    
    // Agregar botones de navegación
    keyboard.push([
      { text: '🔍 Nueva búsqueda', callback_data: 'buscar_cliente' },
      { text: '📋 Ver lista', callback_data: 'lista_clientes' }
    ]);
    keyboard.push([
      { text: '➕ Nuevo cliente', callback_data: 'nuevo_cliente' },
      { text: '🏠 Menú principal', callback_data: 'menu_principal' }
    ]);
    
    const mensajeResultados = clientesFiltrados.length > 10 
      ? `🔍 Encontré ${clientesFiltrados.length} clientes con "${texto}" (mostrando primeros 10):`
      : `🔍 Encontré ${clientesFiltrados.length} clientes con "${texto}":`;
    
    await enviarMensaje(chatId, mensajeResultados, {
      reply_markup: { inline_keyboard: keyboard }
    });
    
    sesion.estado = 'inicio';
    sesionesBot.set(userId, sesion);
    return;
  }
  
  // Manejar nuevo cliente
  if (sesion.estado === 'esperando_nuevo_cliente') {
    const nombreCliente = texto.trim();
    
    if (nombreCliente.length < 2) {
      await enviarMensaje(chatId, '❌ El nombre debe tener al menos 2 caracteres. Intenta de nuevo:\n\n_O usa /cancelar para volver_', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancelar', callback_data: 'cancelar_nuevo_cliente' }]
          ]
        }
      });
      return;
    }
    
    try {
      // Obtener el próximo ID de cliente
      const clientes = await leerSheet('Clientes');
      const maxId = clientes.length > 0 ? Math.max(...clientes.map(c => parseInt(c.cliente_id) || 0)) : 0;
      const nuevoId = maxId + 1;
      
      // Agregar cliente a Google Sheets
      await escribirSheet('Clientes', [nuevoId, nombreCliente]);
      
      // Seleccionar el nuevo cliente
      sesion.clienteSeleccionado = {
        cliente_id: nuevoId,
        nombre: nombreCliente,
        lista: 1 // Lista por defecto para nuevos clientes
      };
      sesion.estado = 'inicio';
      sesionesBot.set(userId, sesion);
      
      await enviarMensaje(chatId, `✅ Cliente "${nombreCliente}" agregado y seleccionado\n\n¿Qué deseas hacer ahora?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍️ Continuar con pedido', callback_data: 'continuar_pedido' }],
            [{ text: '👤 Cambiar cliente', callback_data: 'seleccionar_cliente' }],
            [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('Error agregando cliente:', error);
      await enviarMensaje(chatId, '❌ Error agregando cliente. Intenta de nuevo:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Reintentar', callback_data: 'nuevo_cliente' }],
            [{ text: '📋 Ver lista existente', callback_data: 'lista_clientes' }],
            [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
          ]
        }
      });
    }
    return;
  }
  
  // Manejar búsqueda de productos
  if (sesion.estado === 'esperando_busqueda') {
    const termino = texto.trim().toLowerCase();
    
    if (termino.length < 2) {
      await enviarMensaje(chatId, '❌ Escribe al menos 2 letras para buscar.\n\n_O usa /cancelar para volver_', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancelar búsqueda', callback_data: 'cancelar_busqueda' }]
          ]
        }
      });
      return;
    }
    
    const productos = await leerSheet('Productos');
    let productosFiltrados = productos.filter(p => 
      p.activo === 'SI' && 
      p.producto_nombre && 
      p.producto_nombre.toLowerCase().includes(termino)
    );
    
    // Si hay categoría seleccionada, filtrar también por categoría
    if (sesion.categoriaSeleccionada) {
      productosFiltrados = productosFiltrados.filter(p => 
        p.categoria_id == sesion.categoriaSeleccionada
      );
    }
    
    console.log(`📦 Buscando productos de categoría ${categoriaId}...`);
    
    if (productosFiltrados.length === 0) {
      const mensajeBusqueda = sesion.categoriaSeleccionada 
        ? `❌ No encontré productos con "${texto}" en esta categoría.\n\n¿Qué deseas hacer?`
        : `❌ No encontré productos con "${texto}".\n\n¿Qué deseas hacer?`;
        
    console.log(`📦 Encontrados ${productos.length} productos en categoría ${categoriaId}`);
    
      await enviarMensaje(chatId, mensajeBusqueda, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Buscar de nuevo', callback_data: 'buscar_producto' }],
            [{ text: '📂 Ver por categorías', callback_data: 'hacer_pedido' }],
            [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
          ]
        }
    console.log(`📂 Categoría: ${nombreCategoria}`);
    
      });
      return;
    }
    
    // Mostrar resultados (máximo 10)
    const resultados = productosFiltrados.slice(0, 10);
    const keyboard = resultados.map(prod => [{
      text: `🛍️ ${prod.producto_nombre}`,
      callback_data: `producto_${prod.producto_id}`
    }]);
    
    // Agregar botones de navegación
    keyboard.push([
      { text: '🔍 Nueva búsqueda', callback_data: 'buscar_producto' },
      { text: '📂 Ver categorías', callback_data: 'hacer_pedido' }
    ]);
    keyboard.push([{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]);
    
    const mensajeResultados = productosFiltrados.length > 10 
      ? `🔍 Encontré ${productosFiltrados.length} productos con "${texto}" (mostrando primeros 10):`
      : `🔍 Encontré ${productosFiltrados.length} productos con "${texto}":`;
    
    await enviarMensaje(chatId, mensajeResultados, {
      reply_markup: { inline_keyboard: keyboard }
    });
    console.log(`📤 Enviando mensaje con ${keyboard.length} botones...`);
    
    
    sesion.estado = 'inicio';
    sesionesBot.set(userId, sesion);
    return;
  }
  
  // Manejar cantidad de producto
  if (sesion.estado === 'esperando_cantidad' && /^\d+$/.test(texto)) {
    const cantidad = parseInt(texto);
    const producto = sesion.productoSeleccionado;
    
    if (cantidad > 0) {
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
      await enviarMensaje(chatId, '❌ Cantidad inválida. Ingresa un número mayor a 0:\n\n_O usa /cancelar para volver_', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancelar', callback_data: 'cancelar_producto' }]
    console.log(`💰 Precio calculado: $${precio} (lista ${lista})`);
    
          ]
        }
      });
    }
    return;
  }
  
  // Si está esperando cantidad pero no es un número válido
  if (sesion.estado === 'esperando_cantidad') {
    await enviarMensaje(chatId, '❌ Por favor ingresa solo números.\n\nCantidad para el producto:\n\n_O usa /cancelar para volver_', {
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
    // Verificar si ya hay un cliente seleccionado
    if (sesion.clienteSeleccionado) {
      // Si ya hay cliente, ir directo a categorías
      const categorias = await leerSheet('Categorias');
      
      // Filtrar solo categorías que tienen nombre
      const categoriasConNombre = categorias.filter(cat => 
        cat.categoria_nombre && 
        cat.categoria_nombre.trim() !== '' && 
        cat.categoria_nombre !== 'undefined' && 
        cat.categoria_nombre !== 'null'
      );
      
      if (categoriasConNombre.length === 0) {
        await enviarMensaje(chatId, '❌ No hay categorías disponibles en este momento.');
        return;
      }
      
      const keyboard = categoriasConNombre.map(cat => [{
        text: `📂 ${cat.categoria_nombre}`,
        callback_data: `categoria_${cat.categoria_id}`
      }]);
      
      // Agregar botones de navegación
      keyboard.push([
        { text: '🔍 Buscar producto', callback_data: 'buscar_producto' },
        { text: '👤 Cambiar cliente', callback_data: 'seleccionar_cliente' }
      ]);
      keyboard.push([{ text: '🔙 Volver al menú', callback_data: 'menu_principal' }]);
      
      await enviarMensaje(chatId, `👤 Cliente: **${sesion.clienteSeleccionado.nombre}**\n\n📂 Selecciona una categoría:`, {
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      // Si no hay cliente, solicitar selección
      await enviarMensaje(chatId, '👤 **SELECCIONAR CLIENTE**\n\nPrimero debes seleccionar un cliente para el pedido:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Ver lista de clientes', callback_data: 'lista_clientes' }],
            [{ text: '🔍 Buscar cliente', callback_data: 'buscar_cliente' }],
            [{ text: '➕ Agregar nuevo cliente', callback_data: 'nuevo_cliente' }],
            [{ text: '🔙 Volver al menú', callback_data: 'menu_principal' }]
          ]
        }
      });
    }
  }
  
  if (data === 'seleccionar_cliente') {
    await enviarMensaje(chatId, '👤 **SELECCIONAR CLIENTE**\n\n¿Cómo deseas seleccionar el cliente?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Ver lista de clientes', callback_data: 'lista_clientes' }],
          [{ text: '🔍 Buscar cliente', callback_data: 'buscar_cliente' }],
          [{ text: '➕ Agregar nuevo cliente', callback_data: 'nuevo_cliente' }],
          [{ text: '🔙 Volver al menú', callback_data: 'menu_principal' }]
        ]
      }
    });
  }
  
  if (data === 'lista_clientes') {
    const clientes = await leerSheet('Clientes');
    const clientesValidos = clientes.filter(c => c.nombre && c.nombre.trim() !== '');
    
    if (clientesValidos.length === 0) {
      await enviarMensaje(chatId, '❌ No hay clientes registrados.\n\n¿Deseas agregar uno?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Agregar nuevo cliente', callback_data: 'nuevo_cliente' }],
            [{ text: '🔙 Volver al menú', callback_data: 'menu_principal' }]
          ]
        }
      });
      return;
    }
    
    // Mostrar primeros 10 clientes
    const clientesMostrar = clientesValidos.slice(0, 10);
    const keyboard = clientesMostrar.map(cliente => [{
      text: `👤 ${cliente.nombre}`,
      callback_data: `cliente_${cliente.cliente_id}`
    }]);
    
    // Agregar botones de navegación
    if (clientesValidos.length > 10) {
      keyboard.push([{ text: '🔍 Buscar cliente específico', callback_data: 'buscar_cliente' }]);
    }
    keyboard.push([
      { text: '➕ Nuevo cliente', callback_data: 'nuevo_cliente' },
      { text: '🔙 Volver', callback_data: 'menu_principal' }
    ]);
    
    const mensaje = clientesValidos.length > 10 
      ? `👥 **LISTA DE CLIENTES** (mostrando primeros 10 de ${clientesValidos.length}):\n\nSelecciona un cliente:`
      : `👥 **LISTA DE CLIENTES** (${clientesValidos.length} clientes):\n\nSelecciona un cliente:`;
    
    console.log(`📤 Enviando opciones de cantidad...`);
    
    await enviarMensaje(chatId, mensaje, {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
  
    
    console.log(`✅ Productos de categoría ${categoriaId} mostrados exitosamente`);
  if (data === 'buscar_cliente') {
    sesion.estado = 'esperando_cliente';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '🔍 **BUSCAR CLIENTE**\n\nEscribe el nombre del cliente (o parte del nombre):\n\n_Ejemplos: "juan", "maría", "pérez"_\n\n_O usa /cancelar para volver_', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancelar búsqueda', callback_data: 'cancelar_busqueda_cliente' }]
        ]
      }
    });
  }
  
  if (data === 'nuevo_cliente') {
    sesion.estado = 'esperando_nuevo_cliente';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '➕ **AGREGAR NUEVO CLIENTE**\n\nEscribe el nombre completo del nuevo cliente:\n\n_Ejemplo: "Juan Pérez"_\n\n_O usa /cancelar para volver_', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancelar', callback_data: 'cancelar_nuevo_cliente' }]
        ]
      }
    });
  }
  
  if (data.startsWith('cliente_')) {
    const clienteId = data.split('_')[1];
    const clientes = await leerSheet('Clientes');
    const cliente = clientes.find(c => c.cliente_id == clienteId);
    
    if (cliente) {
      sesion.clienteSeleccionado = cliente;
      sesion.estado = 'inicio';
      sesionesBot.set(userId, sesion);
      
      await enviarMensaje(chatId, `✅ Cliente seleccionado: **${cliente.nombre}**\n\n¿Qué deseas hacer ahora?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍️ Continuar con pedido', callback_data: 'continuar_pedido' }],
            [{ text: '👤 Cambiar cliente', callback_data: 'seleccionar_cliente' }],
            [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
            [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
          ]
        }
      });
    } else {
      await enviarMensaje(chatId, '❌ Cliente no encontrado.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Ver lista', callback_data: 'lista_clientes' }],
            [{ text: '🔙 Volver', callback_data: 'menu_principal' }]
          ]
        }
      });
    }
  }
  
  if (data === 'continuar_pedido') {
    const categorias = await leerSheet('Categorias');
    
    // Filtrar solo categorías que tienen nombre
    const categoriasConNombre = categorias.filter(cat => 
      cat.categoria_nombre && 
      cat.categoria_nombre.trim() !== '' && 
      cat.categoria_nombre !== 'undefined' && 
      cat.categoria_nombre !== 'null'
    );
    
    if (categoriasConNombre.length === 0) {
      await enviarMensaje(chatId, '❌ No hay categorías disponibles en este momento.');
      return;
    }
    
    const keyboard = categoriasConNombre.map(cat => [{
      text: `📂 ${cat.categoria_nombre}`,
      callback_data: `categoria_${cat.categoria_id}`
    }]);
    
    // Agregar botones de navegación
    keyboard.push([
      { text: '🔍 Buscar producto', callback_data: 'buscar_producto' },
      { text: '👤 Cambiar cliente', callback_data: 'seleccionar_cliente' }
    ]);
    keyboard.push([{ text: '🔙 Volver al menú', callback_data: 'menu_principal' }]);
    
    const clienteNombre = sesion.clienteSeleccionado ? sesion.clienteSeleccionado.nombre : 'No seleccionado';
    await enviarMensaje(chatId, `👤 Cliente: **${clienteNombre}**\n\n📂 Selecciona una categoría:`, {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
  
  if (data === 'cancelar_busqueda_cliente') {
    sesion.estado = 'inicio';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '❌ Búsqueda de cliente cancelada\n\n¿Qué deseas hacer?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Ver lista de clientes', callback_data: 'lista_clientes' }],
          [{ text: '➕ Agregar nuevo cliente', callback_data: 'nuevo_cliente' }],
          [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
        ]
      }
    });
  }
  
  if (data === 'cancelar_nuevo_cliente') {
    sesion.estado = 'inicio';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '❌ Creación de cliente cancelada\n\n¿Qué deseas hacer?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Ver lista de clientes', callback_data: 'lista_clientes' }],
          [{ text: '🔍 Buscar cliente', callback_data: 'buscar_cliente' }],
          [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
        ]
      }
    });
  }
  
  if (data === 'buscar_producto') {
    sesion.estado = 'esperando_busqueda';
    sesion.categoriaSeleccionada = null; // Limpiar categoría para búsqueda global
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '🔍 **BUSCAR PRODUCTO**\n\nEscribe el nombre del producto (o parte del nombre):\n\n_Ejemplos: "oreo", "coca", "pan"_\n\n_O usa /cancelar para volver_', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancelar búsqueda', callback_data: 'cancelar_busqueda' }]
        ]
      }
    });
  }
  
  // Manejar cantidades rápidas
  if (data.startsWith('cantidad_')) {
    const cantidad = parseInt(data.split('_')[1]);
    
    const producto = sesion.productoSeleccionado;
    
    if (!producto) {
      await enviarMensaje(chatId, '❌ No hay producto seleccionado');
      return;
    }
    
    if (cantidad > 0) {
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
      sesion.productoSeleccionado = null;
      
      await enviarMensaje(chatId, `✅ Agregado: ${cantidad}x ${producto.producto_nombre}\nSubtotal: $${importe.toLocaleString()}\nTotal del pedido: $${sesion.pedido.total.toLocaleString()}\n\n¿Qué deseas hacer?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Agregar más productos', callback_data: 'hacer_pedido' }],
            [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
            [{ text: '✅ Finalizar pedido', callback_data: 'finalizar_pedido' }]
          ]
        }
      });
      
      sesionesBot.set(userId, sesion);
    }
  }
  
  if (data === 'cancelar_producto') {
    sesion.estado = 'inicio';
    sesion.productoSeleccionado = null;
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '❌ Producto cancelado\n\n¿Qué deseas hacer?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Continuar comprando', callback_data: 'hacer_pedido' }],
          [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
          [{ text: '🏠 Menú principal', callback_data: 'menu_principal' }]
        ]
      }
    });
  }
  
  if (data === 'menu_principal') {
    sesion.estado = 'inicio';
    sesionesBot.set(userId, sesion);
    
    await enviarMensaje(chatId, '🛒 ¡Bienvenido a la Distribuidora!\n\nSelecciona una opción:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Hacer Pedido', callback_data: 'hacer_pedido' }],
          [{ text: '🔍 Buscar Producto', callback_data: 'buscar_producto' }],
          [{ text: '📋 Ver Productos', callback_data: 'ver_productos' }],
          [{ text: '🛒 Ver carrito', callback_data: 'ver_carrito' }],
    
    console.log(`✅ Opciones de cantidad mostradas para producto ${productoId}`);
          [{ text: '❓ Ayuda', callback_data: 'ayuda' }]
        ]
      }
    });
  }
}

// Inicializar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 URL: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}`);
  
  // Verificar Google Sheets
  await verificarGoogleSheets();
  
  // Configurar webhook de Telegram
  await configurarWebhook();
  
  console.log('');
  console.log('🔗 URLs importantes:');
  console.log(`   📊 Dashboard: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}`);
  console.log(`   🔍 Diagnóstico: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/api/diagnostico`);
  console.log(`   🤖 Webhook: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/webhook`);
  console.log('');
  
  // Actualizar cache inicial
  await actualizarCache();
});