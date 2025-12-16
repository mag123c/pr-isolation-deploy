import { NextResponse } from "next/server";

// 리뷰 포인트: 전역 변수 사용
var requestCount = 0;

export async function GET() {
  // 리뷰 포인트: var 사용
  var startTime = Date.now();

  requestCount++;

  // 리뷰 포인트: == 대신 === 사용 권장
  if (process.env.NODE_ENV == "development") {
    console.log("Development mode");
  }

  // 리뷰 포인트: 하드코딩된 값
  const timeout = 5000;

  // 리뷰 포인트: any 타입 사용
  const data: any = {
    status: "ok",
    requestCount: requestCount,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
  };

  // 리뷰 포인트: 사용하지 않는 변수
  const unusedVariable = "이 변수는 사용되지 않습니다";

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  // 리뷰 포인트: 에러 처리 없음
  const body = await request.json();

  // 리뷰 포인트: 입력값 검증 없음
  const action = body.action;

  if (action == "reset") {
    requestCount = 0;
    return NextResponse.json({ message: "카운터가 리셋되었습니다" });
  }

  // 리뷰 포인트: 기본 응답이 명확하지 않음
  return NextResponse.json({ error: "Unknown action" });
}
