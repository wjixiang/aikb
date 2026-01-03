# Auth Frontend

This is the authentication frontend application that provides login and signup functionality.

## Features

- User login with email and password
- User registration with email, password, and optional name
- JWT token-based authentication
- Protected dashboard page
- Form validation and error handling
- Seamless switching between login and signup modes

## Architecture

The authentication components are refactored into the `auth-ui` library:

- **auth-ui library** ([`libs/auth-ui/src/lib/auth-ui.tsx`](libs/auth-ui/src/lib/auth-ui.tsx:1)) - Reusable authentication component with built-in mode switching
- **ui library** ([`libs/ui/src/components/login-form.tsx`](libs/ui/src/components/login-form.tsx:1), [`libs/ui/src/components/signup-form.tsx`](libs/ui/src/components/signup-form.tsx:1)) - Form UI components

## API Endpoints

The frontend communicates with auth-service backend:

- **POST** `/api/auth/login` - User login
- **POST** `/api/auth/register` - User registration

## Configuration

### Backend URL

The API base URL is configured via the `apiBaseUrl` prop in [`AuthUi`](libs/auth-ui/src/lib/auth-ui.tsx:11) component:

```typescript
<AuthUi mode="login" apiBaseUrl="http://localhost:3005/api" />
```

Default: `http://localhost:3005/api`

### Environment Variables

The backend service requires the following environment variables (configured in `.env`):

- `AUTH_DATABASE_URL` - PostgreSQL connection string for auth database
- `JWT_SECRET` - Secret key for JWT access tokens
- `JWT_REFRESH_SECRET` - Secret key for JWT refresh tokens

## Running the Application

### Start the Backend (auth-service)

```bash
nx serve auth-service
```

The auth-service will be available at `http://localhost:3005/api`

### Start the Frontend (auth-fe)

```bash
nx serve auth-fe
```

The frontend will be available at `http://localhost:8000`

## Authentication Flow

1. **Registration**: User fills out the signup form → POST to `/api/auth/register` → Store tokens in localStorage → Redirect to dashboard
2. **Login**: User fills out the login form → POST to `/api/auth/login` → Store tokens in localStorage → Redirect to dashboard
3. **Logout**: Clear tokens from localStorage → Redirect to login page
4. **Mode Switching**: Users can switch between login and signup modes without page reload

## Page Components

- [`DashboardPage`](apps/auth-fe/src/app/pages/dashboard-page.tsx:1) (`/dashboard`) - Protected dashboard (requires authentication)
- [`App`](apps/auth-fe/src/app/app.tsx:1) (`/`) - Main route with AuthUi component

## AuthUi Component

The [`AuthUi`](libs/auth-ui/src/lib/auth-ui.tsx:7) component provides a unified authentication interface with built-in mode switching:

```typescript
interface AuthUiProps {
  mode?: 'login' | 'signup';
  apiBaseUrl?: string;
  onSuccess?: (user: { id: string; email: string; name?: string }) => void;
}
```

### Usage Examples

```typescript
// Login mode (default)
<AuthUi mode="login" />

// Signup mode
<AuthUi mode="signup" />

// With custom API URL and success callback
<AuthUi
  mode="login"
  apiBaseUrl="https://api.example.com/api"
  onSuccess={(user) => console.log('Logged in as', user)}
/>
```

### Features

- **Mode Switching**: Users can toggle between login and signup forms without page navigation
- **Error Handling**: Displays error messages from API responses
- **Loading States**: Shows loading indicators during API calls
- **Token Storage**: Automatically stores JWT tokens in localStorage
- **Auto Navigation**: Redirects to dashboard on successful authentication

## Form Components

The forms are located in the `ui` library:

- [`LoginForm`](libs/ui/src/components/login-form.tsx:14) - Login form component with validation
- [`SignupForm`](libs/ui/src/components/signup-form.tsx:17) - Registration form component with validation

Both forms support:

- `onSubmit` - Form submission handler
- `error` - Error message to display
- `isLoading` - Loading state for submit button
- `onToggleMode` - Callback for switching between login/signup modes
