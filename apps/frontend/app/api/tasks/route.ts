import { auth } from "@/lib/auth";
import { db } from "@repo/db";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await db.task.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        repoUrl: true,
        branch: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ repoUrl: "asc" }, { status: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
