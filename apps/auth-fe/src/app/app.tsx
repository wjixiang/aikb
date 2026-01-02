import NxWelcome from './nx-welcome';

import { Route, Routes, Link } from 'react-router-dom';
import { LoginForm } from 'ui/blocks/login-form';
import { SignupForm } from 'ui/blocks/signup-form';

export function App() {
  return (
    <div className="">

      {/* <LoginForm /> */}
      <Routes>
        <Route path="" element={<LoginForm />}/>
        <Route path="/signup" element={<SignupForm />}/>
      </Routes>
    </div>
  );
}

export default App;
