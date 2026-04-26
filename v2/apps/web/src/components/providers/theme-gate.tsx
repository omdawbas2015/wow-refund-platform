'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

/**
 * Client-side guard that forces light mode whenever the `feature.dark_mode`
 * flag is disabled (admins toggle it via /admin/settings). When dark mode
 * is enabled, this component is a passthrough — the existing root
 * <ThemeProvider> + the top-bar toggle continue to drive the theme.
 *
 * Wrapped at the dashboard layout level so the rule applies to every
 * authenticated page; auth pages use the root ThemeProvider directly.
 */
export function ThemeGate({
  darkModeEnabled,
  children,
}: {
  darkModeEnabled: boolean;
  children: React.ReactNode;
}) {
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (!darkModeEnabled && resolvedTheme === 'dark') {
      setTheme('light');
    }
  }, [darkModeEnabled, resolvedTheme, setTheme]);

  return <>{children}</>;
}
