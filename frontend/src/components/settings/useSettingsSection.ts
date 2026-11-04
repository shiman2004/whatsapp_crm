import { useState, useEffect, useCallback, useRef } from 'react';
import { SettingApiResponse } from './types';
import { API_BASE_URL } from '../../config/api';

interface UseSettingsSectionOptions<T> {
  sectionId: string;
  scope?: 'global' | 'company' | 'user';
  companyId?: string;
  initialData?: T;
}

export function useSettingsSection<T extends Record<string, any>>({
  sectionId,
  scope = 'global',
  companyId = 'ALL',
  initialData
}: UseSettingsSectionOptions<T>) {
  const [data, setData] = useState<T>((initialData || {}) as T);
  const [serverData, setServerData] = useState<T>((initialData || {}) as T);
  const [version, setVersion] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  
  const [conflictState, setConflictState] = useState<{
    isOpen: boolean;
    serverVersion: number;
    onReload: () => void;
    onDismiss: () => void;
  } | undefined>(undefined);

  const getAuthToken = () => {
    return (
      localStorage.getItem('rw_crm_auth_token') ||
      localStorage.getItem('royal_crm_token') ||
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token') ||
      ''
    );
  };

  const getEndpoint = useCallback(() => {
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    if (scope === 'user') {
      return `${base}/api/users/me/preferences`;
    }
    if (scope === 'company' && companyId && companyId !== 'ALL') {
      return `${base}/api/companies/${companyId}/settings/${sectionId}`;
    }
    return `${base}/api/settings/${sectionId}`;
  }, [sectionId, scope, companyId]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = getEndpoint();
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(endpoint, {
        headers
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Fallback gracefully without showing raw HTML parser error
        console.warn(`Settings endpoint ${endpoint} returned non-JSON response (${res.status}).`);
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Failed to load ${sectionId} settings (${res.status})`);
      }

      const json: SettingApiResponse<T> = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setServerData(json.data);
        setVersion(json.version);
        setIsDirty(false);
      }
    } catch (err: any) {
      console.warn(`Error loading settings for ${sectionId}:`, err);
      // Suppress raw parser alert; allow fallback defaults
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [getEndpoint, sectionId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateField = <K extends keyof T>(field: K, val: T[K]) => {
    setData(prev => {
      const next = { ...prev, [field]: val };
      setIsDirty(JSON.stringify(next) !== JSON.stringify(serverData));
      return next;
    });
  };

  const saveSettings = async (): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const endpoint = getEndpoint();
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(endpoint, {
        method: scope === 'user' ? 'PATCH' : 'PUT',
        headers,
        body: JSON.stringify({
          version,
          data
        })
      });

      if (res.status === 409) {
        const conflictRes: SettingApiResponse<T> = await res.json().catch(() => ({}) as any);
        setConflictState({
          isOpen: true,
          serverVersion: conflictRes.currentVersion || (version + 1),
          onReload: () => {
            setConflictState(undefined);
            loadSettings();
          },
          onDismiss: () => {
            setConflictState(undefined);
          }
        });
        return false;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Save failed (${res.status})`);
      }

      const result: SettingApiResponse<T> = await res.json();
      if (result.success) {
        setData(result.data);
        setServerData(result.data);
        setVersion(result.version);
        setIsDirty(false);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(`Error saving settings for ${sectionId}:`, err);
      setError(err.message || 'Error saving settings');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    setData(serverData);
    setIsDirty(false);
  };

  return {
    data,
    setData,
    updateField,
    version,
    isLoading,
    isSaving,
    isDirty,
    error,
    saveSettings,
    discardChanges,
    reload: loadSettings,
    conflictState
  };
}
