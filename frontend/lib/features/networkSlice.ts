import { createSlice } from '@reduxjs/toolkit';

// navigator.onLine is only a hint (see useOnlineStatus) — the authoritative
// signal is whether real requests are succeeding, which syncMiddleware feeds
// in via setOnline/setOffline on every fulfilled/FETCH_ERROR action.
const networkSlice = createSlice({
  name: 'network',
  initialState: { isOnline: true },
  reducers: {
    setOnline: (state) => {
      state.isOnline = true;
    },
    setOffline: (state) => {
      state.isOnline = false;
    },
  },
});

export const { setOnline, setOffline } = networkSlice.actions;
export default networkSlice.reducer;
