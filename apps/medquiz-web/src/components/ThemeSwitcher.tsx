'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex items-center justify-center p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition duration-300 ease-in-out"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-5 h-5" />
          {/* light */}
        </>
      ) : (
        <>
          <Moon className="w-5 h-5" />
          {/* Switch to dark mode */}
        </>
      )}
    </button>
  );
};

export default ThemeSwitcher;
