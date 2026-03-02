require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const LOGO_URL = process.env.LOGO_URL || "";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";
const PORT = Number(process.env.PORT || 3000);

if (!TOKEN) {
  console.error("❌ BOT_TOKEN topilmadi");
  process.exit(1);
}

const bot = new Telegraf(TOKEN);

// =====================
// ADMIN TEKSHIRISH
// =====================
async function isGroupAdminOrCreator(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(
      ctx.chat.id,
      ctx.from.id
    );
    return (
      member.status === "creator" ||
      member.status === "administrator"
    );
  } catch {
    return false;
  }
}

// =====================
// GURUH FILTRI
// =====================
bot.on("message", async (ctx, next) => {
  const type = ctx.chat?.type;
  if (type === "group" || type === "supergroup") {

    // 1️⃣ Admin yoki creator bo‘lsa tegmaymiz
    const privileged = await isGroupAdminOrCreator(ctx);
    if (privileged) return next();

    const text = ctx.message?.text || ctx.message?.caption || "";

    // 2️⃣ Reklama yoki ssilka tekshirish
    const hasLink =
      /https?:\/\/\S+/i.test(text) ||
      /t\.me\/\S+/i.test(text) ||
      /@\w{4,}/.test(text);

    const adWords =
      /(reklama|aksiya|skidka|obuna|kanal|канал|подпис|promo|bonus)/i.test(
        text
      );

    if (hasLink || adWords) {
      try {
        await ctx.deleteMessage();
        console.log("🗑 Reklama o‘chirildi:", ctx.from.id);
      } catch (e) {
        console.log("❌ O‘chirish xato:", e.description);
      }
      return;
    }

    // 3️⃣ Boshqa bot yozsa o‘chiramiz
    if (ctx.from?.is_bot) {
      try {
        await ctx.deleteMessage();
      } catch {}
      return;
    }
  }

  return next();
});

// =====================
// YANGI BOT KIRSA — KICK
// =====================
bot.on("new_chat_members", async (ctx) => {
  const members = ctx.message?.new_chat_members || [];

  for (const m of members) {
    if (m.is_bot) {
      try {
        await ctx.deleteMessage().catch(() => {});
        await ctx.telegram.banChatMember(ctx.chat.id, m.id);
        await ctx.telegram.unbanChatMember(ctx.chat.id, m.id);
        console.log("🤖 Bot kick qilindi:", m.username);
      } catch (e) {
        console.log("❌ Kick xato:", e.description);
      }
    }
  }
});

// =====================
// LEFT / KICK SERVICE XABARINI O‘CHIRISH
// =====================
bot.on("left_chat_member", async (ctx) => {
  try {
    await ctx.deleteMessage();
    console.log("🗑 Left/kick service xabari o‘chirildi");
  } catch {}
});

// =====================
// PRIVATE KURS BOT
// =====================
bot.start(async (ctx) => {
  if (ctx.chat.type !== "private") return;

  const caption =
    "👋 <b>Assalomu alaykum!</b>\n\n" +
    "4 oylik <b>“Buxgalteriya hisobi”</b> kursi haqida ma’lumot olish uchun pastdagi tugmalardan foydalaning 👇";

  await ctx.reply(caption, {
    parse_mode: "HTML",
    ...Markup.keyboard([
      ["💰 Kurs haqida", "📘 O‘quv dasturi"],
      ["📥 Kursga yozilish", "📞 Aloqa"],
    ]).resize(),
  });
});

// =====================
// RUN
// =====================
async function start() {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
  } catch {}

  if (WEBHOOK_URL) {
    const app = express();
    app.use(bot.webhookCallback("/telegraf"));
    await bot.telegram.setWebhook(`${WEBHOOK_URL}/telegraf`);
    app.listen(PORT);
    console.log("🌐 Webhook mode ON");
  } else {
    await bot.launch();
    console.log("🤖 Polling mode ON");
  }
}

start();