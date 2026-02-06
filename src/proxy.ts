import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only protect the marketing surface (homepage and potential marketing subroutes)
const isMarketingRoute = createRouteMatcher(['/', '/marketing(.*)', '/website(.*)']);
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/health(.*)']);

export default clerkMiddleware(async (auth, request) => {
  // Gate ONLY the marketing surface; ignore application routes (e.g. /workstation)
  if (isMarketingRoute(request) && !isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
