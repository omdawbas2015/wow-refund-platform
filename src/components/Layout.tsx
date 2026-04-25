import AppShell from './app-shell/AppShell';

/**
 * Layout wrapper — delegates to the new AppShell.
 * Kept as a separate file to preserve the existing route structure in App.tsx.
 */
export default function Layout() {
  return <AppShell />;
}
