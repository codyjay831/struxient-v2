/**
 * FlowSpec Workflow Detail Layout
 * 
 * Full-bleed layout for the canvas builder.
 * Parent layout conditionally bypasses container padding for this route.
 */
export default function WorkflowDetailLayout({
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
