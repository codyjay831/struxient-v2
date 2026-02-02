/**
 * Full-Bleed Layout - No container padding
 * 
 * For routes that need edge-to-edge canvas rendering (FlowSpec builder, etc.)
 * Children fill the entire main content area without container constraints.
 */
export default function FullBleedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {children}
    </div>
  );
}
