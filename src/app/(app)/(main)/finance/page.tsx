"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isModuleEnabled } from "@/lib/modules/moduleFlags";
import { redirect } from "next/navigation";
import { Loader2, User, MapPin, Briefcase, ExternalLink, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Job {
  id: string;
  address: string | null;
  createdAt: string;
  customer: {
    name: string;
  };
  flowGroupId: string;
}

export default function FinancePage() {
  // Check if module is enabled
  if (!isModuleEnabled("finance")) {
    redirect("/workstation");
  }

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/jobs");
        const data = await response.json();
        setJobs(data.items || []);
      } catch (err) {
        console.error("Failed to fetch finance jobs", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-8 px-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground mt-2">Read-only projection of active jobs and milestones.</p>
      </div>

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between">
            <CardTitle>Jobs Overview</CardTitle>
            <Badge variant="outline" className="font-mono">{jobs.length} Active</Badge>
          </div>
          <CardDescription>
            Financial lens for tracking revenue-triggering job executions.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Loading job ledger...</p>
            </div>
          ) : jobs.length === 0 ? (
            <Card className="border-dashed bg-muted/20 py-24 text-center">
              <CardContent className="flex flex-col items-center">
                <Briefcase className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-medium">No Active Jobs</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Once jobs are provisioned, they will appear in this financial overview.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Service Address</th>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4 font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-primary/60" />
                            {job.customer.name}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            {job.address || "Pending"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground text-xs">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/jobs/${job.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 text-xs px-2">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Card
                              </Button>
                            </Link>
                            <Link href={`/workstation?lens=jobs&job=${job.flowGroupId}`}>
                              <Button variant="outline" size="sm" className="h-8 text-xs px-2 bg-background">
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                                Work
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
