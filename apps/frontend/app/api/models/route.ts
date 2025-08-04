import { getModels } from "@/lib/actions/get-models";
import { getUser } from "@/lib/auth/get-user";
import { ModelInfo } from "@repo/types";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const models = await getModels();

    return NextResponse.json(models);
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      [] as ModelInfo[],
      { status: 500 }
    );
  }
} 