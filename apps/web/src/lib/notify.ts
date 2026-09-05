import "server-only";
import { prisma } from "./prisma";
import { NotificationType } from "@prisma/client";

export async function notify(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });
}

export async function notifyTeamManagerOfTeam(teamId: string, input: {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  const managers = await prisma.user.findMany({
    where: { teamId, archivedAt: null, role: { is: { slug: "team-manager" } } },
  });
  await Promise.all(
    managers.map((m) => notify({ userId: m.id, ...input })),
  );
}