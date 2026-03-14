// src/store/messenger/createUISlice.ts

import type { MessengerSlice, UISlice } from './messenger.store.types';

export const createUISlice: MessengerSlice<UISlice> = (set) => ({
    loading: false,
    error: null,
    isSidebarOpen: true,

    setError: (error) => set({ error }, false, 'setError'),
    setLoading: (loading) => set({ loading }, false, 'setLoading'),
    setSidebarOpen: (open) => set({ isSidebarOpen: open }, false, 'setSidebarOpen'),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen }), false, 'toggleSidebar'),
});
