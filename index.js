require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const LOGO_URL = process.env.LOGO_URL || "";
const WEBHOOK_URL = process.env.WEBHOOK_URL || ""; // masalan: https://xxx.up.railway.app
const PORT = Number(process.env.PORT || 3000);

if (!TOKEN) {
  console.error("❌ BOT_TOKEN topilmadi (.env / Railway Variables tekshiring)");
  process.exit(1);
}
if (!Number.isFinite(ADMIN_ID)) {
  console.error("❌ ADMIN_ID noto‘g‘ri yoki yo‘q. Masalan: ADMIN_ID=123456789");
  process.exit(1);
}

const bot = new Telegraf(TOKEN);

// =====================
// GLOBAL ERROR HANDLER
// =====================
bot.catch((err, ctx) => {
  console.error("❌ BOT ERROR:", err);
});

// =====================
// DEBUG: UPDATE KELYAPTIMI?
// =====================
bot.use(async (ctx, next) => {
  try {
    console.log(
      "UPDATE:",
      ctx.updateType,
      "| CHAT:",
      ctx.chat?.type,
      "| CHAT_ID:",
      ctx.chat?.id,
      "| FROM:",
      ctx.from?.id,
      "| IS_BOT:",
      ctx.from?.is_bot
    );
  } catch (e) {}
  return next();
});

// =====================
// HELPERS
// =====================
function isPrivate(ctx) {
  return ctx.chat?.type === "private";
}

const userState = new Map();
const spamData = new Map();
const MAX_MSG_PER_10S = 5;
const MUTE_SECONDS = 60;

function checkSpamPrivate(ctx) {
  const chatId = ctx.chat?.id;
  if (!chatId) return false;
  if (ctx.from?.id === ADMIN_ID) return true;

  const now = Date.now() / 1000;
  const info = spamData.get(chatId) || { timestamps: [], mutedUntil: 0 };

  if (now < info.mutedUntil) return false;

  info.timestamps = info.timestamps.filter((t) => now - t < 10);
  info.timestamps.push(now);

  if (info.timestamps.length > MAX_MSG_PER_10S) {
    info.mutedUntil = now + MUTE_SECONDS;
    spamData.set(chatId, info);
    ctx
      .reply("⛔️ Juda tez-tez xabar yuboryapsiz.\n1 daqiqadan so‘ng urinib ko‘ring.")
      .catch(() => {});
    return false;
  }

  spamData.set(chatId, info);
  return true;
}

function mainMenu() {
  return Markup.keyboard([
    ["💰 Kurs haqida", "📘 O‘quv dasturi"],
    ["📥 Kursga yozilish", "📞 Aloqa"],
  ]).resize();
}

// =====================================================
// ✅ GURUH: BOT XABAR YOZSA O‘CHIRISH
// =====================================================
bot.on("message", async (ctx, next) => {
  const type = ctx.chat?.type;
  if (type === "group" || type === "supergroup") {
    // admin yozsa tegmaymiz
    if (ctx.from?.id === ADMIN_ID) return next();

    // bot yozgan bo‘lsa o‘chiramiz
    if (ctx.from?.is_bot) {
      try {
        await ctx.deleteMessage();
        console.log("🗑 Deleted bot message:", ctx.from?.username, ctx.from?.id);
      } catch (e) {
        console.error("❌ Delete failed (bot admin emas bo‘lishi mumkin):", e?.description || e);
      }
      return; // groupdagi bot msg uchun shu yerda tugatamiz
    }
  }

  return next();
});

// =====================================================
// ✅ GURUH: YANGI BOT QO‘SHILSA BAN QILISH
// =====================================================
bot.on("new_chat_members", async (ctx) => {
  const type = ctx.chat?.type;
  if (type !== "group" && type !== "supergroup") return;

  const members = ctx.message?.new_chat_members || [];
  for (const m of members) {
    if (m.is_bot) {
      try {
        await ctx.telegram.banChatMember(ctx.chat.id, m.id);
        console.log("✅ BANNED bot:", m.username, m.id);
      } catch (e) {
        console.error("❌ Ban failed (bot admin emas bo‘lishi mumkin):", e?.description || e);
      }
    }
  }
});

// =====================
// PRIVATE BOT (KURS BOT)
// =====================

// /start
bot.start(async (ctx) => {
  if (!isPrivate(ctx)) return;
  if (!checkSpamPrivate(ctx)) return;

  const caption =
    "👋 <b>Assalomu alaykum!</b>\n" +
    "Bu bot orqali siz <b>4 oylik “Buxgalteriya hisobi”</b> kursi haqida ma’lumot olishingiz " +
    "va kursga yozilishingiz mumkin.\n\n" +
    "Quyidagi tugmalardan foydalaning 👇";

  if (LOGO_URL) {
    await ctx
      .replyWithPhoto(LOGO_URL, { caption, parse_mode: "HTML", ...mainMenu() })
      .catch(async () => {
        await ctx.reply(caption, { parse_mode: "HTML", ...mainMenu() });
      });
  } else {
    await ctx.reply(caption, { parse_mode: "HTML", ...mainMenu() });
  }
});

bot.hears("💰 Kurs haqida", async (ctx) => {
  if (!isPrivate(ctx)) return;
  if (!checkSpamPrivate(ctx)) return;

  const text =
    "📚 <b>4 oylik “Buxgalteriya hisobi” amaliy kursi</b>\n\n" +
    "📆 <b>Davomiyligi:</b> 4 oy\n" +
    "💵 <b>Oylik to‘lov:</b> 1 500 000 so‘m\n\n" +
    "🎯 Maqsad — buxgalteriya, soliq bo‘yicha amaliy ko‘nikma va 1C dasturida mustaqil ishlashni o‘rgatish.\n\n" +
    "📍 Manzil: Buxoro sh., Buxoro Savdo Majmuasi 2-qavat, 530-ofis, Shirinovs School\n" +
    "📞 Aloqa: +998936236239, +998996626239";

  await ctx.reply(text, { parse_mode: "HTML" });
});

bot.hears("📘 O‘quv dasturi", async (ctx) => {
  if (!isPrivate(ctx)) return;
  if (!checkSpamPrivate(ctx)) return;

  const text =
    "📘 <b>O‘quv dasturi (4 oy):</b>\n\n" +
    "1️⃣ <b>1-oy:</b> Buxgalteriya hisobining asoslari\n" +
    "2️⃣ <b>2-oy:</b> Soliq savodxonligi va amaliy misollar\n" +
    "3️⃣ <b>3-oy:</b> “1C: Buxgalteriya 8.3 (3.0)” dasturida ishlash\n" +
    "4️⃣ <b>4-oy:</b> Amaliyot — real misollar asosida buxgalteriya yuritish";

  await ctx.reply(text, { parse_mode: "HTML" });
});

bot.hears("📞 Aloqa", async (ctx) => {
  if (!isPrivate(ctx)) return;
  if (!checkSpamPrivate(ctx)) return;

  const text =
    "📞 <b>Biz bilan bog‘laning:</b>\n\n" +
    "👨‍🏫 Admin: @Sunnatillo_buxgalter\n" +
    "📱 Telefon: +998 93 623 62 39\n" +
    "🌐 Sayt: www.shirinovschool.uz";

  await ctx.reply(text, { parse_mode: "HTML" });
});

bot.hears("📥 Kursga yozilish", async (ctx) => {
  if (!isPrivate(ctx)) return;
  if (!checkSpamPrivate(ctx)) return;

  userState.set(ctx.chat.id, { step: "get_name" });
  await ctx.reply("📋 Ismingizni kiriting:");
});

bot.on("text", async (ctx) => {
  if (!isPrivate(ctx)) return;
  if (!checkSpamPrivate(ctx)) return;

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
    try {
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
    } catch (e) {
      console.error("❌ ADMIN ga yuborishda xato:", e?.description || e);
    }

    await ctx.reply("✅ Arizangiz yuborildi! Tez orada bog‘lanamiz.", Markup.removeKeyboard());
    userState.delete(chatId);
  }
});

// =====================
// RUN (Webhook yoki Polling)
// =====================
async function start() {
  // webhook qolib ketgan bo‘lishi mumkin — tozalab yuboramiz
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
  } catch (e) {
    console.log("deleteWebhook skip:", e?.description || e);
  }

  if (WEBHOOK_URL) {
    const app = express();
    app.get("/", (req, res) => res.status(200).send("OK"));
    app.use(bot.webhookCallback("/telegraf"));

    await bot.telegram.setWebhook(`${WEBHOOK_URL}/telegraf`);
    app.listen(PORT, () => console.log(`🌐 Webhook server running on :${PORT}`));
    console.log("✅ Webhook mode ON:", `${WEBHOOK_URL}/telegraf`);
  } else {
    await bot.launch({ dropPendingUpdates: true });
    console.log("✅ Polling mode ON");
  }
}

start().catch((e) => {
  console.error("❌ Start failed:", e);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));