"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintLabelButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer className="mr-1 h-4 w-4" /> Print label
    </Button>
  );
}