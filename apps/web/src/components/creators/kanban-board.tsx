"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { CreatorListItem, CreatorCard } from "./creator-card";
import { StageChangeDialog, moveStageWithReason } from "./stage-change-dialog";
import { groupCreators, type GroupByKey } from "@/lib/grouping";

export interface KanbanStage {
  id: string;
  name: string;
  order: number;
  isCompleted: boolean;
}

export function KanbanBoard({
  creators,
  stages,
  groupBy = "none",
  onReassigned,
}: {
  creators: CreatorListItem[];
  stages: KanbanStage[];
  groupBy?: GroupByKey;
  onReassigned?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [pendingDrag, setPendingDrag] = React.useState<{ creator: CreatorListItem; stage: KanbanStage } | null>(null);
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
  const stageIds = new Set(stages.map((s) => s.id));
  // Creators whose stage isn't in this team's pipeline, or that have no open
  // engagement to move, land in a read-only "Other stages" bucket.
  const otherMoved = displayed.filter((c) => {
    if (!c.stage) return false;
    if (c.stage.id === "unassigned") return false;
    return !stageIds.has(c.stage.id) || !c.currentEngagementId;
  });
  const otherStageNames = [...new Set(otherMoved.map((c) => c.stage?.name).filter(Boolean))];

  const revertOverride = (creatorId: string) => {
    setStageOverrides((prev) => {
      if (!(creatorId in prev)) return prev;
      const next = { ...prev };
      delete next[creatorId];
      return next;
    });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const targetStageId = destination.droppableId === "unassigned" ? null : destination.droppableId;
    const creator = displayed.find((c) => c.id === draggableId);
    if (!creator) return;
    if (creator.stage?.id === targetStageId) return;

    if (!creator.canMove) {
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
    if (!targetStageId) {
      toast({
        title: "Cannot remove stage",
        description: "An engagement always belongs to a stage.",
        variant: "destructive",
      });
      return;
    }
    const stage = stages.find((s) => s.id === targetStageId);
    if (!stage) return;
    setPendingDrag({ creator, stage });
  };

  const confirmDrag = async (reason: string) => {
    if (!pendingDrag) return;
    const { creator, stage } = pendingDrag;
    setStageOverrides((prev) => ({
      ...prev,
      [creator.id]: { id: stage.id, name: stage.name },
    }));
    setBusy(true);
    const res = await moveStageWithReason(creator.currentEngagementId!, stage.id, reason);
    if (!res.ok) {
      revertOverride(creator.id);
      toast({ title: res.error ?? "Could not move stage", variant: "destructive" });
      setBusy(false);
      return;
    }
    toast({ title: "Moved", description: `${creator.name} → ${res.stageName}` });
    setPendingDrag(null);
    setBusy(false);
    router.refresh();
  };

  // Issue 12: stage dropdowns inside the board update the column immediately.
  const handleCardStageChanged = (creatorId: string, stage: { id: string; name: string } | null) => {
    setStageOverrides((prev) => ({
      ...prev,
      [creatorId]: stage ? { id: stage.id, name: stage.name } : { id: null, name: null },
    }));
  };

  const renderCard = (c: CreatorListItem, index: number) => (
    <Draggable key={c.id} draggableId={c.id} index={index} isDragDisabled={!c.canMove || busy}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 transition-shadow ${snapshot.isDragging ? "drop-shadow-md" : ""}`}
        >
          <CreatorCard
            creator={c}
            onStageChanged={handleCardStageChanged}
            onReassigned={onReassigned}
          />
        </div>
      )}
    </Draggable>
  );

  const renderGrouped = (items: CreatorListItem[]) => {
    if (groupBy === "none") return items.map(renderCard);
    return groupCreators(items, groupBy).map((g) => (
      <div key={g.label} className="mb-2">
        <p className="mb-1 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {g.label}
          <span className="rounded-full border px-1.5 text-[10px] font-medium normal-case">{g.items.length}</span>
        </p>
        {g.items.map((c, gi) => renderCard(c, gi))}
      </div>
    ));
  };

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
          {renderGrouped(creatorsByStage(stage.id))}
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
    <>
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
                {renderGrouped(unassigned)}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          {otherMoved.length > 0 && (
            <div className="w-64 shrink-0 rounded-lg border bg-muted/40 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Other stages
                </span>
                <Badge variant="secondary" className="px-1.5">
                  {otherMoved.length}
                </Badge>
              </div>
              {otherStageNames.length > 0 && (
                <p className="mb-2 px-1 text-[11px] text-muted-foreground">
                  {otherStageNames.join(" · ")}
                </p>
              )}
              {otherMoved.map((c) => (
                <div key={c.id} className="mb-2">
                  <CreatorCard
                    creator={c}
                    onReassigned={onReassigned}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </DragDropContext>
      <StageChangeDialog
        open={pendingDrag !== null}
        onOpenChange={(v) => !v && setPendingDrag(null)}
        title={pendingDrag ? `Move to ${pendingDrag.stage.name}` : "Move to"}
        description={pendingDrag ? `${pendingDrag.creator.name} — recorded on their activity log.` : undefined}
        onConfirm={(reason) => void confirmDrag(reason)}
        busy={busy}
      />
    </>
  );
}