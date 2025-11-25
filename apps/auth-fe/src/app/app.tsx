import NxWelcome from './nx-welcome';

import { Route, Routes, Link } from 'react-router-dom';
import {LoginForm} from 'ui/blocks/login-form'
export function App() {
  return (
    <div className=''>
     <LoginForm/>
    </div>
  );
}

export default App;
