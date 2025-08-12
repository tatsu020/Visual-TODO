import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';

interface StepCreationFormProps {
  onAdd: (stepTitle: string) => void;
  existingTitles?: string[];
  onRequestCollapse?: () => void; // Ctrl+Enter で親に折りたたみを要求
}

export const StepCreationForm: React.FC<StepCreationFormProps> = ({ onAdd, existingTitles = [], onRequestCollapse }) => {
  // 常時表示に寄せるため、デフォルトで入力を開いた状態
  const [isAdding, setIsAdding] = useState(true);
  const [stepTitle, setStepTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addSingle = (titleRaw: string) => {
    const title = titleRaw.trim();
    if (!title) return;
    onAdd(title);
  };

  const handleAdd = () => {
    const title = stepTitle.trim();
    if (!title) return;
    addSingle(title);
    setStepTitle('');
    // 入力は閉じず、フォーカスを維持
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleCancel = () => {
    setStepTitle('');
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={stepTitle}
          onChange={(e) => setStepTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              handleCancel();
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              // Ctrl+Enter で折りたたみ要求
              e.preventDefault();
              onRequestCollapse?.();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (!text || (!text.includes('\n') && !text.includes('\r'))) return;
            e.preventDefault();
            // 既存タイトル（小文字）で重複除去
            const existing = new Set(existingTitles.map(t => t.trim().toLowerCase()).filter(Boolean));
            const lines = text
              .replace(/\r\n?/g, '\n')
              .split('\n')
              .map(l => l.trim())
              .filter(l => l.length > 0);
            const seen = new Set<string>();
            for (const line of lines) {
              const key = line.toLowerCase();
              if (seen.has(key)) continue; // 貼り付け内の重複除去
              if (existing.has(key)) continue; // 既存との重複除去
              seen.add(key);
              addSingle(line);
            }
            setStepTitle('');
            requestAnimationFrame(() => {
              inputRef.current?.focus();
            });
          }}
          placeholder="ステップの内容を入力..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
          ref={inputRef}
          maxLength={100}
        />
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!stepTitle.trim()}
            className="px-3 py-1 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            追加
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsAdding(true)}
      className="w-full py-2 border border-dashed border-gray-300 rounded text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center space-x-1"
    >
      <Plus className="w-4 h-4" />
      <span>ステップを追加</span>
    </button>
  );
};

export default StepCreationForm;