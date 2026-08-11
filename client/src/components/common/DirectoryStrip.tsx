import { ROLE_DIRECTORY } from '../../types/role';
import { cn } from '../../utils/cn';

const toneByRole: Record<string, string> = {
  customer: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  vendor: 'bg-marigold-100 text-marigold-600 border-marigold-100',
  delivery_partner: 'bg-emerald-100 text-emerald-600 border-emerald-100',
  super_admin: 'bg-slate-100 text-ink-soft border-slate-200',
};

/**
 * The page's signature element: a horizontal "directory board" strip, the
 * kind of role/wing directory you'd see at the entrance of a physical
 * market, translated into four literal account types. It's the one place
 * the four-role architecture is made visible and concrete instead of
 * described in prose — every other page treats a role as a fact about the
 * signed-in user, not a decoration.
 */
export function DirectoryStrip() {
  return (
    <div className="flex flex-wrap gap-3">
      {ROLE_DIRECTORY.map((entry) => (
        <div
          key={entry.role}
          className={cn(
            'flex min-w-[150px] flex-1 items-center gap-3 rounded-md border px-4 py-3',
            toneByRole[entry.role]
          )}
        >
          <span className="font-mono text-xs font-semibold tracking-widest opacity-80">{entry.code}</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{entry.label}</p>
            <p className="text-xs opacity-80">{entry.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
