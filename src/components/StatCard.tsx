import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: 'green' | 'blue' | 'purple' | 'orange';
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, trend }) => {
  const colorClasses = {
    green: 'bg-green-500 text-green-600 bg-green-50',
    blue: 'bg-blue-500 text-blue-600 bg-blue-50',
    purple: 'bg-purple-500 text-purple-600 bg-purple-50',
    orange: 'bg-orange-500 text-orange-600 bg-orange-50'
  };

  const [bgColor, textColor, bgLight] = colorClasses[color].split(' ');

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p className={`text-sm mt-1 ${textColor}`}>
              {trend} vs mes anterior
            </p>
          )}
        </div>
        <div className={`w-12 h-12 ${bgLight} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${textColor}`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;