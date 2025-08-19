import { useState, useCallback } from 'react';

export interface OrderFlowState {
  step: string;
  pedidoId: string | null;
  clienteSeleccionado: any | null;
  categoriaSeleccionada: any | null;
  productoSeleccionado: any | null;
  carrito: any[];
  total: number;
}

export interface UseOrderFlowReturn {
  orderState: OrderFlowState;
  messages: Array<{ text: string; isUser: boolean; timestamp: Date }>;
  handleUserMessage: (message: string) => void;
  resetFlow: () => void;
}

export const useOrderFlow = (): UseOrderFlowReturn => {
  const [orderState, setOrderState] = useState<OrderFlowState>({
    step: 'inicio',
    pedidoId: null,
    clienteSeleccionado: null,
    categoriaSeleccionada: null,
    productoSeleccionado: null,
    carrito: [],
    total: 0
  });

  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean; timestamp: Date }>>([
    {
      text: '¡Hola! 👋 Soy tu asistente para pedidos. Escribe "crear pedido" para comenzar.',
      isUser: false,
      timestamp: new Date()
    }
  ]);

  const addMessage = useCallback((text: string, isUser: boolean) => {
    setMessages(prev => [...prev, { text, isUser, timestamp: new Date() }]);
  }, []);

  const handleUserMessage = useCallback((message: string) => {
    addMessage(message, true);
    
    // Simular respuesta del bot
    setTimeout(() => {
      let response = '';
      
      switch (orderState.step) {
        case 'inicio':
          if (message.toLowerCase().includes('crear pedido')) {
            response = '👥 Perfecto! Primero necesito que selecciones un cliente. ¿Cuál es el nombre del cliente?';
            setOrderState(prev => ({ ...prev, step: 'seleccion_cliente' }));
          } else {
            response = 'Para comenzar, escribe "crear pedido" 😊';
          }
          break;
          
        case 'seleccion_cliente':
          response = `✅ Cliente "${message}" seleccionado. Ahora elige una categoría de productos:
          
1. Galletitas
2. Bebidas  
3. Lácteos
4. Panadería
5. Conservas`;
          setOrderState(prev => ({ 
            ...prev, 
            step: 'seleccion_categoria',
            clienteSeleccionado: { nombre: message }
          }));
          break;
          
        case 'seleccion_categoria':
          response = `📦 Categoría "${message}" seleccionada. Aquí tienes algunos productos disponibles:

• Producto ejemplo 1 - $350
• Producto ejemplo 2 - $280
• Producto ejemplo 3 - $420

¿Cuál te interesa?`;
          setOrderState(prev => ({ 
            ...prev, 
            step: 'seleccion_producto',
            categoriaSeleccionada: { nombre: message }
          }));
          break;
          
        case 'seleccion_producto':
          response = `🛒 Producto "${message}" seleccionado. ¿Qué cantidad necesitas?`;
          setOrderState(prev => ({ 
            ...prev, 
            step: 'cantidad',
            productoSeleccionado: { nombre: message, precio: 350 }
          }));
          break;
          
        case 'cantidad':
          const cantidad = parseFloat(message) || 1;
          const precio = orderState.productoSeleccionado?.precio || 350;
          const importe = cantidad * precio;
          
          response = `✅ Agregado: ${cantidad} × ${orderState.productoSeleccionado?.nombre} = $${importe.toLocaleString()}

¿Quieres agregar más productos? (sí/no)`;
          
          setOrderState(prev => ({ 
            ...prev, 
            step: 'continuar',
            carrito: [...prev.carrito, {
              producto: prev.productoSeleccionado?.nombre,
              cantidad,
              precio,
              importe
            }],
            total: prev.total + importe
          }));
          break;
          
        case 'continuar':
          if (message.toLowerCase().includes('no')) {
            response = `📋 ¡Pedido completado!

Cliente: ${orderState.clienteSeleccionado?.nombre}
Total: $${orderState.total.toLocaleString()}

Tu pedido ha sido enviado y está pendiente de confirmación. ¡Gracias! 🎉

Para crear otro pedido, escribe "crear pedido".`;
            
            setOrderState({
              step: 'inicio',
              pedidoId: null,
              clienteSeleccionado: null,
              categoriaSeleccionada: null,
              productoSeleccionado: null,
              carrito: [],
              total: 0
            });
          } else {
            response = 'Elige otra categoría de productos:

1. Galletitas
2. Bebidas  
3. Lácteos
4. Panadería
5. Conservas';
            setOrderState(prev => ({ ...prev, step: 'seleccion_categoria' }));
          }
          break;
          
        default:
          response = 'No entendí. Escribe "crear pedido" para comenzar.';
      }
      
      addMessage(response, false);
    }, 1000);
  }, [orderState, addMessage]);

  const resetFlow = useCallback(() => {
    setOrderState({
      step: 'inicio',
      pedidoId: null,
      clienteSeleccionado: null,
      categoriaSeleccionada: null,
      productoSeleccionado: null,
      carrito: [],
      total: 0
    });
    setMessages([{
      text: '¡Hola! 👋 Soy tu asistente para pedidos. Escribe "crear pedido" para comenzar.',
      isUser: false,
      timestamp: new Date()
    }]);
  }, []);

  return {
    orderState,
    messages,
    handleUserMessage,
    resetFlow
  };
};