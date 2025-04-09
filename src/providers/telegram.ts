import { Json } from 'detailed-json';
import {
  IInfoOptions,
  ILogOptions,
  ISuccessOptions,
  IWarnOptions,
  LogLabel,
  type IErrorOptions,
  type ILogProvider,
} from './base';
import { LogMethodOptions } from '../utils/log-method-options';

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

type SendUnstyledMessageOptions = {
  botToken?: string;
  chatId?: string;
  symbol?: string;
  messages: unknown[];
};

type TemplateOptions = {
  title?: string;
  description?: string;
};

type RequestOptions = {
  botToken?: string;
  chatId?: string;
};

interface ITelegramLogOptions
  extends RequestOptions,
    ILogOptions<TemplateOptions> {}

interface ITelegramInfoOptions
  extends RequestOptions,
    IInfoOptions<TemplateOptions> {}

interface ITelegramWarnOptions
  extends RequestOptions,
    IWarnOptions<TemplateOptions> {}

interface ITelegramErrorOptions
  extends RequestOptions,
    IErrorOptions<TemplateOptions> {}

interface ITelegramSuccessOptions
  extends RequestOptions,
    ISuccessOptions<TemplateOptions> {}

type TelegramLogProviderConfig = {
  botToken?: string;
  chatId?: string;
};

export class TelegramLogProvider implements ILogProvider {
  private readonly _botToken?: string;
  private readonly _chatId?: string;

  constructor(config: TelegramLogProviderConfig) {
    this._botToken = config.botToken;
    this._chatId = config.chatId;
  }

  async log(options: ITelegramLogOptions | unknown[]) {
    await LogMethodOptions.switch<ITelegramLogOptions>({
      options,
      unstyled: async (messages, options) => {
        await this._sendUnstyledMessage({
          ...options,
          messages,
        });
      },
      styled: async (template, options) => {
        const { title, description, context, labels } = template;

        await this._sendMessage({
          ...options,
          text: this._rows(
            title && `${title}\n`,
            description && `${description}\n`,
            labels && `${this._buildLabelsRow(labels)}\n`,
            context && this._buildContextRow(context),
          ),
        });
      },
    });
  }

  async info(options: ITelegramInfoOptions | unknown[]) {
    await LogMethodOptions.switch<ITelegramInfoOptions>({
      options,
      unstyled: async (messages, options) => {
        await this._sendUnstyledMessage({
          ...options,
          symbol: 'ℹ️',
          messages,
        });
      },
      styled: async (template, options) => {
        const {
          title = 'Information',
          description,
          labels,
          context,
        } = template;

        await this._sendMessage({
          ...options,
          text: this._rows(
            `ℹ️ ${title}\n`,
            description && `${description}\n`,
            labels && `${this._buildLabelsRow(labels)}\n`,
            context && this._buildContextRow(context),
          ),
        });
      },
    });
  }

  async warn(options: ITelegramWarnOptions | unknown[]) {
    await LogMethodOptions.switch<ITelegramWarnOptions>({
      options,
      unstyled: async (messages, options) => {
        await this._sendUnstyledMessage({
          ...options,
          symbol: '⚠️',
          messages,
        });
      },
      styled: async (template, options) => {
        const { title = 'Warning', description, labels, context } = template;

        await this._sendMessage({
          ...options,
          text: this._rows(
            `⚠️ ${title}\n`,
            description && `${description}\n`,
            labels && `${this._buildLabelsRow(labels)}\n`,
            context && this._buildContextRow(context),
          ),
        });
      },
    });
  }

  async error(options: ITelegramErrorOptions | unknown[]) {
    await LogMethodOptions.switch<ITelegramErrorOptions>({
      options,
      unstyled: async (messages, options) => {
        await this._sendUnstyledMessage({
          ...options,
          symbol: '📛',
          messages,
        });
      },
      styled: async (template, options) => {
        const {
          title = 'An error occurred',
          description,
          labels,
          error,
          context,
        } = template;

        await this._sendMessage({
          ...options,
          text: this._rows(
            `📛 ${title}\n`,
            description && `${description}\n`,
            labels && `${this._buildLabelsRow(labels)}\n`,
            this._buildErrorRow(error),
            context && this._buildContextRow(context),
          ),
        });
      },
    });
  }

  async success(options: ITelegramSuccessOptions | unknown[]) {
    await LogMethodOptions.switch<ITelegramSuccessOptions>({
      options,
      unstyled: async (messages, options) => {
        await this._sendUnstyledMessage({
          ...options,
          symbol: '✅',
          messages,
        });
      },
      styled: async (template, options) => {
        const { title = 'Success', description, labels, context } = template;

        await this._sendMessage({
          ...options,
          text: this._rows(
            `✅ ${title}\n`,
            description && `${description}\n`,
            labels && `${this._buildLabelsRow(labels)}\n`,
            context && this._buildContextRow(context),
          ),
        });
      },
    });
  }

  private async _sendUnstyledMessage(options: SendUnstyledMessageOptions) {
    const { symbol, messages, ...delegatedOptions } = options;

    const stringifiedMessages = messages
      .map((item) => Json.stringify(item))
      .join(' ');

    await this._sendMessage({
      ...delegatedOptions,
      text: symbol ? `${symbol} ${stringifiedMessages}` : stringifiedMessages,
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
      Json.stringify(value),
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
}
