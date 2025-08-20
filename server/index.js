import express from "express";
import { Telegraf } from "telegraf";
import { GoogleSpreadsheet } from "google-spreadsheet";

const {
  TELEGRAM_TOKEN,
  PUBLIC_URL,
  TELEGRAM_WEBhook_SECRET,
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  SHEET_ID
} = process.env;

if (!TELEGRAM_TOKEN) throw new Error("Falta TELEGRAM_TOKEN");
if (!PUBLIC_URL) throw new Error("Falta PUBLIC_URL");
if (!TELEGRAM_WEBhook_SECRET) throw new Error("Falta TELEGRAM_WEBhook_SECRET");

const app = express();
app.use(express.json({ limit: "2mb" }));

const bot = new Telegraf(TELEGRAM_TOKEN, { handlerTimeout: 9000 });

bot.start((ctx) => ctx.reply("Estoy vivo ✅\nUsá /ping o /add <producto> <cantidad>."));
bot.command("ping", (ctx) => ctx.reply("pong 🏓"));

bot.command("add", async (ctx) => {
  try {
    const text = ctx.message.text.trim();
    const parts = text.split(/\s+/);
    if (parts.length < 3) return ctx.reply("Uso: /add <producto> <cantidad>");

    const qty = parseFloat(parts.pop().replace(",", "."));
    const producto = parts.slice(1).join(" ");

    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !SHEET_ID) {
      return ctx.reply("❌ Falta config de Google Sheets.");
    }

    const doc = new GoogleSpreadsheet(SHEET_ID);
    const pk = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");
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

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  const url = `${PUBLIC_URL}${HOOK_PATH}`;
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
