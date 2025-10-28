# 멀티플랫폼 크리에이터 허브 (GitHub Pages용)

> GitHub Pages에서 바로 동작하는 **정적 사이트**입니다. (Next.js/서버리스 없이 작동)
> 요청하신 IA/모듈/탭을 반영했고, 데모 데이터와 iCal, 임베드, 검색/태그, 탭 전환, 언어 토글, 브라우저 알림(로컬)을 제공합니다.

## 빠른 시작

1. 이 저장소를 복제하거나 ZIP을 다운로드해 압축 해제합니다.
2. GitHub에서 새 리포지토리를 만들고, 파일 전체를 업로드합니다.
3. **Settings → Pages → Branch**에서 `main`(또는 기본 브랜치) / `/root` 선택 → 저장하면 배포됩니다.
4. `https://<username>.github.io/<repo>/` 로 접속합니다.

> GitHub Pages 호환을 위해 **해시 라우팅(#/...)** 을 사용합니다.

## 구조

```
/
├─ index.html          # SPA 엔트리 (Tailwind CDN)
├─ app.js              # 라우터/렌더러/기능
├─ service-worker.js   # 기본 캐시 (오프라인 베이스라인)
├─ manifest.json
├─ assets/
├─ data/
│  ├─ creators.json    # 크리에이터/플랫폼/대표영상/라이브상태
│  ├─ schedule.json    # 편성표/일정
│  ├─ schedule.ics     # iCal 구독 파일
│  ├─ vods.json        # VOD/클립
│  ├─ teams.json       # 팀/크루
│  ├─ support.json     # 후원/굿즈(탭)
│  └─ notices.json     # 공지/이벤트
├─ config.json         # 데모/키 설정 (client-only)
└─ config.sample.json
```

## 기능 요약 (요청사항 매핑)

- **핵심 화면(IA)**: 홈 / 라이브 허브 / 편성표 / 크리에이터 프로필 / VOD/클립 / 팀 / 후원·굿즈(탭) / 공지
- **멀티 플랫폼 임베드**: YouTube, Twitch, CHZZK, SOOP iframe
- **검색/태그**: VOD 페이지 검색/필터
- **스케줄 iCal**: `data/schedule.ics` 제공 + 페이지에서 커스텀 iCal 생성/다운로드
- **알림(로컬)**: 브라우저 Notification API (Push 서버 없이 데모)
- **실시간 배너**: 상단 LIVE 배너 (데이터 기반)
- **i18n**: KO/EN 토글
- **SEO/OG**: 기본 메타/OG, JSON-LD(Organization). (hash 라우팅 특성상 상세 페이지는 제한)
- **접근성**: 명도 대비/키보드 네비 기본 준수
- **서비스워커**: 정적 캐시 (간단 오프라인)

## 데이터 편집

- `data/*.json` 을 수정하면 즉시 반영됩니다.
- 크리에이터 페이지 대표영상: `creators.json`에 `representativeVideo`(YouTube videoId) 지정
- 라이브 배너: `creators.json`의 `liveStatus.on`이 `true`면 표시

## 플랫폼 연동(선택)

GitHub Pages는 서버가 없어 **폴링/웹훅/비밀키 보호**가 제한됩니다. 가능한 범위:
- **YouTube**: API 키가 노출되므로 *테스트 용도*로만 `config.json`에 넣고 client fetch를 사용하세요.
- **Twitch**: implicit flow로 토큰을 받을 수 있으나 공개 페이지에서 권장되지 않습니다.
- **CHZZK/SOOP**: CORS/토큰 정책에 따라 브라우저 직접 호출이 제한될 수 있습니다.

> 운영 환경에서는 서버리스(Cloudflare/Vercel Functions)로 키를 보호하고 EventSub/Webhook을 처리하는 것을 권장합니다. 이 저장소는 **GitHub Pages에서 바로 동작**하도록 설계되었습니다.

## 라이선스

MIT
