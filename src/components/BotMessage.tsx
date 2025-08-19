import React from 'react';
import { Bot } from 'lucide-react';
import { Message } from '../types';

interface BotMessageProps {
  message: Message;
  onButtonClick: (text: string) => void;
}

const BotMessage: React.FC<BotMessageProps> = ({ message, onButtonClick }) => {
  return (
    <div className="flex items-start space-x-3">
      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1">
        <div className="bg-white rounded-lg p-3 shadow-sm border max-w-md">
          <p className="text-gray-800 whitespace-pre-line">{message.text}</p>
        </div>
        
        {/* Botones de Respuesta Rápida */}
        {message.buttons && message.buttons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.buttons.map((button, index) => (
              <button
                key={index}
                onClick={() => onButtonClick(button)}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
              >
                {button}
              </button>
            ))}
          </div>
        )}

        {/* Lista de Opciones */}
        {message.options && message.options.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.options.map((option, index) => (
              <button
                key={index}
                onClick={() => onButtonClick(option)}
                className="block w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors border"
              >
                {option}
              </button>
            ))}
          </div>
        )}
        
        <p className="text-xs text-gray-500 mt-1">
          {new Date(message.timestamp).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
};

export default BotMessage;