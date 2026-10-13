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

// Markdown 및 코드 하이라이트 코드는 상세 페이지 진입 시에만 불러온다.
const PostDetailPage = lazy(() =>
  import('./pages/PostDetailPage').then((module) => ({ default: module.PostDetailPage })),
);

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
