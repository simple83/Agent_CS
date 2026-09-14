import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router';

import { useState } from 'react'
import { LoginPage } from './pages/LoginPage'
import { PostListPage } from './pages/PostListPage';
import { PostCreatePage } from './pages/PostCreatePage';
import { PostDetailPage } from './pages/PostDetailPage';
import './App.css'

function App() {

  return (
    <BrowserRouter>
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
          element={<PostDetailPage />}
        />
        
      </Routes>
    </BrowserRouter>
  )
}

export default App
