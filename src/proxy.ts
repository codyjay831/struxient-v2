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
    // Restricted to marketing surface only to prevent drift into app routes
    '/',
    '/marketing(.*)',
    '/website(.*)',
  ],
};
