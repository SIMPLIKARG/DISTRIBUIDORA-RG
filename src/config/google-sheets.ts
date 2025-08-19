import { GoogleAuth } from 'google-auth-library';
import { sheets_v4, google } from 'googleapis';

// Configuración de autenticación con Google Sheets
const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ],
});

export const sheets = google.sheets({ version: 'v4', auth });
export const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;

// Nombres de las pestañas en Google Sheets
export const SHEET_NAMES = {
  CLIENTES: 'Clientes',
  CATEGORIAS: 'Categorias',
  PRODUCTOS: 'Productos',
  PEDIDOS: 'Pedidos',
  DETALLE_PEDIDOS: 'DetallePedidos'
} as const;

// Rangos para cada pestaña
export const SHEET_RANGES = {
  CLIENTES: `${SHEET_NAMES.CLIENTES}!A:B`,
  CATEGORIAS: `${SHEET_NAMES.CATEGORIAS}!A:B`,
  PRODUCTOS: `${SHEET_NAMES.PRODUCTOS}!A:E`,
  PEDIDOS: `${SHEET_NAMES.PEDIDOS}!A:G`,
  DETALLE_PEDIDOS: `${SHEET_NAMES.DETALLE_PEDIDOS}!A:H`
} as const;