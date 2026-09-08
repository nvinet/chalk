import AppTabs from '@/components/app-tabs';

/**
 * The five tabs. A route group, so it adds nothing to the URL — the root
 * layout is a Stack, which is what lets a session open full-screen over the
 * tabs rather than inside one.
 */
export default function TabsLayout() {
  return <AppTabs />;
}
