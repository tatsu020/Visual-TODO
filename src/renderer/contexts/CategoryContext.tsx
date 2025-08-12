import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { handleAsyncError, createError, ErrorCategory } from '../utils/error-handler';

interface Category {
  id?: number;
  name: string;
  label: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
  createCategory: (name: string, label: string, color: string) => Promise<void>;
  updateCategory: (id: number, updates: { name?: string; label?: string; color?: string }) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  getCategoryByName: (name: string) => Category | undefined;
  getCategoryLabel: (name: string) => string;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const useCategory = () => {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
};

interface CategoryProviderProps {
  children: ReactNode;
}

export const CategoryProvider: React.FC<CategoryProviderProps> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    const result = await handleAsyncError(async () => {
      setLoading(true);
      setError(null);
      
      // Check if Electron API is available
      if (!window.electronAPI?.database) {
        console.warn('Electron API not available, using fallback categories');
        setCategories([
          { id: 1, name: 'work', label: '仕事', color: '#2196f3', isDefault: false, createdAt: '', updatedAt: '' },
          { id: 2, name: 'health', label: '健康', color: '#4caf50', isDefault: false, createdAt: '', updatedAt: '' },
          { id: 3, name: 'study', label: '勉強', color: '#9c27b0', isDefault: false, createdAt: '', updatedAt: '' },
          { id: 4, name: 'hobby', label: '趣味', color: '#e91e63', isDefault: false, createdAt: '', updatedAt: '' },
          { id: 5, name: 'household', label: '家事', color: '#ff9800', isDefault: false, createdAt: '', updatedAt: '' },
          { id: 6, name: 'social', label: '社交', color: '#00bcd4', isDefault: false, createdAt: '', updatedAt: '' },
          { id: 7, name: 'finance', label: '金融', color: '#ffc107', isDefault: false, createdAt: '', updatedAt: '' },
          { id: 8, name: 'general', label: '一般', color: '#fdd835', isDefault: false, createdAt: '', updatedAt: '' }
        ]);
        return;
      }
      
      const result = await window.electronAPI.database.query('SELECT * FROM categories ORDER BY label ASC');
      
      console.log('📊 fetchCategories()完了 - カテゴリ数:', result.length);
      setCategories(result);
    }, ErrorCategory.DATABASE);

    if (result === null) {
      setError('カテゴリの取得に失敗しました');
    }
    
    setLoading(false);
  };

  const createCategory = async (name: string, label: string, color: string) => {
    const result = await handleAsyncError(async () => {
      setLoading(true);
      setError(null);
      
      // 入力値検証
      if (!name.trim() || !label.trim()) {
        throw createError.validation('カテゴリ名とラベルは必須です', 'カテゴリ名とラベルを入力してください');
      }
      
      // 名前の重複チェック
      if (categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
        throw createError.validation('カテゴリ名が重複しています', 'このカテゴリ名は既に使用されています');
      }
      
      // Check if Electron API is available
      if (!window.electronAPI?.database) {
        console.warn('Electron API not available, cannot create category');
        throw createError.database('データベースAPI利用不可');
      }
      
      const now = new Date().toISOString();
      const dbResult = await window.electronAPI.database.query(
        'INSERT INTO categories (name, label, color, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)',
        [name.trim(), label.trim(), color, now, now]
      );

      console.log('📝 カテゴリ作成完了 - ID:', dbResult.lastID, 'ラベル:', label);

      const newCategory: Category = {
        id: dbResult.lastID,
        name: name.trim(),
        label: label.trim(),
        color,
        isDefault: false,
        createdAt: now,
        updatedAt: now
      };

      setCategories(prev => [...prev, newCategory]);
    }, ErrorCategory.DATABASE);

    if (result === null) {
      setError('カテゴリの作成に失敗しました');
      throw createError.database('Failed to create category');
    }
    
    setLoading(false);
  };

  const updateCategory = async (id: number, updates: { name?: string; label?: string; color?: string }) => {
    try {
      setLoading(true);
      setError(null);
      
      // 入力値検証
      if (updates.label !== undefined && !updates.label.trim()) {
        throw createError.validation('ラベルは必須です', 'ラベルを入力してください');
      }
      
      // 名前の重複チェック
      if (updates.name && categories.some(cat => cat.id !== id && cat.name.toLowerCase() === updates.name!.toLowerCase())) {
        throw createError.validation('カテゴリ名が重複しています', 'このカテゴリ名は既に使用されています');
      }
      
      const now = new Date().toISOString();
      const updatedData = { ...updates, updatedAt: now };
      
      // IDは更新対象から除外
      delete (updatedData as any).id;
      
      const keys = Object.keys(updatedData).filter(key => key !== 'id');
      const values = keys.map(key => (updatedData as any)[key]);
      const setClause = keys.map(key => `${key} = ?`).join(', ');

      console.log('🔄 カテゴリデータベース更新実行中:', { id, updatedData });
      
      await window.electronAPI.database.query(
        `UPDATE categories SET ${setClause} WHERE id = ?`,
        [...values, id]
      );

      console.log('✅ カテゴリデータベース更新完了、React状態を更新中');
      
      setCategories(prev => {
        const updatedCategories = prev.map(category => 
          category.id === id ? { ...category, ...updatedData } : category
        );
        console.log('🔄 カテゴリReact状態更新完了:', updatedCategories.find(c => c.id === id));
        return updatedCategories;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'カテゴリの更新に失敗しました');
      console.error('Failed to update category:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      
      // カテゴリ数チェック - 最後の1つは削除不可
      if (categories.length <= 1) {
        throw createError.validation('最後のカテゴリは削除できません', '最後のカテゴリは削除できません');
      }
      
      // データベースで削除処理（カテゴリ数チェックとタスク移動はデータベース側で処理）
      await window.electronAPI.database.query('DELETE FROM categories WHERE id = ?', [id]);
      
      // React状態から削除
      setCategories(prev => prev.filter(category => category.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'カテゴリの削除に失敗しました');
      console.error('Failed to delete category:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getCategoryByName = (name: string): Category | undefined => {
    return categories.find(category => category.name === name);
  };

  const getCategoryLabel = (name: string): string => {
    const category = getCategoryByName(name);
    return category?.label || name;
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const value: CategoryContextType = {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryByName,
    getCategoryLabel
  };

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};