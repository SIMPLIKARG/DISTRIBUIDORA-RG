import { useState, useCallback } from 'react';
import { Message } from '../types';

type OrderStep = 
  | 'inicio'
  | 'menu_principal'
  | 'seleccion_cliente'
  | 'ingreso_nuevo_cliente'
  | 'seleccion_categoria'
  | 'seleccion_producto'
  | 'ingreso_cantidad'
  | 'carrito';

interface OrderState {
  step: OrderStep;
  pedidoId: string | null;
  clienteSeleccionado: any | null;
  categoriaSeleccionada: any | null;
  productoSeleccionado: any | null;
  carrito: any[];
  total: number;
}

export const useOrderFlow = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [orderState, setOrderState] = useState<OrderState>({
    step: 'inicio',
    pedidoId: null,
    clienteSeleccionado: null,
    categoriaSeleccionada: null,
    productoSeleccionado: null,
    carrito: [],
    total: 0
  });

  const addMessage = useCallback((message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => [...prev, { ...message, timestamp: Date.now() }]);
  }, []);

  const handleUserInput = useCallback((input: string) => {
    // Agregar mensaje del usuario
    addMessage({
      type: 'user',
      text: input
    });

    // Procesar input según el paso actual
    const normalizedInput = input.toLowerCase().trim();

    switch (orderState.step) {
      case 'inicio':
        if (normalizedInput === '/start' || normalizedInput === 'start') {
          addMessage({
            type: 'bot',
            text: '¡Hola! 👋\n\nSoy tu asistente para pedidos de la distribuidora.\n\n¿Qué querés hacer?',
            buttons: ['🛒 Crear Pedido', '📋 Ver Ayuda']
          });
          setOrderState(prev => ({ ...prev, step: 'menu_principal' }));
        } else {
          addMessage({
            type: 'bot',
            text: 'No entendí ese comando. Escribe /start para comenzar.',
            buttons: ['/start']
          });
        }
        break;

      case 'menu_principal':
        if (normalizedInput === '🛒 crear pedido') {
          addMessage({
            type: 'bot',
            text: '👥 Seleccionar Cliente\n\nElegí un cliente existente:',
            options: ['Juan Pérez', 'María González', 'Carlos Rodríguez', '➕ Agregar Cliente Nuevo']
          });
          setOrderState(prev => ({ ...prev, step: 'seleccion_cliente' }));
        } else if (normalizedInput === '📋 ver ayuda') {
          addMessage({
            type: 'bot',
            text: '🤖 Comandos disponibles:\n\n🛒 Crear Pedido - Iniciar nuevo pedido\n📋 Ver Ayuda - Esta ayuda\n\n¿Cómo funciona?\n1️⃣ Selecciona un cliente\n2️⃣ Elige una categoría\n3️⃣ Agrega productos\n4️⃣ Confirma tu pedido',
            buttons: ['🛒 Crear Pedido', '🔙 Volver']
          });
        }
        break;

      case 'seleccion_cliente':
        if (normalizedInput === '➕ agregar cliente nuevo') {
          addMessage({
            type: 'bot',
            text: '👤 Agregar Cliente Nuevo\n\nEscribe el nombre completo del nuevo cliente:'
          });
          setOrderState(prev => ({ ...prev, step: 'ingreso_nuevo_cliente' }));
        } else {
          // Simular selección de cliente
          const cliente = { id: 1, nombre: input };
          setOrderState(prev => ({ 
            ...prev, 
            clienteSeleccionado: cliente,
            step: 'seleccion_categoria'
          }));
          addMessage({
            type: 'bot',
            text: `✅ Cliente seleccionado: ${input}\n\nAhora elige una categoría:`,
            options: ['Galletitas', 'Bebidas', 'Lácteos', 'Panadería', 'Conservas']
          });
        }
        break;

      case 'ingreso_nuevo_cliente':
        if (input.trim().length >= 2) {
          const nuevoCliente = { id: Date.now(), nombre: input.trim() };
          setOrderState(prev => ({ 
            ...prev, 
            clienteSeleccionado: nuevoCliente,
            step: 'seleccion_categoria'
          }));
          addMessage({
            type: 'bot',
            text: `✅ Cliente creado: ${input.trim()}\n\nAhora elige una categoría:`,
            options: ['Galletitas', 'Bebidas', 'Lácteos', 'Panadería', 'Conservas']
          });
        } else {
          addMessage({
            type: 'bot',
            text: '❌ El nombre debe tener al menos 2 caracteres. Intentá de nuevo:'
          });
        }
        break;

      case 'seleccion_categoria':
        const categoria = { id: 1, nombre: input };
        setOrderState(prev => ({ 
          ...prev, 
          categoriaSeleccionada: categoria,
          step: 'seleccion_producto'
        }));
        addMessage({
          type: 'bot',
          text: `📦 ${input}\n\nElegí un producto:`,
          options: ['Oreo Original 117g - $450', 'Pepitos Chocolate 100g - $380', 'Tita Vainilla 168g - $320']
        });
        break;

      case 'seleccion_producto':
        const producto = { 
          id: 1, 
          nombre: input.split(' - $')[0], 
          precio: parseInt(input.split('$')[1]) || 450 
        };
        setOrderState(prev => ({ 
          ...prev, 
          productoSeleccionado: producto,
          step: 'ingreso_cantidad'
        }));
        addMessage({
          type: 'bot',
          text: `🛒 ${producto.nombre}\n💰 Precio: $${producto.precio}\n\n¿Qué cantidad querés agregar?`,
          buttons: ['1', '2', '3', '4', '5']
        });
        break;

      case 'ingreso_cantidad':
        const cantidad = parseFloat(input);
        if (!isNaN(cantidad) && cantidad > 0 && orderState.productoSeleccionado) {
          const importe = cantidad * orderState.productoSeleccionado.precio;
          const nuevoItem = {
            producto: orderState.productoSeleccionado,
            cantidad,
            importe
          };
          
          const nuevoCarrito = [...orderState.carrito, nuevoItem];
          const nuevoTotal = nuevoCarrito.reduce((sum, item) => sum + item.importe, 0);
          
          setOrderState(prev => ({ 
            ...prev, 
            carrito: nuevoCarrito,
            total: nuevoTotal,
            step: 'carrito'
          }));
          
          addMessage({
            type: 'bot',
            text: `✅ Agregado al carrito:\n${cantidad} × ${orderState.productoSeleccionado.nombre} = $${importe}\n\n💰 Total parcial: $${nuevoTotal}\n\n¿Qué querés hacer?`,
            buttons: ['➕ Agregar Más', '👀 Ver Carrito', '✅ Finalizar Pedido']
          });
        } else {
          addMessage({
            type: 'bot',
            text: '❌ Por favor ingresá un número mayor a 0.',
            buttons: ['1', '2', '3', '4', '5']
          });
        }
        break;

      case 'carrito':
        if (normalizedInput === '➕ agregar más') {
          addMessage({
            type: 'bot',
            text: 'Elegí una categoría para agregar más productos:',
            options: ['Galletitas', 'Bebidas', 'Lácteos', 'Panadería', 'Conservas']
          });
          setOrderState(prev => ({ ...prev, step: 'seleccion_categoria' }));
        } else if (normalizedInput === '👀 ver carrito') {
          const carritoTexto = orderState.carrito.map((item, index) => 
            `${index + 1}. ${item.cantidad} × ${item.producto.nombre} = $${item.importe}`
          ).join('\n');
          
          addMessage({
            type: 'bot',
            text: `🛒 Tu carrito:\n\n${carritoTexto}\n\n💰 Total: $${orderState.total}`,
            buttons: ['➕ Agregar Más', '✅ Finalizar Pedido']
          });
        } else if (normalizedInput === '✅ finalizar pedido') {
          const carritoTexto = orderState.carrito.map((item, index) => 
            `${index + 1}. ${item.cantidad} × ${item.producto.nombre} = $${item.importe}`
          ).join('\n');
          
          addMessage({
            type: 'bot',
            text: `📋 ¡Pedido Enviado!\n\n👤 Cliente: ${orderState.clienteSeleccionado?.nombre}\n📦 Productos:\n${carritoTexto}\n\n💰 Total: $${orderState.total}\n\n⏳ Tu pedido está PENDIENTE de confirmación.\n\n¡Gracias!`,
            buttons: ['🛒 Nuevo Pedido']
          });
          
          // Resetear estado
          setOrderState({
            step: 'menu_principal',
            pedidoId: null,
            clienteSeleccionado: null,
            categoriaSeleccionada: null,
            productoSeleccionado: null,
            carrito: [],
            total: 0
          });
        }
        break;
    }
  }, [orderState, addMessage]);

  const resetFlow = useCallback(() => {
    setMessages([]);
    setOrderState({
      step: 'inicio',
      pedidoId: null,
      clienteSeleccionado: null,
      categoriaSeleccionada: null,
      productoSeleccionado: null,
      carrito: [],
      total: 0
    });
  }, []);

  return {
    messages,
    currentStep: orderState.step,
    handleUserInput,
    resetFlow
  };
};