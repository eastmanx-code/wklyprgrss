/**
 * A contained metric: header, rule, figure.
 *
 * Every value here is from the shared scales — 24px padding, a 16px card
 * title over an 11px subtitle with 8px between them, and a 1px divider with
 * 16px either side. The header sits on a 48px floor so the rules line up
 * across a row rather than stepping with the title length.
 *
 * The hint is not decoration: a number with no definition gets read as
 * whatever the viewer assumes, and "failing" in particular needs to say what
 * it counts before anyone acts on it.
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
      <header className="flex min-h-12 flex-col justify-start">
        <h2 className="card-title">{title}</h2>
        {hint ? <p className="label mt-2">{hint}</p> : null}
      </header>
      <hr className="border-divider my-4 border-0 border-t" />
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}
