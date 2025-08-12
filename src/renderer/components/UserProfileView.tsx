import React, { useState } from 'react';
import { User, Upload, Save, Image as ImageIcon, Palette } from 'lucide-react';
import { useUserProfile } from '../contexts/UserProfileContext';
import { UserProfileFormData, ArtStyle } from '../types';

const UserProfileView: React.FC = () => {
  const { profile, loading, error, updateProfile, uploadReferenceImage } = useUserProfile();
  const [isEditing, setIsEditing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserProfileFormData>({
    description: profile?.description || '',
    referenceImagePath: profile?.referenceImagePath || '',
    artStyle: profile?.artStyle || 'anime',
    quality: profile?.quality
  });

  const artStyles: { value: ArtStyle; label: string; description: string }[] = [
    { value: 'anime', label: 'アニメ調', description: '日本のアニメのようなスタイル' },
    { value: 'realistic', label: 'リアル調', description: '写実的なスタイル' },
    { value: 'watercolor', label: '水彩画風', description: '水彩画のような柔らかいタッチ' },
    { value: 'pixel', label: 'ピクセルアート風', description: 'レトロなドット絵スタイル' },
    { value: 'sketch', label: 'スケッチ風', description: '手書きの鉛筆画風' },
    { value: 'cartoon', label: 'カートゥーン風', description: 'アメリカンコミック風' },
    { value: 'minimalist', label: 'ミニマル風', description: 'シンプルで洗練されたスタイル' }
  ];

  // 入力のたびに自動保存（500msデバウンス）
  React.useEffect(() => {
    const h = setTimeout(async () => {
      try {
        setValidationError(null);
        if (!formData.description.trim()) {
          // 必須項目が空なら保存しない（エラー表示のみ）
          setValidationError('自己紹介を入力してください。');
          return;
        }
        setIsSaving(true);
        await updateProfile(formData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'プロファイルの保存に失敗しました。';
        setValidationError(msg);
      } finally {
        setIsSaving(false);
      }
    }, 500);
    return () => clearTimeout(h);
  }, [formData.description, formData.referenceImagePath, formData.artStyle]);

  const handleImageUpload = async () => {
    const imagePath = await uploadReferenceImage();
    if (imagePath) {
      setFormData(prev => ({ ...prev, referenceImagePath: imagePath }));
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        description: profile.description,
        referenceImagePath: profile.referenceImagePath || '',
        artStyle: profile.artStyle,
        quality: profile.quality
      });
      setIsEditing(false);
      setValidationError(null);
    }
  };

  const handleSave = async () => {
    try {
      setValidationError(null);
      if (!formData.description.trim()) {
        setValidationError('自己紹介を入力してください。');
        return;
      }
      setIsSaving(true);
      await updateProfile(formData);
      setIsEditing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'プロファイルの保存に失敗しました。';
      setValidationError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const clearValidationError = () => {
    if (validationError) {
      setValidationError(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">プロファイルを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">エラーが発生しました</p>
          <p className="text-secondary-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200">
          <div className="p-6 border-b border-secondary-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <User className="w-8 h-8 text-primary-600" />
                <div>
                  <h2 className="text-2xl font-bold text-secondary-900">ユーザープロファイル</h2>
                  <p className="text-secondary-600">AIイラスト生成のための個人情報を設定</p>
                </div>
              </div>
              
               {/* 自動保存のため編集ボタンを非表示に */}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Validation Error Display */}
            {validationError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">入力エラー</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{validationError}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reference Image */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-3">
                <ImageIcon className="w-4 h-4 inline mr-1" />
                参考画像
              </label>
              
              <div className="flex items-start space-x-4">
                <div className="w-32 h-32 bg-secondary-100 rounded-lg border-2 border-dashed border-secondary-300 flex items-center justify-center overflow-hidden">
                  {formData.referenceImagePath ? (
                    <img 
                      src={`file://${formData.referenceImagePath}`}
                      alt="参考画像"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-8 h-8 text-secondary-400 mx-auto mb-2" />
                      <p className="text-xs text-secondary-500">画像なし</p>
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <p className="text-sm text-secondary-600 mb-3">
                    あなたの写真をアップロードすると、AIがその特徴を参考にしてイラストを生成します。
                  </p>
                  
                  {isEditing && (
                    <button
                      onClick={handleImageUpload}
                      className="btn btn-secondary flex items-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>画像をアップロード</span>
                    </button>
                  )}
                  
                  {formData.referenceImagePath && (
                    <p className="text-xs text-secondary-500 mt-2">
                      {formData.referenceImagePath.split('/').pop()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                自己紹介 <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-secondary-600 mb-3">
                AIがイラストを生成する際の参考になる情報を詳しく入力してください。
                例：性別、年齢、髪型、服装の好み、特徴など
              </p>
              
              {isEditing ? (
                <textarea
                  value={formData.description}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, description: e.target.value }));
                    clearValidationError();
                  }}
                  placeholder="例：25歳の女性、黒髪のロングヘア、カジュアルな服装を好む、メガネをかけている..."
                  rows={6}
                  className="textarea"
                />
              ) : (
                <div className="p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                  <p className="whitespace-pre-wrap text-secondary-700">
                    {profile?.description || '自己紹介が設定されていません'}
                  </p>
                </div>
              )}
            </div>

            {/* Art Style */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-3">
                <Palette className="w-4 h-4 inline mr-1" />
                アートスタイル
              </label>
              
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {artStyles.map(style => (
                    <label
                      key={style.value}
                      className={`cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 ${
                        formData.artStyle === style.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-secondary-200 hover:border-secondary-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="artStyle"
                        value={style.value}
                        checked={formData.artStyle === style.value}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, artStyle: e.target.value as ArtStyle }));
                          clearValidationError();
                        }}
                        className="sr-only"
                      />
                      <div className="font-medium text-secondary-900 mb-1">{style.label}</div>
                      <div className="text-sm text-secondary-600">{style.description}</div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                  <div className="font-medium text-secondary-900">
                    {artStyles.find(s => s.value === profile?.artStyle)?.label || 'アニメ調'}
                  </div>
                  <div className="text-sm text-secondary-600 mt-1">
                    {artStyles.find(s => s.value === profile?.artStyle)?.description || ''}
                  </div>
                </div>
              )}
            </div>

            {/* Quality */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-3">
                画質（表現の精細さ）
              </label>

              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    { value: 'low', label: '低', desc: '速い/粗め' },
                    { value: 'medium', label: '中', desc: 'バランス' },
                    { value: 'high', label: '高', desc: '高精細/時間長め' }
                  ] as const).map(q => (
                    <label
                      key={q.value}
                      className={`cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 ${
                        formData.quality === q.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-secondary-200 hover:border-secondary-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="quality"
                        value={q.value}
                        checked={formData.quality === q.value}
                        onChange={(e) => {
                          const v = e.target.value as 'low' | 'medium' | 'high';
                          setFormData(prev => ({ ...prev, quality: v }));
                          clearValidationError();
                        }}
                        className="sr-only"
                      />
                      <div className="font-medium text-secondary-900 mb-1">{q.label}</div>
                      <div className="text-sm text-secondary-600">{q.desc}</div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                  <div className="font-medium text-secondary-900">
                    {formData.quality === 'low' ? '低' : formData.quality === 'medium' ? '中' : formData.quality === 'high' ? '高' : '未設定'}
                  </div>
                  <div className="text-xs text-secondary-500 mt-1">
                    注: 画質は解像度ではなく表現の精細さを調整します（サイズは別設定）。
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex space-x-3 pt-4 border-t border-secondary-200">
                <button
                  onClick={handleCancel}
                  className="flex-1 btn btn-secondary"
                  disabled={isSaving}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 btn btn-primary flex items-center justify-center space-x-2"
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? '保存中...' : '保存'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        {profile && !isEditing && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4">
              AIイラスト生成プレビュー
            </h3>
            <p className="text-secondary-600 mb-4">
              現在の設定でAIが生成するイラストの例：
            </p>
            <div className="bg-secondary-50 rounded-lg p-8 text-center">
              <div className="w-32 h-32 bg-secondary-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-secondary-400" />
              </div>
              <p className="text-sm text-secondary-500">
                タスク作成時にAIイラストが生成されます
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileView;