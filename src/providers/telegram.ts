import {
  IDebugOptions,
  IInfoOptions,
  ILogOptions,
  ISuccessOptions,
  IWarnOptions,
  LogLabel,
  type IErrorOptions,
  type ILogProvider,
} from '../log-provider';

type RequestInit = Exclude<Parameters<typeof fetch>[1], undefined>;

type FetchOptions = Omit<RequestInit, 'body'> & {
  botToken?: string;
  params?: Record<string, unknown>;
};

type SendMessageOptions = {
  botToken?: string;
  chatId?: string;
  text: string;
};

interface IRequestOptions {
  botToken?: string;
  chatId?: string;
}

interface ITelegramLogOptions extends ILogOptions, IRequestOptions {
  title?: string;
  description?: string;
}

interface ITelegramInfoOptions extends IInfoOptions, IRequestOptions {
  title?: string;
  description?: string;
}

interface ITelegramWarnOptions extends IWarnOptions, IRequestOptions {
  title?: string;
  description?: string;
}

interface ITelegramErrorOptions extends IErrorOptions, IRequestOptions {
  title?: string;
  description?: string;
}

interface ITelegramSuccessOptions extends ISuccessOptions, IRequestOptions {
  title?: string;
  description?: string;
}

type TelegramLogProviderConfig = IDebugOptions & {
  botToken?: string;
  chatId?: string;
};

export class TelegramLogProvider implements ILogProvider<'telegram'> {
  readonly id = 'telegram';

  private readonly _botToken?: string;
  private readonly _chatId?: string;
  private readonly _isDebugEnabled: boolean;

  constructor(config: TelegramLogProviderConfig) {
    this._botToken = config.botToken;
    this._chatId = config.chatId;
    this._isDebugEnabled = config.debug ?? false;
  }

  async log(options: ITelegramLogOptions) {
    const { title, description, context, labels, ...message } = options;

    await this._sendMessage({
      ...message,
      text: this._rows(
        title && `${title}\n`,
        description && `${description}\n`,
        labels && `${this._buildLabelsRow(labels)}\n`,
        context && this._buildContextRow(context),
      ),
    });
  }

  async info(options: ITelegramInfoOptions) {
    const {
      title = 'Information',
      description,
      labels,
      context,
      ...message
    } = options;

    await this._sendMessage({
      ...message,
      text: this._rows(
        `ℹ️ ${title}\n`,
        description && `${description}\n`,
        labels && `${this._buildLabelsRow(labels)}\n`,
        context && this._buildContextRow(context),
      ),
    });
  }

  async warn(options: ITelegramWarnOptions) {
    const {
      title = 'Warning',
      description,
      labels,
      context,
      ...message
    } = options;

    await this._sendMessage({
      ...message,
      text: this._rows(
        `⚠️ ${title}\n`,
        description && `${description}\n`,
        labels && `${this._buildLabelsRow(labels)}\n`,
        context && this._buildContextRow(context),
      ),
    });
  }

  async error(options: ITelegramErrorOptions) {
    const {
      title = 'An error occurred',
      description,
      labels,
      error,
      context,
      ...message
    } = options;

    await this._sendMessage({
      ...message,
      text: this._rows(
        `📛 ${title}\n`,
        description && `${description}\n`,
        labels && `${this._buildLabelsRow(labels)}\n`,
        this._buildErrorRow(error),
        context && this._buildContextRow(context),
      ),
    });
  }

  async success(options: ITelegramSuccessOptions) {
    const {
      title = 'Success',
      description,
      labels,
      context,
      ...message
    } = options;

    await this._sendMessage({
      ...message,
      text: this._rows(
        `✅ ${title}\n`,
        description && `${description}\n`,
        labels && `${this._buildLabelsRow(labels)}\n`,
        context && this._buildContextRow(context),
      ),
    });
  }

  private async _sendMessage(options: SendMessageOptions) {
    const botToken = options?.botToken ?? this._botToken;
    const chatId = options.chatId ?? this._chatId;

    if (!botToken) throw new TypeError('Telegram bot token is not defined');

    if (!chatId) throw new TypeError('Telegram chat id is not defined');

    const params = {
      chat_id: chatId,
      parse_mode: 'MarkdownV2',
      text: options.text,
    };

    await this._fetch('/sendMessage', { method: 'POST', params });
  }

  private async _fetch(url: string, options?: FetchOptions) {
    const { params, ...init } = options ?? {};

    const botToken = options?.botToken ?? this._botToken;
    const searchParams = params
      ? `?${this._stringifySearchParams(params)}`
      : '';

    if (!botToken) throw new TypeError('Telegram bot token is not defined');

    return await fetch(
      `https://api.telegram.org/bot${botToken}${url}${searchParams}`,
      init,
    );
  }

  private _buildErrorRow(error: unknown): string {
    return this._buildJsonRow('Error', error);
  }

  private _buildContextRow(context: Record<string, unknown>): string {
    return this._buildJsonRow('Context', context);
  }

  private _buildLabelsRow(labels: LogLabel[]): string {
    return this._rows(
      ...labels.map((label) => this._buildLabelRow(label.name, label.value)),
    );
  }

  private _buildJsonRow(label: string, value: unknown): string {
    return [
      this._buildLabelRow(label),
      '```json',
      this._stringify(value),
      '```',
    ].join('\n');
  }

  private _buildLabelRow(title: string, value?: unknown): string {
    if (value === undefined) return `**${title}:**`;
    return `**${title}:** \`${value}\``;
  }

  private _rows(...rows: unknown[]): string {
    return rows.filter(Boolean).join('\n');
  }

  private _stringifySearchParams(params: Record<string, unknown>): string {
    return encodeURI(
      Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&'),
    );
  }

  private _stringify(value: unknown): string {
    return JSON.stringify(value, Object.getOwnPropertyNames(value), 4);
  }
}
