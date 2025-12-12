# PR Preview 환경 구축

## 배경: 현재 문제점

현재 dev 환경이 하나뿐이라, 여러 개발자가 동시에 작업할 때 문제가 발생합니다.

- "지금 배포해도 돼요?" 슬랙 메시지
- 다른 사람 PR 때문에 테스트 환경이 꼬이는 상황
- QA 순서 조율 필요
- FE 스쿼드 분리로 병렬 개발 케이스 증가

## 해결책: PR별 격리된 Preview 환경

PR에 특정 라벨(예: `preview`)을 붙이면, 해당 PR만을 위한 독립된 테스트 환경이 자동 생성됩니다.

```
기존: PR → develop 머지 → dev 환경 (하나뿐)
개선: PR + preview 라벨 → PR별 격리 환경 자동 생성
```

---

## 의사결정 기록

### 1. Vercel vs AWS 직접 구현

| 항목 | Vercel/Netlify | AWS 직접 구현 (선택) |
|------|----------------|---------------------|
| PR Preview 자동화 | 내장 기능 | GitHub Actions 구현 필요 |
| 구현 복잡도 | 낮음 | 중간 |
| **CORS/쿠키 이슈** | 있음 (백엔드 수정 필요) | **없음** (같은 도메인) |
| 기존 인프라 활용 | X | **O** |
| 백엔드 확장 가능성 | 제한적 | **가능** |

**결정: AWS 직접 구현**
- Vercel은 `*.vercel.app` 도메인이라 기존 dev API의 CORS/쿠키 정책 수정 필요
- AWS로 `pr-*.ounwan.net` 구성하면 같은 도메인 체계라 백엔드 수정 없이 적용 가능
- 기존 ECS + ALB 패턴 그대로 활용 → 팀 학습 비용 없음
- 향후 백엔드 PR Preview 확장 가능

### 2. CloudFront 사용 여부

**결정: CloudFront 미사용 (ALB 직접 연결)**
- Preview 환경은 테스트 목적이라 CDN 캐싱 불필요
- CF 배포 동적 생성/삭제는 복잡도 증가
- 비용 절감 + 구현 단순화

### 3. 인프랩 방식과의 차이점

| 항목 | 인프랩 | 우리 |
|------|--------|------|
| 오케스트레이션 | K8s + ArgoCD | ECS + GitHub Actions |
| 라우팅 | Linkerd HTTPRoute (쿠키 기반) | ALB Host 기반 라우팅 |
| 환경 생성 | ApplicationSet Pull Request Generator | GitHub Actions + AWS CLI |

인프랩은 쿠키 기반 라우팅으로 URL 유지하지만, 우리는 단순하게 `pr-{number}.ounwan.net` 서브도메인 방식 채택.

---

## 프론트엔드에서 먼저 시작하는 이유

| 구분 | 백엔드 | 프론트엔드 |
|------|--------|-----------|
| DB/Redis 종속성 | 있음 (동적 프로비저닝 어려움) | 없음 |
| API 연결 | - | 기존 dev API 바라보면 됨 |
| 구현 난이도 | 높음 | 중간 |

프론트엔드는 stateful 인프라 종속성이 없어서, 컨테이너만 PR별로 띄우고 API는 기존 dev 환경을 바라보면 됩니다.

---

## 아키텍처

```
PR + "preview" 라벨
        ↓
GitHub Actions 트리거
        ↓
┌─────────────────────────────────────┐
│ 1. Docker 빌드 → ECR 푸시           │
│ 2. Target Group 생성                │
│ 3. ALB 리스너 규칙 추가              │
│    (Host: pr-{number}.ounwan.net)   │
│ 4. ECS 서비스 생성                   │
│ 5. PR 코멘트에 URL 자동 추가         │
└─────────────────────────────────────┘
        ↓
https://pr-123.ounwan.net 접속 가능
        ↓
PR 닫힘 (머지/클로즈)
        ↓
리소스 자동 정리 (역순)
```

---

## 구현 상세

### Phase 1: AWS 인프라 (1회성 설정)

| 항목 | 설정 | 비고 |
|------|------|------|
| ACM 인증서 | `*.ounwan.net` | 기존 인증서에 와일드카드 포함 여부 확인 |
| Route53 | `*.ounwan.net → ALB` (ALIAS) | 와일드카드 레코드 |
| ALB | `preview-alb` | HTTPS:443, 기본 규칙 503 |
| ECS 클러스터 | `preview-cluster` | Fargate |
| ECR | `preview-web` | 이미지 저장소 |
| IAM | GitHub Actions용 Role | ECS, ELB, ECR 권한 |

### Phase 2: GitHub Actions 워크플로우

**`.github/workflows/pr-preview.yml`**

```yaml
name: PR Preview

on:
  pull_request:
    types: [labeled, closed]

env:
  AWS_REGION: ap-northeast-2
  ECR_REPOSITORY: preview-web
  ECS_CLUSTER: preview-cluster
  DOMAIN: ounwan.net

jobs:
  deploy-preview:
    if: github.event.action == 'labeled' && github.event.label.name == 'preview'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: pr-${{ github.event.number }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            --build-arg NODE_ENV=production \
            --build-arg STAGE=preview \
            --build-arg NUXT_APP_LINK_API_ENDPOINT=link-rest.devpock.com \
            .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

      - name: Create Target Group
        id: create-tg
        run: |
          TG_ARN=$(aws elbv2 create-target-group \
            --name pr-${{ github.event.number }}-tg \
            --protocol HTTP \
            --port 80 \
            --vpc-id ${{ secrets.VPC_ID }} \
            --target-type ip \
            --health-check-path /api/check-health \
            --health-check-interval-seconds 30 \
            --healthy-threshold-count 2 \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text)
          echo "tg_arn=$TG_ARN" >> $GITHUB_OUTPUT

      - name: Add ALB listener rule
        run: |
          aws elbv2 create-rule \
            --listener-arn ${{ secrets.LISTENER_ARN }} \
            --priority ${{ github.event.number }} \
            --conditions "Field=host-header,Values=pr-${{ github.event.number }}.${{ env.DOMAIN }}" \
            --actions "Type=forward,TargetGroupArn=${{ steps.create-tg.outputs.tg_arn }}"

      - name: Create ECS service
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
        run: |
          # Task Definition 등록
          TASK_DEF=$(cat <<EOF
          {
            "family": "pr-${{ github.event.number }}-web",
            "containerDefinitions": [{
              "name": "web",
              "image": "$ECR_REGISTRY/$ECR_REPOSITORY:pr-${{ github.event.number }}",
              "portMappings": [{"containerPort": 80}],
              "environment": [
                {"name": "NUXT_APP_LINK_API_ENDPOINT", "value": "link-rest.devpock.com"},
                {"name": "NUXT_APP_LINK_API_PROTOCOL", "value": "https"},
                {"name": "NUXT_APP_DEPLOY_URL", "value": "pr-${{ github.event.number }}.${{ env.DOMAIN }}"},
                {"name": "NODE_ENV", "value": "production"},
                {"name": "STAGE", "value": "preview"}
              ],
              "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                  "awslogs-group": "/ecs/preview",
                  "awslogs-region": "${{ env.AWS_REGION }}",
                  "awslogs-stream-prefix": "pr-${{ github.event.number }}"
                }
              }
            }],
            "requiresCompatibilities": ["FARGATE"],
            "networkMode": "awsvpc",
            "cpu": "256",
            "memory": "512",
            "executionRoleArn": "${{ secrets.ECS_EXECUTION_ROLE_ARN }}"
          }
          EOF
          )

          TASK_ARN=$(echo $TASK_DEF | aws ecs register-task-definition \
            --cli-input-json file:///dev/stdin \
            --query 'taskDefinition.taskDefinitionArn' \
            --output text)

          # ECS 서비스 생성
          aws ecs create-service \
            --cluster ${{ env.ECS_CLUSTER }} \
            --service-name pr-${{ github.event.number }} \
            --task-definition $TASK_ARN \
            --desired-count 1 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${{ secrets.SUBNET_IDS }}],securityGroups=[${{ secrets.SECURITY_GROUP_ID }}],assignPublicIp=ENABLED}" \
            --load-balancers "targetGroupArn=${{ steps.create-tg.outputs.tg_arn }},containerName=web,containerPort=80"

      - name: Comment PR with preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: ${{ github.event.number }},
              body: '🚀 **Preview 환경 준비 완료!**\n\n' +
                    '🔗 https://pr-${{ github.event.number }}.${{ env.DOMAIN }}\n\n' +
                    '> PR이 닫히면 자동으로 정리됩니다.'
            })

  cleanup-preview:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Delete ECS service
        run: |
          aws ecs update-service \
            --cluster ${{ env.ECS_CLUSTER }} \
            --service pr-${{ github.event.number }} \
            --desired-count 0

          aws ecs delete-service \
            --cluster ${{ env.ECS_CLUSTER }} \
            --service pr-${{ github.event.number }} \
            --force

      - name: Delete ALB rule
        run: |
          RULE_ARN=$(aws elbv2 describe-rules \
            --listener-arn ${{ secrets.LISTENER_ARN }} \
            --query "Rules[?Priority=='${{ github.event.number }}'].RuleArn" \
            --output text)

          if [ -n "$RULE_ARN" ]; then
            aws elbv2 delete-rule --rule-arn $RULE_ARN
          fi

      - name: Delete Target Group
        run: |
          TG_ARN=$(aws elbv2 describe-target-groups \
            --names pr-${{ github.event.number }}-tg \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text 2>/dev/null || echo "")

          if [ -n "$TG_ARN" ] && [ "$TG_ARN" != "None" ]; then
            aws elbv2 delete-target-group --target-group-arn $TG_ARN
          fi

      - name: Deregister task definition
        run: |
          TASK_DEFS=$(aws ecs list-task-definitions \
            --family-prefix pr-${{ github.event.number }}-web \
            --query 'taskDefinitionArns' \
            --output text)

          for TASK_DEF in $TASK_DEFS; do
            aws ecs deregister-task-definition --task-definition $TASK_DEF
          done
```

### Phase 3: GitHub Secrets 설정

| Secret | 설명 |
|--------|------|
| `AWS_ACCESS_KEY_ID` | IAM 액세스 키 |
| `AWS_SECRET_ACCESS_KEY` | IAM 시크릿 키 |
| `VPC_ID` | VPC ID |
| `SUBNET_IDS` | 서브넷 ID (콤마 구분) |
| `SECURITY_GROUP_ID` | 보안 그룹 ID |
| `LISTENER_ARN` | ALB HTTPS 리스너 ARN |
| `ECS_EXECUTION_ROLE_ARN` | ECS Task Execution Role ARN |

---

## 비용 예상

| 리소스 | 예상 비용 |
|--------|----------|
| ALB | ~$16/월 (고정) + LCU 요금 |
| ECS Fargate (256 CPU, 512MB) | ~$0.01/시간/태스크 |
| Route53 호스팅 영역 | ~$0.50/월 |
| ECR | 거의 무료 (소량) |
| CloudWatch Logs | 거의 무료 (소량) |

**PR 1개 하루 운영 시**: ~$0.24

---

## 고려사항

- **ALB 규칙 제한**: 기본 100개 (PR 번호가 priority로 사용되므로 충분)
- **리소스 정리 실패 대비**: 주기적으로 orphan 리소스 확인하는 스크립트 권장
- **동시 PR 수**: Fargate 서비스 할당량 확인 필요 (기본 500개)

---

## 예상 효과

- 동시에 여러 기능을 병렬 테스트 가능
- "지금 배포해도 돼요?" 커뮤니케이션 오버헤드 제거
- QA/디자인 리뷰 시 독립된 환경 제공
- 코드 리뷰 시 실제 동작 확인 가능
- 개발 생산성 향상

---

## 레퍼런스

- [인프랩 기술 블로그: PR Preview 환경 구축](https://tech.inflab.com/20251121-pr-preview/)
  - K8s + ArgoCD + Linkerd 기반 구현
  - 쿠키 기반 라우팅으로 URL 유지

---

> **향후 확장**: 프론트엔드에서 효과 검증 후, 백엔드 PR Preview도 검토 가능.
> (단, DB/Redis 등 stateful 인프라 프로비저닝 전략 필요)
