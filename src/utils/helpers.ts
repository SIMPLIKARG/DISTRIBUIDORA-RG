// Utilidades para el manejo de datos y texto

export const generateId = (): string => {
  return 'ID' + Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover tildes
    .trim();
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const validateQuantity = (input: string): number | null => {
  const quantity = parseFloat(input.replace(',', '.'));
  return isNaN(quantity) || quantity <= 0 ? null : quantity;
};

export const searchInArray = <T>(
  array: T[], 
  searchTerm: string, 
  searchFields: (keyof T)[]
): T[] => {
  const normalizedSearch = normalizeText(searchTerm);
  
  return array.filter(item => 
    searchFields.some(field => {
      const fieldValue = item[field];
      if (typeof fieldValue === 'string') {
        return normalizeText(fieldValue).includes(normalizedSearch);
      }
      return false;
    })
  );
};