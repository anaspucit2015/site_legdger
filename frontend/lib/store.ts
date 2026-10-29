'use client';
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';
import networkReducer from './features/networkSlice';
import { syncMiddleware } from './syncMiddleware';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    network: networkReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware, syncMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
