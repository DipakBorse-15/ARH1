import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <SEO title="Page Not Found" canonicalPath="/404" />
      <p className="text-6xl">🧵</p>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-stone-900">Page not found</h1>
      <p className="mt-2 text-stone-500">The page you're looking for doesn't exist or may have moved.</p>
      <Link to="/" className="mt-6 rounded-full bg-rose-900 px-6 py-3 text-sm font-semibold text-white">
        Back to Home
      </Link>
    </div>
  );
}
