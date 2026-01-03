import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm, LoginFormProps } from 'ui/blocks/login-form';
import { SignupForm, SignupFormProps } from 'ui/blocks/signup-form';
import { useAuth } from './auth-context';

export interface AuthUiProps {
  mode?: 'login' | 'signup';
  apiBaseUrl?: string;
  onSuccess?: (user: { id: string; email: string; name?: string }) => void;
}

export function AuthUi({
  mode: initialMode = 'login',
  // apiBaseUrl = 'http://localhost:3005',
  onSuccess,
}: AuthUiProps) {
  const navigate = useNavigate();
  const { login, signup, loading, setBaseUrl, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [error, setError] = useState<string | null>(null);

  // // Set the baseUrl when component mounts or apiBaseUrl changes
  // useEffect(() => {
  //   setBaseUrl(apiBaseUrl);
  // }, [apiBaseUrl, setBaseUrl]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const result = await login({ email, password });

    if (result.success) {
      // Call onSuccess callback if provided
      if (onSuccess) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        onSuccess(user);
      }

      // Navigate to dashboard or home page
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirm-password') as string;
    const name = formData.get('name') as string;

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const result = await signup({
      name: name,
      email: email,
      password: password,
    })

    if(result.success){
      navigate('/dashboard');
    }else{
      setError('Registration failed');
    }

    // try {
    //   // Note: Signup is not implemented in auth-context yet, so we'll make a direct API call
    //   const response = await fetch(`${apiBaseUrl}/auth/register`, {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({ email, password, name }),
    //   });

    //   if (!response.ok) {
    //     const errorData = await response.json();
    //     throw new Error(errorData.message || 'Registration failed');
    //   }

    //   const data = await response.json();

    //   // Store tokens in localStorage
    //   localStorage.setItem('token', data.accessToken);
    //   localStorage.setItem('user', JSON.stringify(data.user));

    //   // Call onSuccess callback if provided
    //   if (onSuccess) {
    //     onSuccess(data.user);
    //   }

    //   // Navigate to dashboard or home page
    //   navigate('/dashboard');
    // } catch (err) {
    //   setError(err instanceof Error ? err.message : 'Registration failed');
    // }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        {mode === 'login' ? (
          <LoginForm
            onSubmit={handleLogin}
            error={error}
            isLoading={loading}
            onToggleMode={toggleMode}
          />
        ) : (
          <SignupForm
            onSubmit={handleSignup}
            error={error}
            isLoading={loading}
            onToggleMode={toggleMode}
          />
        )}
      </div>
    </div>
  );
}

export default AuthUi;
