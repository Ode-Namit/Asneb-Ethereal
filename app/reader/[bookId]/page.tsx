"use client";

import dynamic from "next/dynamic";

const PhysicsReader = dynamic(
  () =>
    import("@/components/reader/physics-reader").then(
      (module) => module.PhysicsReader,
    ),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-space text-xs uppercase tracking-[0.2em] text-cyan-300">
        Opening reading sanctuary...
      </main>
    ),
  },
);

export default function ReaderPage({ params }: { params: { bookId: string } }) {
  return <PhysicsReader bookId={params.bookId} />;
}
