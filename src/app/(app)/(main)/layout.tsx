/**
 * Main Layout - Container wrapper for standard pages
 * 
 * Applies container padding for normal pages (workstation, customers, etc.)
 * Pages that need edge-to-edge canvas should be in (fullbleed) instead.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto p-6 md:p-8">
      {children}
    </div>
  );
}
