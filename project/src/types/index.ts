export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  description: string;
  image: string;
}

export interface Client {
  id: string;
  name: string;
  category: number;
  phone: string;
  address: string;
  zone: string;
  lastOrderDate?: string;
  preferredProducts: string[];
  orderHistory: Order[];
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  clientCategory: number;
  products: OrderItem[];
  total: number;
  date: string;
  deliveryDate: string;
  status: 'pending' | 'confirmed' | 'delivered';
  zone: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'client';
  message: string;
  timestamp: string;
  type: 'text' | 'product_suggestion' | 'order_summary';
  products?: OrderItem[];
}

export interface DeliveryRoute {
  id: string;
  zone: string;
  day: string;
  clients: string[];
  status: 'planned' | 'in_progress' | 'completed';
}