import Link from 'next/link';
import type { ReactNode } from 'react';

export interface RelatedLink {
  href: string;
  label: string;
  /** Optional tooltip explaining why this page is related. */
  hint?: string;
}

/**
 * A compact, consistent strip of links to pages that are related in the shop
 * workflow (e.g. Transactions → Udhaar Khata). Used on every page so the user
 * can always see how the screen they are on connects to the rest of the shop.
 */
export function RelatedLinks({ links, label = 'Related' }: { links: RelatedLink[]; label?: string }) {
  if (links.length === 0) return null;
  return (
    <nav className="related-links" aria-label="Related pages">
      <span className="related-links__label">{label}:</span>
      {links.map(link => (
        <Link key={link.href} href={link.href} className="related-link" title={link.hint ?? link.label}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Standard page header used by every screen. Keeps the title, subtitle, related
 * links and action buttons visually aligned across the whole app.
 */
export default function PageHeader({
  icon,
  title,
  subtitle,
  related,
  relatedLabel,
  actions,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  related?: RelatedLink[];
  relatedLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">
          {icon ? <span aria-hidden="true" style={{ display: 'flex' }}>{icon}</span> : null}
          <span>{title}</span>
        </h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        {related && related.length > 0 ? <RelatedLinks links={related} label={relatedLabel} /> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
