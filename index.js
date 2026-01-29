import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'

const app = express()
const PORT = process.env.PORT || 4000

// Permitir CORS amplio en desarrollo (incluye Authorization y métodos no simples como PUT)
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json());

// Manejo de errores para funciones async en rutas
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
  console.error('API error:', err);
  res.status(500).json({ error: err?.message || 'Error interno del servidor' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

// Persistencia con SQLite
const store = require('./db');

// Helpers
const getMesKey = (fecha) => {
  const d = new Date(fecha);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${y}-${m}`;
};

// Simple auth placeholder (usar email como id estable)
app.post('/auth/login', asyncHandler(async (req, res) => {
  const { email = 'demo@user' } = req.body || {};
  const id = email; // id estable para desarrollo
  await store.upsertUser(id, email);
  res.json({ token: id, user: { id, email } });
}));

// Middleware de auth
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  req.userId = token;
  next();
});

// Obtener datos del mes
app.get('/meses', asyncHandler(async (req, res) => {
  const { mes } = req.query; // YYYY-MM
  const key = mes || getMesKey(Date.now());
  await store.ensureMonth(req.userId, key);
  const month = await store.getMonth(req.userId, key);
  const ingresos = await store.listarIngresos(req.userId, key);
  const gastos = await store.listarGastos(req.userId, key);
  const deudas = await store.listarDeudas(req.userId, key);
  res.json({ mes: key, estado: month.estado, ingresos, gastos, deudas });
}));

// Cerrar mes
app.post('/meses/cerrar', asyncHandler(async (req, res) => {
  const { mes } = req.body;
  const key = mes || getMesKey(Date.now());
  await store.setMonthEstado(req.userId, key, 'cerrado');
  res.json({ mes: key, estado: 'cerrado' });
}));

// Ingresos
app.post('/ingresos', asyncHandler(async (req, res) => {
  const { mes, nombre, fuente, monto } = req.body;
  const key = mes || getMesKey(Date.now());
  await store.ensureMonth(req.userId, key);
  const item = { id: randomUUID(), nombre, fuente, monto: Number(monto) || 0 };
  const saved = await store.agregarIngreso(req.userId, key, item);
  res.status(201).json(saved);
}));

app.delete('/ingresos/:id', asyncHandler(async (req, res) => {
  const { mes } = req.query;
  const key = mes || getMesKey(Date.now());
  await store.ensureMonth(req.userId, key);
  await store.eliminarIngreso(req.userId, req.params.id);
  res.json({ ok: true });
}));

app.get('/ingresos', asyncHandler(async (req, res) => {
  const { mes } = req.query;
  const key = mes || getMesKey(Date.now());
  const lista = await store.listarIngresos(req.userId, key);
  res.json(lista);
}));

app.put('/ingresos/:id', asyncHandler(async (req, res) => {
  const updated = await store.actualizarIngreso(req.userId, req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Ingreso no encontrado' });
  res.json(updated);
}));

// Gastos
app.post('/gastos', asyncHandler(async (req, res) => {
  const { mes, nombre, categoria, monto } = req.body;
  const key = mes || getMesKey(Date.now());
  await store.ensureMonth(req.userId, key);
  const item = { id: randomUUID(), nombre, categoria, monto: Number(monto) || 0 };
  const saved = await store.agregarGasto(req.userId, key, item);
  res.status(201).json(saved);
}));

app.delete('/gastos/:id', asyncHandler(async (req, res) => {
  const { mes } = req.query;
  const key = mes || getMesKey(Date.now());
  await store.ensureMonth(req.userId, key);
  await store.eliminarGasto(req.userId, req.params.id);
  res.json({ ok: true });
}));

app.get('/gastos', asyncHandler(async (req, res) => {
  const { mes } = req.query;
  const key = mes || getMesKey(Date.now());
  const lista = await store.listarGastos(req.userId, key);
  res.json(lista);
}));

app.put('/gastos/:id', asyncHandler(async (req, res) => {
  const updated = await store.actualizarGasto(req.userId, req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Gasto no encontrado' });
  res.json(updated);
}));

// Deudas
app.post('/deudas', asyncHandler(async (req, res) => {
  const { mes, nombre, tipoDeuda, montoTotal, pagoMensual, cuotasPagadas, cuotasTotales, tasaInteres } = req.body;
  const key = mes || getMesKey(Date.now());
  await store.ensureMonth(req.userId, key);
  const item = {
    id: randomUUID(),
    nombre,
    tipoDeuda,
    montoTotal: Number(montoTotal) || 0,
    pagoMensual: Number(pagoMensual) || 0,
    cuotasPagadas: Number(cuotasPagadas) || 0,
    cuotasTotales: Number(cuotasTotales) || 0,
    tasaInteres: Number(tasaInteres) || 0,
  };
  const saved = await store.agregarDeuda(req.userId, key, item);
  res.status(201).json(saved);
}));

app.delete('/deudas/:id', asyncHandler(async (req, res) => {
  const { mes } = req.query;
  const key = mes || getMesKey(Date.now());
  await store.ensureMonth(req.userId, key);
  await store.eliminarDeuda(req.userId, req.params.id);
  res.json({ ok: true });
}));

app.post('/deudas/:id/pagar-cuota', asyncHandler(async (req, res) => {
  const { mes, monto } = req.body;
  const key = mes || getMesKey(Date.now());
  await store.ensureMonth(req.userId, key);
  const updated = await store.pagarCuota(req.userId, req.params.id, monto);
  if (!updated) return res.status(404).json({ error: 'Deuda no encontrada' });
  res.json({ ok: true, deuda: updated });
}));

app.get('/deudas', asyncHandler(async (req, res) => {
  const { mes } = req.query;
  const key = mes || getMesKey(Date.now());
  const lista = await store.listarDeudas(req.userId, key);
  res.json(lista);
}));

app.put('/deudas/:id', asyncHandler(async (req, res) => {
  const updated = await store.actualizarDeuda(req.userId, req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Deuda no encontrada' });
  res.json(updated);
}));

// Totales del mes
app.get('/meses/totales', asyncHandler(async (req, res) => {
  const { mes } = req.query;
  const key = mes || getMesKey(Date.now());
  const tot = await store.calcularTotales(req.userId, key);
  res.json({ mes: key, ...tot });
}));

// Abrir mes
app.post('/meses/abrir', asyncHandler(async (req, res) => {
  const { mes } = req.body;
  const key = mes || getMesKey(Date.now());
  await store.setMonthEstado(req.userId, key, 'abierto');
  res.json({ mes: key, estado: 'abierto' });
}));

// Listado de meses del usuario
app.get('/meses/list', asyncHandler(async (req, res) => {
  const mesesUsuario = await store.listMonths(req.userId);
  res.json({ meses: mesesUsuario });
}));

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});