require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const LOGO_URL = process.env.LOGO_URL || "";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";
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
bot.catch((err) => {
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

async function isGroupAdminOrCreator(ctx) {
  try {
    if (!ctx.chat?.id || !ctx.from?.id) return false;
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return member && (member.status === "creator" || member.status === "administrator");
  } catch (e) {
    return false;
  }
}

function isForwardMessage(ctx) {
  const m = ctx.message;
  if (!m) return false;
  // Telegram forward belgilari
  return Boolean(
    m.forward_date ||
      m.forward_from ||
      m.forward_from_chat ||
      m.forward_sender_name
  );
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
// ✅ GURUH: FORWARD / REKLAMA / SSILKA O‘CHIRISH + BOT MSG O‘CHIRISH
//    (CREATOR/ADMIN bo‘lsa tegmaydi)
// =====================================================
bot.on("message", async (ctx, next) => {
  const type = ctx.chat?.type;

  if (type === "group" || type === "supergroup") {
    // ✅ 0) Botning o‘zi yozgan xabarlarga tegmaymiz (aks holda javoblar o‘chib ketadi)
    if (ctx.from?.id && ctx.botInfo?.id && ctx.from.id === ctx.botInfo.id) {
      return next();
    }

    // ✅ 1) Creator/Admin bo‘lsa tegmaymiz
    const isPrivileged = await isGroupAdminOrCreator(ctx);
    if (isPrivileged) return next();

    // ✅ 2) Forward bo‘lsa (Переслано из ...) — o‘chiramiz
    if (isForwardMessage(ctx)) {
      try {
        await ctx.deleteMessage();
        console.log("🗑 Deleted forwarded message from:", ctx.from?.id);
      } catch (e) {
        console.error("❌ Forward delete failed:", e?.description || e);
      }
      return;
    }

    // ✅ 3) Link/reklama tekshiruvi (text yoki caption ichida)
    const text = ctx.message?.text || ctx.message?.caption || "";

    const hasLink =
      /https?:\/\/\S+/i.test(text) ||
      /t\.me\/\S+/i.test(text) ||
      /@\w{4,}/.test(text);

    const adWords =
      /(reklama|aksiya|skidka|obuna|kanal|канал|подпис|promo|bonus)/i.test(text);

    if (hasLink || adWords) {
      try {
        await ctx.deleteMessage();
        console.log("🗑 Deleted ad/link message from:", ctx.from?.id);
      } catch (e) {
        console.error("❌ Ad delete failed:", e?.description || e);
      }
      return;
    }

    // ✅ 4) Boshqa bot yozsa o‘chiramiz (bizning botdan tashqari)
    if (ctx.from?.is_bot) {
      try {
        await ctx.deleteMessage();
        console.log("🗑 Deleted bot message:", ctx.from?.username, ctx.from?.id);
      } catch (e) {
        console.error("❌ Bot msg delete failed:", e?.description || e);
      }
      return;
    }
  }

  return next();
});

// =====================================================
// ✅ GURUH: YANGI BOT QO‘SHILSA KICK (ban + unban)
// =====================================================
bot.on("new_chat_members", async (ctx) => {
  const type = ctx.chat?.type;
  if (type !== "group" && type !== "supergroup") return;

  const members = ctx.message?.new_chat_members || [];
  for (const m of members) {
    if (m.is_bot) {
      try {
        // "joined" servis xabarini o‘chirib yuborish
        await ctx.deleteMessage().catch(() => {});

        // Kick: ban qilib darhol unban qilamiz
        await ctx.telegram.banChatMember(ctx.chat.id, m.id);
        await ctx.telegram.unbanChatMember(ctx.chat.id, m.id);

        console.log("✅ KICKED bot:", m.username, m.id);
      } catch (e) {
        console.error("❌ Kick failed:", e?.description || e);
      }
    }
  }
});

// =====================================================
// ✅ GURUH: CHIQDI/CHIqarildi service xabarini o‘chirish
// =====================================================
bot.on("left_chat_member", async (ctx) => {
  const type = ctx.chat?.type;
  if (type !== "group" && type !== "supergroup") return;

  try {
    await ctx.deleteMessage();
    console.log("🗑 Deleted left/kick service message");
  } catch (e) {
    // ruxsat bo'lmasa jim
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