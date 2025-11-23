/**
 * Gemini AI Image Generator Service
 * Google Gemini 2.0 Flash を使用したタスク画像生成
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

export interface UserProfile {
  selfIntroduction?: string;
  characterStyle?: string;
  referenceImagePath?: string;
}

export interface TaskImageRequest {
  taskTitle: string;
  taskDescription?: string;
  taskCategory?: string;
  userProfile?: UserProfile;
}

export interface GeneratedImage {
  imagePath: string;
  mimeType: string;
  size: number;
  prompt: string;
  generatedAt: Date;
}

export class GeminiImageGenerator {
  private genAI: GoogleGenAI;
  private cacheDir: string;

  constructor(apiKey: string, cacheDir: string = './generated-images') {
    this.genAI = new GoogleGenAI({
      apiKey: apiKey
    });
    this.cacheDir = cacheDir;
    this.ensureCacheDirectory();
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * タスク内容とユーザープロファイルから画像生成プロンプトを作成
   */
  private generatePrompt(request: TaskImageRequest): string {
    const { taskTitle, taskDescription, taskCategory, userProfile } = request;
    
    let prompt = '';
    
    // ユーザー情報の追加
    if (userProfile?.selfIntroduction) {
      prompt += `Person description: ${userProfile.selfIntroduction}. `;
    }
    
    // タスクの内容を画像化
    prompt += `Create an illustration of this person doing the following task: "${taskTitle}"`;
    
    if (taskDescription) {
      prompt += `. Task details: ${taskDescription}`;
    }
    
    // カテゴリに応じた環境設定
    if (taskCategory) {
      switch (taskCategory.toLowerCase()) {
        case '仕事':
        case 'work':
          prompt += '. Setting: office or workspace environment';
          break;
        case '健康':
        case 'health':
          prompt += '. Setting: gym, park, or healthy lifestyle environment';
          break;
        case '勉強':
        case 'study':
          prompt += '. Setting: library, desk, or learning environment';
          break;
        case '趣味':
        case 'hobby':
          prompt += '. Setting: creative or leisure activity space';
          break;
      }
    }
    
    // スタイル指定
    const style = userProfile?.characterStyle || 'friendly cartoon';
    prompt += `. Style: ${style}, bright and cheerful colors, positive and productive atmosphere`;
    
    // 画像の詳細仕様
    prompt += '. Show the person actively engaged in the task, with a happy and motivated expression';
    prompt += '. The image should be inspiring and encourage task completion';
    
    return prompt;
  }

  /**
   * 画像生成とキャッシュ管理
   */
  async generateTaskImage(request: TaskImageRequest): Promise<GeneratedImage> {
    try {
      const prompt = this.generatePrompt(request);
      
      // キャッシュキーの生成（プロンプトのハッシュ化の代わりに簡単な方法を使用）
      const cacheKey = Buffer.from(prompt).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
      const filename = `task-${cacheKey}-${Date.now()}.png`;
      const filepath = path.join(this.cacheDir, filename);
      
      console.log('🎨 Generating image for task:', request.taskTitle);
      console.log('🎯 Prompt:', prompt);
      
      // Gemini API での画像生成
      const result = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: prompt,
        config: {
          responseModalities: ["IMAGE"]
        }
      });
      
      // 画像データの抽出と保存
      let imageData: Buffer | null = null;
      let mimeType = 'image/png';
      
      if (result.candidates) {
        for (const candidate of result.candidates) {
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData) {
                imageData = Buffer.from(part.inlineData.data, 'base64');
                mimeType = part.inlineData.mimeType || 'image/png';
                break;
              }
            }
          }
          if (imageData) break;
        }
      }
      
      if (!imageData) {
        throw new Error('No image data received from Gemini API');
      }
      
      // 画像ファイルの保存
      fs.writeFileSync(filepath, imageData);
      
      const generatedImage: GeneratedImage = {
        imagePath: filepath,
        mimeType: mimeType,
        size: imageData.length,
        prompt: prompt,
        generatedAt: new Date()
      };
      
      console.log('✅ Image generated successfully:', filename);
      console.log('📁 File path:', filepath);
      console.log('📊 File size:', Math.round(imageData.length / 1024), 'KB');
      
      return generatedImage;
      
    } catch (error) {
      console.error('❌ Error generating image:', error);
      throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * キャッシュされた画像のクリーンアップ
   */
  async cleanupCache(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const files = fs.readdirSync(this.cacheDir);
    let deletedCount = 0;
    
    for (const file of files) {
      const filepath = path.join(this.cacheDir, file);
      const stats = fs.statSync(filepath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filepath);
        deletedCount++;
      }
    }
    
    console.log(`🗑️ Cleaned up ${deletedCount} old cached images`);
    return deletedCount;
  }

  /**
   * 利用可能なキャッシュ画像の一覧取得
   */
  getCachedImages(): string[] {
    return fs.readdirSync(this.cacheDir)
      .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
      .map(file => path.join(this.cacheDir, file));
  }
}
