import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: member, error } = await db.from("members").select("id, name, phone, notes").eq("id", id).single();
  if (error || !member) return NextResponse.json({ error: "成员不存在" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, any> = {};
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });
  const { error } = await db.from("members").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await db.from("members").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
