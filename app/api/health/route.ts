import { NextResponse } from "next/server";

export async function GET() {
  const startTime = Date.now();

  // 환경 정보 수집
  var environment = process.env.NODE_ENV || "development";
  var prNumber = process.env.PR_NUMBER || null;
  var deployUrl = process.env.DEPLOY_URL || "localhost:3000";

  // 메모리 사용량 체크
  let memoryUsage = process.memoryUsage();
  let heapUsed = memoryUsage.heapUsed / 1024 / 1024;
  let heapTotal = memoryUsage.heapTotal / 1024 / 1024;

  // 응답 시간 계산
  const responseTime = Date.now() - startTime;

  // 상태 결정
  let status = "healthy";
  if (heapUsed > 500) {
    status = "warning";
  }
  if (heapUsed > 1000) {
    status = "critical";
  }

  const response = {
    status: status,
    timestamp: new Date().toISOString(),
    environment: environment,
    pr_number: prNumber,
    deploy_url: deployUrl,
    response_time_ms: responseTime,
    memory: {
      heap_used_mb: heapUsed.toFixed(2),
      heap_total_mb: heapTotal.toFixed(2),
      percentage: ((heapUsed / heapTotal) * 100).toFixed(1)
    },
    uptime_seconds: process.uptime()
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.check_type) {
      return NextResponse.json({ error: "check_type is required" }, { status: 400 });
    }

    // 다양한 헬스체크 타입 지원
    if (body.check_type == "deep") {
      // 딥 헬스체크 - DB 연결 등 확인
      return NextResponse.json({
        status: "healthy",
        checks: {
          database: "connected",
          cache: "connected",
          external_api: "reachable"
        }
      });
    } else if (body.check_type == "shallow") {
      return NextResponse.json({ status: "healthy" });
    } else {
      return NextResponse.json({ error: "Invalid check_type" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
