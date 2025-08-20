
import express from "express";
import { Telegraf } from "telegraf";
import { google } from "googleapis";

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

if (!TELEGRAM_TOKEN) throw new Error("Falta TELEGRAM_TOKEN (o TELEGRAM_BOT_TOKEN)");

const app = express();
app.use(express.json({ limit: "2mb" }));
const bot = new Telegraf(TELEGRAM_TOKEN, { handlerTimeout: 9000 });

function extractSheetId(urlOrId) {
  if (!urlOrId) return "";
  if (/^[A-Za-z0-9_-]{20,}$/.test(urlOrId)) return urlOrId;
  const m = String(urlOrId).match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : "";
}
function pickSheetId() {
  return SHEET_ID || GOOGLE_SHEETS_ID || GOOGLE_SHEET_ID || extractSheetId(SHEET_URL);
}
function normalizePk(raw) {
  let s = String(raw || "");
  // remove possible surrounding quotes
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  // convert \r\n and \r to \n
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // convert literal \n into real newlines
  s = s.split(String.raw`\\n`).join("\n");
  return s.trim();
}

function getAuth() {
  const email = GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const pk = normalizePk(GOOGLE_PRIVATE_KEY || GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  if (!email || !pk) throw new Error("Sheets no configurado: faltan credenciales");
  return new google.auth.JWT({
    email,
    key: pk,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

function getSheetsClient() {
  const spreadsheetId = pickSheetId();
  if (!spreadsheetId) throw new Error("Sheets no configurado: falta SHEET_ID/GOOGLE_SHEETS_ID o SHEET_URL válido");
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, spreadsheetId };
}

async function firstTitle(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return meta.data.sheets?.[0]?.properties?.title || "Hoja 1";
}

bot.command("ping", (ctx) => ctx.reply("pong 🏓"));

bot.command("add", async (ctx) => {
  try {
    const parts = (ctx.message.text || "").trim().split(/\s+/);
    if (parts.length < 3) return ctx.reply("Uso: /add <producto> <cantidad>\nEj: /add oreo 3");
    const qty = parseFloat(parts.pop().replace(",", "."));
    const producto = parts.slice(1).join(" ");
    const { sheets, spreadsheetId } = getSheetsClient();
    const title = await firstTitle(sheets, spreadsheetId);
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: `${title}!A:Z`, valueInputOption: "USER_ENTERED",
      requestBody: { values: [[ctx.from.id, ctx.from.username || "", producto, qty, new Date().toISOString()]] }
    });
    return ctx.reply(`✅ Agregado: <b>${producto}</b> x <b>${qty}</b>`, { parse_mode: "HTML" });
  } catch (e) {
    console.error("add error:", e);
    return ctx.reply("❌ No pude guardar. Revisá credenciales/permisos del Sheet.");
  }
});

const session = new Map();
let clientsCache = { list: [], ts: 0 };
const CLIENTS_TTL = 5 * 60 * 1000;

async function loadClients() {
  const { sheets, spreadsheetId } = getSheetsClient();
  try {
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Clientes!A:C" });
    const rows = resp.data.values || [];
    if (rows.length > 1) {
      const list = rows.slice(1).map(r => ({
        id: (r[0] || "").toString().trim(),
        nombre: (r[1] || "").toString().trim(),
        categoria: (r[2] || "").toString().trim(),
      })).filter(x => x.nombre);
      if (list.length) { list.sort((a,b)=> a.nombre.localeCompare(b.nombre)); return list; }
    }
  } catch {}
  const title = await firstTitle(sheets, spreadsheetId);
  const resp2 = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A:C` });
  const rows2 = resp2.data.values || [];
  const list2 = (rows2.length > 1 ? rows2.slice(1) : rows2).map(r => ({
    id: (r[0] || "").toString().trim(),
    nombre: (r[1] || "").toString().trim(),
    categoria: (r[2] || "").toString().trim(),
  })).filter(x => x.nombre);
  list2.sort((a,b)=> a.nombre.localeCompare(b.nombre));
  return list2;
}
async function getClients() {
  const now = Date.now();
  if (clientsCache.list.length && now - clientsCache.ts < CLIENTS_TTL) return clientsCache.list;
  const list = await loadClients();
  clientsCache = { list, ts: now };
  return list;
}
function buildClientKeyboard(clients, page=0, pageSize=10) {
  const start = page * pageSize;
  const slice = clients.slice(start, start + pageSize);
  const kb = [];
  for (const c of slice) {
    const label = c.categoria ? `${c.nombre} · cat ${c.categoria}` : c.nombre;
    kb.push([{ text: label, callback_data: c.id ? `selid:${c.id}` : `sel:${c.nombre.slice(0,64)}` }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️ Anterior", callback_data: "pg:prev" });
  if (start + pageSize < clients.length) nav.push({ text: "Siguiente ➡️", callback_data: "pg:next" });
  if (nav.length) kb.push(nav);
  return { reply_markup: { inline_keyboard: kb } };
}
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

bot.command("start", async (ctx) => {
  try {
    const list = await getClients();
    if (!list.length) return ctx.reply("No pude leer clientes del Sheet. Revisá credenciales o la pestaña 'Clientes'.");
    session.set(ctx.from.id, { step: "choose_client", page: 0, filtered: list });
    await ctx.reply("Elegí un cliente o escribí 3+ letras para buscar:", buildClientKeyboard(list, 0));
  } catch (e) {
    console.error("/start error:", e);
    ctx.reply("❌ Error al leer Google Sheets (credenciales o permisos).");
  }
});

bot.command("clients", async (ctx) => {
  try {
    const list = await getClients();
    if (!list.length) return ctx.reply("No pude leer clientes (0 resultados).");
    const first = list.slice(0, 20).map(c => `${c.id ? c.id+' - ' : ''}${c.nombre}${c.categoria ? ' · cat '+c.categoria : ''}`).join("\n");
    return ctx.reply(`Leídos ${list.length} clientes:\n` + first);
  } catch (e) {
    console.error("/clients error:", e);
    ctx.reply("❌ Error al leer Google Sheets.");
  }
});

bot.on("text", async (ctx) => {
  const st = session.get(ctx.from.id);
  if (!st || st.step !== "choose_client") return;
  const q = (ctx.message.text || "").trim();
  const all = await getClients();
  let filtered = all;
  if (q.length >= 3) {
    const nq = norm(q);
    filtered = all.filter(c => norm(c.nombre).includes(nq));
    if (filtered.length === 1) {
      const c = filtered[0];
      session.set(ctx.from.id, { step: "done", client: c });
      return ctx.reply(`✅ Cliente seleccionado: <b>${c.nombre}</b>${c.categoria ? " · cat " + c.categoria : ""}`, { parse_mode: "HTML" });
    }
  }
  session.set(ctx.from.id, { step: "choose_client", page: 0, filtered });
  await ctx.reply(filtered.length ? "⬇️ Resultados:" : "No encontré coincidencias.", buildClientKeyboard(filtered, 0));
});

bot.on("callback_query", async (ctx) => {
  const st = session.get(ctx.from.id);
  if (!st) { await ctx.answerCbQuery(); return; }
  const data = ctx.callbackQuery.data || "";
  if (data.startsWith("selid:") || data.startsWith("sel:")) {
    const key = data.startsWith("selid:") ? data.slice(6) : data.slice(4);
    const all = await getClients();
    const c = data.startsWith("selid:") ? all.find(x => x.id === key) : all.find(x => x.nombre.startsWith(key));
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
    let page = (st.page || 0) + (data === "pg:next" ? 1 : -1);
    if (page < 0) page = 0;
    session.set(ctx.from.id, { ...st, page });
    try { await ctx.editMessageReplyMarkup(buildClientKeyboard(st.filtered || [], page).reply_markup); }
    catch { await ctx.reply("Página actualizada:", buildClientKeyboard(st.filtered || [], page)); }
    await ctx.answerCbQuery();
  } else {
    await ctx.answerCbQuery();
  }
});

const HOOK_PATH = `/webhook/${TELEGRAM_WEBhook_SECRET}`;
app.post(HOOK_PATH, (req, res) => { try { bot.handleUpdate(req.body); } catch (e) { console.error(e); } res.send("ok"); });
app.get("/", (_req, res) => res.json({ ok: true }));
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
app.get("/set-webhook", async (_req, res) => {
  if (!PUBLIC_URL) return res.status(400).json({ ok: false, error: "PUBLIC_URL vacío" });
  const url = `${PUBLIC_URL}${HOOK_PATH}`;
  try { await bot.telegram.setWebhook(url, { drop_pending_updates: true, allowed_updates: ["message"] }); return res.json({ ok: true, url }); }
  catch (e) { console.error(e); return res.status(500).json({ ok: false, error: String(e) }); }
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  const url = `${PUBLIC_URL}${HOOK_PATH}`;
  if (PUBLIC_URL) {
    try { await bot.telegram.setWebhook(url, { drop_pending_updates: true, allowed_updates: ["message"] }); console.log("setWebhook OK ->", url); }
    catch (e) { console.error("setWebhook FAIL:", e); }
  }
  console.log("Server listening on", port);
});
