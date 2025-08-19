import React from 'react';
import { User } from 'lucide-react';
import { Message } from '../types';

interface UserMessageProps {
  message: Message;
}

const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  return (
    <div className="flex items-start space-x-3 justify-end">
      <div className="flex-1 flex justify-end">
        <div className="bg-blue-600 text-white rounded-lg p-3 shadow-sm max-w-md">
          <p className="whitespace-pre-line">{message.text}</p>
        </div>
      </div>
      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-white" />
      </div>
    </div>
  );
};

export default UserMessage;