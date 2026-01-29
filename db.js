import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY; // Preferir service_role en backend

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[store] SUPABASE_URL o SUPABASE_*_KEY no configurados. Configure server/.env');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '', {
  auth: { persistSession: false },
});

// Helpers generales
async function single(table, filters) {
  let q = supabase.from(table).select('*');
  Object.entries(filters || {}).forEach(([k, v]) => { q = q.eq(k, v); });
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

// Users
async function upsertUser(id, email) {
  const { error } = await supabase.from('users').upsert({ id, email });
  if (error) throw error;
}

// Months
async function ensureMonth(userId, key) {
  const { error } = await supabase.from('months').upsert({ key, userId, estado: 'abierto' }, { onConflict: 'key,userId' });
  if (error) throw error;
}

async function getMonth(userId, key) {
  await ensureMonth(userId, key);
  const row = await single('months', { key, userId });
  return row || { key, userId, estado: 'abierto' };
}

async function setMonthEstado(userId, key, estado) {
  await ensureMonth(userId, key);
  const { error } = await supabase.from('months').update({ estado }).eq('key', key).eq('userId', userId);
  if (error) throw error;
}

async function listMonths(userId) {
  const { data, error } = await supabase.from('months').select('key').eq('userId', userId).order('key');
  if (error) throw error;
  return (data || []).map(r => r.key);
}

// Ingresos
async function listarIngresos(userId, key) {
  await ensureMonth(userId, key);
  const { data, error } = await supabase.from('ingresos').select('*').eq('userId', userId).eq('mesKey', key);
  if (error) throw error;
  return data || [];
}

async function agregarIngreso(userId, key, item) {
  const rec = { id: item.id, userId, mesKey: key, nombre: item.nombre || '', fuente: item.fuente || '', monto: Number(item.monto) || 0 };
  const { data, error } = await supabase.from('ingresos').insert(rec).select('*').limit(1);
  if (error) throw error;
  return (data && data[0]) || rec;
}

async function actualizarIngreso(userId, id, fields) {
  const { data: current, error: errSel } = await supabase.from('ingresos').select('*').eq('id', id).eq('userId', userId).limit(1);
  if (errSel) throw errSel;
  if (!current || !current[0]) return null;
  const updated = {
    nombre: fields.nombre !== undefined ? fields.nombre : current[0].nombre,
    fuente: fields.fuente !== undefined ? fields.fuente : current[0].fuente,
    monto: fields.monto !== undefined ? Number(fields.monto) || 0 : current[0].monto,
  };
  const { error } = await supabase.from('ingresos').update(updated).eq('id', id).eq('userId', userId);
  if (error) throw error;
  const { data } = await supabase.from('ingresos').select('*').eq('id', id).limit(1);
  return (data && data[0]) || null;
}

async function eliminarIngreso(userId, id) {
  const { error } = await supabase.from('ingresos').delete().eq('id', id).eq('userId', userId);
  if (error) throw error;
}

// Gastos
async function listarGastos(userId, key) {
  await ensureMonth(userId, key);
  const { data, error } = await supabase.from('gastos').select('*').eq('userId', userId).eq('mesKey', key);
  if (error) throw error;
  return data || [];
}

async function agregarGasto(userId, key, item) {
  const rec = { id: item.id, userId, mesKey: key, nombre: item.nombre || '', categoria: item.categoria || '', monto: Number(item.monto) || 0 };
  const { data, error } = await supabase.from('gastos').insert(rec).select('*').limit(1);
  if (error) throw error;
  return (data && data[0]) || rec;
}

async function actualizarGasto(userId, id, fields) {
  const { data: current, error: errSel } = await supabase.from('gastos').select('*').eq('id', id).eq('userId', userId).limit(1);
  if (errSel) throw errSel;
  if (!current || !current[0]) return null;
  const updated = {
    nombre: fields.nombre !== undefined ? fields.nombre : current[0].nombre,
    categoria: fields.categoria !== undefined ? fields.categoria : current[0].categoria,
    monto: fields.monto !== undefined ? Number(fields.monto) || 0 : current[0].monto,
  };
  const { error } = await supabase.from('gastos').update(updated).eq('id', id).eq('userId', userId);
  if (error) throw error;
  const { data } = await supabase.from('gastos').select('*').eq('id', id).limit(1);
  return (data && data[0]) || null;
}

async function eliminarGasto(userId, id) {
  const { error } = await supabase.from('gastos').delete().eq('id', id).eq('userId', userId);
  if (error) throw error;
}

// Deudas
async function listarDeudas(userId, key) {
  await ensureMonth(userId, key);
  const { data, error } = await supabase.from('deudas').select('*').eq('userId', userId).eq('mesKey', key);
  if (error) throw error;
  return data || [];
}

async function agregarDeuda(userId, key, item) {
  const rec = { id: item.id, userId, mesKey: key, nombre: item.nombre || '', categoria: item.categoria || '', monto: Number(item.monto) || 0, cuotas: Number(item.cuotas) || 1, restante: Number(item.restante) || Number(item.monto) || 0 };
  const { data, error } = await supabase.from('deudas').insert(rec).select('*').limit(1);
  if (error) throw error;
  const d = (data && data[0]) || rec;
  const { error: errUp } = await supabase.from('deudas').update({ restante: d.monto }).eq('id', d.id).eq('userId', userId);
  if (errUp) throw errUp;
  return d;
}

async function actualizarDeuda(userId, id, fields) {
  const { data: current, error: errSel } = await supabase.from('deudas').select('*').eq('id', id).eq('userId', userId).limit(1);
  if (errSel) throw errSel;
  if (!current || !current[0]) return null;
  const updated = {
    nombre: fields.nombre !== undefined ? fields.nombre : current[0].nombre,
    categoria: fields.categoria !== undefined ? fields.categoria : current[0].categoria,
    monto: fields.monto !== undefined ? Number(fields.monto) || 0 : current[0].monto,
    cuotas: fields.cuotas !== undefined ? Number(fields.cuotas) || 1 : current[0].cuotas,
    restante: fields.restante !== undefined ? Number(fields.restante) || 0 : current[0].restante,
  };
  const { error } = await supabase.from('deudas').update(updated).eq('id', id).eq('userId', userId);
  if (error) throw error;
  const { data } = await supabase.from('deudas').select('*').eq('id', id).limit(1);
  return (data && data[0]) || null;
}

async function eliminarDeuda(userId, id) {
  const { error } = await supabase.from('deudas').delete().eq('id', id).eq('userId', userId);
  if (error) throw error;
}

async function pagarCuota(userId, id, monto) {
  const { data: current, error: errSel } = await supabase.from('deudas').select('*').eq('id', id).eq('userId', userId).limit(1);
  if (errSel) throw errSel;
  if (!current || !current[0]) return null;
  const restante = Math.max(0, Number(current[0].restante) - (Number(monto) || 0));
  const { error } = await supabase.from('deudas').update({ restante }).eq('id', id).eq('userId', userId);
  if (error) throw error;
  const { data } = await supabase.from('deudas').select('*').eq('id', id).limit(1);
  return (data && data[0]) || null;
}

async function calcularTotales(userId, key) {
  await ensureMonth(userId, key);
  const { data: ingresosRows, error: errIng } = await supabase.from('ingresos').select('monto').eq('userId', userId).eq('mesKey', key);
  if (errIng) throw errIng;
  const { data: gastosRows, error: errGas } = await supabase.from('gastos').select('monto').eq('userId', userId).eq('mesKey', key);
  if (errGas) throw errGas;
  const { data: deudasRows, error: errDeu } = await supabase.from('deudas').select('restante').eq('userId', userId).eq('mesKey', key);
  if (errDeu) throw errDeu;
  const totalIngresos = (ingresosRows || []).reduce((sum, r) => sum + Number(r.monto || 0), 0);
  const totalGastos = (gastosRows || []).reduce((sum, r) => sum + Number(r.monto || 0), 0);
  const totalDeudasRestante = (deudasRows || []).reduce((sum, r) => sum + Number(r.restante || 0), 0);
  return { totalIngresos, totalGastos, totalDeudasRestante };
}

export default {
  upsertUser,
  ensureMonth,
  getMonth,
  setMonthEstado,
  listMonths,
  listarIngresos,
  agregarIngreso,
  actualizarIngreso,
  eliminarIngreso,
  listarGastos,
  agregarGasto,
  actualizarGasto,
  eliminarGasto,
  listarDeudas,
  agregarDeuda,
  actualizarDeuda,
  eliminarDeuda,
  pagarCuota,
  calcularTotales,
};