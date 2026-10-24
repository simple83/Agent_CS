import { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
} from 'react-router';

import { LoginPage } from './pages/LoginPage'
import { PostListPage } from './pages/PostListPage';
import { PostCreatePage } from './pages/PostCreatePage';
import './App.css'

// 상세 페이지와 작성 미리보기에서 Markdown/하이라이트 청크를 필요할 때 불러온다.
const PostDetailPage = lazy(() =>
  import('./pages/PostDetailPage').then((module) => ({ default: module.PostDetailPage })),
);

/**
 * 공통 메뉴와 URL별 화면을 연결한다. 상세 화면은 지연 로드해 초기 번들 크기를 줄인다.
 * 라우팅 자체는 인증 경계가 아니며 작성 권한은 서비스/서버에서 검증한다.
 */
function App() {

  return (
    <BrowserRouter>
      <nav className="app-nav" aria-label="주요 메뉴">
        <NavLink to="/posts" end>게시글 목록</NavLink>
        <NavLink to="/posts/create">글쓰기</NavLink>
        <NavLink to="/login">로그인</NavLink>
      </nav>
      <Routes>

        <Route
          path="/"
          element={<Navigate to="/posts" replace />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/posts"
          element={<PostListPage />}
        />

        <Route
          path="/posts/create"
          element={<PostCreatePage />}
        />

        <Route
          path="/posts/:postId"
          element={
            <Suspense fallback={<div role="status">게시글 화면을 불러오는 중입니다...</div>}>
              <PostDetailPage />
            </Suspense>
          }
        />
        
      </Routes>
    </BrowserRouter>
  )
}

export default App
