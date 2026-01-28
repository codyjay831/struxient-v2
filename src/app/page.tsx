import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Struxient
        </h1>
        <p className="max-w-md text-muted-foreground">
          Execution-first operations platform.
        </p>
        
        <div className="flex gap-4">
          <Button asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/sign-up">Sign Up</Link>
          </Button>
        </div>

        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Bootstrap Complete</CardTitle>
            <CardDescription>
              Next.js + shadcn + Prisma + Clerk
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add your Clerk API keys to .env to enable authentication.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
