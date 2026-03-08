---
created: 2026-02-18T08:55
title: Create separate assessment portal at assessment.career-9.com
area: general
files:
  - react-social/src/app/pages/StudentOnlineAssessment/
  - react-social/src/app/pages/games/
  - docker-compose.yml
---

## Problem

The assessment flow (student login → assessment taking → completion) is currently embedded in the main Career-Nine React app. It needs to be extracted into a standalone React project hosted at assessment.career-9.com to:
- Optimize for concurrent usage (100+ simultaneous devices)
- Reduce bundle size by only including assessment-related code
- Enable independent deployment and scaling

## Solution

1. **Separate React project** - Extract assessment flow (student login, assessment pages, game renderer, all games) into a new React project
2. **Nginx configuration** - Create configs for both HTTP and HTTPS at assessment.career-9.com
3. **Docker Compose** - Containerized deployment setup
4. **Performance optimization for 100 devices:**
   - Pre-load game how-to videos and assets
   - Asset preloading strategy (service worker / prefetch)
   - Bundle splitting and lazy loading
   - CDN for static assets
   - Connection pooling on backend
5. **Create an implementation plan** before execution
