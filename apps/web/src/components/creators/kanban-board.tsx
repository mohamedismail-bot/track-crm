"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { CreatorListItem, CreatorCard } from "./creator-card";

export interface KanbanStage {
  id: string;
  name: string;
  order: number;
  isCompleted: boolean;
}

export function KanbanBoard({
  creators,
  stages,
  canMove,
}: {
  creators: CreatorListItem[];
  stages: KanbanStage[];
  canMove: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [stageOverrides, setStageOverrides] = React.useState<
    Record<string, { id: string | null; name: string | null }>
  >({});

  // Merge optimistic overrides with the server-provided list (no sync effect).
  const displayed = React.useMemo(
    () =>
      creators.map((c) => {
        const o = stageOverrides[c.id];
        if (!o) return c;
        return {
          ...c,
          stage: o.id ? { id: o.id, name: o.name ?? "" } : null,
        };
      }),
    [creators, stageOverrides],
  );

  const creatorsByStage = (stageId: string) =>
    displayed.filter((c) => c.stage?.id === stageId);
  const unassigned = displayed.filter((c) => !c.stage);
  const completedStages = stages.filter((s) => s.isCompleted);
  const standardStages = stages.filter((s) => !s.isCompleted);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const targetStageId = destination.droppableId === "unassigned" ? null : destination.droppableId;
    const creator = displayed.find((c) => c.id === draggableId);
    if (!creator) return;
    if (creator.stage?.id === targetStageId) return;

    if (!canMove) {
      toast({
        title: "Cannot move stages",
        description: "Only the assigned owner or a team manager can move stages.",
        variant: "destructive",
      });
      return;
    }

    if (!creator.currentEngagementId) {
      toast({
        title: "No open engagement",
        description: `${creator.name} has no engagement to move.`,
        variant: "destructive",
      });
      return;
    }

    const stage = standardStages.find((s) => s.id === targetStageId);
    setStageOverrides((prev) => ({
      ...prev,
      [draggableId]: stage ? { id: stage.id, name: stage.name } : { id: null, name: null },
    }));

    setBusy(true);
    try {
      const res = await fetch(`/api/engagements/${creator.currentEngagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move-stage", stageId: targetStageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Could not move stage", variant: "destructive" });
        return;
      }
      toast({ title: "Moved", description: `${creator.name} → ${data.stageName}` });
      router.refresh();
    } catch {
      toast({ title: "Could not move stage", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const renderCard = (c: CreatorListItem, index: number) => (
    <Draggable key={c.id} draggableId={c.id} index={index} isDragDisabled={!canMove || busy}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 transition-shadow ${
            snapshot.isDragging ? "drop-shadow-md" : ""
          }`}
        >
          <CreatorCard creator={c} />
        </div>
      )}
    </Draggable>
  );

  const renderColumn = (stage: KanbanStage, isCompleted: boolean) => (
    <Droppable key={stage.id} droppableId={stage.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex min-h-[140px] w-64 shrink-0 flex-col rounded-lg border p-2 transition-colors ${
            snapshot.isDraggingOver ? "border-primary/50 bg-primary/5" : "bg-muted/30"
          }`}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span
              className={`truncate text-xs font-semibold uppercase tracking-wide ${
                isCompleted ? "text-primary" : "text-foreground"
              }`}
            >
              {stage.name}
            </span>
            <Badge variant="secondary" className="px-1.5">
              {creatorsByStage(stage.id).length}
            </Badge>
          </div>
          {creatorsByStage(stage.id).map(renderCard)}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );

  if (stages.length === 0) {
    return (
      <div className="rounded-xl border p-10 text-center text-muted-foreground">
        No pipeline configured yet. Ask an admin to configure stages for this team.
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {standardStages.map((s) => renderColumn(s, false))}
        {completedStages.map((s) => renderColumn(s, true))}
        <Droppable droppableId="unassigned">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`w-64 shrink-0 rounded-lg border border-dashed p-2 transition-colors ${
                snapshot.isDraggingOver ? "border-primary/50 bg-primary/5" : "border-border"
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  No engagement
                </span>
                <Badge variant="secondary" className="px-1.5">
                  {unassigned.length}
                </Badge>
              </div>
              {unassigned.map(renderCard)}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </DragDropContext>
  );
}