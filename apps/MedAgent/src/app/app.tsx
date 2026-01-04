import { Route, Routes } from 'react-router-dom';
import { AuthUi, AuthProvider } from 'auth-ui';
import { Dashboard } from './pages/dashboard';

export function App() {

  return (
    
      <Routes>
        <Route
          path="/auth"
          element={
            <AuthUi
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
