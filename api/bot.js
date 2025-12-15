import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// Vercel автоматически подставит переменные окружения из настроек проекта
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
// WEB_APP_URL - это ссылка на ваш деплой Vercel (https://project.vercel.app)
const WEB_APP_URL = process.env.WEB_APP_URL; 

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is missing');

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

// --- ЛОГИКА БОТА ---

bot.start((ctx) => {
    ctx.reply('Добро пожаловать в FreeTime! 🗓\nДобавьте меня в группу с друзьями, и я найду время для встречи.', 
        Markup.inlineKeyboard([
            Markup.button.webApp('🚀 Запустить', WEB_APP_URL || 'https://google.com'),
            Markup.button.url('➕ Добавить в группу', `https://t.me/${ctx.botInfo.username}?startgroup=true`)
        ])
    );
});

bot.on(['my_chat_member', 'new_chat_members'], async (ctx) => {
    const chat = ctx.chat;
    const newStatus = ctx.myChatMember?.new_chat_member?.status;

    if (newStatus === 'left' || newStatus === 'kicked') return;

    if (chat.type === 'group' || chat.type === 'supergroup') {
        const { error } = await supabase.from('groups').upsert({
            id: chat.id,
            title: chat.title,
            tier: 'FREE'
        });

        if (!error) {
            await ctx.reply(`👋 Привет, ${chat.title}! Я готов искать свободное время.`, 
                Markup.inlineKeyboard([
                    Markup.button.webApp('📅 Открыть Календарь', `${WEB_APP_URL}?startapp=gid_${chat.id}`)
                ])
            );
        }
    }
});

// --- VERCEL HANDLER ---
// Эта функция запускается каждый раз, когда Telegram присылает обновление
export default async function handler(request: any, response: any) {
    // Проверка секретного токена (опционально, но рекомендуется)
    // if (request.headers['x-telegram-bot-api-secret-token'] !== process.env.SECRET_TOKEN) {
    //    return response.status(401).send('Unauthorized');
    // }

    try {
        const { body } = request;
        // Обрабатываем обновление от Telegram
        await bot.handleUpdate(body);
        response.status(200).json({ ok: true });
    } catch (error: any) {
        console.error('Error handling update:', error);
        response.status(500).json({ error: error.message });
    }
}
