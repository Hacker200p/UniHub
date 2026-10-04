import { useEffect, useState } from 'react'
import { ThemeContext } from './themeContext.js'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('ush_theme') || 'light')
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('ush_theme', theme) }, [theme])
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((current) => current === 'light' ? 'dark' : 'light') }}>{children}</ThemeContext.Provider>
}
