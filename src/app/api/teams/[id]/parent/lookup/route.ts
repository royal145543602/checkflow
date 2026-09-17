import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params;
  const { phone } = await request.json();

  if (!phone || typeof phone !== "string") {
    return NextResponse.json({ found: false, message: "请输入电话号码" }, { status: 400 });
  }

  // Find member(s) with matching phone
  const { data: members } = await db.from("members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("phone", phone);

  if (!members || members.length === 0) {
    return NextResponse.json({ found: false, message: "未找到相關記錄" });
  }

  // Get today's records for the first matching member
  const member = members[0];
  const now = new Date();
  const bjNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const todayStr = bjNow.toISOString().split("T")[0];

  const { data: todayRecords } = await db.from("records")
    .select("type, time")
    .eq("member_id", member.id)
    .gte("time", `${todayStr}T00:00:00+08:00`)
    .lte("time", `${todayStr}T23:59:59+08:00`)
    .order("time", { ascending: false });

  // Get recent 7 days records
  const fromStr = new Date(bjNow.getTime() - 6 * 86400000).toISOString().split("T")[0];
  const { data: weekRecords } = await db.from("records")
    .select("type, time")
    .eq("member_id", member.id)
    .gte("time", `${fromStr}T00:00:00.000Z`)
    .lte("time", `${todayStr}T23:59:59.999Z`)
    .order("time", { ascending: true });

  // Determine current status
  const lastRecord = todayRecords?.[0];
  const lastIn = todayRecords?.find((r: any) => r.type === "in");
  const lastOut = todayRecords?.find((r: any) => r.type === "out");
  const status = !lastRecord ? "none" : lastRecord.type === "in" ? "in" : "out";

  // Build recent days array
  const dayMap = new Map<string, { checkIn: string | null; checkOut: string | null }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(bjNow.getTime() - i * 86400000);
    const key = d.toISOString().split("T")[0];
    dayMap.set(key, { checkIn: null, checkOut: null });
  }
  for (const r of weekRecords || []) {
    const date = r.time.split("T")[0];
    if (dayMap.has(date)) {
      if (r.type === "in") dayMap.get(date)!.checkIn = r.time;
      if (r.type === "out") dayMap.get(date)!.checkOut = r.time;
    }
  }

  const recentDays = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, rec]) => ({ date, ...rec }));

  return NextResponse.json({
    found: true,
    child: {
      name: member.name,
      status,
      lastCheckIn: lastIn?.time || null,
      lastCheckOut: lastOut?.time || null,
      recentDays,
    },
  });
}