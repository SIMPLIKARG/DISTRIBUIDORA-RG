interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface SendMessageOptions {
  chat_id: number;
  text: string;
  reply_markup?: {
    keyboard?: string[][];
    one_time_keyboard?: boolean;
    resize_keyboard?: boolean;
  } | {
    inline_keyboard?: Array<Array<{
      text: string;
      callback_data: string;
    }>>;
  };
  parse_mode?: 'Markdown' | 'HTML';
}

export class TelegramService {
  private botToken: string;
  private apiUrl: string;

  constructor(botToken: string) {
    this.botToken = botToken;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
  }

  // Enviar mensaje de texto
  async sendMessage(options: SendMessageOptions): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error enviando mensaje de Telegram:', error);
      throw error;
    }
  }

  // Enviar mensaje con teclado personalizado
  async sendMessageWithKeyboard(
    chatId: number, 
    text: string, 
    keyboard: string[][]
  ): Promise<any> {
    return this.sendMessage({
      chat_id: chatId,
      text,
      reply_markup: {
        keyboard,
        one_time_keyboard: true,
        resize_keyboard: true,
      },
      parse_mode: 'Markdown'
    });
  }

  // Enviar mensaje con botones inline
  async sendMessageWithInlineKeyboard(
    chatId: number,
    text: string,
    buttons: Array<Array<{ text: string; callback_data: string }>>
  ): Promise<any> {
    return this.sendMessage({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: buttons,
      },
      parse_mode: 'Markdown'
    });
  }

  // Configurar webhook
  async setWebhook(webhookUrl: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
        }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error configurando webhook:', error);
      throw error;
    }
  }

  // Obtener información del webhook
  async getWebhookInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/getWebhookInfo`);
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo info del webhook:', error);
      throw error;
    }
  }

  // Obtener información del bot
  async getMe(): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/getMe`);
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo info del bot:', error);
      throw error;
    }
  }
}

// Instancia del servicio de Telegram
export const telegramService = new TelegramService(process.env.TELEGRAM_BOT_TOKEN || '');