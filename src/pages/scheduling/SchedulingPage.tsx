import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import HeadwayOptimizerTab from "./HeadwayOptimizerTab";
import TimeSpaceDiagramTab from "./TimeSpaceDiagramTab";
import LayoverPlannerTab from "./LayoverPlannerTab";
import BlockBuilderTab from "./BlockBuilderTab";

export default function SchedulingPage() {
  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div>
        <h1 className="text-xl font-semibold">Scheduling Tools</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Optimise headways, visualise trip patterns, review layovers, and build vehicle duty blocks.
        </p>
      </div>

      <Tabs defaultValue="headway" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="headway">Headway Optimizer</TabsTrigger>
          <TabsTrigger value="diagram">Time-Space Diagram</TabsTrigger>
          <TabsTrigger value="layover">Layover Planner</TabsTrigger>
          <TabsTrigger value="blocks">Block Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="headway" className="flex-1 mt-4">
          <HeadwayOptimizerTab />
        </TabsContent>

        <TabsContent value="diagram" className="flex-1 mt-4">
          <TimeSpaceDiagramTab />
        </TabsContent>

        <TabsContent value="layover" className="flex-1 mt-4">
          <LayoverPlannerTab />
        </TabsContent>

        <TabsContent value="blocks" className="flex-1 mt-4">
          <BlockBuilderTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
