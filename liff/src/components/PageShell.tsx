import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  title: string;
  children: ReactNode;
  showMemberLink?: boolean;
  leftAlign?: boolean;
}

export function PageShell({
  title,
  children,
  showMemberLink = true,
  leftAlign = true,
}: Props) {
  return (
    <div className="purchase-page app-page">
      <header className={`purchase-header ${leftAlign ? "header-left" : ""}`}>
        <h1 className={`purchase-page-title ${leftAlign ? "title-left" : ""}`}>
          {title}
        </h1>
        {showMemberLink && (
          <Link to="/member" className="member-chip">
            <span className="member-chip-icon">👤</span>
            會員專區
          </Link>
        )}
      </header>
      {children}
    </div>
  );
}
