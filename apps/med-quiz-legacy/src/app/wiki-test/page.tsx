"use client";

import React from "react";
import { WorkSpace } from "@/components/wiki/workspace";

export default function WikiTestPage() {
  return (
    <div className="h-screen w-full bg-background">
      <div className="h-full p-4">
        <WorkSpace
          initialPath="README"
          basePath="/wiki"
          className="h-full border border-border rounded-lg shadow-lg"
        />
      </div>
    </div>
  );
}
