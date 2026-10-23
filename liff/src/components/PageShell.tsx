import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SITE_BRAND_TITLE } from "../lib/siteBrand";

interface Props {
  title: string;
  children: ReactNode;
  showMemberLink?: boolean;
  leftAlign?: boolean;
  headerAction?: ReactNode;
}

export function PageShell({
  title,
  children,
  showMemberLink = true,
  leftAlign = true,
  headerAction,
}: Props) {
  return (
    <div className="purchase-page app-page">
      <p className="site-brand-title">{SITE_BRAND_TITLE}</p>
      <header className={`purchase-header ${leftAlign ? "header-left" : ""}`}>
        <h1 className={`purchase-page-title ${leftAlign ? "title-left" : ""}`}>
          {title}
        </h1>
        <div className="purchase-header-actions">
          {headerAction}
          {showMemberLink && (
            <Link to="/member" className="member-chip">
              <span className="member-chip-icon">👤</span>
              會員專區
            </Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
