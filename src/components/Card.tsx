/**
 * A contained metric.
 *
 * The hint is not decoration: a number with no definition gets read as
 * whatever the viewer assumes it means, and "failing" in particular needs to
 * say what it counts before anyone acts on it.
 */
export function Card({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      <h2 className="label">{title}</h2>
      {hint ? <p className="note text-muted mt-1.5">{hint}</p> : null}
      <div className="mt-5 flex-1">{children}</div>
    </section>
  );
}
