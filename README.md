# CS3219 — Software Design and Architecture (AY2627 Sem 1)

## Friend on Campus (FoC)

**Friend on Campus (FoC)** is a peer-to-peer campus errand platform where
students can request items to be collected from stores or facilities on
campus, and other students can fulfil (and deliver) those requests. The
platform runs on a closed credit economy — credits cannot be bought,
withdrawn, or exchanged for money, and only circulate within the platform.

---

## Team Members

| Name | Role |
| ----- | ----- |
| Your Name | Your ownership |
| Your Name | Your ownership |
| Your Name | Your ownership |
| Your Name | Your ownership |
| Your Name | Your ownership |

---

## Repository Structure

This repository follows a **one-service-per-folder** structure: each
microservice (`user-service/`, `supplier-service/`, `order-service/`,
`credit-service/`) lives in its own top-level folder.

```text
.
├── user-service/
├── supplier-service/
├── order-service/
├── credit-service/
├── <n2h-service>/
└── README.md
```

- Any **nice-to-have (N2H)** feature that warrants its own service should
  be added as an **additional folder** at the same level, following the
  same per-service structure.
- Files for agentic coding tools (e.g. agent configs, prompts, skills)
  may be added as needed, but must still **respect the
  one-service-per-folder skeleton** for core implementation.

---

## Deployment

FoC is built, tested and deployed by GitHub Actions. For the full setup
(AWS resources, server bootstrap, verification and troubleshooting), see
[CI-CD-SETUP.md](CI-CD-SETUP.md).

- **CI** (`.github/workflows/ci.yml`) runs on every pull request into
  `main`: it builds and tests each service, lints and builds the frontend,
  and checks that every Dockerfile builds.
- **CD** (`.github/workflows/deploy.yml`) runs on every push to `main`: it
  pushes the backend images to Amazon ECR, restarts the Docker Compose stack
  on EC2 (`compose.yaml` + `compose.prod.yaml`, with `gateway/nginx.conf` as
  the API gateway), and publishes the frontend to S3 behind CloudFront.

The deploy workflow reads these repository settings
(**Settings → Secrets and variables → Actions**):

| Variable | Value |
|---|---|
| `AWS_REGION` | `ap-southeast-1` |
| `AWS_ROLE_ARN` | ARN of the IAM role GitHub Actions assumes |
| `S3_BUCKET` | Bucket that holds the frontend build |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID |
| `CLOUDFRONT_DOMAIN` | CloudFront domain, without `https://` |
| `EC2_APP_DIR` | App folder on the server, e.g. `/home/ubuntu/foc` |

| Secret | Value |
|---|---|
| `EC2_HOST` | The server's Elastic IP |
| `EC2_USER` | SSH user, e.g. `ubuntu` |
| `EC2_SSH_KEY` | Private key of the deploy SSH key pair |

The services' own secrets (database passwords, JWT keys, SMTP credentials)
are never stored in GitHub. They live only on the server, written by
`scripts/setup-server-secrets.sh`.

---
