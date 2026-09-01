import { useRef, type ChangeEvent, type FormEvent } from 'react';
import { usePostForm } from '../hooks/usePostForm';
import type { PostEntity } from '../types/post.types';

interface PostFormProps {
  onCreated?: (post: PostEntity) => void;
}

export const PostForm = ({ onCreated }: PostFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    title,
    content,
    hashtagInput,
    images,
    isLoading,
    error,
    setTitle,
    setContent,
    setHashtagInput,
    setImages,
    submit,
  } = usePostForm({ onCreated });

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setImages(Array.from(event.target.files ?? []));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const createdPost = await submit();
    if (createdPost && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.title}>새 게시글 작성</h2>

      <label style={styles.field}>
        <span style={styles.label}>제목 *</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isLoading}
          style={styles.input}
        />
      </label>

      <label style={styles.field}>
        <span style={styles.label}>내용 *</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={isLoading}
          rows={8}
          style={styles.textarea}
        />
      </label>

      <label style={styles.field}>
        <span style={styles.label}>해시태그</span>
        <input
          type="text"
          value={hashtagInput}
          onChange={(event) => setHashtagInput(event.target.value)}
          disabled={isLoading}
          placeholder="React, TypeScript, 자료구조"
          style={styles.input}
        />
        <span style={styles.helperText}>쉼표(,)로 여러 태그를 구분합니다.</span>
      </label>

      <label style={styles.field}>
        <span style={styles.label}>이미지</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          disabled={isLoading}
        />
        {images.length > 0 && (
          <span style={styles.helperText}>{images.length}개 파일 선택됨</span>
        )}
      </label>

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" disabled={isLoading} style={styles.submitButton}>
        {isLoading ? '등록 중...' : '게시글 등록'}
      </button>
    </form>
  );
};

const styles = {
  form: {
    width: '100%',
    maxWidth: '720px',
    margin: '0 auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    fontFamily: 'sans-serif',
  },
  title: {
    margin: 0,
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontWeight: 'bold' as const,
    color: '#343a40',
  },
  input: {
    padding: '11px 12px',
    border: '1px solid #ced4da',
    borderRadius: '8px',
    fontSize: '14px',
  },
  textarea: {
    padding: '11px 12px',
    border: '1px solid #ced4da',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  },
  helperText: {
    color: '#868e96',
    fontSize: '12px',
  },
  error: {
    margin: 0,
    color: '#dc3545',
    fontSize: '14px',
  },
  submitButton: {
    padding: '12px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#007bff',
    color: '#fff',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
};
