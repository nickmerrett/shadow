import { getModels } from "@/lib/actions/get-models";
import { ModelInfo } from "@repo/types";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const models = await getModels();

    return NextResponse.json(models);
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { models: [] as ModelInfo[] },
      { status: 500 }
    );
  }
} 