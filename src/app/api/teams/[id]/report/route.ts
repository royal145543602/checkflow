import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params;
  const { searchParams } = new URL(request.url);

  const now = new Date();
  const from = searchParams.get("from") || new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const to = searchParams.get("to") || now.toISOString().split("T")[0];
  const includeWeekends = searchParams.get("includeWeekends") === "true";

  // Fetch team name
  const { data: team } = await db.from("teams").select("name").eq("id", teamId).single();
  if (!team) return NextResponse.json({ error: "团队不存在" }, { status: 404 });

  // Count weekdays in range
  const startDate = new Date(`${from}T00:00:00`);
  const endDate = new Date(`${to}T23:59:59`);
  let totalDaysCount = 0;
  const allDates: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const day = cursor.getDay();
    const isWeekend = day === 0 || day === 6;
    if (!includeWeekends && isWeekend) { cursor.setDate(cursor.getDate() + 1); continue; }
    totalDaysCount++;
    allDates.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  // Fetch all members
  const { data: members } = await db.from("members")
    .select("id, name")
    .eq("team_id", teamId)
    .order("name");

  if (!members || members.length === 0) {
    return NextResponse.json({ teamName: team.name, from, to, members: [] });
  }

  // Fetch all records in range
  const { data: records } = await db.from("records")
    .select("member_id, type, time")
    .eq("team_id", teamId)
    .gte("time", `${from}T00:00:00.000Z`)
    .lte("time", `${to}T23:59:59.999Z`)
    .order("time", { ascending: true });

  // Group records by member
  const recordsByMember = new Map<string, any[]>();
  for (const r of records || []) {
    if (!recordsByMember.has(r.member_id)) recordsByMember.set(r.member_id, []);
    recordsByMember.get(r.member_id)!.push(r);
  }

  const memberReports = members.map((m: any) => {
    const recs = recordsByMember.get(m.id) || [];
    // Build day map
    const dayMap = new Map<string, { checkIn: string | null; checkOut: string | null }>();
    for (const date of allDates) {
      dayMap.set(date, { checkIn: null, checkOut: null });
    }
    for (const r of recs) {
      const date = r.time.split("T")[0];
      if (dayMap.has(date)) {
        if (r.type === "in") dayMap.get(date)!.checkIn = r.time;
        if (r.type === "out") dayMap.get(date)!.checkOut = r.time;
      }
    }
    let present = 0;
    const days: Array<{ date: string; checkIn: string | null; checkOut: string | null }> = [];
    for (const date of allDates) {
      const d = dayMap.get(date)!;
      days.push({ date, checkIn: d.checkIn, checkOut: d.checkOut });
      if (d.checkIn) present++;
    }
    return {
      name: m.name,
      total: totalDaysCount,
      present,
      rate: totalDaysCount > 0 ? Math.round((present / totalDaysCount) * 100) : 0,
      days,
    };
  });

  return NextResponse.json({
    teamName: team.name,
    from,
    to,
    members: memberReports,
  });
}