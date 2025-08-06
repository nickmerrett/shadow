import { getUser } from "@/lib/auth/get-user";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  latencyMs?: number;
}

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

    // Forward cookies from the original request
    const requestHeaders = await headers();
    const cookieHeader = requestHeaders.get("cookie");

    const response = await fetch(`${baseUrl}/api/validate-keys`, {
      method: "POST",
      headers: {
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const validationResults = await response.json();
    return NextResponse.json(validationResults);
  } catch (error) {
    console.error("Error validating API keys:", error);
    return NextResponse.json(
      { error: "Failed to validate API keys" },
      { status: 500 }
    );
  }
}