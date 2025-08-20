import { Product, Client, Order } from '../types';

export const products: Product[] = [
  {
    id: '1',
    name: 'Pan Integral',
    category: 'Panadería',
    price: 850,
    unit: 'unidad',
    description: 'Pan integral artesanal',
    image: 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '2',
    name: 'Leche Entera',
    category: 'Lácteos',
    price: 1200,
    unit: 'litro',
    description: 'Leche entera pasteurizada',
    image: 'https://images.pexels.com/photos/416978/pexels-photo-416978.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '3',
    name: 'Queso Cremoso',
    category: 'Lácteos',
    price: 2800,
    unit: 'kg',
    description: 'Queso cremoso de primera calidad',
    image: 'https://images.pexels.com/photos/773253/pexels-photo-773253.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '4',
    name: 'Yogur Natural',
    category: 'Lácteos',
    price: 650,
    unit: '500ml',
    description: 'Yogur natural sin azúcar',
    image: 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '5',
    name: 'Huevos',
    category: 'Frescos',
    price: 1800,
    unit: 'docena',
    description: 'Huevos frescos de granja',
    image: 'https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '6',
    name: 'Pollo Entero',
    category: 'Carnes',
    price: 3200,
    unit: 'kg',
    description: 'Pollo entero fresco',
    image: 'https://images.pexels.com/photos/616354/pexels-photo-616354.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '7',
    name: 'Carne Molida',
    category: 'Carnes',
    price: 4500,
    unit: 'kg',
    description: 'Carne molida especial',
    image: 'https://images.pexels.com/photos/361184/asparagus-steak-veal-steak-veal-361184.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '8',
    name: 'Tomates',
    category: 'Verduras',
    price: 900,
    unit: 'kg',
    description: 'Tomates frescos',
    image: 'https://images.pexels.com/photos/533280/pexels-photo-533280.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '9',
    name: 'Papas',
    category: 'Verduras',
    price: 600,
    unit: 'kg',
    description: 'Papas para consumo',
    image: 'https://images.pexels.com/photos/144248/potatoes-vegetables-erdfrucht-bio-144248.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '10',
    name: 'Cebollas',
    category: 'Verduras',
    price: 500,
    unit: 'kg',
    description: 'Cebollas frescas',
    image: 'https://images.pexels.com/photos/533342/pexels-photo-533342.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '11',
    name: 'Arroz',
    category: 'Almacén',
    price: 1400,
    unit: 'kg',
    description: 'Arroz largo fino',
    image: 'https://images.pexels.com/photos/723198/pexels-photo-723198.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '12',
    name: 'Fideos',
    category: 'Almacén',
    price: 800,
    unit: '500g',
    description: 'Fideos secos',
    image: 'https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '13',
    name: 'Aceite',
    category: 'Almacén',
    price: 2200,
    unit: 'litro',
    description: 'Aceite de girasol',
    image: 'https://images.pexels.com/photos/33783/olive-oil-salad-dressing-cooking-olive.jpg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '14',
    name: 'Azúcar',
    category: 'Almacén',
    price: 1100,
    unit: 'kg',
    description: 'Azúcar común',
    image: 'https://images.pexels.com/photos/65882/spoon-white-sugar-sweet-65882.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '15',
    name: 'Sal',
    category: 'Almacén',
    price: 300,
    unit: 'kg',
    description: 'Sal fina',
    image: 'https://images.pexels.com/photos/1340116/pexels-photo-1340116.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '16',
    name: 'Manzanas',
    category: 'Frutas',
    price: 1200,
    unit: 'kg',
    description: 'Manzanas rojas',
    image: 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '17',
    name: 'Bananas',
    category: 'Frutas',
    price: 800,
    unit: 'kg',
    description: 'Bananas maduras',
    image: 'https://images.pexels.com/photos/61127/pexels-photo-61127.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '18',
    name: 'Naranjas',
    category: 'Frutas',
    price: 700,
    unit: 'kg',
    description: 'Naranjas para jugo',
    image: 'https://images.pexels.com/photos/161559/background-bitter-breakfast-bright-161559.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '19',
    name: 'Manteca',
    category: 'Lácteos',
    price: 1800,
    unit: '200g',
    description: 'Manteca sin sal',
    image: 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg?auto=compress&cs=tinysrgb&w=400'
  },
  {
    id: '20',
    name: 'Mermelada',
    category: 'Almacén',
    price: 1500,
    unit: '450g',
    description: 'Mermelada de frutilla',
    image: 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg?auto=compress&cs=tinysrgb&w=400'
  }
];

export const clients: Client[] = [
  {
    id: '1',
    name: 'María González',
    category: 1,
    phone: '+54 9 11 1234-5678',
    address: 'Av. Corrientes 1234',
    zone: 'Centro',
    lastOrderDate: '2024-01-15',
    preferredProducts: ['1', '2', '3', '8', '16'],
    orderHistory: []
  },
  {
    id: '2',
    name: 'Carlos Rodríguez',
    category: 2,
    phone: '+54 9 11 2345-6789',
    address: 'San Martín 567',
    zone: 'Centro',
    lastOrderDate: '2024-01-14',
    preferredProducts: ['6', '7', '11', '13', '5'],
    orderHistory: []
  },
  {
    id: '3',
    name: 'Ana López',
    category: 3,
    phone: '+54 9 11 3456-7890',
    address: 'Belgrano 890',
    zone: 'Norte',
    lastOrderDate: '2024-01-13',
    preferredProducts: ['2', '4', '9', '10', '17'],
    orderHistory: []
  },
  {
    id: '4',
    name: 'Roberto Silva',
    category: 2,
    phone: '+54 9 11 4567-8901',
    address: 'Rivadavia 2345',
    zone: 'Oeste',
    lastOrderDate: '2024-01-12',
    preferredProducts: ['1', '12', '14', '15', '18'],
    orderHistory: []
  },
  {
    id: '5',
    name: 'Laura Martínez',
    category: 4,
    phone: '+54 9 11 5678-9012',
    address: 'Mitre 678',
    zone: 'Sur',
    lastOrderDate: '2024-01-11',
    preferredProducts: ['3', '19', '20', '16', '8'],
    orderHistory: []
  }
];

export const sampleOrders: Order[] = [
  {
    id: '1',
    clientId: '1',
    clientName: 'María González',
    clientCategory: 1,
    products: [
      { productId: '1', productName: 'Pan Integral', quantity: 2, price: 850, total: 1700 },
      { productId: '2', productName: 'Leche Entera', quantity: 1, price: 1200, total: 1200 }
    ],
    total: 2900,
    date: '2024-01-16',
    deliveryDate: '2024-01-18',
    status: 'confirmed',
    zone: 'Centro'
  }
];