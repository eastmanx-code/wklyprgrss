import Link from "next/link";

export default function NotFound() {
  return (
    <main className="pt-16">
      <div className="panel text-center">
        <p className="label">Not found</p>
        <h1 className="mt-3 text-metric font-medium">
          That page doesn&apos;t exist
        </h1>
        <Link href="/" className="btn mt-6">
          Start over
        </Link>
      </div>
    </main>
  );
}
