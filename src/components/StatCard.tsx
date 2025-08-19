import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: 'green' | 'blue' | 'orange' | 'purple';
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, trend }) => {
  const colorClasses = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p className="text-sm text-green-600 mt-1">{trend}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;