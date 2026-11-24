import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const NotFound = () => (
  <div className="mx-auto max-w-lg px-4 py-24 text-center">
    <p className="text-sm font-semibold text-royal">404</p>
    <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
    <p className="mt-3 text-muted">The page you are looking for does not exist or has moved.</p>
    <Button asChild className="mt-8"><Link to="/">Back to home</Link></Button>
  </div>
);
