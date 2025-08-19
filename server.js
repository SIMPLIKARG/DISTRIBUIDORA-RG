import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Datos en memoria (simple)
let clientes = [
  { id: 1, nombre: 'Juan Pérez' },
  { id: 2, nombre: 'María González' },
  { id: 3, nombre: 'Carlos Rodríguez' }
];

let productos = [
  { id: 1, nombre: 'Oreo Original 117g', precio: 450 },
  { id: 2, nombre: 'Coca Cola 500ml', precio: 350 },
  { id: 3, nombre: 'Leche Entera 1L', precio: 280 }
];

let pedidos = [
  { id: 1, cliente: 'Juan Pérez', total: 800, fecha: '2024-01-15', estado: 'CONFIRMADO' },
  { id: 2, cliente: 'María González', total: 630, fecha: '2024-01-16', estado: 'PENDIENTE' }
];

// Rutas API
app.get('/api/clientes', (req, res) => {
  res.json(clientes);
});

app.get('/api/productos', (req, res) => {
  res.json(productos);
});

app.get('/api/pedidos', (req, res) => {
  res.json(pedidos);
});

app.get('/api/stats', (req, res) => {
  const stats = {
    totalClientes: clientes.length,
    totalProductos: productos.length,
    totalPedidos: pedidos.length,
    ventasTotal: pedidos.reduce((sum, p) => sum + p.total, 0)
  };
  res.json(stats);
});

// Actualizar pedido
app.put('/api/pedidos/:id', (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  
  const pedido = pedidos.find(p => p.id == id);
  if (pedido) {
    pedido.estado = estado;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Pedido no encontrado' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Página principal
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema Distribuidora</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-6">
        <h1 class="text-3xl font-bold text-center mb-8">Sistema Distribuidora</h1>
        
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">Clientes</h3>
                <p class="text-3xl font-bold text-blue-600" id="totalClientes">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">Productos</h3>
                <p class="text-3xl font-bold text-green-600" id="totalProductos">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">Pedidos</h3>
                <p class="text-3xl font-bold text-orange-600" id="totalPedidos">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">Ventas Total</h3>
                <p class="text-3xl font-bold text-purple-600" id="ventasTotal">-</p>
            </div>
        </div>

        <!-- Pedidos -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-2xl font-bold mb-4">Pedidos Recientes</h2>
            <div id="pedidos" class="space-y-4">
                <!-- Se cargan con JavaScript -->
            </div>
        </div>
    </div>

    <script>
        // Cargar datos
        async function loadData() {
            try {
                // Stats
                const statsRes = await fetch('/api/stats');
                const stats = await statsRes.json();
                
                document.getElementById('totalClientes').textContent = stats.totalClientes;
                document.getElementById('totalProductos').textContent = stats.totalProductos;
                document.getElementById('totalPedidos').textContent = stats.totalPedidos;
                document.getElementById('ventasTotal').textContent = '$' + stats.ventasTotal.toLocaleString();

                // Pedidos
                const pedidosRes = await fetch('/api/pedidos');
                const pedidos = await pedidosRes.json();
                
                const pedidosContainer = document.getElementById('pedidos');
                pedidosContainer.innerHTML = pedidos.map(pedido => \`
                    <div class="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                            <h3 class="font-semibold">#\${pedido.id} - \${pedido.cliente}</h3>
                            <p class="text-gray-600">\${pedido.fecha}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold">$\${pedido.total.toLocaleString()}</p>
                            <span class="px-2 py-1 rounded text-sm \${pedido.estado === 'CONFIRMADO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                                \${pedido.estado}
                            </span>
                        </div>
                    </div>
                \`).join('');
                
            } catch (error) {
                console.error('Error cargando datos:', error);
            }
        }

        // Cargar al inicio
        loadData();
        
        // Recargar cada 30 segundos
        setInterval(loadData, 30000);
    </script>
</body>
</html>
  `);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(\`🚀 Servidor corriendo en puerto \${PORT}\`);
  console.log(\`🌐 Dashboard: http://localhost:\${PORT}\`);
  console.log(\`📊 API: http://localhost:\${PORT}/api/stats\`);
});
  )
}
)