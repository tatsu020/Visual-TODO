import { z } from 'zod';

// タスク関連のスキーマ
export const TaskCreateSchema = z.object({
  title: z.string()
    .min(1, 'タイトルは必須です')
    .max(200, 'タイトルは200文字以内で入力してください')
    .trim(),
  description: z.string()
    .max(1000, '説明は1000文字以内で入力してください')
    .optional()
    .transform(val => val?.trim() || ''),
  type: z.enum(['immediate', 'recurring', 'scheduled'], {
    errorMap: () => ({ message: '有効なタイプを選択してください' })
  }),
  scheduledTime: z.string()
    .optional()
    .transform(val => val?.trim()),
  scheduledTimeEnd: z.string()
    .optional()
    .transform(val => val?.trim()),
  estimatedDuration: z.number()
    .min(1, '所要時間は1分以上で入力してください')
    .max(1440, '所要時間は24時間(1440分)以内で入力してください')
    .optional(),
  recurringPattern: z.string()
    .max(100, '繰り返しパターンは100文字以内で入力してください')
    .optional()
    .transform(val => val?.trim()),
  dueDate: z.string()
    .optional()
    .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: '有効な日付形式で入力してください (YYYY-MM-DD)'
    }),
  location: z.string()
    .max(200, '場所は200文字以内で入力してください')
    .optional()
    .transform(val => val?.trim()),
  priority: z.enum(['high', 'medium', 'low'], {
    errorMap: () => ({ message: '有効な優先度を選択してください' })
  }).optional()
});

export const TaskUpdateSchema = TaskCreateSchema.partial().extend({
  id: z.number().positive('有効なタスクIDが必要です'),
  status: z.enum(['pending', 'inProgress', 'completed', 'paused']).optional()
});

// ユーザープロファイル関連のスキーマ
export const UserProfileSchema = z.object({
  description: z.string()
    .trim(),
  referenceImagePath: z.string()
    .optional()
    .refine(val => !val || /\.(jpg|jpeg|png|gif)$/i.test(val), {
      message: '有効な画像ファイル形式を選択してください (.jpg, .jpeg, .png, .gif)'
    }),
  artStyle: z.enum(['anime', 'realistic', 'watercolor', 'pixel', 'sketch', 'cartoon', 'minimalist'], {
    errorMap: () => ({ message: '有効なアートスタイルを選択してください' })
  }),
  quality: z.enum(['low', 'medium', 'high']).nullish().transform(val => val ?? undefined)
});

// APIキー関連のスキーマ
export const ApiKeySchema = z.string()
  .min(1, 'APIキーは必須です')
  .regex(/^[A-Za-z0-9_-]+$/, 'APIキーは英数字、ハイフン、アンダースコアのみ使用可能です')
  .min(20, 'APIキーは20文字以上である必要があります')
  .max(200, 'APIキーは200文字以内である必要があります');

// APIキーのオプショナルスキーマ（空文字列も許可）
const OptionalApiKeySchema = z.union([
  z.literal(''),
  ApiKeySchema
]).optional().transform(val => val === '' ? undefined : val);

// 設定関連のスキーマ
export const SettingsSchema = z.object({
  geminiApiKey: OptionalApiKeySchema,
  notificationsEnabled: z.boolean(),
  notificationSound: z.boolean(),
  notificationVolume: z.number().min(0).max(100),
  widgetOpacity: z.number().min(10).max(100),
  widgetAlwaysOnTop: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  language: z.enum(['ja', 'en']),
  fontSize: z.enum(['small', 'medium', 'large']),
  openaiApiKey: OptionalApiKeySchema,
  imageProvider: z.enum(['gemini', 'openai']).optional()
});

// データベースクエリパラメータのサニタイゼーション
export const sanitizeString = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error('文字列である必要があります');
  }

  // SQLインジェクション防止: 危険な文字列をエスケープ
  return value
    .replace(/'/g, "''")  // シングルクォートをエスケープ
    .replace(/;/g, '')     // セミコロンを除去
    .replace(/--/g, '')    // SQLコメントを除去
    .replace(/\/\*/g, '')  // SQLコメント開始を除去
    .replace(/\*\//g, '')  // SQLコメント終了を除去
    .trim();
};

export const sanitizeNumber = (value: unknown): number => {
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error('有効な数値である必要があります');
  }
  return num;
};

// 検証ヘルパー関数
export const validateAndSanitize = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => err.message).join(', ');
      throw new Error(`入力値検証エラー: ${messages}`);
    }
    throw error;
  }
};

// タイプエクスポート
export type TaskCreateInput = z.infer<typeof TaskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>;
export type UserProfileInput = z.infer<typeof UserProfileSchema>;
export type SettingsInput = z.infer<typeof SettingsSchema>;