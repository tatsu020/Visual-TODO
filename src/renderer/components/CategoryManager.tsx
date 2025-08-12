import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, AlertTriangle } from 'lucide-react';

interface Category {
  id?: number;
  name: string;
  label: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryManagerProps {
  categories: Category[];
  onCategoryCreate: (name: string, label: string, color: string) => Promise<void>;
  onCategoryUpdate: (id: number, updates: { name?: string; label?: string; color?: string }) => Promise<void>;
  onCategoryDelete: (id: number) => Promise<void>;
  onClose: () => void;
}

interface CategoryFormData {
  name: string;
  label: string;
  color: string;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  onCategoryCreate,
  onCategoryUpdate,
  onCategoryDelete,
  onClose
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    label: '',
    color: '#fdd835'
  });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const predefinedColors = [
    '#fdd835', // Yellow (General)
    '#2196f3', // Blue (Work)
    '#4caf50', // Green (Health)
    '#9c27b0', // Purple (Study)
    '#e91e63', // Pink (Hobby)
    '#ff9800', // Orange (Household)
    '#00bcd4', // Turquoise (Social)
    '#ffc107', // Gold (Finance)
    '#f44336', // Red
    '#607d8b', // Blue Grey
    '#795548', // Brown
    '#ff5722'  // Deep Orange
  ];

  const resetForm = () => {
    setFormData({ name: '', label: '', color: '#fdd835' });
    setShowAddForm(false);
    setEditingCategory(null);
  };

  const handleAdd = async () => {
    if (!formData.name.trim() || !formData.label.trim()) {
      alert('カテゴリ名とラベルを入力してください。');
      return;
    }

    // 名前の重複チェック
    if (categories.some(cat => cat.name.toLowerCase() === formData.name.toLowerCase())) {
      alert('このカテゴリ名は既に使用されています。');
      return;
    }

    try {
      setLoading(true);
      await onCategoryCreate(formData.name.trim(), formData.label.trim(), formData.color);
      resetForm();
    } catch (error) {
      console.error('Failed to create category:', error);
      alert('カテゴリの作成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      label: category.label,
      color: category.color
    });
    setShowAddForm(false);
  };

  const handleUpdate = async () => {
    if (!editingCategory || !formData.label.trim()) {
      alert('ラベルを入力してください。');
      return;
    }

    // 名前の重複チェック（自分以外）
    if (formData.name !== editingCategory.name && 
        categories.some(cat => cat.id !== editingCategory.id && cat.name.toLowerCase() === formData.name.toLowerCase())) {
      alert('このカテゴリ名は既に使用されています。');
      return;
    }

    try {
      setLoading(true);
      const updates: any = {
        label: formData.label.trim(),
        color: formData.color
      };
      
      // 全カテゴリで名前変更可能
      updates.name = formData.name.trim();

      await onCategoryUpdate(editingCategory.id!, updates);
      resetForm();
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('カテゴリの更新に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (categoryId: number) => {
    try {
      setLoading(true);
      await onCategoryDelete(categoryId);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('カテゴリの削除に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-secondary-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-secondary-900">カテゴリ管理</h2>
              <p className="text-secondary-600 mt-1">タスクのカテゴリを追加・編集・削除できます</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-secondary-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Add New Category Button */}
          {!showAddForm && !editingCategory && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full mb-6 p-4 border-2 border-dashed border-secondary-300 rounded-lg hover:border-primary-500 transition-colors flex items-center justify-center space-x-2 text-secondary-600 hover:text-primary-600"
            >
              <Plus className="w-5 h-5" />
              <span>新しいカテゴリを追加</span>
            </button>
          )}

          {/* Add/Edit Form */}
          {(showAddForm || editingCategory) && (
            <div className="mb-6 p-6 bg-secondary-50 rounded-lg border border-secondary-200">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                {editingCategory ? 'カテゴリを編集' : '新しいカテゴリを追加'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    カテゴリ名 (英数字)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                    placeholder="例: work, study"
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    表示名
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="例: 仕事, 勉強"
                    className="input"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  カテゴリカラー
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {predefinedColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`w-12 h-12 rounded-lg border-2 transition-all ${
                        formData.color === color 
                          ? 'border-secondary-800 scale-110' 
                          : 'border-secondary-300 hover:border-secondary-400'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center space-x-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-8 rounded border border-secondary-300"
                  />
                  <span className="text-sm text-secondary-600">カスタムカラー</span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={editingCategory ? handleUpdate : handleAdd}
                  disabled={loading}
                  className="btn btn-primary flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? '保存中...' : '保存'}</span>
                </button>
                <button
                  onClick={resetForm}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* Categories List */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-secondary-900">カテゴリ一覧</h3>
            
            {categories.length === 0 ? (
              <p className="text-secondary-500 text-center py-8">カテゴリがありません</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(category => (
                  <div
                    key={category.id}
                    className="p-4 border border-secondary-200 rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-6 h-6 rounded-full border border-secondary-300"
                          style={{ backgroundColor: category.color }}
                        />
                        <div>
                          <div className="font-medium text-secondary-900">
                            {category.label}
                          </div>
                          <div className="text-sm text-secondary-600">{category.name}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="p-2 hover:bg-secondary-100 rounded-full transition-colors"
                          title="編集"
                        >
                          <Edit2 className="w-4 h-4 text-secondary-600" />
                        </button>
                        
                        <button
                          onClick={() => setDeleteConfirm(category.id!)}
                          disabled={categories.length <= 1}
                          className={`p-2 rounded-full transition-colors ${
                            categories.length <= 1 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'hover:bg-red-100'
                          }`}
                          title={categories.length <= 1 ? '最後のカテゴリは削除できません' : '削除'}
                        >
                          <Trash2 className={`w-4 h-4 ${categories.length <= 1 ? 'text-secondary-400' : 'text-red-600'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <h3 className="text-lg font-semibold text-secondary-900">カテゴリを削除</h3>
              </div>
              <p className="text-secondary-600 mb-6">
                このカテゴリを削除してもよろしいですか？このカテゴリを使用しているタスクは他の利用可能なカテゴリに自動的に移動されます。
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={loading}
                  className="btn btn-danger flex-1"
                >
                  {loading ? '削除中...' : '削除'}
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={loading}
                  className="btn btn-secondary flex-1"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;