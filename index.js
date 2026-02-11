require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const LOGO_URL = process.env.LOGO_URL;

const bot = new Telegraf(TOKEN);

// ====== STATE ======
const userState = new Map(); // chatId -> { step, name, phone }
const spamData = new Map();  // chatId -> { timestamps: [], mutedUntil: 0 }

const MAX_MSG_PER_10S = 5;
const MUTE_SECONDS = 60;

// ====== SPAM CHECK ======
function checkSpam(ctx) {
  const chatId = ctx.chat?.id;
  if (!chatId) return false;
  if (chatId === ADMIN_ID) return true;

  const now = Date.now() / 1000;
  const info = spamData.get(chatId) || { timestamps: [], mutedUntil: 0 };

  if (now < info.mutedUntil) return false;

  info.timestamps = info.timestamps.filter(t => now - t < 10);
  info.timestamps.push(now);

  if (info.timestamps.length > MAX_MSG_PER_10S) {
    info.mutedUntil = now + MUTE_SECONDS;
    spamData.set(chatId, info);
    ctx.reply("⛔️ Juda tez-tez xabar yuboryapsiz.\nIltimos, 1 daqiqadan so‘ng yana urinib ko‘ring.")
      .catch(()=>{});
    return false;
  }

  spamData.set(chatId, info);
  return true;
}

// ====== KEYBOARD (anonim olib tashlandi) ======
function mainMenu() {
  return Markup.keyboard([
    ["💰 Kurs haqida", "📘 O‘quv dasturi"],
    ["📥 Kursga yozilish", "📞 Aloqa"],
  ]).resize();
}

// ====== /start ======
bot.start(async (ctx) => {
  if (!checkSpam(ctx)) return;

  const caption =
    "👋 <b>Assalomu alaykum!</b>\n" +
    "Bu bot orqali siz <b>4 oylik 'Buxgalteriya hisobi'</b> amaliy kursi haqida ma’lumot olishingiz " +
    "va kursga yozilishingiz mumkin.\n\n" +
    "Quyidagi tugmalardan foydalaning 👇";

  await ctx.replyWithPhoto(LOGO_URL, {
    caption,
    parse_mode: "HTML",
    ...mainMenu(),
  });
});

// ====== Kurs haqida ======
bot.hears("💰 Kurs haqida", (ctx) => {
  if (!checkSpam(ctx)) return;

  const text =
    "📚 <b>4 oylik “Buxgalteriya hisobi” amaliy kursi</b>\n\n" +
    "📆 <b>Davomiyligi:</b> 4 oy\n" +
    "💵 <b>Oylik to‘lov:</b> 1 500 000 so‘m\n\n" +
    "🎯 Maqsad — buxgalteriya, soliq bo‘yicha amaliy ko‘nikma va 1C dasturida mustaqil ishlashni o‘rgatish.\n\n" +
    "📍 Manzil: Buxoro sh., Buxoro Savdo Majmuasi 2-qavat, 530-ofis, Shirinovs School\n" +
    "📞 Aloqa: +998936236239, +998996626239";

  ctx.reply(text, { parse_mode: "HTML" });
});

// ====== O‘quv dasturi ======
bot.hears("📘 O‘quv dasturi", (ctx) => {
  if (!checkSpam(ctx)) return;

  const text =
    "📘 <b>O‘quv dasturi (4 oy):</b>\n\n" +
    "1️⃣ <b>1-oy:</b> Buxgalteriya hisobining asoslari\n" +
    "2️⃣ <b>2-oy:</b> Soliq savodxonligi va amaliy misollar\n" +
    "3️⃣ <b>3-oy:</b> “1C: Buxgalteriya 8.3 (3.0)” dasturida ishlash\n" +
    "4️⃣ <b>4-oy:</b> Amaliyot — real misollar asosida buxgalteriya yuritish";

  ctx.reply(text, { parse_mode: "HTML" });
});

// ====== Aloqa ======
bot.hears("📞 Aloqa", (ctx) => {
  if (!checkSpam(ctx)) return;

  const text =
    "📞 <b>Biz bilan bog‘laning:</b>\n\n" +
    "👨‍🏫 Admin: @Sunnatillo_buxgalter\n" +
    "📍 Manzil: Buxoro sh., Buxoro Savdo Majmuasi 2-qavat 530-ofis, Shirinovs School\n" +
    "📱 Telefon: +998 93 623 62 39\n" +
    "🌐 Sayt: www.shirinovschool.uz";

  ctx.reply(text, { parse_mode: "HTML" });
});

// ====== Kursga yozilish (start) ======
bot.hears("📥 Kursga yozilish", (ctx) => {
  if (!checkSpam(ctx)) return;

  userState.set(ctx.chat.id, { step: "get_name" });
  ctx.reply("📋 Ismingizni kiriting:");
});

// ====== Bitta text handler (kursga yozilish flow) ======
bot.on("text", async (ctx) => {
  if (!checkSpam(ctx)) return;

  const chatId = ctx.chat.id;
  const state = userState.get(chatId);

  if (state?.step === "get_name") {
    userState.set(chatId, { step: "get_phone", name: ctx.message.text });
    return ctx.reply("📞 Telefon raqamingizni yuboring (+998 bilan):");
  }

  if (state?.step === "get_phone") {
    state.phone = ctx.message.text;
    state.step = "finish";
    userState.set(chatId, state);
    return ctx.reply("✉️ Nima uchun kursga yozilmoqchisiz? (qisqacha yozing):");
  }

  if (state?.step === "finish") {
    await ctx.telegram.sendMessage(
      ADMIN_ID,
      "📥 <b>Yangi ariza!</b>\n\n" +
      `👤 Ism: ${state.name}\n` +
      `📞 Telefon: ${state.phone}\n` +
      `💬 Izoh: ${ctx.message.text}\n` +
      `🆔 ID: ${chatId}\n` +
      "📘 Kurs: 4 oylik “Buxgalteriya hisobi” amaliy kursi",
      { parse_mode: "HTML" }
    );

    await ctx.reply(
      "✅ Arizangiz yuborildi! Tez orada siz bilan bog‘lanamiz. Rahmat!",
      Markup.removeKeyboard()
    );

    userState.delete(chatId);
    return;
  }

  // Agar user hech qaysi step’da bo‘lmasa, jim turamiz yoki xabar beramiz:
  // return ctx.reply("Menyudan tugmalardan foydalaning 👇", mainMenu());
});

// ====== RUN ======
bot.launch();
console.log("🤖 Bot ishga tushdi...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
