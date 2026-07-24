//게시글 목록 조회, 카테고리 변경, 검색 제어

import { useState, useEffect } from 'react';
import { postApi } from '../services/postApi';
import type { PostEntity, PostCategory } from '../types/post.type';

export const usePostList = (initialCategory?: PostCategory) => {
  //상태(State) 정의
  const [posts, setPosts] = useState<PostEntity[]>([]);
  const [currentCategory, setCurrentCategory] = useState<PostCategory | undefined>(initialCategory);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);


  // 비동기 데이터 로드 함수 (Promise 핸들링)
  const fetchPosts = async (category?: PostCategory) => {
    setIsLoading(true);
    setError(null);
    try {
      // 서버 데이터 비동기 대기
      const data = await postApi.getPosts(category);
      setPosts(data); // 성공시 게시글 데이터 상태 업데이트
    } catch (err: any) {
      // 실패시 에러 메시지 보관
      setError(err.message || '게시글 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false); // 성공하든 실패하든 로딩 종료
    }
  };


  // 사용자가 카테고리 탭을 변경할 때 호출할 제어 함수
  const changeCategory = (category: PostCategory | undefined) => {
    setCurrentCategory(category);
    // 카테고리 상태를 바꾸면서 서버에 해당 카테고리 글을 새로 요청
    fetchPosts(category);
  };


  // 컴포넌트가 처음 화면에 나타날 때 자동으로 첫 데이터를 로드
  useEffect(() => {
    fetchPosts(currentCategory);
    // 의존성 배열을 비워두어 처음 켜질 때 한 번만 실행
  }, []);

  
  // Boundary에서 필요한 데이터 반환
  return {
    posts,
    currentCategory,
    isLoading,
    error,
    changeCategory,
    refresh: () => fetchPosts(currentCategory) // 수동 새로고침 함수
  };
};