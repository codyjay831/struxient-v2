import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <div className="absolute top-8 right-8">
          <UserButton />
        </div>
        
        <h1 className="text-4xl font-semibold tracking-tight">
          Website – Logged In
        </h1>
        <p className="max-w-md text-muted-foreground">
          Welcome to the Struxient marketing surface. This area is protected.
        </p>
        
        <div className="flex gap-4 mt-4">
          <Button asChild variant="outline">
            <Link href="/workstation">Enter Work Station</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
