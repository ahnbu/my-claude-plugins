# 사이드바 토글 성능 개선 — grid transition → transform 전환

## 근본 원인

`grid-template-columns`는 GPU 가속 불가능한 Layout 속성이다. 매 transition 프레임마다 모든 자식 DOM을 리플로우하는데, 사이드바(8000+ 노드)는 TOC(200 노드) 대비 40배 많아서 40배 느리다.

| | 사이드바 | TOC |
|---|---|---|
| DOM 노드 수 | ~8,000 | ~200 |
| Transition 속성 | grid-template-columns (Layout) | 동일 |
| GPU 가속 | 불가 | 동일 |
| 프레임당 리플로우 | 8,000 노드 재계산 | 200 노드 재계산 |

## 해결 방향

grid transition 제거 → CSS `transform` 사용.

`grid-template-columns`를 transition하지 않고, 사이드바를 `transform: translateX(-100%)`로 밀어내는 방식. `transform`은 GPU composite-only 속성이라 DOM 크기와 무관하게 빠르다.

### 두 방식 비교

| | grid 크기 변경 (변경 전) | transform 밀어내기 (변경 후) |
|---|---|---|
| 속도 | 내용물 많을수록 느림 | 항상 빠름 |
| 시각 효과 | 자연스러운 축소 | 슬라이드 아웃 |
| 구현 복잡도 | 단순 | JS에서 grid transition을 잠시 꺼야 함 (사이드바만 전환 시) |
| 레이아웃 | 메인 영역이 서서히 넓어짐 | 메인 영역이 즉시 넓어짐 |

핵심 트레이드오프는 "서서히 줄어드는 애니메이션" vs "빠르게 밀려나는 애니메이션". 현재 1000개 세션 목록 규모에서는 전자가 체감상 버벅거리므로 후자를 채택.

## 설계 결정: 사이드바만 vs 둘 다 전환

사이드바만 transform으로 바꾸면 `.app`의 `transition: grid-template-columns`가 TOC용으로 남아있어, 사이드바 토글 시 JS에서 grid transition을 잠시 꺼야 하는 핵이 필요하다.

```javascript
// JS 핵 — 사이드바만 전환 시 필요
app.style.transition = "none";
app.classList.toggle("sidebar-collapsed");
app.offsetHeight; // force reflow
app.style.transition = "";
```

**트레이드오프:**
1. TOC에 영향 가능성 — 사이드바 토글 순간에 TOC도 동시 토글하면 TOC의 grid transition도 꺼진 상태에서 실행. 현실적으로 동시 누르는 경우 없으므로 무시 가능.
2. 코드 복잡도 — `offsetHeight` 강제 리플로우는 흔한 패턴이지만 의도를 모르면 혼란. 주석 필요.
3. 깜빡임 가능성 — transition 꺼진 상태에서 grid 즉시 변경, 메인 영역이 "탁" 넓어짐. 느린 기기에서 미세한 갭 가능.

**결정: 둘 다 transform으로 전환** — grid transition 완전 제거, JS 핵 불필요, 코드 깔끔.

grid transition을 쓰는 곳은 TOC와 사이드바 둘뿐이므로, 둘 다 transform으로 통일하면 `.app`에서 `transition` 속성을 완전히 제거할 수 있다.

## 적용 내용

수정 파일: `my-session-dashboard/index.html`

### 1. `.app`에서 grid transition 제거

```css
/* 삭제 */
.app {
  transition: grid-template-columns 0.2s ease;
}
```

grid 크기 변경은 즉시 적용. 시각적 애니메이션은 각 패널의 transform이 처리.

### 2. `.sidebar`에 transform transition 추가

```css
.sidebar {
  transition: transform 0.2s ease;
  will-change: transform;
}
.app.sidebar-collapsed .sidebar {
  transform: translateX(-100%);
  border-right: none;
}
```

### 3. `.toc-panel`에 transform transition 추가

```css
.toc-panel {
  transition: transform 0.2s ease;
  will-change: transform;
}
.app.toc-collapsed .toc-panel {
  transform: translateX(100%);
}
```

### 4. JS 변경 없음

`toggleSidebar()`, `toggleToc()` 코드 수정 불필요. CSS만으로 해결.

## 검증

1. 빌드 후 브라우저에서 사이드바 접기/펼기 → TOC와 동등한 속도인지 확인
2. TOC 접기와 독립적으로 동작하는지 확인
3. 새로고침 후 상태 유지 확인
