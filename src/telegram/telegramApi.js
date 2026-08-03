export class TelegramApi {
	constructor(botToken) {
		this.botToken = botToken;
		this.baseUrl = `https://api.telegram.org/bot${botToken}`;
	}

	async sendMessage(chatId, text, extra = {}) {
		return await fetch(`${this.baseUrl}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: chatId,
				text,
				parse_mode: 'HTML',
				...extra,
			}),
		});
	}

	async sendDocument(chatId, fileId, caption = '') {
		return await fetch(`${this.baseUrl}/sendDocument`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: chatId,
				document: fileId,
				caption,
			}),
		});
	}
}
