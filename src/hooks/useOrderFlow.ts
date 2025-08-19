import { useState, useCallback } from 'react';
import { Message } from '../types';

export interface OrderFlowState {
  step: string;
  pedidoId: string | null;
  clienteSeleccionado: any;
  categoriaSeleccionada: any;
  productoSeleccionado: any;
  carrito: any[];
  total: number;
}

export interface UseOrderFlowReturn {
  messages: Message[];
  currentStep: string;
  handleUserInput: (input: string) => void;
  resetFlow: () => void;
}

export const useOrderFlow = (): UseOrderFlowReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('inicio');
  const [orderState, setOrderState] = useState<OrderFlowState>({
    step: 'inicio',
    pedidoId: null,
    clienteSeleccionado: null,
    categoriaSeleccionada: null,
    productoSeleccionado: null,
    carrito: [],
    total: 0
  });

  const addBotMessage = useCallback((text: string, buttons?: string[], options?: string[]) => {
    const message: Message = {
      type: 'bot',
      text,
      timestamp: Date.now(),
      buttons,
      options
    };
    setMessages(prev => [...prev, message]);
  }, []);

  const addUserMessage = useCallback((text: string) => {
    const message: Message = {
      type: 'user',
      text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, message]);
  }, []);

  const handleUserInput = useCallback((input: string) => {
    addUserMessage(input);
    
    const normalizedInput = input.toLowerCase().trim();
    
    switch (currentStep) {
      case 'inicio':
        if (normalizedInput === '/start' || normalizedInput === 'start') {
          addBotMessage(
            '¡Hola! 👋\n\nSoy tu asistente para pedidos de la distribuidora.\n\n¿Qué querés hacer?',
            ['🛒 Crear Pedido', '📋 Ver Ayuda']
          );
          setCurrentStep('menu_principal');
        } else {
          addBotMessage(
            'Escribe /start para comenzar',
            ['/start']
          );
        }
        break;

      case 'menu_principal':
        if (normalizedInput.includes('crear pedido')) {
          addBotMessage(
            '👥 Seleccionar Cliente\n\nElegí un cliente existente:',
            [],
            ['Juan Pérez', 'María González', 'Carlos Rodríguez', '➕ Agregar Cliente Nuevo']
          );
          setCurrentStep('seleccion_cliente');
        } else if (normalizedInput.includes('ayuda')) {
          addBotMessage(
            `🤖 Comandos disponibles:\n\n🛒 Crear Pedido - Iniciar nuevo pedido\n📋 Ver Ayuda - Esta ayuda\n\n¿Cómo funciona?\n1️⃣ Selecciona un cliente\n2️⃣ Elige una categoría\n3️⃣ Agrega productos\n4️⃣ Confirma tu pedido`,
            ['🛒 Crear Pedido', '🔙 Volver']
          );
        } else {
          addBotMessage(
            'Elegí una opción del menú:',
            ['🛒 Crear Pedido', '📋 Ver Ayuda']
          );
        }
        break;

      case 'seleccion_cliente':
        if (normalizedInput.includes('agregar cliente')) {
          addBotMessage('👤 Escribe el nombre completo del nuevo cliente:');
          setCurrentStep('ingreso_nuevo_cliente');
        } else {
          // Simular selección de cliente
          setOrderState(prev => ({
            ...prev,
            clienteSeleccionado: { nombre: input, id: 1 }
          }));
          addBotMessage(
            `✅ Cliente seleccionado: ${input}\n\nAhora elige una categoría:`,
            [],
            ['Galletitas', 'Bebidas', 'Lácteos', 'Panadería', 'Conservas']
          );
          setCurrentStep('seleccion_categoria');
        }
        break;

      case 'ingreso_nuevo_cliente':
        if (input.trim().length >= 2) {
          setOrderState(prev => ({
            ...prev,
            clienteSeleccionado: { nombre: input.trim(), id: Date.now() }
          }));
          addBotMessage(
            `✅ Cliente creado: ${input.trim()}\n\nAhora elige una categoría:`,
            [],
            ['Galletitas', 'Bebidas', 'Lácteos', 'Panadería', 'Conservas']
          );
          setCurrentStep('seleccion_categoria');
        } else {
          addBotMessage('❌ El nombre debe tener al menos 2 caracteres. Intentá de nuevo:');
        }
        break;

      case 'seleccion_categoria':
        setOrderState(prev => ({
          ...prev,
          categoriaSeleccionada: { nombre: input, id: 1 }
        }));
        addBotMessage(
          `📦 ${input}\n\nElegí un producto:`,
          [],
          ['Oreo Original - $450', 'Pepitos Chocolate - $380', 'Coca Cola - $350', '🔙 Cambiar Categoría']
        );
        setCurrentStep('seleccion_producto');
        break;

      case 'seleccion_producto':
        if (normalizedInput.includes('cambiar categoría')) {
          addBotMessage(
            'Elegí una categoría:',
            [],
            ['Galletitas', 'Bebidas', 'Lácteos', 'Panadería', 'Conservas']
          );
          setCurrentStep('seleccion_categoria');
        } else {
          const [nombre, precio] = input.split(' - $');
          setOrderState(prev => ({
            ...prev,
            productoSeleccionado: { nombre, precio: parseInt(precio) || 0 }
          }));
          addBotMessage(
            `🛒 ${nombre}\n💰 Precio: $${precio}\n\n¿Qué cantidad querés agregar?`,
            ['1', '2', '3', '4', '5']
          );
          setCurrentStep('ingreso_cantidad');
        }
        break;

      case 'ingreso_cantidad':
        const cantidad = parseFloat(input);
        if (isNaN(cantidad) || cantidad <= 0) {
          addBotMessage(
            '❌ Por favor ingresá un número mayor a 0.',
            ['1', '2', '3', '4', '5']
          );
        } else {
          const precio = orderState.productoSeleccionado?.precio || 0;
          const importe = cantidad * precio;
          const nuevoTotal = orderState.total + importe;
          
          setOrderState(prev => ({
            ...prev,
            carrito: [...prev.carrito, {
              producto: prev.productoSeleccionado?.nombre,
              cantidad,
              precio,
              importe
            }],
            total: nuevoTotal
          }));

          addBotMessage(
            `✅ Agregado al carrito:\n${cantidad} × ${orderState.productoSeleccionado?.nombre} = $${importe.toLocaleString('es-ES')}\n\n💰 Total parcial: $${nuevoTotal.toLocaleString('es-ES')}\n\n¿Qué querés hacer?`,
            ['➕ Agregar Más', '👀 Ver Carrito', '✅ Finalizar Pedido']
          );
          setCurrentStep('carrito');
        }
        break;

      case 'carrito':
        if (normalizedInput.includes('agregar más')) {
          addBotMessage(
            'Elegí una categoría para agregar más productos:',
            [],
            ['Galletitas', 'Bebidas', 'Lácteos', 'Panadería', 'Conservas']
          );
          setCurrentStep('seleccion_categoria');
        } else if (normalizedInput.includes('ver carrito')) {
          if (orderState.carrito.length === 0) {
            addBotMessage('🛒 Tu carrito está vacío.', ['➕ Agregar Más']);
          } else {
            const carritoTexto = orderState.carrito.map((item: any, index: number) => 
              `${index + 1}. ${item.cantidad} × ${item.producto} = $${item.importe.toLocaleString('es-ES')}`
            ).join('\n');
            
            addBotMessage(
              `🛒 Tu carrito:\n\n${carritoTexto}\n\n💰 Total: $${orderState.total.toLocaleString('es-ES')}`,
              ['➕ Agregar Más', '✅ Finalizar Pedido']
            );
          }
        } else if (normalizedInput.includes('finalizar pedido')) {
          if (orderState.carrito.length === 0) {
            addBotMessage('❌ No podés finalizar un pedido vacío.', ['➕ Agregar Más']);
          } else {
            const carritoTexto = orderState.carrito.map((item: any, index: number) => 
              `${index + 1}. ${item.cantidad} × ${item.producto} = $${item.importe.toLocaleString('es-ES')}`
            ).join('\n');

            addBotMessage(
              `📋 ¡Pedido Enviado!\n\n👤 Cliente: ${orderState.clienteSeleccionado?.nombre}\n📦 Productos:\n${carritoTexto}\n\n💰 Total: $${orderState.total.toLocaleString('es-ES')}\n\n⏳ Tu pedido está PENDIENTE de confirmación.\n\n¡Gracias!`,
              ['🛒 Nuevo Pedido', '📋 Ver Ayuda']
            );
            
            // Resetear estado del pedido
            setOrderState({
              step: 'menu_principal',
              pedidoId: null,
              clienteSeleccionado: null,
              categoriaSeleccionada: null,
              productoSeleccionado: null,
              carrito: [],
              total: 0
            });
            setCurrentStep('menu_principal');
          }
        } else {
          addBotMessage(
            'Elegí una opción del menú:',
            ['➕ Agregar Más', '👀 Ver Carrito', '✅ Finalizar Pedido']
          );
        }
        break;

      default:
        addBotMessage(
          'Escribe /start para comenzar',
          ['/start']
        );
        setCurrentStep('inicio');
    }
  }, [currentStep, orderState, addBotMessage, addUserMessage]);

  const resetFlow = useCallback(() => {
    setMessages([]);
    setCurrentStep('inicio');
    setOrderState({
      step: 'inicio',
      pedidoId: null,
      clienteSeleccionado: null,
      categoriaSeleccionada: null,
      productoSeleccionado: null,
      carrito: [],
      total: 0
    });
    addBotMessage(
      '¡Hola! 👋\n\nSoy tu asistente para pedidos de la distribuidora.\n\nEscribe /start para comenzar',
      ['/start']
    );
  }, [addBotMessage]);

  return {
    messages,
    currentStep,
    handleUserInput,
    resetFlow
  };
};