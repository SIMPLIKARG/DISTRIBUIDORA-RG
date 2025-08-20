import React, { useState, useRef, useEffect } from 'react';
import { Send, Phone, User, Bot, ShoppingCart, Plus, Minus } from 'lucide-react';
import { ChatMessage, Client, Product, OrderItem } from '../types';
import { clients, products } from '../data/mockData';
import { calculatePriceForCategory, getCategoryName, getCategoryColor } from '../utils/pricing';

const ChatBot: React.FC = () => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startConversation = (client: Client) => {
    setSelectedClient(client);
    setMessages([]);
    setCurrentOrder([]);
    
    // Mensaje inicial del bot
    setTimeout(() => {
      const initialMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'bot',
        message: `¡Hola ${client.name}! 👋 Soy el asistente de pedidos de la distribuidora. Mañana estaremos pasando por tu zona (${client.zone}) para hacer la entrega.\n\nTu categoría es: ${getCategoryName(client.category)}\n\n¿Necesitas mercadería esta semana?`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'text'
      };
      setMessages([initialMessage]);
      
      // Sugerir productos habituales
      setTimeout(() => {
        suggestPreferredProducts(client);
      }, 2000);
    }, 500);
  };

  const suggestPreferredProducts = (client: Client) => {
    const preferredProducts = products.filter(p => client.preferredProducts.includes(p.id));
    
    if (preferredProducts.length > 0) {
      setIsTyping(true);
      setTimeout(() => {
        const suggestionMessage: ChatMessage = {
          id: Date.now().toString(),
          sender: 'bot',
          message: `Veo que habitualmente pedís estos productos. ¿Te interesa alguno para esta semana?`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'product_suggestion',
          products: preferredProducts.map(p => ({
            productId: p.id,
            productName: p.name,
            quantity: 1,
            price: p.price,
            total: p.price
          }))
        };
        setMessages(prev => [...prev, suggestionMessage]);
        setIsTyping(false);
      }, 1500);
    }
  };

  const addToOrder = (product: Product, quantity: number = 1) => {
    if (!selectedClient) return;
    
    const clientPrice = calculatePriceForCategory(product.price, selectedClient.category);
    
    setCurrentOrder(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity, total: (item.quantity + quantity) * clientPrice }
            : item
        );
      } else {
        return [...prev, {
          productId: product.id,
          productName: product.name,
          quantity,
          price: clientPrice,
          total: clientPrice * quantity
        }];
      }
    });

    // Respuesta del bot
    const botResponse: ChatMessage = {
      id: Date.now().toString(),
      sender: 'bot',
      message: `¡Perfecto! Agregué ${quantity} ${product.unit} de ${product.name} a tu pedido. ¿Algo más?`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'text'
    };
    setMessages(prev => [...prev, botResponse]);
  };

  const updateOrderQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCurrentOrder(prev => prev.filter(item => item.productId !== productId));
    } else {
      setCurrentOrder(prev =>
        prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
            : item
        )
      );
    }
  };

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'client',
      message: inputMessage,
      timestamp: new Date().toLocaleTimeString(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    // Simular respuesta del bot
    setIsTyping(true);
    setTimeout(() => {
      let botResponse = '';
      const lowerMessage = inputMessage.toLowerCase();

      if (lowerMessage.includes('si') || lowerMessage.includes('sí') || lowerMessage.includes('necesito')) {
        botResponse = '¡Excelente! Te muestro nuestros productos disponibles. Podés elegir los que necesites.';
      } else if (lowerMessage.includes('no') || lowerMessage.includes('nada')) {
        botResponse = 'Entendido. ¿Estás seguro? Recordá que tenemos productos frescos y buenos precios. ¿No necesitas nada de lo habitual?';
      } else if (lowerMessage.includes('precio')) {
        botResponse = 'Te paso la lista de precios actualizada. Todos nuestros productos son de primera calidad.';
      } else {
        botResponse = 'Entiendo. ¿Te puedo ayudar con algo específico? Tengo todos nuestros productos disponibles.';
      }

      const response: ChatMessage = {
        id: Date.now().toString(),
        sender: 'bot',
        message: botResponse,
        timestamp: new Date().toLocaleTimeString(),
        type: 'text'
      };

      setMessages(prev => [...prev, response]);
      setIsTyping(false);
    }, 1000);
  };

  const confirmOrder = () => {
    if (currentOrder.length === 0) return;

    const total = currentOrder.reduce((sum, item) => sum + item.total, 0);
    const orderSummary: ChatMessage = {
      id: Date.now().toString(),
      sender: 'bot',
      message: `¡Perfecto! Tu pedido está confirmado:\n\nTotal: $${total.toLocaleString()}\n\nLo tendremos listo para la entrega de mañana. ¡Gracias por tu pedido!`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'order_summary',
      products: currentOrder
    };

    setMessages(prev => [...prev, orderSummary]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Lista de Clientes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Clientes por Zona</h3>
        <div className="space-y-2">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => startConversation(client)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedClient?.id === client.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center">
                <User className="h-8 w-8 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">{client.name}</p>
                  <p className="text-sm text-gray-500">{client.zone}</p>
                  <p className="text-xs text-gray-400">{client.phone}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
        {selectedClient ? (
          <>
            {/* Header del Chat */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-green-500 mr-2" />
                <div>
                  <p className="font-medium text-gray-900">{selectedClient.name}</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm text-gray-500">WhatsApp - {selectedClient.zone}</p>
                    <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(selectedClient.category)}`}>
                      {getCategoryName(selectedClient.category)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'bot' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender === 'bot'
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    <div className="flex items-center mb-1">
                      {message.sender === 'bot' ? (
                        <Bot className="h-4 w-4 mr-1" />
                      ) : (
                        <User className="h-4 w-4 mr-1" />
                      )}
                      <span className="text-xs opacity-75">{message.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-line">{message.message}</p>
                    
                    {message.type === 'product_suggestion' && message.products && (
                      <div className="mt-3 space-y-2">
                        {message.products.map((item) => {
                          const product = products.find(p => p.id === item.productId);
                          return product ? (
                            <div key={item.productId} className="bg-white p-2 rounded border">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="h-8 w-8 rounded object-cover mr-2"
                                  />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                                    <p className="text-xs text-gray-500">
                                      ${selectedClient ? calculatePriceForCategory(product.price, selectedClient.category) : product.price}/{product.unit}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => addToOrder(product)}
                                  className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                                >
                                  Agregar
                                </button>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
                    <div className="flex items-center">
                      <Bot className="h-4 w-4 mr-1" />
                      <span className="text-sm text-gray-500">Escribiendo...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={sendMessage}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Phone className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Selecciona un cliente para iniciar la conversación</p>
            </div>
          </div>
        )}
      </div>

      {/* Pedido Actual */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Pedido Actual</h3>
          <ShoppingCart className="h-5 w-5 text-gray-400" />
        </div>

        {currentOrder.length > 0 ? (
          <>
            <div className="space-y-3 mb-4">
              {currentOrder.map((item) => (
                <div key={item.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{item.productName}</p>
                    <p className="text-xs text-gray-500">${item.price} c/u</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateOrderQuantity(item.productId, item.quantity - 1)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateOrderQuantity(item.productId, item.quantity + 1)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-medium text-gray-900 text-sm">${item.total}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t pt-3">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="font-bold text-lg text-gray-900">
                  ${currentOrder.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                </span>
              </div>
              <button
                onClick={confirmOrder}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Confirmar Pedido
              </button>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No hay productos en el pedido</p>
          </div>
        )}

        {/* Catálogo de Productos */}
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 mb-3">Catálogo de Productos</h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                <div className="flex items-center">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-8 w-8 rounded object-cover mr-2"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">
                      ${selectedClient ? calculatePriceForCategory(product.price, selectedClient.category) : product.price}/{product.unit}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => addToOrder(product)}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;