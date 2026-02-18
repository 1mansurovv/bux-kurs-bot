require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const LOGO_URL = process.env.LOGO_URL;

const bot = new Telegraf(TOKEN);

// ====== STATE ======
const userState = new Map(); 
const spamData = new Map();

const MAX_MSG_PER_10S = 5;
const MUTE_SECONDS = 60;

// ====== SPAM CHECK (PRIVATE CHAT UCHUN) ======
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
    ctx.reply("⛔️ Juda tez-tez xabar yuboryapsiz.\n1 daqiqadan so‘ng urinib ko‘ring.")
      .catch(()=>{});
    return false;
  }

  spamData.set(chatId, info);
  return true;
}

// ====== GURUHDA BOSHQA BOT XABARINI O‘CHIRISH ======
bot.on("message", async (ctx) => {
  try {
    if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") return;

    // adminni tekshirmaymiz
    if (ctx.from?.id === ADMIN_ID) return;

    // agar xabar yuborgan user BOT bo‘lsa
    if (ctx.from?.is_bot) {
      await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
    }
  } catch (e) {}
});

// ====== GURUHGA YANGI BOT QO‘SHILSA CHIQARISH ======
bot.on("new_chat_members", async (ctx) => {
  try {
    for (const m of ctx.message.new_chat_members) {
      if (m.is_bot) {
        await ctx.reply("🚫 Botlar guruhga qo‘shilishi taqiqlangan.");
        await ctx.telegram.banChatMember(ctx.chat.id, m.id);
      }
    }
  } catch (e) {}
});

// ====== MENU ======
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
    "Bu bot orqali siz <b>4 oylik 'Buxgalteriya hisobi'</b> kursi haqida ma’lumot olishingiz mumkin.\n\n" +
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

  ctx.reply(
    "📚 <b>4 oylik Buxgalteriya hisobi kursi</b>\n\n" +
    "📆 Davomiyligi: 4 oy\n" +
    "💵 Oylik to‘lov: 1 500 000 so‘m\n\n" +
    "📍 Manzil: Buxoro sh., Buxoro Savdo Majmuasi 530-ofis\n" +
    "📞 Tel: +998936236239",
    { parse_mode: "HTML" }
  );
});

// ====== O‘quv dasturi ======
bot.hears("📘 O‘quv dasturi", (ctx) => {
  if (!checkSpam(ctx)) return;

  ctx.reply(
    "📘 <b>O‘quv dasturi:</b>\n\n" +
    "1️⃣ Buxgalteriya asoslari\n" +
    "2️⃣ Soliq amaliyoti\n" +
    "3️⃣ 1C dasturi\n" +
    "4️⃣ Amaliyot",
    { parse_mode: "HTML" }
  );
});

// ====== Aloqa ======
bot.hears("📞 Aloqa", (ctx) => {
  if (!checkSpam(ctx)) return;

  ctx.reply(
    "📞 Admin: @Sunnatillo_buxgalter\n" +
    "📱 Tel: +998 93 623 62 39",
    { parse_mode: "HTML" }
  );
});

// ====== Kursga yozilish ======
bot.hears("📥 Kursga yozilish", (ctx) => {
  if (!checkSpam(ctx)) return;
  userState.set(ctx.chat.id, { step: "get_name" });
  ctx.reply("📋 Ismingizni kiriting:");
});

bot.on("text", async (ctx) => {
  if (!checkSpam(ctx)) return;

  const chatId = ctx.chat.id;
  const state = userState.get(chatId);

  if (state?.step === "get_name") {
    userState.set(chatId, { step: "get_phone", name: ctx.message.text });
    return ctx.reply("📞 Telefon raqamingizni kiriting:");
  }

  if (state?.step === "get_phone") {
    state.phone = ctx.message.text;
    state.step = "finish";
    userState.set(chatId, state);
    return ctx.reply("✉️ Nima uchun kursga yozilmoqchisiz?");
  }

  if (state?.step === "finish") {
    await ctx.telegram.sendMessage(
      ADMIN_ID,
      "📥 <b>Yangi ariza!</b>\n\n" +
      `👤 Ism: ${state.name}\n` +
      `📞 Telefon: ${state.phone}\n` +
      `💬 Izoh: ${ctx.message.text}`,
      { parse_mode: "HTML" }
    );

    await ctx.reply(
      "✅ Arizangiz yuborildi! Tez orada bog‘lanamiz.",
      Markup.removeKeyboard()
    );

    userState.delete(chatId);
  }
});

// ====== RUN ======
bot.launch();
console.log("🤖 Bot ishga tushdi...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
