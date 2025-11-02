import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Selector Test",
  description: "Test page for quiz selector component",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background w-full px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </div>
  );
}
