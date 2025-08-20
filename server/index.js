
import express from "express";
import { Telegraf } from "telegraf";
import { GoogleSpreadsheet } from "google-spreadsheet";

// ===== Env =====
const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  GOOGLE_PRIVATE_KEY,
  SHEET_ID,
  SHEET_URL,
  GOOGLE_SHEETS_ID,
  GOOGLE_SHEET_ID,
} = process.env;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBhook_SECRET = process.env.TELEGRAM_WEBhook_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "gk-default-hook";
let PUBLIC_URL =
  process.env.PUBLIC_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "") ||
  process.env.RAILWAY_URL ||
  process.env.DEPLOY_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "";

// ===== App/Bot =====
if (!TELEGRAM_TOKEN) throw new Error("Falta TELEGRAM_TOKEN (o TELEGRAM_BOT_TOKEN)");
const app = express();
app.use(express.json({ limit: "2mb" }));
const bot = new Telegraf(TELEGRAM_TOKEN, { handlerTimeout: 9000 });

// ===== Helpers =====
function extractSheetId(urlOrId) {
  if (!urlOrId) return "";
  if (/^[A-Za-z0-9_-]{20,}$/.test(urlOrId)) return urlOrId;
  const m = String(urlOrId).match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : "";
}
function normalizePk(raw) {
  return String(raw || "").split(String.raw`\\n`).join("\n");
}
function pickSheetId() {
  return SHEET_ID || GOOGLE_SHEETS_ID || GOOGLE_SHEET_ID || extractSheetId(SHEET_URL);
}

// ===== Google Sheets doc =====
async function openDoc() {
  const pkEnv = GOOGLE_PRIVATE_KEY || GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !pkEnv) {
    throw new Error("Sheets no configurado: faltan credenciales");
  }
  const sheetId = pickSheetId();
  if (!sheetId) throw new Error("Sheets no configurado: falta SHEET_ID/GOOGLE_SHEETS_ID o SHEET_URL válido");
  const doc = new GoogleSpreadsheet(sheetId);
  const private_key = normalizePk(pkEnv);
  await doc.useServiceAccountAuth({ client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key });
  await doc.loadInfo();
  return doc;
}

// ===== Comandos =====
bot.command("ping", (ctx) => ctx.reply("pong 🏓"));

// /add <producto> <cantidad> -> escribe fila en 1ra hoja
bot.command("add", async (ctx) => {
  try {
    const parts = (ctx.message.text || "").trim().split(/\s+/);
    if (parts.length < 3) return ctx.reply("Uso: /add <producto> <cantidad>\nEj: /add oreo 3");
    const qty = parseFloat(parts.pop().replace(",", "."));
    const producto = parts.slice(1).join(" ");
    const doc = await openDoc();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({ user_id: ctx.from.id, producto, cantidad: qty, ts: new Date().toISOString() });
    return ctx.reply(`✅ Agregado: <b>${producto}</b> x <b>${qty}</b>`, { parse_mode: "HTML" });
  } catch (e) {
    console.error("add error:", e);
    return ctx.reply("❌ No pude guardar en el Sheet. Revisá credenciales/permisos.");
  }
});

// ===== Selección de Cliente (pestaña Clientes) =====
const session = new Map(); // userId -> { step, page, filtered, client }
let clientsCache = { list: [], ts: 0 };
const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;

async function openClientsSheet() {
  try {
    const doc = await openDoc();
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
async function loadClientsFromSheet() {
  const ws = await openClientsSheet();
  if (!ws) return [];
  // 1) headers
  try {
    const rows = await ws.getRows({ limit: 5000 });
    const list = [];
    for (const r of rows) {
      const idRaw = r.cliente_id ?? r.id ?? r.ID ?? r.Id ?? r["cliente_id"];
      const nombreRaw = r.nombre ?? r.Nombre ?? r.NOMBRE ?? r.cliente ?? r.Cliente;
      const catRaw = r.categoria ?? r.Categoria ?? r.CATEGORIA;
      const id = idRaw ? String(idRaw).trim() : "";
      const nombre = nombreRaw ? String(nombreRaw).trim() : "";
      const categoria = catRaw ? String(catRaw).trim() : "";
      if (nombre) list.push({ id, nombre, categoria });
    }
    if (list.length) {
      list.sort((a,b)=> a.nombre.localeCompare(b.nombre));
      return list;
    }
  } catch {}
  // 2) fallback por celdas (A=id, B=nombre, C=categoria)
  try {
    const maxRows = Math.min(ws.rowCount || 1000, 2000);
    await ws.loadCells(`A1:C${maxRows}`);
    const arr = [];
    for (let r = 2; r <= maxRows; r++) {
      const id = (ws.getCell(r-1, 0).value || "").toString().trim();
      const nombre = (ws.getCell(r-1, 1).value || "").toString().trim();
      const categoria = (ws.getCell(r-1, 2).value || "").toString().trim();
      if (nombre) arr.push({ id, nombre, categoria });
    }
    arr.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return arr;
  } catch (e) {
    console.error("loadClientsFromSheet fallback error:", e);
    return [];
  }
}
async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && (now - clientsCache.ts) < CLIENTS_CACHE_TTL_MS) return clientsCache.list;
  const list = await loadClientsFromSheet();
  clientsCache = { list, ts: now };
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

bot.command("start", async (ctx) => {
  const all = await getClients();
  if (!all.length) return ctx.reply("No pude leer clientes del Sheet. Revisá credenciales o la pestaña 'Clientes'.");
  session.set(ctx.from.id, { step: "choose_client", page: 0, filtered: all });
  const kb = buildClientKeyboard(all, 0);
  await ctx.reply("Elegí un cliente o escribí 3+ letras para buscar:", kb);
});
bot.on("text", async (ctx) => {
  const st = session.get(ctx.from.id);
  if (!st || st.step !== "choose_client") return;
  const txt = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (txt.length >= 3) {
    const q = normalize(txt);
    filtered = all.filter(c => normalize(c.nombre).includes(q));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(ctx.from.id, { step: "done", client: c });
      return ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    }
  }
  session.set(ctx.from.id, { step: "choose_client", page: 0, filtered });
  const kb = buildClientKeyboard(filtered, 0);
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias.", kb);
});
bot.on("callback_query", async (ctx) => {
  const st = session.get(ctx.from.id);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:") || data.startsWith("sel:")) {
    const cNameOrId = data.startsWith("selid:") ? data.slice(6) : data.slice(4);
    const all = await getClients();
    let c = data.startsWith("selid:") ? all.find(x => x.id === cNameOrId) : all.find(x => x.nombre.startsWith(cNameOrId));
    await ctx.answerCbQuery();
    if (c) {
      session.set(ctx.from.id, { step: "done", client: c });
      await ctx.editMessageText(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    } else {
      await ctx.editMessageText("El cliente ya no está disponible. Volvé a /start");
    }
    return;
  }
  if (data === "pg:next" || data === "pg:prev") {
    let page = st.page || 0;
    page = data === "pg:next" ? page + 1 : Math.max(0, page - 1);
    session.set(ctx.from.id, { ...st, page });
    const kb = buildClientKeyboard(st.filtered || [], page);
    try { await ctx.editMessageReplyMarkup(kb.reply_markup); } catch { await ctx.reply("Página actualizada:", kb); }
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();
});

// ===== HTTP: webhook, health, env check =====
const HOOK_PATH = `/webhook/${TELEGRAM_WEBhook_SECRET}`;
app.post(HOOK_PATH, (req, res) => { try { bot.handleUpdate(req.body); } catch (e) { console.error(e); } res.send("ok"); });
app.get("/", (_req, res) => res.json({ ok: true }));
app.get("/set-webhook", async (_req, res) => {
  if (!PUBLIC_URL) return res.status(400).json({ ok: false, error: "PUBLIC_URL vacío" });
  const url = `${PUBLIC_URL}${HOOK_PATH}`;
  try { await bot.telegram.setWebhook(url, { drop_pending_updates: true, allowed_updates: ["message"] }); return res.json({ ok: true, url }); }
  catch (e) { console.error(e); return res.status(500).json({ ok: false, error: String(e) }); }
});
// Env checker (no expone secretos)
app.get("/env", (_req, res) => {
  const pkEnv = GOOGLE_PRIVATE_KEY || GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  res.json({
    TELEGRAM_TOKEN: !!TELEGRAM_TOKEN,
    PUBLIC_URL: !!PUBLIC_URL,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: !!GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: pkEnv ? `len:${String(pkEnv).length}` : false,
    SHEET_ID_OR_URL: !!(pickSheetId())
  });
});

// Start
const port = process.env.PORT || 3000;
app.listen(port, async () => {
  const url = `${PUBLIC_URL}${HOOK_PATH}`;
  if (PUBLIC_URL) {
    try { await bot.telegram.setWebhook(url, { drop_pending_updates: true, allowed_updates: ["message"] }); console.log("setWebhook OK ->", url); }
    catch (e) { console.error("setWebhook FAIL:", e); }
  }
  console.log("Server listening on", port);
});
