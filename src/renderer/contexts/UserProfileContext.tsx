import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, UserProfileFormData } from '../types';
import { UserProfileSchema, validateAndSanitize } from '../schemas';

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (profileData: UserProfileFormData) => Promise<void>;
  uploadReferenceImage: () => Promise<string | null>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if Electron API is available
      if (!window.electronAPI?.database) {
        console.warn('Electron API not available, using fallback for user profile');
        setProfile(null);
        setLoading(false);
        return;
      }
      
      const result = await window.electronAPI.database.query('SELECT * FROM user_profiles LIMIT 1');
      setProfile(result.length > 0 ? result[0] : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プロファイルの取得に失敗しました');
      console.error('Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData: UserProfileFormData) => {
    try {
      setLoading(true);
      setError(null);
      
      // 入力値検証とサニタイゼーション
      const validatedData = validateAndSanitize(UserProfileSchema, profileData);
      
      const now = new Date().toISOString();
      
      if (profile) {
        // Update existing profile
        await window.electronAPI.database.query(
          'UPDATE user_profiles SET description = ?, referenceImagePath = ?, artStyle = ?, quality = ?, updatedAt = ? WHERE id = ?',
          [validatedData.description, validatedData.referenceImagePath || null, validatedData.artStyle, validatedData.quality || null, now, profile.id]
        );
        
        setProfile(prev => prev ? {
          ...prev,
          description: validatedData.description,
          referenceImagePath: validatedData.referenceImagePath,
          artStyle: validatedData.artStyle,
          quality: validatedData.quality,
          updatedAt: now
        } : null);
      } else {
        // Create new profile
        const result = await window.electronAPI.database.query(
          'INSERT INTO user_profiles (description, referenceImagePath, artStyle, quality, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [validatedData.description, validatedData.referenceImagePath || null, validatedData.artStyle, validatedData.quality || null, now, now]
        );
        
        const newProfile: UserProfile = {
          id: result.lastID,
          description: validatedData.description,
          referenceImagePath: validatedData.referenceImagePath,
          artStyle: validatedData.artStyle,
          quality: validatedData.quality,
          createdAt: now,
          updatedAt: now
        };
        
        setProfile(newProfile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プロファイルの更新に失敗しました');
      console.error('Failed to update user profile:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const uploadReferenceImage = async (): Promise<string | null> => {
    try {
      const result = await window.electronAPI.dialog.openFile([
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
      ]);
      
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像のアップロードに失敗しました');
      console.error('Failed to upload reference image:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const value: UserProfileContextType = {
    profile,
    loading,
    error,
    fetchProfile,
    updateProfile,
    uploadReferenceImage
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};