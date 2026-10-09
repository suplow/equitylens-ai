import { Database, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { number } from "@/lib/format";
import { sourceNote } from "@/lib/data/mock-provider";
export function SourceNote() {
  return (
    <p className="source-note">
      <Database size={12} aria-hidden="true" />
      {sourceNote}
    </p>
  );
}
export function Change({ value }: { value: number }) {
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={value >= 0 ? "change positive" : "change negative"}>
      <Icon size={14} aria-hidden="true" />
      {value > 0 ? "+" : ""}
      {number(value, 2)}%
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function MockBadge() {
  return <span className="badge mock-badge">MOCK</span>;
}
