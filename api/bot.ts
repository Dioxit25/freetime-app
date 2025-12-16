import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// Vercel автоматически подставит переменные окружения из настроек проекта
const BOT_TOKEN = process.env.BOT_TOKEN;

// Try standard keys first, then fallback to VITE_ keys if the user only set those
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

// WEB_APP_URL - это ссылка на ваш деплой Vercel (https://project.vercel.app)
const WEB_APP_URL = process.env.WEB_APP_URL; 

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is missing');

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

// --- ЛОГИКА БОТА ---

// 1. Простая проверка, работает ли бот
bot.command('ping', async (ctx) => {
    await ctx.reply('Pong! 🏓 Бот работает и видит сообщения.');
});

bot.start((ctx) => {
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
    if (ctx.chat.type === 'private') {
        return ctx.reply('Эту команду нужно писать внутри группы.');
    }
    await initializeGroup(ctx, ctx.chat.id, ctx.chat.title);
});

// Вспомогательная функция регистрации группы
async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    console.log(`Initializing group: ${chatId} - ${chatTitle}`);
    
    // 1. Сохраняем группу в Supabase
    const { error } = await supabase.from('groups').upsert({
        id: chatId,
        title: chatTitle,
        tier: 'FREE'
    });

    if (error) {
        console.error("Supabase Error:", error);
        return ctx.reply(`⚠️ Ошибка базы данных: ${error.message}`);
    }

    // 2. Отвечаем в чат
    await ctx.reply(`👋 Привет, ${chatTitle}! Я готов искать свободное время.`, 
        Markup.inlineKeyboard([
            Markup.button.webApp('📅 Открыть Календарь', `${WEB_APP_URL}?startapp=gid_${chatId}`)
        ])
    );
}

// --- VERCEL HANDLER ---
export default async function handler(request: any, response: any) {
    try {
        const { body } = request;
        await bot.handleUpdate(body);
        response.status(200).json({ ok: true });
    } catch (error: any) {
        console.error('Error handling update:', error);
        response.status(500).json({ error: error.message });
    }
}
