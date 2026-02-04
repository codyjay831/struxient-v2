"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Activity } from "lucide-react";

interface DetourRow {
  id: string;
  checkpointNodeId: string;
  resumeTargetNodeId: string;
  type: string;
  status: string;
  repeatIndex: number;
  openedAt: string;
}

export function DetourDebugPanel({ flowId }: { flowId?: string }) {
  const [detours, setDetours] = useState<DetourRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDetours = async () => {
    if (!flowId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/flowspec/flows/${flowId}/debug/detours`);
      const data = await res.json();
      setDetours(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetours();
  }, [flowId]);

  const copyAsText = () => {
    const text = detours.map(d => 
      `Detour ${d.id} [${d.status}] - Checkpoint: ${d.checkpointNodeId}, Resume: ${d.resumeTargetNodeId}, Type: ${d.type}, Repeat: ${d.repeatIndex}`
    ).join("\n");
    navigator.clipboard.writeText(text);
  };

  if (!flowId) return null;

  return (
    <Card className="mt-8 border-dashed bg-muted/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Detour Debug Panel</CardTitle>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchDetours} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={copyAsText}>
            <Copy className="mr-2 h-4 w-4" />
            Copy as Text
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {detours.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No detours for this flow.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Checkpoint</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead>Opened At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detours.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-[10px]">{d.id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <Badge variant={d.status === 'ACTIVE' ? 'default' : 'secondary'}>{d.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{d.checkpointNodeId}</TableCell>
                  <TableCell className="text-xs">{d.resumeTargetNodeId}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(d.openedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
