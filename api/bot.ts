import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// Vercel автоматически подставит переменные окружения из настроек проекта
const BOT_TOKEN = process.env.BOT_TOKEN;

// Try standard keys first, then fallback to VITE_ keys if the user only set those
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

// WEB_APP_URL - это ссылка на ваш деплой Vercel (https://project.vercel.app)
const WEB_APP_URL = process.env.WEB_APP_URL; 

console.log(`[BOT INIT] Token present: ${!!BOT_TOKEN}, DB URL present: ${!!SUPABASE_URL}, WebApp URL: ${WEB_APP_URL}`);

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');

// Initialize Supabase only if keys are present
const supabase = (SUPABASE_URL && SUPABASE_KEY) 
    ? createClient(SUPABASE_URL, SUPABASE_KEY) 
    : null;

// --- ЛОГИКА БОТА ---

// 1. Простая проверка, работает ли бот
bot.command('ping', async (ctx) => {
    console.log(`[CMD] /ping from ${ctx.from.id}`);
    await ctx.reply('Pong! 🏓 Бот работает и видит сообщения.');
});

bot.start((ctx) => {
    console.log(`[CMD] /start from ${ctx.from.id}`);
    ctx.reply('Добро пожаловать в FreeTime! 🗓\nДобавьте меня в группу с друзьями, и я найду время для встречи.', 
        Markup.inlineKeyboard([
            Markup.button.webApp('🚀 Запустить', WEB_APP_URL || 'https://google.com'),
            Markup.button.url('➕ Добавить в группу', `https://t.me/${ctx.botInfo.username}?startgroup=true`)
        ])
    );
});

// 2. Обработка добавления в группу (автоматическая)
bot.on(['my_chat_member', 'new_chat_members'], async (ctx) => {
    try {
        const chat = ctx.chat;
        const newStatus = ctx.myChatMember?.new_chat_member?.status;
        console.log(`[EVENT] Member status change in ${chat.id} (${chat.type}): ${newStatus}`);

        // Если бота удалили, игнорируем
        if (newStatus === 'left' || newStatus === 'kicked') return;

        // Реагируем только в группах
        if (chat.type === 'group' || chat.type === 'supergroup') {
            await initializeGroup(ctx, chat.id, chat.title);
        }
    } catch (e) {
        console.error("Error in my_chat_member:", e);
    }
});

// 3. Ручная команда инициализации (если бот уже в группе, но промолчал)
bot.command('init', async (ctx) => {
    console.log(`[CMD] /init in ${ctx.chat.id}`);
    if (ctx.chat.type === 'private') {
        return ctx.reply('Эту команду нужно писать внутри группы.');
    }
    await initializeGroup(ctx, ctx.chat.id, ctx.chat.title);
});

// Вспомогательная функция регистрации группы
async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    if (!supabase) {
        console.error("[DB ERROR] Supabase not configured");
        return ctx.reply("⚠️ Ошибка: База данных не подключена на сервере.");
    }

    console.log(`[INIT GROUP] ${chatId} - ${chatTitle}`);
    
    // 1. Сохраняем группу в Supabase
    const { error } = await supabase.from('groups').upsert({
        id: chatId,
        title: chatTitle,
        tier: 'FREE'
    });

    if (error) {
        console.error("[DB ERROR]", error);
        return ctx.reply(`⚠️ Ошибка базы данных: ${error.message}`);
    }

    // 2. Отвечаем в чат
    // IMPORTANT: When passing start_param in URL, it usually maps to tgWebAppStartParam in the app
    const appLink = `${WEB_APP_URL}?startapp=gid_${chatId}`;
    console.log(`[REPLY] Sending App Link: ${appLink}`);

    await ctx.reply(`👋 Привет, ${chatTitle}! Я готов искать свободное время.`, 
        Markup.inlineKeyboard([
            Markup.button.webApp('📅 Открыть Календарь', appLink)
        ])
    );
}

// --- VERCEL HANDLER ---
export default async function handler(request: any, response: any) {
    // 1. Check for GET request (Browser visit)
    if (request.method === 'GET') {
        return response.status(200).send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>🤖 Bot is Running</h1>
                    <p>Status: <strong>Online</strong></p>
                    <p>Endpoint: <code>/api/bot</code></p>
                    <p style="color: gray; font-size: 0.9em;">Make sure your Webhook URL points here.</p>
                </body>
            </html>
        `);
    }

    // 2. Check Configuration
    if (!BOT_TOKEN) {
        return response.status(500).json({ error: 'BOT_TOKEN is missing in Environment Variables' });
    }

    // 3. Handle Telegram Update
    try {
        const { body } = request;
        if (!body) {
             console.log("[WARN] Empty body received");
             return response.status(400).json({ error: 'No body provided' });
        }
        await bot.handleUpdate(body);
        response.status(200).json({ ok: true });
    } catch (error: any) {
        console.error('Error handling update:', error);
        // Don't crash Telegram with 500, log it and return 200 so they stop retrying bad updates
        response.status(200).json({ error: error.message });
    }
}
