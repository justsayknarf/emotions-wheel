import { AdminThemeSelector } from '../components/AdminThemeSelector';
import { AdminThemeInspector } from '../components/AdminThemeInspector';

// Picker up top, then a live readout of exactly what the selected theme sets
// — every --ui-* token and shader stop, not just its swatch chip.
export function ThemesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', minHeight: 0 }}>
      <AdminThemeSelector />
      <AdminThemeInspector />
    </div>
  );
}
