import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { useOrderFlow } from '../hooks/useOrderFlow';
import BotMessage from './BotMessage';
import UserMessage from './UserMessage';

const TelegramBot: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, currentStep, handleUserInput, resetFlow } = useOrderFlow();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      handleUserInput(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleButtonClick = (text: string) => {
    handleUserInput(text);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header del Chat */}
        <div className="bg-blue-600 text-white p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold">Bot Distribuidora</h2>
              <p className="text-blue-100 text-sm">En línea</p>
            </div>
          </div>
        </div>

        {/* Área de Mensajes */}
        <div className="h-96 overflow-y-auto p-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>¡Hola! Soy tu asistente para pedidos.</p>
              <p className="text-sm">Escribe /start para comenzar</p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div key={index} className="mb-4">
              {message.type === 'bot' ? (
                <BotMessage 
                  message={message} 
                  onButtonClick={handleButtonClick}
                />
              ) : (
                <UserMessage message={message} />
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input de Mensaje */}
        <div className="p-4 border-t bg-white">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSendMessage}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          
          {/* Botones de Acceso Rápido */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => handleUserInput('/start')}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
            >
              /start
            </button>
            <button
              onClick={() => handleUserInput('/ayuda')}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
            >
              /ayuda
            </button>
            <button
              onClick={resetFlow}
              className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm hover:bg-red-200 transition-colors"
            >
              Reiniciar
            </button>
          </div>
        </div>
      </div>

      {/* Estado Actual */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Estado del Pedido</h3>
        <p className="text-blue-700 text-sm">
          Paso actual: <span className="font-medium">{currentStep}</span>
        </p>
      </div>
    </div>
  );
};

export default TelegramBot;