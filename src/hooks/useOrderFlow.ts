import { useState, useCallback } from 'react';
import { Message, Cliente, Categoria, Producto, Pedido, DetallePedido } from '../types';
import { useData } from './useData';
import { generateId, normalizeText } from '../utils/helpers';

type FlowStep = 'inicio' | 'seleccion_cliente' | 'seleccion_categoria' | 'seleccion_producto' | 'ingreso_cantidad' | 'carrito' | 'finalizado';

interface OrderState {
  pedidoId?: string;
  clienteSeleccionado?: Cliente;
  categoriaSeleccionada?: Categoria;
  productoSeleccionado?: Producto;
  carrito: DetallePedido[];
  total: number;
}

export const useOrderFlow = () => {
  const { clientes, categorias, productos, addPedido, addDetallePedido } = useData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState<FlowStep>('inicio');
  const [orderState, setOrderState] = useState<OrderState>({
    carrito: [],
    total: 0
  });

  const addMessage = useCallback((message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => [...prev, { ...message, timestamp: Date.now() }]);
  }, []);

  const addBotMessage = useCallback((text: string, buttons?: string[], options?: string[]) => {
    addMessage({ type: 'bot', text, buttons, options });
  }, [addMessage]);

  const addUserMessage = useCallback((text: string) => {
    addMessage({ type: 'user', text });
  }, [addMessage]);

  const resetFlow = useCallback(() => {
    setMessages([]);
    setCurrentStep('inicio');
    setOrderState({ carrito: [], total: 0 });
  }, []);

  const buscarClientes = useCallback((busqueda: string) => {
    const textoBusqueda = normalizeText(busqueda);
    return clientes.filter(cliente => 
      normalizeText(cliente.nombre).includes(textoBusqueda)
    );
  }, [clientes]);

  const buscarProductos = useCallback((busqueda: string, categoriaId: number) => {
    const textoBusqueda = normalizeText(busqueda);
    return productos.filter(producto => 
      producto.categoria_id === categoriaId &&
      producto.activo === 'SI' &&
      normalizeText(producto.producto_nombre).includes(textoBusqueda)
    );
  }, [productos]);

  const calcularTotal = useCallback((carrito: DetallePedido[]) => {
    return carrito.reduce((sum, item) => sum + item.importe, 0);
  }, []);

  const handleUserInput = useCallback((input: string) => {
    addUserMessage(input);

    switch (currentStep) {
      case 'inicio':
        if (input.toLowerCase() === '/start') {
          addBotMessage(
            '¡Hola! 👋 Soy tu asistente para pedidos.\n\n¿Listo para crear un nuevo pedido?',
            ['Iniciar pedido', 'Ver ayuda']
          );
          setCurrentStep('seleccion_cliente');
        } else if (input.toLowerCase() === '/ayuda') {
          addBotMessage(
            '🤖 *Comandos disponibles:*\n\n/start - Iniciar nuevo pedido\n/ayuda - Ver esta ayuda\n\n*¿Cómo funciona?*\n1. Selecciona un cliente\n2. Elige una categoría\n3. Agrega productos\n4. Confirma tu pedido',
            ['/start']
          );
        } else if (input === 'Iniciar pedido') {
          addBotMessage(
            '¿Para qué cliente es el pedido?\n\nPuedes escribir el nombre del cliente o elegir de la lista:',
            [],
            clientes.slice(0, 5).map(c => c.nombre)
          );
          setCurrentStep('seleccion_cliente');
        } else {
          addBotMessage(
            'No entendí ese comando. Escribe /start para comenzar o /ayuda para ver los comandos disponibles.',
            ['/start', '/ayuda']
          );
        }
        break;

      case 'seleccion_cliente':
        const clientesEncontrados = buscarClientes(input);
        
        if (clientesEncontrados.length === 1) {
          const cliente = clientesEncontrados[0];
          const pedidoId = generateId();
          
          setOrderState(prev => ({
            ...prev,
            pedidoId,
            clienteSeleccionado: cliente
          }));

          addBotMessage(
            `✅ Cliente seleccionado: *${cliente.nombre}*\n\nAhora elige una categoría de productos:`,
            [],
            categorias.map(c => c.categoria_nombre)
          );
          setCurrentStep('seleccion_categoria');
        } else if (clientesEncontrados.length > 1) {
          addBotMessage(
            `Encontré ${clientesEncontrados.length} clientes. ¿Cuál elegís?`,
            [],
            clientesEncontrados.slice(0, 8).map(c => c.nombre)
          );
        } else {
          addBotMessage(
            'No encontré coincidencias. Probá otro nombre o elegí de la lista:',
            [],
            clientes.slice(0, 8).map(c => c.nombre)
          );
        }
        break;

      case 'seleccion_categoria':
        const categoria = categorias.find(c => 
          normalizeText(c.categoria_nombre) === normalizeText(input)
        );

        if (categoria) {
          const productosCategoria = productos.filter(p => 
            p.categoria_id === categoria.categoria_id && p.activo === 'SI'
          );

          setOrderState(prev => ({
            ...prev,
            categoriaSeleccionada: categoria
          }));

          if (productosCategoria.length > 0) {
            addBotMessage(
              `📦 Categoría: *${categoria.categoria_nombre}*\n\n¿Qué producto querés agregar?`,
              [],
              productosCategoria.slice(0, 8).map(p => `${p.producto_nombre} - $${p.precio.toLocaleString('es-ES')}`)
            );
            setCurrentStep('seleccion_producto');
          } else {
            addBotMessage(
              'No hay productos disponibles en esta categoría. Elegí otra:',
              [],
              categorias.map(c => c.categoria_nombre)
            );
          }
        } else {
          addBotMessage(
            'Esa categoría no existe. Elegí una de la lista:',
            [],
            categorias.map(c => c.categoria_nombre)
          );
        }
        break;

      case 'seleccion_producto':
        if (!orderState.categoriaSeleccionada) return;

        // Buscar producto por nombre (ignorando el precio en la búsqueda)
        const nombreProducto = input.split(' - $')[0];
        const productosEncontrados = buscarProductos(nombreProducto, orderState.categoriaSeleccionada.categoria_id);

        if (productosEncontrados.length === 1) {
          const producto = productosEncontrados[0];
          
          setOrderState(prev => ({
            ...prev,
            productoSeleccionado: producto
          }));

          addBotMessage(
            `🛒 Producto: *${producto.producto_nombre}*\nPrecio: $${producto.precio.toLocaleString('es-ES')}\n\n¿Qué cantidad querés agregar?`
          );
          setCurrentStep('ingreso_cantidad');
        } else if (productosEncontrados.length > 1) {
          addBotMessage(
            'Encontré varios productos. ¿Cuál elegís?',
            [],
            productosEncontrados.map(p => `${p.producto_nombre} - $${p.precio.toLocaleString('es-ES')}`)
          );
        } else {
          const productosCategoria = productos.filter(p => 
            p.categoria_id === orderState.categoriaSeleccionada.categoria_id && p.activo === 'SI'
          );
          addBotMessage(
            'Ese producto no existe o está inactivo. Elegí uno de la lista:',
            [],
            productosCategoria.slice(0, 8).map(p => `${p.producto_nombre} - $${p.precio.toLocaleString('es-ES')}`)
          );
        }
        break;

      case 'ingreso_cantidad':
        const cantidad = parseFloat(input.replace(',', '.'));
        
        if (isNaN(cantidad) || cantidad <= 0) {
          addBotMessage('Ingresá un número mayor a 0.');
          return;
        }

        if (!orderState.productoSeleccionado || !orderState.clienteSeleccionado) return;

        const importe = cantidad * orderState.productoSeleccionado.precio;
        const nuevoDetalle: DetallePedido = {
          detalle_id: generateId(),
          pedido_id: orderState.pedidoId!,
          producto_id: orderState.productoSeleccionado.producto_id,
          producto_nombre: orderState.productoSeleccionado.producto_nombre,
          categoria_id: orderState.productoSeleccionado.categoria_id,
          cantidad,
          precio_unitario: orderState.productoSeleccionado.precio,
          importe
        };

        const nuevoCarrito = [...orderState.carrito, nuevoDetalle];
        const nuevoTotal = calcularTotal(nuevoCarrito);

        setOrderState(prev => ({
          ...prev,
          carrito: nuevoCarrito,
          total: nuevoTotal,
          productoSeleccionado: undefined,
          categoriaSeleccionada: undefined
        }));

        addDetallePedido(nuevoDetalle);

        addBotMessage(
          `✅ Agregado: ${cantidad} × ${orderState.productoSeleccionado.producto_nombre} = $${importe.toLocaleString('es-ES')}\n\n💰 Total parcial: $${nuevoTotal.toLocaleString('es-ES')}\n\n¿Qué querés hacer ahora?`,
          ['Agregar otro producto', 'Ver carrito', 'Finalizar pedido']
        );
        setCurrentStep('carrito');
        break;

      case 'carrito':
        if (input === 'Agregar otro producto') {
          addBotMessage(
            'Elegí una categoría de productos:',
            [],
            categorias.map(c => c.categoria_nombre)
          );
          setCurrentStep('seleccion_categoria');
        } else if (input === 'Ver carrito') {
          if (orderState.carrito.length === 0) {
            addBotMessage(
              'Tu carrito está vacío.',
              ['Agregar producto']
            );
          } else {
            const carritoTexto = orderState.carrito.map(item => 
              `• ${item.cantidad} × ${item.producto_nombre} = $${item.importe.toLocaleString('es-ES')}`
            ).join('\n');
            
            addBotMessage(
              `🛒 *Tu carrito:*\n\n${carritoTexto}\n\n💰 *Total: $${orderState.total.toLocaleString('es-ES')}*`,
              ['Agregar otro producto', 'Finalizar pedido']
            );
          }
        } else if (input === 'Finalizar pedido') {
          if (orderState.carrito.length === 0) {
            addBotMessage(
              'No podés finalizar un pedido vacío.',
              ['Agregar producto']
            );
            return;
          }

          if (!orderState.clienteSeleccionado || !orderState.pedidoId) return;

          const pedidoFinal: Pedido = {
            pedido_id: orderState.pedidoId,
            fecha_hora: new Date().toISOString(),
            cliente_id: orderState.clienteSeleccionado.cliente_id,
            cliente_nombre: orderState.clienteSeleccionado.nombre,
            items_cantidad: orderState.carrito.length,
            total: orderState.total,
            estado: 'CONFIRMADO'
          };

          addPedido(pedidoFinal);

          addBotMessage(
            `✅ *Pedido confirmado*\n\n👤 Cliente: ${orderState.clienteSeleccionado.nombre}\n📦 Ítems: ${orderState.carrito.length}\n💰 Total: $${orderState.total.toLocaleString('es-ES')}\n🆔 ID: ${orderState.pedidoId}\n\n¡Gracias por tu pedido!`,
            ['Crear nuevo pedido', 'Ver pedidos']
          );
          setCurrentStep('finalizado');
        }
        break;

      case 'finalizado':
        if (input === 'Crear nuevo pedido') {
          resetFlow();
          addBotMessage(
            '¿Para qué cliente es el nuevo pedido?',
            [],
            clientes.slice(0, 5).map(c => c.nombre)
          );
          setCurrentStep('seleccion_cliente');
        } else {
          addBotMessage(
            '¿Querés crear un nuevo pedido?',
            ['Crear nuevo pedido']
          );
        }
        break;
    }
  }, [currentStep, orderState, clientes, categorias, productos, buscarClientes, buscarProductos, calcularTotal, addBotMessage, addUserMessage, addPedido, addDetallePedido, resetFlow]);

  return {
    messages,
    currentStep,
    orderState,
    handleUserInput,
    resetFlow
  };
};