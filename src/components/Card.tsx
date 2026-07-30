/**
 * A contained metric: a header block, a rule, then the figure.
 *
 * The rule is doing real work. Title, description and content were all the
 * same uppercase mono at nearly the same weight, so a card read as one
 * undifferentiated paragraph with a chart stuck to the bottom of it.
 *
 * The hint is not decoration either: a number with no definition gets read as
 * whatever the viewer assumes, and "failing" in particular needs to say what
 * it counts before anyone acts on it. It stays short — a paragraph of
 * uppercase is a wall.
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
    <section className={`panel flex flex-col overflow-hidden p-0 ${className}`}>
      <header className="border-line border-b px-5 py-4">
        <h2 className="label text-ink font-medium">{title}</h2>
        {hint ? <p className="label text-muted mt-1.5">{hint}</p> : null}
      </header>
      <div className="flex flex-1 flex-col justify-center p-5">{children}</div>
    </section>
  );
}
