import { GoogleGenAI } from '@google/genai';
import OpenAI, { toFile } from 'openai';
import { join } from 'path';
import { app } from 'electron';
import { writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { DatabaseManager } from './database';

export interface ImageGenerationOptions {
  prompt: string;
  referenceImagePath?: string;
  style: string;
  size?: '256x256' | '384x256' | '512x512' | '1024x1024';
  location?: string;
}

export enum AIImageErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_KEY_INVALID = 'API_KEY_INVALID',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  CONTENT_VIOLATION = 'CONTENT_VIOLATION',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INVALID_PROMPT = 'INVALID_PROMPT',
  FILE_SAVE_ERROR = 'FILE_SAVE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AIImageError {
  type: AIImageErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  details?: any;
}

export class AIImageGenerator {
  private genAI: GoogleGenAI | null = null;
  private openai: OpenAI | null = null;
  private provider: 'gemini' | 'openai' = 'gemini';
  private database: DatabaseManager;
  private cacheDir: string;
  private onProgress?: (progress: { stage: string; percent: number; message: string }) => void;

  constructor(database: DatabaseManager, onProgress?: (progress: { stage: string; percent: number; message: string }) => void) {
    this.database = database;
    this.cacheDir = join(app.getPath('userData'), 'images');
    this.onProgress = onProgress;

    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
      console.log('📁 画像キャッシュディレクトリを作成:', this.cacheDir);
    } else {
      // 起動時にキャッシュの状況をログ出力
      this.logCacheStatus();
    }
  }

  // ログ用: オブジェクトからbase64やデータURLを伏せ字にする
  private redactBase64InObject(input: any, depth: number = 0): any {
    if (depth > 5) return '[redacted-depth]';
    if (input == null) return input;
    if (typeof input === 'string') {
      if (input.startsWith('data:image/')) return '[data:image/*;base64, ...redacted]';
      if (input.length > 2048 && /[A-Za-z0-9+/=]{100,}/.test(input)) return '[large-base64-like-string redacted]';
      return input;
    }
    if (Array.isArray(input)) {
      return input.slice(0, 50).map(v => this.redactBase64InObject(v, depth + 1));
    }
    if (typeof input === 'object') {
      const out: any = Array.isArray(input) ? [] : {};
      for (const [k, v] of Object.entries(input)) {
        if (k === 'data' || k === 'b64_json' || k === 'base64' || k === 'content' || k === 'image') {
          if (typeof v === 'string') {
            out[k] = '[redacted]';
            continue;
          }
        }
        out[k] = this.redactBase64InObject(v, depth + 1);
      }
      return out;
    }
    return input;
  }

  // キャッシュ状況を確認し、既存ファイルからマッピングを復元するメソッド
  private logCacheStatus(): void {
    try {
      const files = readdirSync(this.cacheDir);
      const imageFiles = files.filter(file => file.endsWith('.png'));

      console.log('🗄️ 画像キャッシュ状況:');
      console.log(`  - キャッシュディレクトリ: ${this.cacheDir}`);
      console.log(`  - 保存済み画像ファイル数: ${imageFiles.length}`);
      console.log(`  - メモリキャッシュサイズ: ${this.memoryCache.size}/${this.MAX_CACHE_SIZE}`);

      if (imageFiles.length > 0) {
        console.log('  - 最新の画像ファイル:');
        imageFiles.slice(0, 3).forEach(file => {
          const filePath = join(this.cacheDir, file);
          const stats = require('fs').statSync(filePath);
          console.log(`    * ${file} (${Math.round(stats.size / 1024)}KB)`);
        });

        // 既存ファイルからマッピングを復元
        this.rebuildMappingFromFiles(imageFiles);
      }
    } catch (error) {
      console.warn('⚠️ キャッシュ状況確認エラー:', error);
    }
  }

  // 既存ファイルからマッピングを復元
  private rebuildMappingFromFiles(imageFiles: string[]): void {
    try {
      console.log('🔄 既存ファイルからマッピングを復元中...');
      let restoredCount = 0;

      imageFiles.forEach(fileName => {
        // ファイル名からキャッシュキーを抽出（例: gemini_task_1234567890_abcd1234_taskname.png）
        const match = fileName.match(/gemini_task_\d+_([a-zA-Z0-9]{8})/);
        if (match) {
          const keyFragment = match[1];

          // キャッシュキーの断片から完全なキーを復元（データベースから検索）
          this.restoreCacheKeyFromFragment(keyFragment, fileName);
          restoredCount++;
        }
      });

      console.log(`✅ マッピング復元完了: ${restoredCount}個のファイルを処理`);
    } catch (error) {
      console.warn('⚠️ マッピング復元エラー:', error);
    }
  }

  // データベースからタスクを取得してキャッシュキーを復元する方法を追加
  public async restoreMappingsFromDatabase(database: any): Promise<void> {
    try {
      console.log('🔄 データベースからマッピングを復元中...');

      const tasks = await database.query('SELECT id, title, description, imageUrl FROM tasks WHERE imageUrl IS NOT NULL');
      let restoredCount = 0;
      let repairedCount = 0;
      console.log(`📊 復元対象タスク数: ${tasks.length}`);

      // ユーザープロファイルを一度だけ取得
      const userProfileResult = await database.query('SELECT description, artStyle FROM user_profiles LIMIT 1');
      const userDescription = userProfileResult.length > 0 ? userProfileResult[0].description || '' : '';
      const artStyle = userProfileResult.length > 0 ? userProfileResult[0].artStyle || 'anime' : 'anime';
      console.log(`👤 ユーザープロファイル: ${userDescription}, スタイル: ${artStyle}`);

      for (const task of tasks) {
        if (task.imageUrl && task.imageUrl.startsWith('data:image')) {
          console.log(`🔄 復元処理中: TaskID ${task.id}, タイトル: "${task.title}"`);

          // タスク情報からキャッシュキーを再生成（参照画像は当時不明のため含めない）
          const cacheKey = this.generateCacheKey(task.title, task.description || '', userDescription, artStyle, undefined);
          console.log(`🔑 生成されたキャッシュキー: ${cacheKey}`);

          // 🩹 破損した画像データの修復チェック
          const isCorrupted = this.isImageDataCorrupted(task.imageUrl);
          if (isCorrupted) {
            console.log(`🚨 破損画像検出 - TaskID ${task.id}: ${isCorrupted}`);

            // ファイルキャッシュから完全なデータを復元試行
            const repairedImageUrl = await this.repairImageFromCache(cacheKey, task.title);
            if (repairedImageUrl) {
              console.log(`🩹 画像修復成功 - TaskID ${task.id}`);

              // データベースを更新
              await database.query('UPDATE tasks SET imageUrl = ? WHERE id = ?', [repairedImageUrl, task.id]);
              await this.setCachedImage(cacheKey, repairedImageUrl);
              repairedCount++;
            } else {
              console.warn(`⚠️ 画像修復失敗 - TaskID ${task.id}: 破損データをそのまま使用`);
              await this.setCachedImage(cacheKey, task.imageUrl);
            }
          } else {
            // 正常なデータはそのまま使用
            await this.setCachedImage(cacheKey, task.imageUrl);
          }

          this.taskIdMapping.set(task.id, cacheKey);
          console.log(`✅ TaskID ${task.id} -> キャッシュキー ${cacheKey.substring(0, 12)}... (メモリキャッシュ)`);

          // ファイルキャッシュとの関連付けを試行（オプション、失敗しても画像表示に影響なし）
          try {
            const files = readdirSync(this.cacheDir);
            const matchingFile = files.find(file => file.includes(cacheKey.substring(0, 8)));

            if (matchingFile) {
              this.taskImageMapping.set(cacheKey, matchingFile);
              console.log(`📎 ファイル関連付け: ${matchingFile}`);
            } else {
              console.log(`⚠️ 対応するファイルなし（問題なし、base64データが優先される）`);
            }
          } catch (fileError) {
            console.warn(`⚠️ ファイル関連付けに失敗（画像表示には影響なし）:`, fileError);
          }

          restoredCount++;
        } else {
          console.log(`⏭️ スキップ: TaskID ${task.id} (imageUrl無効または空)`);
        }
      }

      console.log(`✅ データベースからのマッピング復元完了: ${restoredCount}個のタスク`);
      if (repairedCount > 0) {
        console.log(`🩹 画像修復完了: ${repairedCount}個のタスク`);
      }
      console.log(`📊 メモリキャッシュサイズ: ${this.memoryCache.size}`);
      console.log(`📊 TaskIDマッピングサイズ: ${this.taskIdMapping.size}`);
      console.log(`📊 ファイルマッピングサイズ: ${this.taskImageMapping.size}`);
    } catch (error) {
      console.error('❌ データベースマッピング復元エラー:', error);
    }
  }

  // 画像データの破損チェック
  private isImageDataCorrupted(imageUrl: string): string | null {
    try {
      if (!imageUrl.startsWith('data:image/')) {
        return 'data:URLフォーマットではありません';
      }

      const headerMatch = imageUrl.match(/^data:([^;]+);base64,/);
      if (!headerMatch) {
        return 'base64ヘッダーが無効です';
      }

      const base64Data = imageUrl.substring(headerMatch[0].length);

      // PNG画像の場合、終端チェック
      if (headerMatch[1] === 'image/png') {
        const buffer = Buffer.from(base64Data, 'base64');
        const hasValidEnd = buffer.includes(Buffer.from('IEND'));
        if (!hasValidEnd) {
          return 'PNG終端チャンクが不完全です';
        }
      }

      return null; // 破損なし
    } catch (error) {
      return `データ解析エラー: ${error instanceof Error ? error.message : 'unknown'}`;
    }
  }

  // ファイルキャッシュから完全な画像データを復元
  private async repairImageFromCache(cacheKey: string, taskTitle: string): Promise<string | null> {
    try {
      const files = readdirSync(this.cacheDir);

      // キャッシュキーまたはタスクタイトルにマッチするファイルを探す
      const matchingFiles = files.filter(file =>
        file.includes(cacheKey.substring(0, 8)) ||
        file.includes(taskTitle.replace(/[^\w]/g, '_'))
      );

      if (matchingFiles.length === 0) {
        console.warn(`⚠️ 修復用ファイルが見つかりません: ${taskTitle}`);
        return null;
      }

      // 最新のファイルを使用
      const latestFile = matchingFiles.sort().reverse()[0];
      const filePath = join(this.cacheDir, latestFile);

      console.log(`📁 修復用ファイル: ${latestFile}`);

      const imageBuffer = readFileSync(filePath);
      const base64Data = imageBuffer.toString('base64');
      const repairedImageUrl = `data:image/png;base64,${base64Data}`;

      console.log(`🩹 修復された画像サイズ: ${repairedImageUrl.length}文字`);

      return repairedImageUrl;
    } catch (error) {
      console.error(`❌ 画像修復エラー:`, error);
      return null;
    }
  }

  // キャッシュキーの断片からマッピングを復元（暫定）
  private restoreCacheKeyFromFragment(keyFragment: string, fileName: string): void {
    // より精密な復元が必要な場合は、後でデータベース連携で実装
    this.taskImageMapping.set(keyFragment, fileName);
    console.log(`📎 断片的復元: ${keyFragment} -> ${fileName}`);
  }

  async initialize(apiKey: string): Promise<void> {
    if (!apiKey) {
      throw this.createError(AIImageErrorType.API_KEY_MISSING, 'API key is required for image generation');
    }

    try {
      this.genAI = new GoogleGenAI({
        apiKey: apiKey
      });
    } catch (error) {
      throw this.createError(AIImageErrorType.API_KEY_INVALID, 'Failed to initialize Gemini client', error);
    }
  }

  // OpenAI (gpt-image-1) 初期化
  async initializeOpenAI(apiKey: string): Promise<void> {
    if (!apiKey) {
      throw this.createError(AIImageErrorType.API_KEY_MISSING, 'API key is required for image generation');
    }
    try {
      this.openai = new OpenAI({ apiKey });
    } catch (error) {
      throw this.createError(AIImageErrorType.API_KEY_INVALID, 'Failed to initialize OpenAI client', error);
    }
  }

  // 画像プロバイダの設定（'gemini' | 'openai'）
  setProvider(provider: 'gemini' | 'openai'): void {
    this.provider = provider;
  }

  getProvider(): 'gemini' | 'openai' {
    return this.provider;
  }

  getCacheDir(): string {
    return this.cacheDir;
  }

  async generateTaskImage(
    taskTitle: string,
    taskDescription: string,
    userDescription: string,
    options: Partial<ImageGenerationOptions> = {},
    taskId?: number
  ): Promise<{ success: true; imageUrl: string } | { success: false; error: AIImageError }> {
    // キューイングシステムを使用して重複リクエストを防ぐ
    return await this.generateTaskImageQueued(taskTitle, taskDescription, userDescription, options, taskId);
  }

  private async generateWithRetry(
    taskTitle: string,
    taskDescription: string,
    userDescription: string,
    options: Partial<ImageGenerationOptions>,
    maxRetries: number,
    taskId?: number
  ): Promise<{ success: true; imageUrl: string } | { success: false; error: AIImageError }> {
    let lastError: AIImageError | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎨 AI画像生成試行 ${attempt}/${maxRetries} - タスク: ${taskTitle}`);

        const result = await this.attemptImageGeneration(taskTitle, taskDescription, userDescription, options, taskId);

        if (result.success) {
          console.log(`✅ AI画像生成成功 (試行 ${attempt}/${maxRetries})`);
          return result;
        } else {
          lastError = result.error;

          // リトライ可能なエラーかチェック
          if (!result.error.retryable || attempt === maxRetries) {
            console.log(`❌ AI画像生成失敗 - リトライ不可またはリトライ上限: ${result.error.userMessage}`);
            return result;
          }

          // リトライ前の待機時間（指数バックオフ）
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`⏳ ${waitTime}ms待機後にリトライします...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } catch (error) {
        lastError = this.analyzeError(error, `${taskTitle} (試行 ${attempt})`);

        if (!lastError.retryable || attempt === maxRetries) {
          console.error(`❌ AI画像生成で予期しないエラー (試行 ${attempt}/${maxRetries}):`, error);
          return { success: false, error: lastError };
        }

        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ エラー後 ${waitTime}ms待機してリトライします...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return {
      success: false,
      error: lastError || this.createError(AIImageErrorType.UNKNOWN_ERROR, 'All retry attempts failed')
    };
  }

  private async attemptImageGeneration(
    taskTitle: string,
    taskDescription: string,
    userDescription: string,
    options: Partial<ImageGenerationOptions>,
    taskId?: number
  ): Promise<{ success: true; imageUrl: string } | { success: false; error: AIImageError }> {
    // 進行度: プロンプト構築開始
    this.onProgress?.({ stage: 'preparing', percent: 10, message: 'プロンプトを準備中...' });

    // 毎回新規生成に切り替え（キャッシュは参照しない）
    const cacheKey = this.generateCacheKey(
      taskTitle,
      taskDescription,
      userDescription,
      options.style || 'anime',
      options.referenceImagePath
    );

    const prompt = this.buildPrompt(taskTitle, taskDescription, userDescription, options.style || 'anime', options, options.referenceImagePath);

    console.log('🎯 プロンプト:', prompt);
    console.log('📊 入力パラメータ:', { taskTitle, taskDescription, userDescription, options });

    // AbortControllerでタイムアウト管理を改善（プロバイダ別）
    const controller = new AbortController();
    const timeoutMs = this.provider === 'openai' ? 240000 : 25000; // OpenAIは生成が重めのため長め
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // OpenAI(gpt-image-1)を利用する場合
      if (this.provider === 'openai') {
        // 進行度: OpenAI API呼び出し開始
        this.onProgress?.({ stage: 'generating', percent: 30, message: 'OpenAIで画像を生成中...' });

        if (!this.openai) {
          return {
            success: false,
            error: this.createError(AIImageErrorType.API_KEY_MISSING, 'OpenAI client not initialized')
          };
        }

        try {
          // gpt-image-1 の推奨サイズに丸める（参照画像の縦横比を優先）
          const requestedSize = options.size || '256x256';
          const allowedSizes = new Set(['1024x1024', '1024x1536', '1536x1024']);
          let size = allowedSizes.has(requestedSize as string) ? (requestedSize as string) : '1024x1024';
          if (options.referenceImagePath) {
            try {
              const dim = await this.getImageDimensions(options.referenceImagePath);
              if (dim) {
                const ratio = dim.width / dim.height;
                if (ratio > 1.2) size = '1536x1024';
                else if (ratio < 0.8) size = '1024x1536';
                else size = '1024x1024';
              }
            } catch { }
          }

          let b64: string | undefined;
          let url: string | undefined;
          const quality = await this.resolveOpenAIQuality((options as any)?.quality);

          // 参照画像があれば image-to-image（edits）を使用
          if (options.referenceImagePath) {
            try {
              const fs = require('fs');
              const path = require('path');
              if (fs.existsSync(options.referenceImagePath)) {
                // Content-Type を確実に付与するため、拡張子からMIMEを決定して toFile に渡す
                const ext = path.extname(options.referenceImagePath).toLowerCase();
                const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                  : ext === '.png' ? 'image/png'
                    : ext === '.webp' ? 'image/webp'
                      : undefined;
                // ReadableStreamの再利用による空読みを避けるため、毎回新しいストリームからFileLikeを生成
                const makeFileLike = async () => {
                  const stream = fs.createReadStream(options.referenceImagePath);
                  const filename = `reference${ext || '.png'}`;
                  return await toFile(stream, filename, contentType ? { type: contentType } : undefined);
                };
                // 参照画像の用途を明示するため、プロンプトにヒントを追記
                const promptWithRef = `${prompt}\n\nUse the provided reference image to match the person’s face, hair, skin tone, and outfit style, but create a new pose and a new environment. Do not copy the original background.`;
                // 単体→配列の順で互換的に試行、quality/input_fidelityは未対応なら外す
                const baseParams: any = { model: 'gpt-image-1', prompt: promptWithRef, size, n: 1 };
                // OpenAI SDKは Node では toFile(FileLike) を推奨
                const fileLike = await makeFileLike();
                let editParams: any = { ...baseParams, image: fileLike };
                if (quality) editParams.quality = quality;
                editParams.input_fidelity = 'high';
                let result: any;
                try {
                  result = await this.openai.images.edit(editParams);
                } catch (e: any) {
                  if (quality && this.isUnknownQualityParameterError(e)) {
                    delete editParams.quality;
                    result = await this.openai.images.edit(editParams);
                  } else if (this.isUnknownInputFidelityParameterError(e)) {
                    delete editParams.input_fidelity;
                    result = await this.openai.images.edit(editParams);
                  } else if (this.isImageListShapeError(e)) {
                    const fileLike2 = await makeFileLike();
                    editParams = { ...baseParams, image: [fileLike2] };
                    if (quality) editParams.quality = quality;
                    editParams.input_fidelity = 'high';
                    try {
                      result = await this.openai.images.edit(editParams);
                    } catch (e2: any) {
                      if (quality && this.isUnknownQualityParameterError(e2)) {
                        delete editParams.quality;
                        result = await this.openai.images.edit(editParams);
                      } else if (this.isUnknownInputFidelityParameterError(e2)) {
                        delete editParams.input_fidelity;
                        result = await this.openai.images.edit(editParams);
                      } else {
                        throw e2;
                      }
                    }
                  } else {
                    throw e;
                  }
                }
                b64 = (result as any)?.data?.[0]?.b64_json;
                url = (result as any)?.data?.[0]?.url;
              } else {
                console.warn('OpenAI edits: reference image path not found, fallback to text-to-image');
              }
            } catch (e) {
              console.warn('OpenAI edits failed, fallback to text-to-image:', e);
            }
          }

          // テキストのみ（generate）
          if (!b64 && !url) {
            const generateParams: any = {
              model: 'gpt-image-1',
              prompt,
              size,
              n: 1
            };
            if (quality) generateParams.quality = quality;
            let result: any;
            try {
              result = await this.openai.images.generate(generateParams);
            } catch (e: any) {
              if (quality && this.isUnknownQualityParameterError(e)) {
                delete generateParams.quality;
                result = await this.openai.images.generate(generateParams);
              } else {
                throw e;
              }
            }
            b64 = (result as any)?.data?.[0]?.b64_json;
            url = (result as any)?.data?.[0]?.url;
          }

          clearTimeout(timeoutId);

          // 進行度: レスポンス受信完了
          this.onProgress?.({ stage: 'processing', percent: 70, message: '画像を処理中...' });

          if (!b64 && !url) {
            return {
              success: false,
              error: this.createError(AIImageErrorType.SERVICE_UNAVAILABLE, 'No image data received from OpenAI API')
            };
          }
          let imageBuffer: Buffer;
          if (b64) {
            imageBuffer = Buffer.from(b64, 'base64');
          } else {
            // fetch image from URL
            const res = await fetch(url!);
            if (!res.ok) {
              return {
                success: false,
                error: this.createError(
                  AIImageErrorType.SERVICE_UNAVAILABLE,
                  `Failed to download image from URL: ${res.status} ${res.statusText}`
                )
              };
            }
            const arrayBuf = await res.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuf);
          }
          const base64DataUrl = await this.saveImageToCache(imageBuffer, taskTitle, cacheKey, taskId);
          // 生のbase64はログに出さない
          console.log('💾 ファイル保存完了: [data:image/*;base64, ...redacted]');
          // 進行度: 保存完了
          this.onProgress?.({ stage: 'complete', percent: 100, message: '画像生成が完了しました' });
          return { success: true, imageUrl: base64DataUrl };
        } catch (openaiError) {
          clearTimeout(timeoutId);

          if (controller.signal.aborted) {
            return {
              success: false,
              error: this.createError(AIImageErrorType.NETWORK_ERROR, 'API request timeout')
            };
          }
          return { success: false, error: this.analyzeError(openaiError, `${taskTitle} (OpenAI)`) };
        }
      }

      // contents をテキスト＋（あれば）参照画像の複合にする
      const contents: any[] = [prompt];
      try {
        if (options.referenceImagePath) {
          const fs = require('fs');
          const path = require('path');
          if (fs.existsSync(options.referenceImagePath)) {
            const imageBuffer = fs.readFileSync(options.referenceImagePath);
            const base64 = imageBuffer.toString('base64');
            const ext = path.extname(options.referenceImagePath).toLowerCase();
            const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
              : ext === '.png' ? 'image/png'
                : ext === '.webp' ? 'image/webp'
                  : 'application/octet-stream';
            contents.push({
              inlineData: {
                data: base64,
                mimeType
              }
            });
            console.log('🖼️ 参照画像をcontentsに添付:', {
              path: options.referenceImagePath,
              mimeType,
              sizeKB: Math.round(imageBuffer.length / 1024)
            });
          } else {
            console.warn('参照画像パスが存在しません:', options.referenceImagePath);
          }
        }
      } catch (e) {
        console.warn('参照画像の読み込みに失敗。テキストのみで続行します:', e);
      }

      // 進行度: Gemini API呼び出し開始
      this.onProgress?.({ stage: 'generating', percent: 30, message: 'Geminiで画像を生成中...' });

      const result = await this.genAI!.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents,
        config: {
          responseModalities: ["IMAGE"]
        }
      });

      clearTimeout(timeoutId);

      // 進行度: レスポンス受信完了
      this.onProgress?.({ stage: 'processing', percent: 70, message: '画像を処理中...' });

      // レスポンス構造をログに出力
      console.log('📋 APIレスポンス構造:', {
        candidates: result.candidates?.length || 0,
        modelVersion: result.modelVersion,
        usageMetadata: result.usageMetadata
      });

      // 画像データの抽出とキャッシュ保存
      if (result.candidates) {
        for (const candidate of result.candidates) {
          console.log('🔍 候補をチェック中:', {
            hasContent: !!candidate.content,
            hasParts: !!candidate.content?.parts,
            partsCount: candidate.content?.parts?.length || 0
          });

          if (candidate.content && candidate.content.parts) {
            for (let i = 0; i < candidate.content.parts.length; i++) {
              const part = candidate.content.parts[i];
              console.log(`📎 パート ${i}:`, {
                hasInlineData: !!part.inlineData,
                hasText: !!part.text,
                mimeType: part.inlineData?.mimeType,
                dataLength: part.inlineData?.data?.length
              });

              if (part.inlineData && part.inlineData.data) {
                try {
                  const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                  console.log('✅ 画像データを発見、処理中...');

                  // 1. キャッシュキーを使ってファイル保存とマッピング更新
                  const base64DataUrl = await this.saveImageToCache(imageBuffer, taskTitle, cacheKey, taskId);
                  console.log('💾 ファイル保存完了: [data:image/*;base64, ...redacted]');

                  // 進行度: 保存完了
                  this.onProgress?.({ stage: 'complete', percent: 100, message: '画像生成が完了しました' });

                  console.log('🔗 画像URL生成完了');
                  console.log('📊 データサイズ:', Math.round(part.inlineData.data.length / 1024), 'KB (base64)');

                  // 3. base64データURLを直接返す（データベース保存用）
                  return { success: true, imageUrl: base64DataUrl };
                } catch (saveError) {
                  console.error('画像処理エラー:', saveError);
                  return {
                    success: false,
                    error: this.createError(AIImageErrorType.FILE_SAVE_ERROR, `Failed to process image: ${saveError}`)
                  };
                }
              }
            }
          }
        }
      }

      console.warn('❌ Gemini APIから画像データを受信できませんでした');
      try {
        const redacted = this.redactBase64InObject(result);
        console.log('📝 レスポンス詳細(一部伏せ字):', JSON.stringify(redacted, null, 2));
      } catch {
        console.log('📝 レスポンス詳細(表示省略: サニタイズ失敗)');
      }
      return {
        success: false,
        error: this.createError(AIImageErrorType.SERVICE_UNAVAILABLE, 'No image data received from API')
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (controller.signal.aborted) {
        return {
          success: false,
          error: this.createError(AIImageErrorType.NETWORK_ERROR, 'API request timeout')
        };
      }

      throw error;
    }
  }

  private buildPrompt(
    taskTitle: string,
    taskDescription: string,
    userDescription: string,
    style: string,
    options: Partial<ImageGenerationOptions> = {},
    referenceImagePath?: string
  ): string {
    // スタイル拡張（小サムネでも視認性の高いテイストを優先）
    const styleExpandedMap: Record<string, string> = {
      anime: 'anime style, clean line art, cel shading, vibrant colors, soft rim light, studio-quality',
      cartoon: 'flat illustration, bold outlines, simplified shapes, playful, bright palette',
      minimalist: 'minimal flat icon style, 2–3 color palette, thick outline, large shapes, high contrast',
      watercolor: 'watercolor style, soft textures, pastel tones, gentle lighting',
      realistic: 'photorealistic, soft light, shallow depth of field, natural colors',
      pixel: 'pixel art, 16-bit feeling, limited palette, crisp contrast',
      sketch: 'pencil sketch, clean shading, simple background'
    };

    const styleExpanded = styleExpandedMap[style] || styleExpandedMap.anime;

    const parts: string[] = [];
    parts.push('High-quality illustration for a visual to-do app.');

    // What & Where & When
    let taskLine = `Depict a single person actively performing: "${taskTitle}"`;
    if (taskDescription) taskLine += ` — ${taskDescription}.`;

    // Location context
    if (options.location) {
      taskLine += ` Location: ${options.location}.`;
    }

    // Time context (if provided in options, though currently passed via prompt text usually)
    // We can infer lighting from the prompt if needed, or add explicit time context handling later.

    parts.push(taskLine);

    if (userDescription) {
      parts.push(`The person is ${userDescription}; show them happy and focused.`);
    }

    parts.push(
      'Composition: centered subject, medium shot (waist-up), eye-level, clear silhouette, '
      + '10–15% margin around the subject, no cropping of head or hands.'
    );

    // Environment refinement based on location
    let envPrompt = 'Environment: ';
    if (options.location) {
      envPrompt += `clearly visible ${options.location} background, detailed but slightly blurred depth of field.`;
    } else {
      envPrompt += 'a few subtle props relevant to the task; minimal, slightly blurred background.';
    }
    parts.push(envPrompt);

    parts.push('No text, numbers, logos, or UI elements.');
    parts.push(
      `Style: ${styleExpanded}. Consistent color palette, vivid colors, soft lighting, ` +
      'clean edges, high contrast. Safe for work.'
    );
    parts.push('Goal: readable as a 64×64 thumbnail; iconic, simple, motivational.');

    // 参照画像のパスはここでは含めない（API側で画像を添付し、別途追記する）
    return parts.join('\n\n');
  }

  private async resolveOpenAIQuality(rawQuality?: string): Promise<'low' | 'medium' | 'high' | undefined> {
    const normalize = (q: string): 'low' | 'medium' | 'high' | undefined => {
      const v = String(q).toLowerCase();
      if (v === 'low' || v === 'medium' || v === 'high') return v;
      return undefined;
    };
    if (rawQuality) return normalize(rawQuality);
    try {
      const rows = await this.database.query('SELECT value FROM settings WHERE key = ?', ['openaiImageQuality']);
      if (rows && rows.length > 0) {
        const q = normalize(rows[0].value);
        if (q) return q;
      }
    } catch { }
    try {
      const rows2 = await this.database.query('SELECT value FROM settings WHERE key = ?', ['imageQuality']);
      if (rows2 && rows2.length > 0) {
        const q = normalize(rows2[0].value);
        if (q) return q;
      }
    } catch { }
    return undefined;
  }

  private isUnknownQualityParameterError(e: any): boolean {
    const msg = e?.message || e?.toString?.();
    return typeof msg === 'string' && (msg.includes("Unknown parameter: 'quality'") || msg.includes('Invalid parameter: quality'));
  }
  private isUnknownInputFidelityParameterError(e: any): boolean {
    const msg = e?.message || e?.toString?.();
    return typeof msg === 'string' && (msg.includes("Unknown parameter: 'input_fidelity'") || msg.includes('Invalid parameter: input_fidelity'));
  }
  private isImageListShapeError(e: any): boolean {
    const msg = e?.message || e?.toString?.();
    return typeof msg === 'string' && (msg.includes('Expected entry at `image` to be') || msg.includes('must be an array'));
  }

  private async saveImageToCache(imageBuffer: Buffer, taskTitle: string, cacheKey?: string, taskId?: number): Promise<string> {
    try {
      // ファイル名を安全に生成（日本語文字も適切に処理）
      const safeTaskTitle = taskTitle
        .replace(/[^\w\s-]/g, '') // 特殊文字を除去
        .replace(/\s+/g, '_') // スペースをアンダースコアに
        .substring(0, 15); // 長さを制限

      // キャッシュキーの一部をファイル名に含める（固有性を確保）
      const keyPrefix = cacheKey ? `_${cacheKey.substring(0, 8)}` : '';
      const fileName = `gemini_task_${Date.now()}${keyPrefix}_${safeTaskTitle || 'untitled'}.png`;
      const filePath = join(this.cacheDir, fileName);

      writeFileSync(filePath, imageBuffer);

      console.log('💾 Image saved to cache:', fileName);
      console.log('📁 File path:', filePath);
      console.log('📊 File size:', Math.round(imageBuffer.length / 1024), 'KB');

      // マッピングを更新
      if (cacheKey) {
        this.taskImageMapping.set(cacheKey, fileName);
        console.log(`🔗 マッピング更新: ${cacheKey} -> ${fileName}`);
      }

      if (taskId) {
        this.taskIdMapping.set(taskId, cacheKey || fileName);
        console.log(`🆔 TaskIDマッピング更新: ${taskId} -> ${cacheKey || fileName}`);
      }

      // base64データURLを直接返す（file://URLではなく）
      const base64Data = imageBuffer.toString('base64');
      const base64DataUrl = `data:image/png;base64,${base64Data}`;
      console.log('🔗 Base64 Data URL生成完了（伏せ字）');

      return base64DataUrl;
    } catch (error) {
      console.error('Failed to save image to cache:', error);
      throw new Error(`Failed to save image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // メモリキャッシュ（LRUキャッシュ）
  private memoryCache = new Map<string, { data: string; timestamp: number }>();
  private readonly MAX_CACHE_SIZE = 50; // 最大50個のキャッシュエントリ
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

  private generateCacheKey(title: string, description: string, userDescription: string, style: string, referenceImagePath?: string): string {
    const pathModule = require('path');
    const refKey = referenceImagePath ? pathModule.basename(referenceImagePath) : 'no_ref';
    const content = `${title}|${description}|${userDescription}|${style}|${refKey}`;
    // 簡単なハッシュ生成（本格的にはcrypto.createHashを使用）
    return Buffer.from(content).toString('base64').replace(/[\/+=]/g, '_').substring(0, 32);
  }

  private async getCachedImage(cacheKey: string): Promise<string | null> {
    // 1. メモリキャッシュをチェック
    const cached = this.memoryCache.get(cacheKey);

    if (cached) {
      // TTLチェック
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log('🗄️ メモリキャッシュから画像を取得:', cacheKey);
        return cached.data;
      } else {
        this.memoryCache.delete(cacheKey);
      }
    }

    // 2. メモリキャッシュに見つからない場合、ファイルキャッシュをチェック
    try {
      const cachedFile = await this.loadFromFileCache(cacheKey);
      if (cachedFile) {
        console.log('💾 ファイルキャッシュから画像を復元:', cacheKey);
        // ファイルキャッシュから読み込んだ画像をメモリキャッシュにも保存
        await this.setCachedImage(cacheKey, cachedFile);
        return cachedFile;
      }
    } catch (error) {
      console.warn('⚠️ ファイルキャッシュの読み込みに失敗:', error);
    }

    return null;
  }

  private async setCachedImage(cacheKey: string, imageUrl: string): Promise<void> {
    // LRU実装：サイズ制限に達した場合は最も古いエントリを削除
    if (this.memoryCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(cacheKey, {
      data: imageUrl,
      timestamp: Date.now()
    });
  }

  // TaskIDとキャッシュキーのマッピングを保存（メモリ上で管理）
  private taskImageMapping = new Map<string, string>(); // cacheKey -> fileName
  private taskIdMapping = new Map<number, string>(); // taskId -> cacheKey

  // ファイルキャッシュから画像を読み込む新しいメソッド（キャッシュキーベース）
  private async loadFromFileCache(cacheKey: string): Promise<string | null> {
    try {
      if (!existsSync(this.cacheDir)) {
        console.log('📁 キャッシュディレクトリが存在しません');
        return null;
      }

      // 1. まずマッピングから対応するファイル名を取得
      let targetFileName = this.taskImageMapping.get(cacheKey);

      if (targetFileName) {
        const filePath = join(this.cacheDir, targetFileName);
        if (existsSync(filePath)) {
          console.log(`💾 マッピングからファイル取得: ${targetFileName}`);
          return await this.readImageFileAsBase64(filePath);
        } else {
          console.warn(`⚠️ マッピングされたファイルが見つかりません: ${targetFileName}`);
          this.taskImageMapping.delete(cacheKey);
        }
      }

      // 2. マッピングにない場合、キャッシュキーをファイル名に含むファイルを検索
      const files = readdirSync(this.cacheDir);
      const cacheKeyFiles = files.filter(file =>
        file.includes(cacheKey.substring(0, 8)) && file.endsWith('.png')
      );

      if (cacheKeyFiles.length > 0) {
        // 最新のファイルを選択
        cacheKeyFiles.sort((a, b) => {
          const timestampA = parseInt(a.match(/gemini_task_(\d+)/)?.[1] || '0');
          const timestampB = parseInt(b.match(/gemini_task_(\d+)/)?.[1] || '0');
          return timestampB - timestampA;
        });

        targetFileName = cacheKeyFiles[0];
        const filePath = join(this.cacheDir, targetFileName);

        // マッピングを更新
        this.taskImageMapping.set(cacheKey, targetFileName);
        console.log(`🔗 新しいマッピング作成: ${cacheKey} -> ${targetFileName}`);

        return await this.readImageFileAsBase64(filePath);
      }

      console.log(`❌ キャッシュキー "${cacheKey}" に対応するファイルが見つかりません`);
      return null;
    } catch (error) {
      console.error('❌ ファイルキャッシュ読み込みエラー:', error);
      return null;
    }
  }

  // ファイルを読み込んでbase64データURLに変換するヘルパー
  private async readImageFileAsBase64(filePath: string): Promise<string> {
    const imageBuffer = readFileSync(filePath);
    const base64Data = imageBuffer.toString('base64');
    const base64DataUrl = `data:image/png;base64,${base64Data}`;
    console.log(`✅ ファイル読み込み成功: ${Math.round(imageBuffer.length / 1024)}KB`);
    return base64DataUrl;
  }

  // 画像の縦横サイズ取得（参照画像のアスペクト比に合わせた出力サイズ選定に使用）
  private async getImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
    try {
      const fs = require('fs');
      const buffer = fs.readFileSync(filePath);
      // PNG/JPEG簡易ヘッダ解析（外部依存を避ける）
      // PNG
      if (buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
      // JPEG（SOF0/2スキャン）
      if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        let offset = 2;
        while (offset < buffer.length) {
          if (buffer[offset] !== 0xff) break;
          const marker = buffer[offset + 1];
          const size = buffer.readUInt16BE(offset + 2);
          if (marker === 0xc0 || marker === 0xc2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          offset += 2 + size;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // 互換性のため残しておく（使用されていないが、preloadで参照される可能性）
  public async convertFileUrlToBase64(fileUrl: string): Promise<string | null> {
    console.log('⚠️ convertFileUrlToBase64は非推奨 - 新しいシステムではbase64データURLを直接使用');

    // すでにbase64データURLの場合はそのまま返す
    if (fileUrl.startsWith('data:')) {
      return fileUrl;
    }

    console.warn('file://URLは新しいシステムではサポートされていません');
    return null;
  }

  // 新機能: TaskIDから直接画像URLを取得する（データベース直読み）
  public async getImageUrlByTaskId(taskId: number): Promise<string | null> {
    try {
      console.log(`🔍 TaskID ${taskId} の画像URLを取得中...`);

      // 1. まずメモリマッピングから確認
      const cacheKey = this.taskIdMapping.get(taskId);
      if (cacheKey) {
        const cachedImage = await this.getCachedImage(cacheKey);
        if (cachedImage) {
          console.log(`✅ TaskID ${taskId} - メモリキャッシュから取得`);
          return cachedImage;
        }
      }

      // 2. データベースから直接取得
      const taskResult = await this.database.query('SELECT imageUrl FROM tasks WHERE id = ?', [taskId]);
      if (taskResult.length > 0 && taskResult[0].imageUrl) {
        console.log(`✅ TaskID ${taskId} - データベースから取得`);
        const imageUrl = taskResult[0].imageUrl;

        // 取得した画像URLをメモリキャッシュにも保存（次回の高速化）
        if (cacheKey) {
          await this.setCachedImage(cacheKey, imageUrl);
        }

        return imageUrl;
      }

      console.log(`❌ TaskID ${taskId} - 画像URLが見つかりません`);
      return null;
    } catch (error) {
      console.error(`❌ TaskID ${taskId} の画像URL取得エラー:`, error);
      return null;
    }
  }

  // キャッシュクリア機能
  public clearCache(): void {
    this.memoryCache.clear();
    console.log('🧹 AIImageGenerator キャッシュをクリアしました');
  }

  // キャッシュ統計情報
  public getCacheStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.memoryCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      keys: Array.from(this.memoryCache.keys())
    };
  }

  // 画像生成キューの実装
  private generateQueue = new Map<number, {
    promise: Promise<{ success: true; imageUrl: string } | { success: false; error: AIImageError }>;
    timestamp: number
  }>();

  async generateTaskImageQueued(
    taskTitle: string,
    taskDescription: string,
    userDescription: string,
    options: Partial<ImageGenerationOptions> = {},
    taskId?: number
  ): Promise<{ success: true; imageUrl: string } | { success: false; error: AIImageError }> {
    if (!this.genAI) {
      return {
        success: false,
        error: this.createError(AIImageErrorType.API_KEY_MISSING, 'AI image generation not initialized')
      };
    }

    // 同じタスクIDの重複リクエストを防ぐ
    if (taskId && this.generateQueue.has(taskId)) {
      console.log('🔄 既存のキューから画像生成結果を取得中 - タスクID:', taskId);
      return await this.generateQueue.get(taskId)!.promise;
    }

    const promise = this.executeImageGeneration(taskTitle, taskDescription, userDescription, options, taskId);

    if (taskId) {
      this.generateQueue.set(taskId, { promise, timestamp: Date.now() });

      // 完了後にキューから削除
      promise.finally(() => {
        this.generateQueue.delete(taskId);
      });
    }

    return await promise;
  }

  private async executeImageGeneration(
    taskTitle: string,
    taskDescription: string,
    userDescription: string,
    options: Partial<ImageGenerationOptions>,
    taskId?: number
  ): Promise<{ success: true; imageUrl: string } | { success: false; error: AIImageError }> {
    // リトライ機能付きで画像生成を実行
    const result = await this.generateWithRetry(taskTitle, taskDescription, userDescription, options, 3, taskId);

    // 画像生成成功時、TaskIDがある場合はデータベースを更新
    if (result.success && taskId) {
      try {
        console.log('💾 データベースに画像URLを保存中 - タスクID:', taskId);
        console.log('🔗 保存する画像URL: [data:image/*;base64, ...redacted]');
        console.log('📊 画像URLサイズ:', result.imageUrl.length, 'characters');

        const updateResult = await this.database.query(
          'UPDATE tasks SET imageUrl = ?, updatedAt = ? WHERE id = ?',
          [result.imageUrl, new Date().toISOString(), taskId]
        );

        console.log('📋 データベースUPDATE結果:', updateResult);
        console.log('🔢 影響された行数:', updateResult.changes || 'unknown');

        // 更新が正常に実行されたか確認
        const verifyResult = await this.database.query(
          'SELECT id, title, imageUrl FROM tasks WHERE id = ?',
          [taskId]
        );

        console.log('🔍 更新後の確認クエリ結果:', {
          found: verifyResult.length > 0,
          taskId: verifyResult[0]?.id,
          title: verifyResult[0]?.title,
          hasImageUrl: !!verifyResult[0]?.imageUrl,
          imageUrlLength: verifyResult[0]?.imageUrl?.length,
          imageUrlPrefix: verifyResult[0]?.imageUrl ? '[data:image/*;base64, ...redacted]' : undefined
        });

        if (verifyResult.length === 0) {
          console.error('❌ 更新確認: タスクが見つかりません - ID:', taskId);
          return {
            success: false,
            error: this.createError(AIImageErrorType.FILE_SAVE_ERROR, 'Task not found after update', { taskId })
          };
        }

        if (!verifyResult[0].imageUrl) {
          console.error('❌ 更新確認: imageUrlが保存されていません');
          return {
            success: false,
            error: this.createError(AIImageErrorType.FILE_SAVE_ERROR, 'Image URL not saved to database', { taskId, updateResult })
          };
        }

        console.log('✅ データベース更新完了 - タスクID:', taskId);
      } catch (dbError) {
        console.error('❌ データベース更新失敗:', dbError);
        // データベース更新失敗時もエラーとして返す
        return {
          success: false,
          error: this.createError(AIImageErrorType.FILE_SAVE_ERROR, 'Failed to save image URL to database', dbError)
        };
      }
    }

    return result;
  }

  // キューのクリーンアップ（古いリクエストを削除）
  private cleanupQueue(): void {
    const now = Date.now();
    const QUEUE_TTL = 5 * 60 * 1000; // 5分

    for (const [taskId, item] of this.generateQueue.entries()) {
      if (now - item.timestamp > QUEUE_TTL) {
        console.log('🧹 古いキューエントリを削除 - タスクID:', taskId);
        this.generateQueue.delete(taskId);
      }
    }
  }

  async regenerateTaskImage(taskId: number): Promise<{ success: true; imageUrl: string } | { success: false; error: AIImageError }> {
    try {
      const taskResult = await this.database.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
      if (taskResult.length === 0) {
        return {
          success: false,
          error: this.createError(AIImageErrorType.UNKNOWN_ERROR, 'Task not found')
        };
      }

      const task = taskResult[0];
      const profileResult = await this.database.query('SELECT * FROM user_profiles LIMIT 1');
      const profile = profileResult.length > 0 ? profileResult[0] : null;

      if (!profile) {
        return {
          success: false,
          error: this.createError(AIImageErrorType.UNKNOWN_ERROR, 'User profile not found')
        };
      }

      const result = await this.generateTaskImage(
        task.title,
        task.description || '',
        profile.description,
        { style: profile.artStyle }
      );

      if (result.success) {
        await this.database.query(
          'UPDATE tasks SET imageUrl = ?, updatedAt = ? WHERE id = ?',
          [result.imageUrl, new Date().toISOString(), taskId]
        );
        return result;
      } else {
        return result;
      }
    } catch (error) {
      console.error('Failed to regenerate task image:', error);
      return {
        success: false,
        error: this.analyzeError(error, `Task ID: ${taskId}`)
      };
    }
  }

  private createError(type: AIImageErrorType, message: string, details?: any): AIImageError {
    const errorMessages = {
      [AIImageErrorType.API_KEY_MISSING]: {
        userMessage: 'AI画像生成にはAPIキーの設定が必要です。設定画面で設定してください。',
        retryable: false
      },
      [AIImageErrorType.API_KEY_INVALID]: {
        userMessage: 'APIキーが無効です。設定画面で正しいAPIキーを設定してください。',
        retryable: false
      },
      [AIImageErrorType.NETWORK_ERROR]: {
        userMessage: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
        retryable: true
      },
      [AIImageErrorType.RATE_LIMIT]: {
        userMessage: 'API使用量の制限に達しました。しばらく待ってから再試行してください。',
        retryable: true
      },
      [AIImageErrorType.CONTENT_VIOLATION]: {
        userMessage: 'タスクの内容がポリシーに違反している可能性があります。内容を変更してください。',
        retryable: false
      },
      [AIImageErrorType.QUOTA_EXCEEDED]: {
        userMessage: 'API使用量の上限に達しました。プランをアップグレードするか、明日再試行してください。',
        retryable: false
      },
      [AIImageErrorType.SERVICE_UNAVAILABLE]: {
        userMessage: 'AI画像生成サービスが一時的に利用できません。しばらく待ってから再試行してください。',
        retryable: true
      },
      [AIImageErrorType.INVALID_PROMPT]: {
        userMessage: 'タスクの内容に問題があります。タスクの説明を見直してください。',
        retryable: false
      },
      [AIImageErrorType.FILE_SAVE_ERROR]: {
        userMessage: '画像の保存に失敗しました。ストレージの容量を確認してください。',
        retryable: true
      },
      [AIImageErrorType.UNKNOWN_ERROR]: {
        userMessage: '画像生成中に予期しないエラーが発生しました。再試行してください。',
        retryable: true
      }
    };

    const errorInfo = errorMessages[type];
    return {
      type,
      message,
      userMessage: errorInfo.userMessage,
      retryable: errorInfo.retryable,
      details
    };
  }

  private analyzeError(error: any, context: string): AIImageError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Gemini API特有のエラーパターンを分析
    if (errorMessage.includes('API key')) {
      return this.createError(AIImageErrorType.API_KEY_INVALID, errorMessage, { context, stack: errorStack });
    }

    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      return this.createError(AIImageErrorType.QUOTA_EXCEEDED, errorMessage, { context, stack: errorStack });
    }

    if (errorMessage.includes('rate') || errorMessage.includes('throttle')) {
      return this.createError(AIImageErrorType.RATE_LIMIT, errorMessage, { context, stack: errorStack });
    }

    if (errorMessage.includes('content') || errorMessage.includes('policy') || errorMessage.includes('violation')) {
      return this.createError(AIImageErrorType.CONTENT_VIOLATION, errorMessage, { context, stack: errorStack });
    }

    if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return this.createError(AIImageErrorType.NETWORK_ERROR, errorMessage, { context, stack: errorStack });
    }

    if (errorMessage.includes('service') || errorMessage.includes('unavailable') || errorMessage.includes('503')) {
      return this.createError(AIImageErrorType.SERVICE_UNAVAILABLE, errorMessage, { context, stack: errorStack });
    }

    // ファイル保存エラー
    if (errorMessage.includes('save') || errorMessage.includes('write') || errorMessage.includes('ENOSPC')) {
      return this.createError(AIImageErrorType.FILE_SAVE_ERROR, errorMessage, { context, stack: errorStack });
    }

    // デフォルト: 不明なエラー
    return this.createError(AIImageErrorType.UNKNOWN_ERROR, errorMessage, { context, stack: errorStack });
  }

  isInitialized(): boolean {
    if (this.provider === 'openai') {
      return this.openai !== null;
    }
    return this.genAI !== null;
  }
}
