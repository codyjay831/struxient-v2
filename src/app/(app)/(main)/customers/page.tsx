"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, User, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Customer {
  id: string;
  name: string;
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [newCustomerName, setNewCustomerName] = useState("");

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error("Failed to fetch customers");
      const data = await response.json();
      setCustomers(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustomerName.trim() }),
      });

      if (!response.ok) throw new Error("Failed to create customer");
      
      setNewCustomerName("");
      await fetchCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground mt-2">Manage customer accounts and metadata.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Creation Form */}
        <div className="md:col-span-1">
          <Card className="sticky top-8">
            <CardHeader>
              <CardTitle>Create Customer</CardTitle>
              <CardDescription>Add a new customer to your tenant.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Acme Corp"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive font-medium">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={isSubmitting || !newCustomerName.trim()}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create Customer
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Customer List */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>All Customers</CardTitle>
                <CardDescription>Existing customers in your organization.</CardDescription>
              </div>
              <Badge variant="outline">{customers.length} Total</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">Loading customers...</p>
                </div>
              ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                  <User className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground font-medium">No customers found</p>
                  <p className="text-xs text-muted-foreground mt-1">Create your first customer to get started.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {customers.map((customer) => (
                    <div key={customer.id} className="py-4 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold">{customer.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">ID: {customer.id}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div className="hidden sm:block">
                          <p className="text-xs text-muted-foreground">Created</p>
                          <p className="text-sm font-medium">{new Date(customer.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Link href={`/customers/${customer.id}`}>
                          <Button variant="ghost" size="icon">
                            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
