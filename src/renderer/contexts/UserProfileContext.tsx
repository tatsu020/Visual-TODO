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
      if (!window.electronAPI.userProfile) {
        console.warn('Electron API not available, using fallback for user profile');
        setProfile(null);
        setLoading(false);
        return;
      }
      
      const result = await window.electronAPI.userProfile.get();
      setProfile(result?.success ? (result.profile || null) : null);
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
      const normalizedQuality = validatedData.quality ?? undefined;

      const now = new Date().toISOString();
      
      await window.electronAPI.userProfile.save({
        description: validatedData.description,
        referenceImagePath: validatedData.referenceImagePath || null,
        artStyle: validatedData.artStyle,
        quality: normalizedQuality ?? null,
        createdAt: profile?.createdAt || now,
        updatedAt: now
      });

      setProfile(prev => ({
        id: prev?.id,
        description: validatedData.description,
        referenceImagePath: validatedData.referenceImagePath,
        artStyle: validatedData.artStyle,
        quality: normalizedQuality,
        createdAt: prev?.createdAt || now,
        updatedAt: now
      }));
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
