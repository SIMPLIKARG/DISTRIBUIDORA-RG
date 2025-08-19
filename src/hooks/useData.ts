import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function updateInSheet(sheetName, pedidoId, updates) {
  if (!sheets || !SPREADSHEET_ID) {
    console.log(`⚠️  Actualizando en memoria: ${sheetName}`);
    switch (sheetName) {
      case 'Pedidos':
        const index = pedidosMemoria.findIndex(p => p.pedido_id === pedidoId);
        if (index !== -1) {
          pedidosMemoria[index] = { ...pedidosMemoria[index], ...updates };
        }
        break;
    }
    return;
  }

  try {
    // Obtener todos los datos para encontrar la fila
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return;

    const headers = rows[0];
    const pedidoIdIndex = headers.indexOf('pedido_id');
    
    if (pedidoIdIndex === -1) {
      throw new Error('No se encontró la columna pedido_id');
    }

    // Encontrar la fila del pedido
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][pedidoIdIndex] === pedidoId) {
        rowIndex = i + 1; // +1 porque las filas en Sheets empiezan en 1
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error(`No se encontró el pedido ${pedidoId}`);
    }

    // Actualizar cada campo modificado
    for (const [key, value] of Object.entries(updates)) {
      const columnIndex = headers.indexOf(key);
      if (columnIndex !== -1) {
        const columnLetter = String.fromCharCode(65 + columnIndex); // A, B, C, etc.
        const range = `${sheetName}!${columnLetter}${rowIndex}`;
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: range,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[value]],
          },
        });
      }
    }

    console.log(`✅ Pedido ${pedidoId} actualizado en ${sheetName}`);
  } catch (error) {
    console.error(`❌ Error actualizando en ${sheetName}:`, error.message);
    // Fallback a memoria
    switch (sheetName) {
      case 'Pedidos':
        const index = pedidosMemoria.findIndex(p => p.pedido_id === pedidoId);
        if (index !== -1) {
          pedidosMemoria[index] = { ...pedidosMemoria[index], ...updates };
        }
        break;
    }
  }
}

// Estado del bot por usuario
const userSessions = new Map();

// Función para crear teclados inline
function createInlineKeyboard(buttons, columns = 2) {
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += columns) {
    const row = buttons.slice(i, i + columns).map(button => ({
      text: button.text,
      callback_data: button.callback_data
    }));
    keyboard.push(row);
  }
  return { inline_keyboard: keyboard };
}

// Función para crear teclado de respuesta
function createReplyKeyboard(buttons, columns = 2) {
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += columns) {
    const row = buttons.slice(i, i + columns);
    keyboard.push(row);
  }
  return {
    keyboard: keyboard,
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

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

async function saveNewClient(clientData) {
  try {
    // Obtener clientes existentes para generar nuevo ID
    const clientes = await getDataFromSheet('Clientes');
    const maxId = Math.max(...clientes.map(c => c.cliente_id), 0);
    const newClient = {
      cliente_id: maxId + 1,
      nombre: clientData.nombre,
      telefono: clientData.telefono || '',
      direccion: clientData.direccion || ''
    };
    
    await appendToSheet('Clientes', newClient);
    console.log('✅ Cliente nuevo guardado:', newClient);
    return newClient;
  } catch (error) {
    console.error('❌ Error guardando cliente:', error);
    throw error;
  }
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
    nuevoCliente: null,
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
          const keyboard = createReplyKeyboard(['🛒 Crear Pedido', '📋 Ver Ayuda']);
          await sendTelegramMessage(chatId, 
            `¡Hola ${userName}! 👋\n\nSoy tu asistente para pedidos de la distribuidora.\n\n¿Qué querés hacer?`,
            { reply_markup: keyboard }
          );
          session.step = 'menu_principal';
        } else if (input === '🛒 crear pedido' || input === 'crear pedido') {
          session.step = 'seleccion_cliente';
          await mostrarMenuClientes(chatId);
        } else if (input === '📋 ver ayuda' || input === 'ayuda' || input === '/ayuda') {
          const keyboard = createReplyKeyboard(['🛒 Crear Pedido', '🔙 Volver']);
          await sendTelegramMessage(chatId, 
            `🤖 *Comandos disponibles:*\n\n🛒 Crear Pedido - Iniciar nuevo pedido\n📋 Ver Ayuda - Esta ayuda\n\n*¿Cómo funciona?*\n1️⃣ Selecciona un cliente\n2️⃣ Elige una categoría\n3️⃣ Agrega productos\n4️⃣ Confirma tu pedido\n\n¡Es muy fácil! 😊`,
            { reply_markup: keyboard }
          );
        } else {
          const keyboard = createReplyKeyboard(['🛒 Crear Pedido', '📋 Ver Ayuda']);
          await sendTelegramMessage(chatId, 
            'No entendí ese comando. ¿Qué querés hacer?',
            { reply_markup: keyboard }
          );
        }
        break;

      case 'menu_principal':
        if (input === '🛒 crear pedido') {
          session.step = 'seleccion_cliente';
          await mostrarMenuClientes(chatId);
        } else if (input === '📋 ver ayuda') {
          const keyboard = createReplyKeyboard(['🛒 Crear Pedido', '🔙 Volver']);
          await sendTelegramMessage(chatId, 
            `🤖 *Comandos disponibles:*\n\n🛒 Crear Pedido - Iniciar nuevo pedido\n📋 Ver Ayuda - Esta ayuda\n\n*¿Cómo funciona?*\n1️⃣ Selecciona un cliente\n2️⃣ Elige una categoría\n3️⃣ Agrega productos\n4️⃣ Confirma tu pedido`,
            { reply_markup: keyboard }
          );
        } else if (input === '🔙 volver') {
          session.step = 'inicio';
          const keyboard = createReplyKeyboard(['🛒 Crear Pedido', '📋 Ver Ayuda']);
          await sendTelegramMessage(chatId, 
            `¿Qué querés hacer?`,
            { reply_markup: keyboard }
          );
        } else {
          const keyboard = createReplyKeyboard(['🛒 Crear Pedido', '📋 Ver Ayuda']);
          await sendTelegramMessage(chatId, 
            'Elegí una opción del menú:',
            { reply_markup: keyboard }
          );
        }
        break;

      case 'seleccion_cliente':
        if (input === '➕ agregar cliente nuevo') {
          await sendTelegramMessage(chatId, 
            `👤 *Agregar Cliente Nuevo*\n\nEscribe el nombre completo del nuevo cliente:\n\n*Ejemplo:* Juan Pérez`
          );
          session.step = 'ingreso_nuevo_cliente';
        } else if (input === '🔙 volver al menú') {
          session.step = 'menu_principal';
          const keyboard = createReplyKeyboard(['🛒 Crear Pedido', '📋 Ver Ayuda']);
          await sendTelegramMessage(chatId, 
            `¿Qué querés hacer?`,
            { reply_markup: keyboard }
          );
        } else {
          // Buscar cliente por nombre
          const clientes = await getDataFromSheet('Clientes');
          const clientesEncontrados = clientes.filter(cliente => 
            normalizeText(cliente.nombre).includes(normalizeText(message))
          );
          
          if (clientesEncontrados.length === 1) {
            const cliente = clientesEncontrados[0];
            session.pedidoId = generateId();
            session.clienteSeleccionado = cliente;
            
            await sendTelegramMessage(chatId, 
              `✅ Cliente seleccionado: *${cliente.nombre}*\n\nAhora elige una categoría:`
            );
            session.step = 'seleccion_categoria';
            await mostrarMenuCategorias(chatId);
          } else if (clientesEncontrados.length > 1) {
            const buttons = clientesEncontrados.slice(0, 8).map(c => c.nombre);
            buttons.push('➕ Agregar Cliente Nuevo', '🔙 Volver al Menú');
            const keyboard = createReplyKeyboard(buttons, 1);
            await sendTelegramMessage(chatId, 
              `Encontré varios clientes. ¿Cuál elegís?`,
              { reply_markup: keyboard }
            );
          } else {
            await mostrarMenuClientes(chatId);
            await sendTelegramMessage(chatId, 
              `❌ No encontré el cliente "${message}". Elegí uno de la lista o agregá uno nuevo.`
            );
          }
        }
        break;

      case 'ingreso_nuevo_cliente':
        if (message.trim().length < 2) {
          await sendTelegramMessage(chatId, 
            `❌ El nombre debe tener al menos 2 caracteres. Intentá de nuevo:`
          );
          break;
        }

        try {
          const nuevoCliente = await saveNewClient({ nombre: message.trim() });
          session.pedidoId = generateId();
          session.clienteSeleccionado = nuevoCliente;
          
          await sendTelegramMessage(chatId, 
            `✅ *Cliente creado exitosamente!*\n\n👤 ${nuevoCliente.nombre}\n🆔 ID: ${nuevoCliente.cliente_id}\n\nAhora elige una categoría:`
          );
          session.step = 'seleccion_categoria';
          await mostrarMenuCategorias(chatId);
        } catch (error) {
          await sendTelegramMessage(chatId, 
            `❌ Error creando el cliente. Intentá de nuevo o volvé al menú.`
          );
          await mostrarMenuClientes(chatId);
          session.step = 'seleccion_cliente';
        }
        break;

      case 'seleccion_categoria':
        if (input === '🔙 cambiar cliente') {
          session.clienteSeleccionado = null;
          session.pedidoId = null;
          session.step = 'seleccion_cliente';
          await mostrarMenuClientes(chatId);
        } else {
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
              await sendTelegramMessage(chatId, 
                `📦 *${categoria.categoria_nombre}*\n\nElegí un producto:`
              );
              session.step = 'seleccion_producto';
              await mostrarMenuProductos(chatId, categoria.categoria_id);
            } else {
              await sendTelegramMessage(chatId, 
                `❌ No hay productos disponibles en esa categoría.`
              );
              await mostrarMenuCategorias(chatId);
            }
          } else {
            await sendTelegramMessage(chatId, 
              `❌ Categoría no encontrada. Elegí una de la lista:`
            );
            await mostrarMenuCategorias(chatId);
          }
        }
        break;

      case 'seleccion_producto':
        if (input === '🔙 cambiar categoría') {
          session.categoriaSeleccionada = null;
          session.step = 'seleccion_categoria';
          await mostrarMenuCategorias(chatId);
        } else {
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

            const keyboard = createReplyKeyboard(['1', '2', '3', '4', '5', '🔙 Cambiar Producto'], 3);
            await sendTelegramMessage(chatId, 
              `🛒 *${producto.producto_nombre}*\n💰 Precio: $${producto.precio.toLocaleString('es-ES')}\n\n¿Qué cantidad querés agregar?`,
              { reply_markup: keyboard }
            );
            session.step = 'ingreso_cantidad';
          } else if (productosEncontrados.length > 1) {
            const buttons = productosEncontrados.slice(0, 8).map(p => 
              `${p.producto_nombre} - $${p.precio.toLocaleString('es-ES')}`
            );
            buttons.push('🔙 Cambiar Categoría');
            const keyboard = createReplyKeyboard(buttons, 1);
            await sendTelegramMessage(chatId, 
              `Encontré varios productos. ¿Cuál elegís?`,
              { reply_markup: keyboard }
            );
          } else {
            await sendTelegramMessage(chatId, 
              `❌ Producto no encontrado. Elegí uno de la lista:`
            );
            await mostrarMenuProductos(chatId, session.categoriaSeleccionada.categoria_id);
          }
        }
        break;

      case 'ingreso_cantidad':
        if (input === '🔙 cambiar producto') {
          session.productoSeleccionado = null;
          session.step = 'seleccion_producto';
          await mostrarMenuProductos(chatId, session.categoriaSeleccionada.categoria_id);
          break;
        }
        
        const cantidad = parseFloat(message.replace(',', '.'));
        
        if (isNaN(cantidad) || cantidad <= 0) {
          const keyboard = createReplyKeyboard(['1', '2', '3', '4', '5', '🔙 Cambiar Producto'], 3);
          await sendTelegramMessage(chatId, 
            '❌ Por favor ingresá un número mayor a 0.\n\n*Ejemplo:* 2 o 1.5',
            { reply_markup: keyboard }
          );
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

        const keyboard = createReplyKeyboard(['➕ Agregar Más', '👀 Ver Carrito', '✅ Finalizar Pedido'], 1);
        await sendTelegramMessage(chatId, 
          `✅ *Agregado al carrito:*\n${cantidad} × ${session.productoSeleccionado.producto_nombre} = $${importe.toLocaleString('es-ES')}\n\n💰 *Total parcial: $${session.total.toLocaleString('es-ES')}*\n\n¿Qué querés hacer?`,
          { reply_markup: keyboard }
        );
        session.step = 'carrito';
        break;

      case 'carrito':
        if (input === '➕ agregar más') {
          await sendTelegramMessage(chatId, 
            `Elegí una categoría para agregar más productos:`
          );
          session.step = 'seleccion_categoria';
          await mostrarMenuCategorias(chatId);
        } else if (input === '👀 ver carrito') {
          if (session.carrito.length === 0) {
            const keyboard = createReplyKeyboard(['➕ Agregar Más'], 1);
            await sendTelegramMessage(chatId, 
              '🛒 Tu carrito está vacío.',
              { reply_markup: keyboard }
            );
          } else {
            const carritoTexto = session.carrito.map((item, index) => 
              `${index + 1}. ${item.cantidad} × ${item.producto_nombre} = $${item.importe.toLocaleString('es-ES')}`
            ).join('\n');
            
            const keyboard = createReplyKeyboard(['➕ Agregar Más', '✅ Finalizar Pedido'], 1);
            await sendTelegramMessage(chatId, 
              `🛒 *Tu carrito:*\n\n${carritoTexto}\n\n💰 *Total: $${session.total.toLocaleString('es-ES')}*`,
              { reply_markup: keyboard }
            );
          }
        } else if (input === '✅ finalizar pedido') {
          if (session.carrito.length === 0) {
            const keyboard = createReplyKeyboard(['➕ Agregar Más'], 1);
            await sendTelegramMessage(chatId, 
              '❌ No podés finalizar un pedido vacío.',
              { reply_markup: keyboard }
            );
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
            estado: 'PENDIENTE'
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

          const keyboard = createReplyKeyboard(['🛒 Nuevo Pedido', '📋 Ver Ayuda'], 1);
          await sendTelegramMessage(chatId, 
            `📋 *¡Pedido Enviado!*\n\n👤 *Cliente:* ${session.clienteSeleccionado.nombre}\n📦 *Productos:*\n${carritoTexto}\n\n💰 *Total: $${session.total.toLocaleString('es-ES')}*\n🆔 *ID:* ${session.pedidoId}\n\n⏳ Tu pedido está *PENDIENTE* de confirmación.\n\nSerá revisado y confirmado desde el dashboard.\n\n¡Gracias!`,
            { reply_markup: keyboard }
          );
          
          // Resetear sesión
          session = {
            step: 'menu_principal',
            pedidoId: null,
            clienteSeleccionado: null,
            nuevoCliente: null,
            categoriaSeleccionada: null,
            productoSeleccionado: null,
            carrito: [],
            total: 0
          };
        } else if (input === '🛒 nuevo pedido') {
          // Resetear sesión
          session = {
            step: 'seleccion_cliente',
            pedidoId: null,
            clienteSeleccionado: null,
            nuevoCliente: null,
            categoriaSeleccionada: null,
            productoSeleccionado: null,
            carrito: [],
            total: 0
          };
          await mostrarMenuClientes(chatId);
        } else {
          const keyboard = createReplyKeyboard(['➕ Agregar Más', '👀 Ver Carrito', '✅ Finalizar Pedido'], 1);
          await sendTelegramMessage(chatId, 
            'Elegí una opción del menú:',
            { reply_markup: keyboard }
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
      nuevoCliente: null,
      categoriaSeleccionada: null,
      productoSeleccionado: null,
      carrito: [],
      total: 0
    };
  }

  userSessions.set(userId, session);
}

// Funciones auxiliares para mostrar menús
async function mostrarMenuClientes(chatId) {
  try {
    const clientes = await getDataFromSheet('Clientes');
    const buttons = clientes.slice(0, 8).map(c => c.nombre);
    buttons.push('➕ Agregar Cliente Nuevo', '🔙 Volver al Menú');
    
    const keyboard = createReplyKeyboard(buttons, 1);
    await sendTelegramMessage(chatId, 
      `👥 *Seleccionar Cliente*\n\nElegí un cliente existente o agregá uno nuevo:`,
      { reply_markup: keyboard }
    );
  } catch (error) {
    console.error('Error mostrando menú clientes:', error);
    await sendTelegramMessage(chatId, 'Error cargando clientes. Intentá de nuevo.');
  }
}

async function mostrarMenuCategorias(chatId) {
  try {
    const categorias = await getDataFromSheet('Categorias');
    const buttons = categorias.map(c => c.categoria_nombre);
    buttons.push('🔙 Cambiar Cliente');
    
    const keyboard = createReplyKeyboard(buttons, 2);
    await sendTelegramMessage(chatId, 
      `📂 *Seleccionar Categoría*\n\nElegí una categoría de productos:`,
      { reply_markup: keyboard }
    );
  } catch (error) {
    console.error('Error mostrando menú categorías:', error);
    await sendTelegramMessage(chatId, 'Error cargando categorías. Intentá de nuevo.');
  }
}

async function mostrarMenuProductos(chatId, categoriaId) {
  try {
    const productos = await getDataFromSheet('Productos');
    const productosCategoria = productos.filter(p => 
      p.categoria_id === categoriaId && p.activo === 'SI'
    );
    
    const buttons = productosCategoria.slice(0, 10).map(p => 
      `${p.producto_nombre} - $${p.precio.toLocaleString('es-ES')}`
    );
    buttons.push('🔙 Cambiar Categoría');
    
    const keyboard = createReplyKeyboard(buttons, 1);
    await sendTelegramMessage(chatId, 
      `📦 *Seleccionar Producto*\n\nElegí un producto:`,
      { reply_markup: keyboard }
    );
  } catch (error) {
    console.error('Error mostrando menú productos:', error);
    await sendTelegramMessage(chatId, 'Error cargando productos. Intentá de nuevo.');
  }
}

// Manejar callback queries (botones inline)
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const userName = callbackQuery.from.first_name || 'Usuario';
  
  console.log(`🔘 Callback de ${userName} (${chatId}): ${data}`);
  
  // Responder al callback para quitar el "loading"
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (TELEGRAM_BOT_TOKEN) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: '✅'
        })
      });
    } catch (error) {
      console.error('Error respondiendo callback:', error);
    }
  }
  
  // Procesar como mensaje normal
  await handleBotMessage(chatId, data, userName);
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

app.put('/api/pedidos/:id', async (req, res) => {
  try {
    const pedidoId = req.params.id;
    const updates = req.body;
    
    console.log('📝 Actualizando pedido:', pedidoId, updates);
    
    // Actualizar en Google Sheets o memoria
    await updateInSheet('Pedidos', pedidoId, updates);
    
    res.json({
      success: true,
      message: 'Pedido actualizado correctamente',
      pedido_id: pedidoId,
      updates: updates
    });
  } catch (error) {
    console.error('❌ Error actualizando pedido:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error actualizando pedido',
      details: error.message 
    });
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
    } else if (update.callback_query) {
      // Manejar botones inline
      await handleCallbackQuery(update.callback_query);
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
  const RAILWAY_STATIC_URL = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'https://distribuidora-rg-production.up.railway.app';
  
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN no configurado');
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
        allowed_updates: ["message", "callback_query"]
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

// Endpoint para configurar webhook manualmente
app.post('/api/setup-webhook', async (req, res) => {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const { webhookUrl } = req.body;
  
  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(400).json({ 
      error: 'TELEGRAM_BOT_TOKEN no configurado',
      success: false 
    });
  }

  // Usar URL del request si no se proporciona una específica
  const baseUrl = webhookUrl || `${req.protocol}://${req.get('host')}`;
  const fullWebhookUrl = `${baseUrl}/webhook`;

  try {
    console.log('🔧 Configurando webhook manualmente:', fullWebhookUrl);
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: fullWebhookUrl,
        allowed_updates: ["message"]
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Webhook configurado exitosamente');
      
      // Verificar configuración
      const infoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      const info = await infoResponse.json();
      
      res.json({
        success: true,
        message: 'Webhook configurado exitosamente',
        webhook_url: fullWebhookUrl,
        webhook_info: info.result
      });
    } else {
      console.error('❌ Error configurando webhook:', result);
      res.status(400).json({
        success: false,
        error: result.description,
        telegram_response: result
      });
    }
  } catch (error) {
    console.error('❌ Error en setupWebhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para obtener info del webhook
app.get('/api/webhook-info', async (req, res) => {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(400).json({ 
      error: 'TELEGRAM_BOT_TOKEN no configurado' 
    });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const result = await response.json();
    
    res.json({
      success: true,
      webhook_info: result.result,
      is_configured: !!result.result.url,
      webhook_url: result.result.url
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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
  console.log(`🔧 Setup Webhook: /api/setup-webhook`);
  console.log(`📋 Webhook Info: /api/webhook-info`);
  console.log('🚀 ========================================');
  
  // Intentar configurar webhook después de 15 segundos
  setTimeout(setupWebhook, 15000);
});