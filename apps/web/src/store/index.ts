import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';
import type {
  CalendarState, CalendarView, CalendarFilters,
  Employee, Schedule, Shift, SchedulingRule,
  CopilotConversation, CopilotMessage,
  UUID, ISODate,
} from '@/types';
import { addDays, addMonths } from 'date-fns';
import { todayISO, toISODate, parseISODate } from '@/lib/dates';

// ============================================================
// CALENDAR STORE
// ============================================================

interface CalendarStore extends CalendarState {
  setView: (view: CalendarView) => void;
  setCurrentDate: (date: ISODate) => void;
  navigate: (direction: 'prev' | 'next' | 'today') => void;
  selectShift: (id: UUID, multiSelect?: boolean) => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<CalendarFilters>) => void;
  toggleCoverageOverlay: () => void;
  setHighlightedEmployee: (id: UUID | undefined) => void;
}

function navigateDate(date: ISODate, view: CalendarView, direction: 'prev' | 'next'): ISODate {
  const d = parseISODate(date);
  const delta = direction === 'next' ? 1 : -1;
  if (view === 'month') return toISODate(addMonths(d, delta));
  const days = view === 'day' || view === 'staff_timeline' ? 1 : 7;
  return toISODate(addDays(d, delta * days));
}

export const useCalendarStore = create<CalendarStore>()(
  devtools(
    immer((set, get) => ({
      view: 'week',
      currentDate: todayISO(),
      selectedShiftIds: [],
      showWeekends: true,
      showCoverageOverlay: false,
      filters: {},

      setView: (view) => set((s) => { s.view = view; }),
      setCurrentDate: (date) => set((s) => { s.currentDate = date; }),

      navigate: (direction) => set((s) => {
        if (direction === 'today') {
          s.currentDate = todayISO();
        } else {
          s.currentDate = navigateDate(s.currentDate, s.view, direction);
        }
      }),

      selectShift: (id, multiSelect) => set((s) => {
        if (multiSelect) {
          const idx = s.selectedShiftIds.indexOf(id);
          if (idx >= 0) s.selectedShiftIds.splice(idx, 1);
          else s.selectedShiftIds.push(id);
        } else {
          s.selectedShiftIds = s.selectedShiftIds[0] === id && s.selectedShiftIds.length === 1 ? [] : [id];
        }
      }),

      clearSelection: () => set((s) => { s.selectedShiftIds = []; }),

      setFilters: (filters) => set((s) => {
        Object.assign(s.filters, filters);
      }),

      toggleCoverageOverlay: () => set((s) => {
        s.showCoverageOverlay = !s.showCoverageOverlay;
      }),

      setHighlightedEmployee: (id) => set((s) => {
        s.highlightedEmployeeId = id;
      }),
    })),
    { name: 'CalendarStore' }
  )
);

// ============================================================
// APP STORE (global UI state)
// ============================================================

// ── Toast types ───────────────────────────────────────────────────────────────
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface AppStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  // The slide-out menu on phones and small tablets.
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  copilotOpen: boolean;
  toggleCopilot: () => void;
  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  // Shifts cached across route changes so deletions survive navigation
  cachedShifts: Shift[];
  cachedWeekKey: string | null;
  setCachedShifts: (weekKey: string, shifts: Shift[]) => void;
  addCachedShift: (shift: Shift) => void;
  updateCachedShift: (id: UUID, patch: Partial<Shift>) => void;
  removeCachedShift: (id: UUID) => void;
}

export const useAppStore = create<AppStore>()(
  devtools(
    immer((set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => { s.sidebarCollapsed = !s.sidebarCollapsed; }),
      mobileNavOpen: false,
      setMobileNavOpen: (open) => set((s) => { s.mobileNavOpen = open; }),
      copilotOpen: false,
      toggleCopilot: () => set((s) => { s.copilotOpen = !s.copilotOpen; }),
      toasts: [],
      addToast: (toast) => set((s) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        s.toasts.push({ ...toast, id });
      }),
      removeToast: (id) => set((s) => { s.toasts = s.toasts.filter(t => t.id !== id); }),
      cachedShifts: [],
      cachedWeekKey: null,
      setCachedShifts: (weekKey, shifts) => set((s) => { s.cachedWeekKey = weekKey; s.cachedShifts = shifts; }),
      addCachedShift: (shift) => set((s) => { s.cachedShifts.push(shift); }),
      updateCachedShift: (id, patch) => set((s) => {
        const idx = s.cachedShifts.findIndex(sh => sh.id === id);
        if (idx >= 0) Object.assign(s.cachedShifts[idx], patch);
      }),
      removeCachedShift: (id) => set((s) => { s.cachedShifts = s.cachedShifts.filter(sh => sh.id !== id); }),
    })),
    { name: 'AppStore' }
  )
);

// ============================================================
// COPILOT STORE
// ============================================================

interface CopilotStore {
  conversations: CopilotConversation[];
  activeConversationId: UUID | null;
  isStreaming: boolean;
  setActiveConversation: (id: UUID | null) => void;
  addMessage: (conversationId: UUID, message: CopilotMessage) => void;
  appendStreamChunk: (conversationId: UUID, messageId: string, chunk: string) => void;
  finishStreaming: (conversationId: UUID, messageId: string) => void;
  createConversation: (conv: CopilotConversation) => void;
  setStreaming: (streaming: boolean) => void;
}

export const useCopilotStore = create<CopilotStore>()(
  devtools(
    immer((set) => ({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,

      setActiveConversation: (id) => set((s) => { s.activeConversationId = id; }),

      createConversation: (conv) => set((s) => {
        s.conversations.unshift(conv);
        s.activeConversationId = conv.id;
      }),

      addMessage: (conversationId, message) => set((s) => {
        const conv = s.conversations.find((c) => c.id === conversationId);
        if (conv) conv.messages.push(message);
      }),

      appendStreamChunk: (conversationId, messageId, chunk) => set((s) => {
        const conv = s.conversations.find((c) => c.id === conversationId);
        if (conv) {
          const msg = conv.messages.find((m) => m.id === messageId);
          if (msg) msg.content += chunk;
        }
      }),

      finishStreaming: (conversationId, messageId) => set((s) => {
        const conv = s.conversations.find((c) => c.id === conversationId);
        if (conv) {
          const msg = conv.messages.find((m) => m.id === messageId);
          if (msg) msg.isStreaming = false;
        }
        s.isStreaming = false;
      }),

      setStreaming: (streaming) => set((s) => { s.isStreaming = streaming; }),
    })),
    { name: 'CopilotStore' }
  )
);

// ============================================================
// RULES STORE (persisted to localStorage per org)
// ============================================================

interface RulesStore {
  orgId: string | null;
  rules: SchedulingRule[];
  setOrgRules: (orgId: string, rules: SchedulingRule[]) => void;
  addRule: (rule: SchedulingRule) => void;
  toggleRule: (id: UUID) => void;
  updateRule: (id: UUID, patch: Partial<SchedulingRule>) => void;
  deleteRule: (id: UUID) => void;
}

export const useRulesStore = create<RulesStore>()(
  devtools(
    immer((set) => ({
      orgId: null,
      rules: [],

      setOrgRules: (orgId, rules) => set((s) => {
        s.orgId = orgId;
        s.rules = rules as any;
      }),

      addRule: (rule) => set((s) => { s.rules.push(rule as any); }),

      toggleRule: (id) => set((s) => {
        const r = s.rules.find(r => r.id === id);
        if (r) r.isEnabled = !r.isEnabled;
      }),

      updateRule: (id, patch) => set((s) => {
        const r = s.rules.find(r => r.id === id);
        if (r) Object.assign(r, patch);
      }),

      deleteRule: (id) => set((s) => {
        s.rules = s.rules.filter(r => r.id !== id);
      }),
    })),
    { name: 'RulesStore' }
  )
);
