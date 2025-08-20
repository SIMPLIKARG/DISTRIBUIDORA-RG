import express from "express";
import { Telegraf } from "telegraf";
import { GoogleSpreadsheet } from "google-spreadsheet";

// ===== Env vars (con fallbacks) =====
const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, SHEET_ID } = process.env;

// Soporta ambos nombres para token y secret
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBhook_SECRET = process.env.TELEGRAM_WEBhook_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "gk-default-hook";

// PUBLIC_URL autodetección y warnings no fatales
let PUBLIC_URL = process.env.PUBLIC_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")
  || process.env.RAILWAY_URL
  || process.env.DEPLOY_URL
  || process.env.RENDER_EXTERNAL_URL
  || "";

if (!TELEGRAM_TOKEN) throw new Error("Falta TELEGRAM_TOKEN (o TELEGRAM_BOT_TOKEN)");
if (!TELEGRAM_WEBhook_SECRET) console.warn("TELEGRAM_WEBhook_SECRET no definido, usando valor por defecto para el path de webhook.");
if (!PUBLIC_URL) console.warn("PUBLIC_URL no definido. Se intentará auto-detectar; también podés setearlo o usar /set-webhook.");

const app = express();
app.use(express.json({ limit: "2mb" }));

// ===== Bot =====
const bot = new Telegraf(TELEGRAM_TOKEN, { handlerTimeout: 9000 });

// Ping simple
bot.command("ping", (ctx) => ctx.reply("pong 🏓"));

// ===== Helpers Google Sheets =====
async function openDoc() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
    throw new Error("Sheets no configurado");
  }
  const doc = new GoogleSpreadsheet(SHEET_ID);
  const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: pk });
  await doc.loadInfo();
  return doc;
}

// ===== Demo /add producto cantidad (escribe en la primera hoja) =====
bot.command("add", async (ctx) => {
  try {
    const parts = (ctx.message.text || "").trim().split(/\s+/);
    if (parts.length < 3) return ctx.reply("Uso: /add <producto> <cantidad>\nEj: /add oreo 3");
    const qty = parseFloat(parts.pop().replace(",", "."));
    const producto = parts.slice(1).join(" ");
    const doc = await openDoc();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      user_id: ctx.from.id, username: ctx.from.username || "", producto, cantidad: qty, ts: new Date().toISOString()
    });
    return ctx.reply(`✅ Agregado: <b>${producto}</b> x <b>${qty}</b>`, { parse_mode: "HTML" });
  } catch (err) {
    console.error("add error:", err);
    return ctx.reply("❌ No pude guardar. Revisá credenciales/permisos del Sheet.");
  }
});

// ======== Selección de Cliente desde la pestaña 'Clientes' ========
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], byId: new Map(), ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  try {
    const doc = await openDoc();
    // buscar hoja "Clientes" (case-insensitive)
    let ws = null;
    for (let i = 0; i < doc.sheetCount; i++) {
      const s = doc.sheetsByIndex[i];
      if ((s.title || "").toLowerCase() === "clientes") { ws = s; break; }
    }
    if (!ws) ws = doc.sheetsByIndex[0];
    return ws;
  } catch (e) {
    console.warn("Sheets no configurado o error al abrir:", e.message);
    return null;
  }
}


// ===== Helpers de lectura robusta desde Google Sheets =====
async function loadClientsFromSheet() {
  const ws = await openClientsSheet();
  if (!ws) return [];

  try {
    // 1) Intento normal usando headers
    const rows = await ws.getRows({ limit: 5000 });
    let list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r['cliente_id'] ?? r['Cliente_id'];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    if (list.length > 0) {
      const seen = new Set(), dedup = [];
      for (const c of list) {
        const key = (c.id || "") + "|" + c.nombre.toLowerCase();
        if (!seen.has(key)) { seen.add(key); dedup.push(c); }
      }
      dedup.sort((a,b)=> a.nombre.localeCompare(b.nombre));
      return dedup;
    }
  } catch (e) {
    console.warn("getRows con headers falló, probando lectura por celdas:", e.message);
  }

  // 2) Fallback: lectura por celdas (A=cliente_id, B=nombre, C=categoria)
  try {
    const maxRows = Math.min(ws.rowCount || 1000, 2000);
    await ws.loadCells(`A1:C${maxRows}`);
    const headerA = (ws.getCellByA1("A1").value || "").toString().toLowerCase();
    const headerB = (ws.getCellByA1("B1").value || "").toString().toLowerCase();
    const headerC = (ws.getCellByA1("C1").value || "").toString().toLowerCase();
    // Si las cabeceras no están, igual leemos valores de columnas A/B/C
    const arr = [];
    for (let r = 2; r <= maxRows; r++) {
      const id = (ws.getCell(r-1, 0).value || "").toString().trim();   // A
      const nombre = (ws.getCell(r-1, 1).value || "").toString().trim(); // B
      const categoria = (ws.getCell(r-1, 2).value || "").toString().trim(); // C
      if (nombre) arr.push({ id, nombre, categoria });
    }
    if (arr.length) {
      arr.sort((a,b)=> a.nombre.localeCompare(b.nombre));
      return arr;
    }
  } catch (e) {
    console.error("Fallback por celdas también falló:", e);
  }
  return [];
}

// /clients: comando de depuración para listar los primeros clientes leídos
bot.command("clients", async (ctx) => {
  try {
    const list = await getClients();
    if (!list.length) return ctx.reply("No pude leer clientes (0 resultados). Revisá permisos/hoja 'Clientes'.");
    const first = list.slice(0, 20).map(c => `${c.id ? c.id+" - " : ""}${c.nombre}${c.categoria ? " · cat "+c.categoria : ""}`).join("
");
    return ctx.reply(`Leídos ${list.length} clientes:
` + first);
  } catch (e) {
    console.error("/clients error:", e);
    return ctx.reply("Error leyendo clientes.");
  }
});


async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) return clientsCache.list;
  const list = await loadClientsFromSheet();
  clientsCache = { list, byId: new Map(list.map(c => [c.id, c])), ts: now };
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

// /start: flujo de selección de cliente
bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  const all = await getClients();
  if (!all.length) {
    return ctx.reply("No pude leer clientes del Sheet. Revisá credenciales o la pestaña 'Clientes'.");
  }
  session.set(userId, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente (o escribí 3+ letras para buscar):", kb);
});

// Texto libre cuando estamos eligiendo cliente
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

// Callbacks (selección y paginación)
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

// ===== Webhook HTTP =====
const HOOK_PATH = `/webhook/${TELEGRAM_WEBhook_SECRET}`;

app.post(HOOK_PATH, (req, res) => {
  try { bot.handleUpdate(req.body); } catch (e) { console.error("handleUpdate error:", e); }
  res.status(200).send("ok");
});

// Health & util para setear webhook manual
app.get("/", (_req, res) => res.json({ ok: true, status: "healthy" }));

app.get("/set-webhook", async (_req, res) => {
  if (!PUBLIC_URL) return res.status(400).json({ ok: false, error: "PUBLIC_URL vacío" });
  const url = `${PUBLIC_URL}${HOOK_PATH}`;
  try {
    await bot.telegram.setWebhook(url, { drop_pending_updates: true, allowed_updates: ["message"] });
    console.log("setWebhook OK ->", url);
    return res.json({ ok: true, url });
  } catch (err) {
    console.error("setWebhook FAIL:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ===== Arranque =====
const port = process.env.PORT || 3000;
app.listen(port, async () => {
  const url = `${PUBLIC_URL}${HOOK_PATH}`;
  if (!PUBLIC_URL) { console.warn("No se setea webhook en arranque: PUBLIC_URL vacío."); return; }
  try {
    await bot.telegram.setWebhook(url, { drop_pending_updates: true, allowed_updates: ["message"] });
    console.log("setWebhook OK ->", url);
  } catch (err) {
    console.error("setWebhook FAIL:", err);
  }
  console.log("Server listening on", port);
});
