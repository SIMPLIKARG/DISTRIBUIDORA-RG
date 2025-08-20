import express from "express";
import { Telegraf } from "telegraf";
import { GoogleSpreadsheet } from "google-spreadsheet";

const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, SHEET_ID } = process.env;

// Soporta ambos nombres para el token del bot
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
// Soporta ambos nombres para el secret del webhook
const TELEGRAM_WEBhook_SECRET = process.env.TELEGRAM_WEBhook_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "gk-default-hook";

// PUBLIC_URL con auto-detección para Railway / Render / etc.
let PUBLIC_URL = process.env.PUBLIC_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")
  || process.env.RAILWAY_URL
  || process.env.DEPLOY_URL
  || process.env.RENDER_EXTERNAL_URL
  || "";

if (!TELEGRAM_TOKEN) throw new Error("Falta TELEGRAM_TOKEN");
if (!PUBLIC_URL) console.warn("PUBLIC_URL no definido. Se intentará auto-detectar; también podés setearlo como env o usar /set-webhook.");
if (!TELEGRAM_WEBhook_SECRET) console.warn("TELEGRAM_WEBhook_SECRET no definido, usando valor por defecto para el path del webhook.");

const app = express();
app.use(express.json({ limit: "2mb" }));

const bot = new Telegraf(TELEGRAM_TOKEN, { handlerTimeout: 9000 });

 // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;nUsá /ping o /add <producto> <cantidad>."));
bot.command("ping", (ctx) => ctx.reply("pong 🏓"));


// ======= Estado en memoria para selección de cliente =======
const session = new Map(); // key: userId -> { step, page, filtered, selected }
let clientsCache = { list: [], ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

// Cargar clientes desde Google Sheets (primera hoja). Toma columna 'nombre' o 'cliente'.
async function loadClientsFromSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return [];
  }
  try {
    const doc = new GoogleSpreadsheet(SHEET_ID);
    const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;n/g, "
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;n");
    await doc.useServiceAccountAuth({
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: pk
    });
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows({ limit: 5000 });
    const names = rows.map(r =>
      r.nombre || r.cliente || r.Nombre || r.Cliente || r.NAME || r['NOMBRE'] || r['CLIENTE']
    ).filter(Boolean).map(s => String(s).trim());
    // Unificar, dedup y ordenar
    const uniq = Array.from(new Set(names)).sort((a,b) => a.localeCompare(b));
    return uniq;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, ts: now };
  return list;
}

function buildClientKeyboard(names, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = names.slice(start, start + pageSize);
  const kb = [];
  for (const name of slice) {
    kb.push([{ text: name, callback_data: `sel:${name.slice(0,64)}` }]); // limita tamaño
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < names.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;u0300-
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;u036f]/g,""); }

// ======= Flujo /start: pedir cliente =======
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const allClients = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: allClients });
  const kb = buildClientKeyboard(allClients, 0);
  await ctx.reply("Elegí un cliente de la lista o escribí al menos 3 letras para buscar:", kb);
});

// Texto libre cuando estamos eligiendo cliente
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  const txt = (ctx.message.text || "").trim();
  if (!st || st.step !== "choose_client") return; // ignorar si no estamos en selección

  // Filtrar si escribe 3+ letras, sino volver a mostrar página 0
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(n => normalize(n).includes(q));
    if (filtered.length === 1) {
      session.set(userId, { step: "done", client: filtered[0] });
      await ctx.reply(`✅ Cliente seleccionado: <b>${filtered[0]}</b>`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados, elegí uno:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de inline keyboard
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }

  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    session.set(userId, { step: "done", client: name });
    await ctx.answerCbQuery();
    await ctx.editMessageText(`✅ Cliente seleccionado: <b>${name}</b>`, { parse_mode: "HTML" });
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      // si no se puede editar el markup, reenviamos mensaje
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


bot.command("add", async (ctx) => {
  try {
    const text = ctx.message.text.trim();
    const parts = text.split(/
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;s+/);
    if (parts.length < 3) return ctx.reply("Uso: /add <producto> <cantidad>");

    const qty = parseFloat(parts.pop().replace(",", "."));
    const producto = parts.slice(1).join(" ");

    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
      return ctx.reply("❌ Falta config de Google Sheets.");
    }

    const doc = new GoogleSpreadsheet(SHEET_ID);
    const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;n/g, "
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;n");
    await doc.useServiceAccountAuth({
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: pk
    });
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      user_id: ctx.from.id,
      username: ctx.from.username || "",
      producto,
      cantidad: qty,
      ts: new Date().toISOString()
    });

    return ctx.reply(`✅ Agregado: <b>${producto}</b> x <b>${qty}</b>`, { parse_mode: "HTML" });
  } catch (err) {
    console.error("add error:", err);
    return ctx.reply("❌ No pude guardar. Revisá credenciales de Sheets.");
  }
});

const HOOK_PATH = `/webhook/${TELEGRAM_WEBhook_SECRET}`;
app.post(HOOK_PATH, (req, res) => {
  try {
    bot.handleUpdate(req.body);
  } catch (e) {
    console.error("handleUpdate error:", e);
  }
  res.status(200).send("ok");
});

app.get("/", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT ||
// ======= Selección de Cliente desde la pestaña "Clientes" del Google Sheet =======
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    console.warn("Sheets no configurado: no se podrán listar clientes.");
    return null;
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  let ws = null;
  for (let i = 0; i < doc.sheetCount; i++) {
    const s = doc.sheetsByIndex[i];
    if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
  }
  if (!ws) ws = doc.sheetsByIndex[0];
  return ws;
}

async function loadClientsFromSheet() {
  try {
    const ws = await openClientsSheet();
    if (!ws) return [];
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    // dedup por nombre+id
    const seen = new Set();
    const dedup = [];
    for (const c of list) {
      const key = (c.id || "") + "|" + c.nombre.toLowerCase();
      if (!seen.has(key)) { seen.add(key); dedup.push(c); }
    }
    // ordenar por nombre
    dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return dedup;
  } catch (err) {
    console.error("Error leyendo clientes del Sheet:", err);
    return [];
  }
}

async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) {
    return clientsCache.list;
  }
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c=>[c.id, c])), ts: now };
  return list;
}

function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    const data = c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}`;
    kb.push([{ text: label, callback_data: data }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}

function normalize(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// /start: pedir cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre: filtra clientes cuando estamos eligiendo
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(userId, { step: "done", client: c });
      await ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
      return;
    }
  }
  session.set(userId, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias. Probá con otro texto.", kb);
});

// Manejo de callbacks
bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const st = session.get(userId);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:")) {
    const id = data.slice(6);
    const all = await getClients();
    const byId = new Map(all.map(c=>[c.id, c]));
    const c = byId.get(id);
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data.startsWith("sel:")) {
    const name = data.slice(4);
    const all = await getClients();
    const c = all.find(x => x.nombre.startsWith(name));
    await ctx.answerCbQuery();
    if (c) {
      session.set(userId, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(userId, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try {
      await ctx.editMessageReplyMarkup(kb.reply_markup);
    } catch {
      await ctx.reply("Página actualizada:", kb);
    }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});


const port = process.env.PORT || 3000;
app.listen(port, async () => {
  const url = `${PUBLIC_URL}${HOOK_PATH}`;
  if (!PUBLIC_URL) { console.warn("No se setea webhook en arranque: PUBLIC_URL vacío."); return; }
  try {
    await bot.telegram.setWebhook(url, {
      drop_pending_updates: true,
      allowed_updates: ["message"]
    });
    console.log("setWebhook OK ->", url);
  } catch (err) {
    console.error("setWebhook FAIL:", err);
  }
  console.log("Server listening on", port);
});
