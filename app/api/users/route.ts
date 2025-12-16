import { NextResponse } from "next/server";

// 테스트용 사용자 API
var users: any[] = [];

export async function GET() {
  var result = users;

  if (users.length == 0) {
    console.log("No users found");
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();

  const newUser = {
    id: users.length + 1,
    name: body.name,
    email: body.email,
    createdAt: new Date()
  };

  users.push(newUser);

  return NextResponse.json(newUser);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  users = users.filter(u => u.id != id);

  return NextResponse.json({ message: "User deleted" });
}
