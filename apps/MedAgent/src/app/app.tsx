import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthUi } from 'auth-ui';
import { Dashboard } from './pages/dashboard';

export function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <AuthUi
            mode={authMode}
            onSuccess={(user) => {
              console.log('Authentication successful:', user);
            }}
          />
        }
      />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/" element={<Dashboard />} />
    </Routes>
  );
}

export default App;
