import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  if (!context) {
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
    setLoading(true);
    setError(null);
    // カテゴリ機能は廃止済み。空データを返す。
    setCategories([]);
    setLoading(false);
  };

  const createCategory = async (name: string, label: string, color: string) => {
    setLoading(true);
    setError(null);
    const now = new Date().toISOString();
    const newCategory: Category = {
      id: Date.now(),
      name: name.trim(),
      label: label.trim(),
      color,
      isDefault: false,
      createdAt: now,
      updatedAt: now
    };
    setCategories(prev => [...prev, newCategory]);
    setLoading(false);
  };

  const updateCategory = async (id: number, updates: { name?: string; label?: string; color?: string }) => {
    setLoading(true);
    setError(null);
    const now = new Date().toISOString();
    setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...updates, updatedAt: now } : cat));
    setLoading(false);
  };

  const deleteCategory = async (id: number) => {
    setLoading(true);
    setError(null);
    setCategories(prev => prev.filter(cat => cat.id !== id));
    setLoading(false);
  };

  const getCategoryByName = (name: string) => categories.find(category => category.name === name);
  const getCategoryLabel = (name: string) => getCategoryByName(name)?.label || name;

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
