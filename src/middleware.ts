import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only protect the marketing surface (homepage and potential marketing subroutes)
const isMarketingRoute = createRouteMatcher(['/', '/marketing(.*)', '/website(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (isMarketingRoute(request)) {
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
