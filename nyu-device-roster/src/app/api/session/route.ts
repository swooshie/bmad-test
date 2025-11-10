import { NextResponse } from "next/server";

import { withSession } from "@/lib/auth/sessionMiddleware";

export const GET = withSession(async (request) => {
  const { email, role } = request.session.user ?? {};

  return NextResponse.json(
    {
      status: "ok",
      manager: {
        email,
        role: (role as string | undefined) ?? "admissions-manager",
      },
    },
    { status: 200 }
  );
});
