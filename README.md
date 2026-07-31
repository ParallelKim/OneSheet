# OneSheet

합주용 한 장 기타 차트 메이커.

송폼 · 코드 · 반복 · 짧은 메모를 한 페이지로 정리하고, 연주/인쇄 모드로 바로 본다.

## 스택

- React + TypeScript + Vite
- Zustand (편집 상태)
- Dexie / IndexedDB (로컬 저장)
- Tailwind CSS
- Firebase Hosting (+ 향후 Auth/Firestore 동기화)

## 로컬 실행

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

## Firebase

1. Firebase 프로젝트 생성 후 `.firebaserc`의 `onesheet-app`을 실제 프로젝트 ID로 변경
2. `.env.example`을 복사해 `.env`에 웹 앱 설정 입력
3. 배포:

```bash
firebase login
npm run deploy:hosting
```

로컬 편집은 Firebase 없이도 Dexie로 동작한다.  
원격 저장은 `src/firebase/sync.ts`에 Firestore 헬퍼를 준비해 두었고, 인증 UI는 다음 단계에서 연결한다.

## 현재 MVP

- 곡 목록 / 생성 / 삭제
- 섹션 추가·정렬·복제·반복
- 마디별 코드 입력 (`bm` → `Bm` 정규화)
- 섹션 메모
- 자동 저장 (IndexedDB)
- 연주/인쇄 뷰 (A4)
