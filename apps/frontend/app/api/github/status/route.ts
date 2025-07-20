import { getUser } from "@/lib/auth/get-user";
import { getGitHubAccount } from "@/lib/db-operations/get-github-account";
import { getGitHubAppInstallationUrl } from "@/lib/github-app";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if GitHub App is configured
    if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_SLUG) {
      return NextResponse.json({
        isConnected: false,
        isAppInstalled: false,
        installationUrl: null,
        message: "GitHub App not configured",
      });
    }

    const account = await getGitHubAccount(user.id);

    if (!account) {
      return NextResponse.json({
        isConnected: false,
        isAppInstalled: false,
        installationUrl: null,
        message: "GitHub account not connected",
      });
    }

    const isAppInstalled =
      account.githubAppConnected && account.githubInstallationId;

    return NextResponse.json({
      isConnected: true,
      isAppInstalled,
      installationId: account.githubInstallationId,
      installationUrl: !isAppInstalled ? getGitHubAppInstallationUrl() : null,
      message: isAppInstalled
        ? "GitHub App is installed and connected"
        : "GitHub App needs to be installed for full repository access",
    });
  } catch (error) {
    console.error("Error checking GitHub status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
