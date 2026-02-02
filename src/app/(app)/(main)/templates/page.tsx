"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2Icon,
  RefreshCwIcon,
  DownloadIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  LayoutTemplateIcon,
  TagIcon,
} from "lucide-react";

interface Template {
  id: string;
  tradeKey: string;
  category: string;
  name: string;
  description: string | null;
  version: number;
  tags: string[];
}

interface TemplatesResponse {
  templates: Template[];
  trades: string[];
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [trades, setTrades] = useState<string[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importTarget, setImportTarget] = useState<Template | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const tradeParam = selectedTrade !== "all" ? `?trade=${selectedTrade}` : "";
      const response = await fetch(`/api/flowspec/templates${tradeParam}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch templates");
      }

      setTemplates(data.templates || []);
      setTrades(data.trades || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch templates");
    } finally {
      setIsLoading(false);
    }
  }, [selectedTrade]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleImport = async () => {
    if (!importTarget) return;

    setIsImporting(true);
    try {
      const response = await fetch(`/api/flowspec/templates/${importTarget.id}/import`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to import template");
      }

      // Navigate to the new workflow
      router.push(`/flowspec/${data.workflowId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import template");
    } finally {
      setIsImporting(false);
      setImportTarget(null);
    }
  };

  // Group templates by category
  const groupedTemplates = templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, Template[]>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Library</h1>
          <p className="text-muted-foreground mt-1">
            Pre-built workflow templates ready to import into your workspace
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            className="w-48 h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">All Trades</option>
            {trades.map((trade) => (
              <option key={trade} value={trade}>
                {trade}
              </option>
            ))}
          </select>
          <Button variant="outline" size="icon" onClick={fetchTemplates} disabled={isLoading}>
            <RefreshCwIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircleIcon className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <LayoutTemplateIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No templates available</h3>
              <p className="text-muted-foreground">
                {selectedTrade !== "all"
                  ? "No templates found for this trade. Try selecting a different trade."
                  : "Templates will appear here when they are added to the system."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
            <div key={category}>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <TagIcon className="h-5 w-5 text-muted-foreground" />
                {category}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setImportTarget(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {template.tradeKey} • v{template.version}
                          </CardDescription>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      {template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {template.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Confirmation Dialog */}
      <Dialog open={!!importTarget} onOpenChange={(open) => !open && setImportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Template</DialogTitle>
            <DialogDescription>
              Import "{importTarget?.name}" into your workspace? This will create a new workflow in
              DRAFT status that you can customize and publish.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-2">{importTarget?.name}</h4>
              <p className="text-sm text-muted-foreground">
                Trade: {importTarget?.tradeKey} • Category: {importTarget?.category}
              </p>
              {importTarget?.description && (
                <p className="text-sm text-muted-foreground mt-2">{importTarget?.description}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportTarget(null)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Import to Workspace
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
