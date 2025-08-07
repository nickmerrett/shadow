import { getUser } from "@/lib/auth/get-user";
import { makeBackendRequest } from "@/lib/make-backend-request";
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

    // Forward cookies from the original request
    const requestHeaders = await headers();
    const cookieHeader = requestHeaders.get("cookie");

    const response = await makeBackendRequest(`/api/validate-keys`, {
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
