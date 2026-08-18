import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/useAppStore';
import { bootstrapSession } from './features/auth/authSlice';
import { fetchWishlist } from './features/wishlist/wishlistSlice';
import { router } from './routes/router';

function SessionBootstrap() {
  const dispatch = useAppDispatch();
  const { status: authStatus, user } = useAppSelector((s) => s.auth);
  const wishlistStatus = useAppSelector((s) => s.wishlist.status);

  useEffect(() => {
    // Attempts a silent refresh from the httpOnly cookie so a page reload
    // doesn't drop the user's session just because the in-memory access
    // token is gone. A failure here just means "not logged in."
    dispatch(bootstrapSession());
  }, [dispatch]);

  useEffect(() => {
    // Covers both paths that establish a customer session — the silent
    // bootstrap above and a fresh interactive login — with one effect
    // rather than dispatching fetchWishlist from two separate places.
    if (authStatus === 'authenticated' && user?.role === 'customer' && wishlistStatus === 'idle') {
      dispatch(fetchWishlist());
    }
  }, [authStatus, user?.role, wishlistStatus, dispatch]);

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <Provider store={store}>
      <SessionBootstrap />
    </Provider>
  );
}
