# PR Preview 환경 요약

> 왜 이렇게 결정했고, 어떻게 더 최적화할 수 있는가

---

## 문제

```
"지금 dev 환경 쓰고 있어요" - 슬랙 메시지
```

- 단일 dev 환경에서 여러 기능 동시 QA 불가
- PR 머지 순서 조율 필요
- 기능별 롤백 어려움

---

## 의사결정

### 왜 ECS + ALB인가?

| 선택지 | 탈락 이유 |
|--------|----------|
| **Vercel** | `*.vercel.app` 도메인 → CORS/쿠키 이슈 → 백엔드 수정 필요 |
| **K8s + Service Mesh** | EKS ~$150/월, 복잡도 높음, 전담 인력 필요 |
| **ECS + ALB** ✅ | 기존 인프라 패턴, 낮은 비용, 빠른 적용 |

### 왜 별도 클러스터인가?

| 선택지 | 결정 이유 |
|--------|----------|
| 기존 link-dev 클러스터 활용 | 리소스 경합, 비용 추적 어려움 |
| **별도 preview-cluster** ✅ | 격리, 비용 명확, 장애 영향 분리 |

### 왜 CodeDeploy 안 쓰는가?

| 선택지 | 결정 이유 |
|--------|----------|
| CodeDeploy (Blue/Green) | Preview는 무중단 배포 불필요, 오버헤드 |
| **직접 ECS API** ✅ | 단순, 빠름, PR 닫으면 바로 삭제 |

---

## 현재 구조

```
PR opened → GitHub Actions → ECR → Target Group → ALB Rule → ECS Service
                                   (pr-N-tg)     (pr-N.domain)  (pr-N)

PR closed → ECS 삭제 → ALB Rule 삭제 → Target Group 삭제
```

**비용:** ~$37/월 (PR 5개 상시 운영 기준)

---

## 최적화 방향

### 1. 즉시 적용 가능

| 항목 | 효과 | 방법 |
|------|------|------|
| **Fargate Spot** | 비용 70% 절감 | `capacityProvider: FARGATE_SPOT` |
| **ECR 이미지 정리** | 저장 비용 절감 | cleanup 워크플로우에 `batch-delete-image` 추가 |
| **기존 ALB 활용** | ALB 비용 제거 (~$16/월) | link-dev ALB에 Rule만 추가 |

### 2. 중기 개선

| 항목 | 상황 | 방법 |
|------|------|------|
| **모노레포 대응** | 여러 앱이 한 레포에 | `dorny/paths-filter`로 변경 감지 → 영향받는 앱만 배포 |
| **자동 만료** | PR 오래 열려있음 | Scheduled workflow로 7일 이상 된 환경 자동 삭제 |
| **ALB 100개 제한** | PR이 많아지면 | 오래된 환경 우선 삭제 로직 |

### 3. 장기 발전

| 조건 | 방향 |
|------|------|
| 개발자 10명+, 예산 $200+/월 | EKS + Argo CD (인프랩 방식) |
| 정적 사이트 PR Preview | S3 + CloudFront (서버리스) |
| 백엔드도 PR Preview | DB/Redis 프로비저닝 전략 필요 |

---

## 비용 요약

### 과금 요소

| 리소스 | 과금 기준 | 비용 |
|--------|----------|------|
| **ALB** | 존재하는 시간 | ~$16/월 (고정) |
| **Fargate** | Task 실행 시간 | ~$0.34/일/PR |
| **ECR** | 저장 용량 | ~$0.10/GB/월 |
| ECS Cluster, Service, Target Group | - | 무료 |

### 시나리오별

| 시나리오 | 월 비용 |
|----------|---------|
| ALB + PR 5개 상시 | ~$68 |
| ALB + QA할 때만 (월 40시간) | ~$19 |
| **기존 ALB 활용 + QA할 때만** | **~$3** |

---

## 한 줄 요약

```
기존 ECS 인프라 패턴 유지 + ALB Host 라우팅으로
PR별 독립 환경을 ~$37/월에 운영.
Fargate Spot 적용 시 ~$20/월로 절감 가능.
```
