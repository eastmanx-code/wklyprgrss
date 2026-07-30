/**
 * A contained metric: a header block, a rule, then the figure.
 *
 * The header has a floor height so the rules line up across a row. Without it
 * a card whose hint wraps to two lines pushed its rule 15px below its
 * neighbour's, and a row of cards read as slightly broken rather than as a
 * grid.
 *
 * The hint is not decoration: a number with no definition gets read as
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
      <header className="border-line flex min-h-[5.25rem] flex-col justify-center border-b px-6 py-4">
        <h2 className="label text-ink font-medium">{title}</h2>
        {hint ? <p className="label text-muted mt-1.5">{hint}</p> : null}
      </header>
      <div className="flex flex-1 flex-col justify-start p-6">{children}</div>
    </section>
  );
}
