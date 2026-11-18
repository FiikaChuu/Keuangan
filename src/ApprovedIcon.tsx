import './approved-icons.css';

export type ApprovedIconName = 'expense' | 'income' | 'transfer' | 'reports' | 'home' | 'wallet' | 'activity' | 'settings';

/** Approved transparent artwork; the surrounding control provides its accessible name. */
export function ApprovedIcon({ name, navigation = false }: { name: ApprovedIconName; navigation?: boolean }) {
  return (
    <span className={`approved-icon-slot${navigation ? ' approved-icon-slot--nav' : ''}`} aria-hidden="true">
      <img src={`/icons/3d-v2/${navigation ? `nav-${name}` : name}.webp`} alt="" width={navigation ? 32 : 52} height={navigation ? 32 : 52} loading="eager" decoding="async" />
    </span>
  );
}
