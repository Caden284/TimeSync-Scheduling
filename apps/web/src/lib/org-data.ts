'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuth } from '@/context/auth-context';
import { getOrg, getDepartments, getLocations, getWorkerTypes, getTaskTypes } from './db';
import type { TaskType, WorkerType } from '@/types';

// The signed-in user's organization, departments, locations, worker types and
// tasks, loaded once from the database and shared by every page.

interface OrgDataState {
  orgId: string | null;
  org: any | null;
  departments: any[];
  locations: any[];
  workerTypes: WorkerType[];
  taskTypes: TaskType[];
  loading: boolean;
  error: string | null;
  load: (orgId: string, force?: boolean) => Promise<void>;
}

export const useOrgDataStore = create<OrgDataState>((set, get) => ({
  orgId: null,
  org: null,
  departments: [],
  locations: [],
  workerTypes: [],
  taskTypes: [],
  loading: false,
  error: null,
  load: async (orgId, force = false) => {
    const s = get();
    if (!force && (s.loading || s.orgId === orgId)) return;
    set({ loading: true, error: null, orgId });
    try {
      const [org, departments, locations, workerTypes, taskTypes] = await Promise.all([
        getOrg(orgId), getDepartments(orgId), getLocations(orgId),
        // Optional until the tasks migration is applied.
        getWorkerTypes(orgId).catch(() => [] as WorkerType[]),
        getTaskTypes(orgId).catch(() => [] as TaskType[]),
      ]);
      set({ org, departments, locations, workerTypes, taskTypes, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load organization' });
    }
  },
}));

export function useOrgData() {
  const { profile } = useAuth();
  const state = useOrgDataStore();
  useEffect(() => {
    if (profile?.orgId) state.load(profile.orgId);
  }, [profile?.orgId]);
  return {
    ...state,
    refresh: () => (profile?.orgId ? state.load(profile.orgId, true) : Promise.resolve()),
  };
}
