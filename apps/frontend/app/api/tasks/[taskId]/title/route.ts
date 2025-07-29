import { updateTaskTitle } from "@/lib/db-operations/update-task-title";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    const { title } = await request.json();

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 }
      );
    }

    const result = await updateTaskTitle(taskId, title);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update task title" },
        { status: 500 }
      );
    }

    return NextResponse.json({ task: result.task });
  } catch (error) {
    console.error("Error updating task title:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}