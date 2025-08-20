// Utilidades para cálculo de precios por categoría de cliente

export const CATEGORY_MULTIPLIERS = {
  1: 1.0,    // Categoría 1 - Precio base (100%)
  2: 1.1,    // Categoría 2 - 10% más caro
  3: 1.2,    // Categoría 3 - 20% más caro
  4: 1.3,    // Categoría 4 - 30% más caro
  5: 1.4     // Categoría 5 - 40% más caro
};

export const CATEGORY_NAMES = {
  1: 'Mayorista A',
  2: 'Mayorista B', 
  3: 'Minorista A',
  4: 'Minorista B',
  5: 'Público General'
};

export const CATEGORY_COLORS = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-yellow-100 text-yellow-800',
  4: 'bg-orange-100 text-orange-800',
  5: 'bg-red-100 text-red-800'
};

export const calculatePriceForCategory = (basePrice: number, category: number): number => {
  const multiplier = CATEGORY_MULTIPLIERS[category as keyof typeof CATEGORY_MULTIPLIERS] || 1.0;
  return Math.round(basePrice * multiplier);
};

export const getCategoryName = (category: number): string => {
  return CATEGORY_NAMES[category as keyof typeof CATEGORY_NAMES] || 'Sin categoría';
};

export const getCategoryColor = (category: number): string => {
  return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100 text-gray-800';
};