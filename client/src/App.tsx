import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { store } from './store';
import { useAppDispatch } from './hooks/useAppStore';
import { bootstrapSession } from './features/auth/authSlice';
import { router } from './routes/router';

function SessionBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Attempts a silent refresh from the httpOnly cookie so a page reload
    // doesn't drop the user's session just because the in-memory access
    // token is gone. A failure here just means "not logged in."
    dispatch(bootstrapSession());
  }, [dispatch]);

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <Provider store={store}>
      <SessionBootstrap />
    </Provider>
  );
}
