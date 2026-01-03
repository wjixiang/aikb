import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthUi } from 'auth-ui';
import { DashboardPage } from './pages/dashboard-page';

export function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthUi
            mode={authMode}
            onSuccess={(user) => {
              console.log('Authentication successful:', user);
            }}
          />
        }
      />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}

export default App;
